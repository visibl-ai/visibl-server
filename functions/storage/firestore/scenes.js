/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
import {
  getFirestore,
  Timestamp} from "firebase-admin/firestore";

import {logger} from "firebase-functions";

import {
  libraryGetFirestore,
} from "./library.js";

import {
  catalogueGetFirestore,
} from "./catalogue.js";

import {
  imageDispatcher,
} from "../../ai/openai/dallE.js";

import {
  getCatalogueDefaultScene,
  storeScenes,
  fileExists,
  getDefaultSceneFilename,
} from "../storage.js";

async function getLibraryScenesFirestore(uid, data, app) {
  const db = getFirestore();
  const {libraryId} = data;
  // Query the Scenes collection for items matching uid and libraryId
  const scenesQuery = await db.collection("Scenes")
      .where("uid", "==", uid)
      .where("libraryId", "==", libraryId)
      .get();

  // If no scenes found, return an empty array
  if (scenesQuery.empty) {
    return [];
  }

  // Map the query results to an array of scene objects
  const scenes = scenesQuery.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  return scenes;
}

async function getGlobalScenesFirestore(uid, data, app) {
  const db = getFirestore();
  const {libraryId, sceneId} = data;
  // return a single scene.
  if (sceneId) {
    const scene = await db.collection("Scenes").doc(sceneId).get();
    return {
      id: scene.id,
      ...scene.data(),
    };
  }
  // Get Catalogue info from library item
  const libraryItem = await libraryGetFirestore(uid, libraryId);
  const {catalogueId} = libraryItem;
  // Query the Scenes collection for items matching uid and libraryId
  const scenesQuery = await db.collection("Scenes")
      .where("catalogueId", "==", catalogueId)
      .get();
  // Map the query results to an array of scene objects
  let scenes = scenesQuery.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  // Filter out duplicate scenes with empty prompts, keeping only one
  const uniqueScenes = scenes.reduce((acc, scene) => {
    if (scene.prompt === "") {
      if (!acc.hasEmptyPrompt) {
        acc.hasEmptyPrompt = true;
        acc.result.push(scene);
      }
    } else {
      acc.result.push(scene);
    }
    return acc;
  }, {hasEmptyPrompt: false, result: []}).result;

  // Replace the original scenes array with the filtered one
  scenes = uniqueScenes;
  return scenes;
}

async function getCatalogueScenesFirestore(uid, data, app) {
  const db = getFirestore();
  const {catalogueId} = data;
  // Query the Scenes collection for items matching uid and libraryId
  const scenesQuery = await db.collection("Scenes")
      .where("uid", "==", uid)
      .where("catalogueId", "==", catalogueId)
      .get();

  // If no scenes found, return an empty array
  if (scenesQuery.empty) {
    return [];
  }

  // Map the query results to an array of scene objects
  const scenes = scenesQuery.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  return scenes;
}

async function scenesCreateLibraryItemFirestore(uid, data, app) {
  const db = getFirestore();
  const {libraryId, prompt, userDefault} = data;
  let {chapter} = data;
  if (chapter === undefined) {
    chapter = 0;
  }
  // Check if prompt is undefined or an empty string
  if (prompt === undefined) {
    throw new Error("Prompt cannot be undefined");
  }

  // Check if userDefault is undefined
  if (userDefault === undefined) {
    throw new Error("userDefault must be specified");
  }

  // Check if libraryId is undefined
  if (libraryId === undefined) {
    throw new Error("libraryId must be specified");
  }

  // Ensure userDefault is a boolean
  const isUserDefault = Boolean(userDefault);

  const scenesRef = db.collection("Scenes");

  // Check if a scene with the same libraryId and prompt already exists
  const existingSceneQuery = await scenesRef
      .where("uid", "==", uid)
      .where("libraryId", "==", libraryId)
      .where("prompt", "==", prompt)
      .get();

  if (!existingSceneQuery.empty) {
    throw new Error("A scene with the same libraryId and prompt already exists");
  }

  // If userDefault is true, update all existing scenes for this libraryId to false
  if (isUserDefault) {
    await scenesUpdateUserLibraryDefaultFirestore(db, uid, scenesRef, libraryId);
  }

  const {catalogueId: catalogueId} = await libraryGetFirestore(uid, libraryId);
  logger.debug(`Creating scene for catalogueId: ${catalogueId}`);
  const {sku: sku} = await catalogueGetFirestore(catalogueId);

  const newScene = {
    uid,
    libraryId,
    prompt,
    userDefault,
    catalogueId,
    sku,
    createdAt: Timestamp.now(),
  };

  const newSceneRef = await scenesRef.add(newScene);
  logger.debug(`Created new scene for libraryId: ${libraryId} with id: ${newSceneRef.id}`);
  // Dispatch long running task to generate scenes..
  const defaultExist = await fileExists(app, getDefaultSceneFilename(sku));
  if (defaultExist) {
    const defaultScenes = await getCatalogueDefaultScene(app, sku);
    await storeScenes(app, newSceneRef.id, defaultScenes);
    await imageDispatcher({
      sceneId: newSceneRef.id,
      lastSceneGenerated: 0,
      totalScenes: defaultScenes[chapter].length,
      chapter: chapter,
    });
  } else {
    logger.debug(`No default scenes found for sku: ${sku}, skipping for now...`);
  }
  return {id: newSceneRef.id, ...newScene};
}


/**
 * Updates the user default status for scenes in a user's library.
 *
 * This function is used to manage the default scene for a specific library item.
 * When setting a scene as the default, it ensures that only one scene is marked
 * as default for the given library item by updating all other scenes to non-default.
 *
 * @param {FirebaseFirestore.Firestore} db - The Firestore database instance.
 * @param {string} uid - The user ID.
 * @param {FirebaseFirestore.CollectionReference} scenesRef - Reference to the Scenes collection.
 * @param {string} libraryId - The ID of the library item.
 * @param {string} [sceneId] - Optional. The ID of the scene being set as default.
 *                             If provided, this scene will be excluded from the update.
 * @returns {Promise<void>} A promise that resolves when the update is complete.
 */

// Function explanation:
// The scenesUpdateUserLibraryDefaultFirestore function is responsible for maintaining
// the consistency of the default scene status within a user's library. It performs
// the following tasks:
//
// 1. It queries the Firestore database for all scenes that belong to the specified
//    user (uid) and library item (libraryId) that are currently marked as default.
//
// 2. It creates a batch write operation to efficiently update multiple documents
//    in a single atomic transaction.
//
// 3. For each scene found in the query (except for the optionally specified sceneId),
//    it updates the 'userDefault' field to false.
//
// 4. Finally, it commits the batch operation, applying all updates atomically.
//
// This function is typically called when a new scene is being set as the default
// for a library item, ensuring that only one scene can be the default at any time.
// The optional sceneId parameter allows the function to exclude a specific scene
// from being updated, which is useful when that scene is being set as the new default.
async function scenesUpdateLibraryItemFirestore(uid, data, app) {
  const db = getFirestore();
  const {libraryId, sceneId, userDefault} = data;
  if (!libraryId || !sceneId) {
    throw new Error("libraryId and sceneId are required");
  }

  if (userDefault === undefined) {
    throw new Error("userDefault must be specified");
  }

  // Ensure userDefault is a boolean
  const isUserDefault = Boolean(userDefault);

  const scenesRef = db.collection("Scenes");

  // Get the scene to update
  const sceneToUpdate = await scenesRef.doc(sceneId).get();

  if (!sceneToUpdate.exists) {
    throw new Error("Scene not found");
  }

  const sceneData = sceneToUpdate.data();

  // Check if the scene belongs to the user and library
  if (sceneData.uid !== uid || sceneData.libraryId !== libraryId) {
    throw new Error("Unauthorized to update this scene");
  }

  // If setting as default, update all other scenes for this libraryId to non-default
  if (isUserDefault) {
    await scenesUpdateUserLibraryDefaultFirestore(db, uid, scenesRef, libraryId, sceneId);
  }
  await sceneToUpdate.ref.update({userDefault: isUserDefault});
  // Return the updated scene data
  return {
    id: sceneId,
    ...sceneData,
    userDefault: isUserDefault,
  };
}

async function scenesUpdateUserLibraryDefaultFirestore(db, uid, scenesRef, libraryId, sceneId) {
  const batch = db.batch();
  const existingScenesQuery = await scenesRef
      .where("uid", "==", uid)
      .where("libraryId", "==", libraryId)
      .where("userDefault", "==", true)
      .get();

  existingScenesQuery.forEach((doc) => {
    if (doc.id !== sceneId) {
      batch.update(doc.ref, {userDefault: false});
    }
  });

  await batch.commit();
}

async function getSceneFirestore(sceneId) {
  const db = getFirestore();
  const scene = await db.collection("Scenes").doc(sceneId).get();
  return {
    id: scene.id,
    ...scene.data(),
  };
}

async function sceneUpdateChapterGeneratedFirestore(sceneId, chapter, generated, updatedAt) {
  const db = getFirestore();
  const sceneRef = db.collection("Scenes").doc(sceneId);

  const scene = await sceneRef.get();
  if (!scene.exists) {
    throw new Error("Scene not found");
  }

  const data = scene.data();
  if (!data.chapters) {
    data.chapters = {};
  }
  data.chapters[chapter] = {
    imagesGenerated: generated,
    updatedAt,
  };

  await sceneRef.update({chapters: data.chapters});

  // Return the updated data
  return {
    id: scene.id,
    ...data,
    chapters: data.chapters, // Ensure we return the updated chapters
  };
}

export {
  getLibraryScenesFirestore,
  getGlobalScenesFirestore,
  scenesCreateLibraryItemFirestore,
  scenesUpdateLibraryItemFirestore,
  getCatalogueScenesFirestore,
  getSceneFirestore,
  sceneUpdateChapterGeneratedFirestore,
};
