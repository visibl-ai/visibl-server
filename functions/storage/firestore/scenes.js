/* eslint-disable valid-jsdoc */
/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
import {
  getFirestore,
  Timestamp,
  FieldPath} from "firebase-admin/firestore";

import logger from "../../util/logger.js";

import {
  libraryGetFirestore,
} from "./library.js";

import {
  catalogueGetFirestore,
} from "./catalogue.js";

import {
  imageDispatcher,
} from "../../ai/imageGen.js";

import {
  getCatalogueDefaultScene,
  storeScenes,
  fileExists,
  getDefaultSceneFilename,
} from "../storage.js";

import {
  dispatchTask,
  dataToBody,
} from "../../util/dispatch.js";

import {
  geminiRequest,
} from "../../ai/gemini/gemini.js";

// Global in this context is that scenes are not unique to users.
async function getGlobalScenesFirestore(uid, data) {
  const db = getFirestore();
  const {libraryId, sceneId} = data;
  // Get Catalogue info from library item
  const libraryItem = await libraryGetFirestore(uid, libraryId);
  const defaultScene = libraryItem.defaultSceneId;
  // return a single scene.
  if (sceneId) {
    const scene = await db.collection("Scenes").doc(sceneId).get();
    const sceneData = scene.data();
    if (sceneId === defaultScene) {
      sceneData.userDefault = true;
    } else {
      sceneData.userDefault = false;
    }
    return {
      id: scene.id,
      ...sceneData,
    };
  }

  const {catalogueId} = libraryItem;
  // Query the Scenes collection for items matching uid and libraryId
  const scenesQuery = await db.collection("Scenes")
      .where("catalogueId", "==", catalogueId)
      .orderBy(FieldPath.documentId(), "desc")
      .get();
  // Map the query results to an array of scene objects
  let scenes = scenesQuery.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  // Filter out duplicate scenes with empty prompts, keeping only one
  const uniqueScenes = scenes.reduce((acc, scene) => {
    const sceneWithDefault = {
      ...scene,
      userDefault: scene.id === defaultScene,
    };
    if (scene.prompt === "") {
      if (!acc.hasEmptyPrompt) {
        acc.hasEmptyPrompt = true;
        acc.result.push(sceneWithDefault);
      }
    } else {
      acc.result.push(sceneWithDefault);
    }
    return acc;
  }, {hasEmptyPrompt: false, result: []}).result;


  // Replace the original scenes array with the filtered one
  scenes = uniqueScenes;
  return scenes;
}

async function getCatalogueScenesFirestore(data) {
  const db = getFirestore();
  const {catalogueId} = data;
  // Query the Scenes collection for items matching uid and libraryId
  const scenesQuery = await db.collection("Scenes")
      .where("catalogueId", "==", catalogueId)
      .orderBy(FieldPath.documentId(), "desc")
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

async function scenesCreateItemFirestore(uid, data) {
  const db = getFirestore();
  let {libraryId, prompt, userDefault, currentTime} = data;
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
    userDefault = false;
  }

  // Check if libraryId is undefined
  if (libraryId === undefined) {
    throw new Error("libraryId must be specified");
  }
  // Check if prompt is an object
  let sanitizedPrompt = {};
  // IN TESTS - we can pass in a prompt object for testing.
  if (typeof prompt === "object" && prompt !== null) {
    // If prompt is already an object, use it as is
    sanitizedPrompt.result = prompt;
  } else {
    sanitizedPrompt = await geminiRequest({
      prompt: "convertThemeToPrompt",
      message: prompt,
      replacements: [],
    });
  }
  if (sanitizedPrompt.result) {
    sanitizedPrompt = sanitizedPrompt.result;
    logger.debug(`Sanitized prompt ${sanitizedPrompt.title}:${sanitizedPrompt.prompt} from ${prompt}`);
  } else {
    logger.error(`No sanitized prompt found for ${sanitizedPrompt}`);
    throw new Error("No sanitized prompt found");
  }

  const {catalogueId: catalogueId} = await libraryGetFirestore(uid, libraryId);
  // Ensure userDefault is a boolean
  const isUserDefault = Boolean(userDefault);

  const scenesRef = db.collection("Scenes");

  // Check if a scene with the same libraryId and prompt already exists
  const existingSceneQuery = await scenesRef
      .where("catalogueId", "==", catalogueId)
      .where("prompt", "==", prompt)
      .get();

  if (!existingSceneQuery.empty) {
    logger.warn(`A scene with the same prompt already exists for ${catalogueId} and prompt: ${prompt}`);
    return {id: existingSceneQuery.docs[0].id, ...existingSceneQuery.docs[0].data()};
  }
  logger.debug(`Creating scene for catalogueId: ${catalogueId}`);
  const {sku: sku} = await catalogueGetFirestore(catalogueId);

  const newScene = {
    uid,
    prompt: sanitizedPrompt.prompt,
    title: sanitizedPrompt.title,
    catalogueId,
    sku,
    createdAt: Timestamp.now(),
  };

  const newSceneRef = await scenesRef.add(newScene);
  logger.debug(`Created new scene for catalogueId: ${catalogueId} with id: ${newSceneRef.id}`);
  // Dispatch long running task to generate scenes..
  const defaultExist = await fileExists({path: getDefaultSceneFilename({sku})});
  if (defaultExist) {
    const defaultScenes = await getCatalogueDefaultScene({sku});
    await storeScenes({sceneId: newSceneRef.id, sceneData: defaultScenes});
    // Default scenes exist for this item. Lets start generating images for the current time.
    if (currentTime) {
      logger.debug(`New Scene: currentTime found, generating scenes at currentTime: ${currentTime}`);
      await dispatchTask("generateSceneImagesCurrentTime",
          {sceneId: newSceneRef.id, currentTime});
    } else {
      logger.debug(`New Scene: No currentTime found, generating full chapter.`);
      await imageDispatcher({
        sceneId: newSceneRef.id,
        lastSceneGenerated: 0,
        totalScenes: defaultScenes[chapter].length,
        chapter: chapter,
      });
    }
  } else {
    logger.debug(`No default scenes found for sku: ${sku}, skipping for now...`);
  }
  // If userDefault is true, update all existing scenes for this libraryId to false
  if (isUserDefault) {
    await scenesUpdateUserLibraryDefaultFirestore({db, uid, libraryId, sceneId: newSceneRef.id});
  }
  return {id: newSceneRef.id, ...newScene};
}

async function scenesCreateDefaultCatalogueFirestore(data) {
  const db = getFirestore();
  const {catalogueId, sku} = data;
  if (!catalogueId || !sku) {
    throw new Error("catalogueId and sku are required");
  }
  const prompt = "";
  const title = "Origin";
  const uid = "admin";
  const scenesRef = db.collection("Scenes");

  // Check if a scene with the same libraryId and prompt already exists
  const existingSceneQuery = await scenesRef
      .where("catalogueId", "==", catalogueId)
      .where("globalDefault", "==", true)
      .get();

  if (!existingSceneQuery.empty) {
    logger.error(`A global default scene already exists for catalogueId: ${catalogueId} with sceneId: ${existingSceneQuery.docs[0].id}`);
    return {
      id: existingSceneQuery.docs[0].id,
      ...existingSceneQuery.docs[0].data(),
    };
  }
  logger.debug(`Creating scene for catalogueId: ${catalogueId}`);

  const newScene = {
    uid,
    prompt,
    title,
    catalogueId,
    sku,
    globalDefault: true,
    createdAt: Timestamp.now(),
  };

  const newSceneRef = await scenesRef.add(newScene);
  logger.debug(`Created new scene for catalogueId: ${catalogueId} with id: ${newSceneRef.id}`);
  // Dispatch long running task to generate scenes..
  const defaultExist = await fileExists({path: getDefaultSceneFilename({sku})});
  if (defaultExist) {
    const defaultScenes = await getCatalogueDefaultScene({sku});
    await storeScenes({sceneId: newSceneRef.id, sceneData: defaultScenes});
  } else {
    logger.debug(`No default scenes found for sku: ${sku}, skipping for now...`);
  }
  return {id: newSceneRef.id, ...newScene};
}


/*
 * This should be moved to the library handler. It is not scene related.
 */
async function scenesUpdateLibraryItemFirestore(uid, data) {
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

  // If setting as default, update all other scenes for this libraryId to non-default
  if (isUserDefault) {
    return await scenesUpdateUserLibraryDefaultFirestore({db, uid, libraryId, sceneId});
  }
  // Return the updated scene data
  logger.error(`Someone called update scene default without setting it to default`);
  return {};
}

// Update the library item to set the scene as the default.
async function scenesUpdateUserLibraryDefaultFirestore(params) {
  const {db, uid, libraryId, sceneId} = params;
  const libraryRef = db.collection("Library").doc(libraryId);

  // Update the defaultSceneId field
  await libraryRef.update({defaultSceneId: sceneId});

  // Fetch the updated library item
  const updatedLibraryItem = await libraryRef.get();

  return {
    id: libraryId,
    ...updatedLibraryItem.data(),
  };
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
  getGlobalScenesFirestore,
  scenesCreateItemFirestore,
  scenesUpdateLibraryItemFirestore,
  getCatalogueScenesFirestore,
  getSceneFirestore,
  sceneUpdateChapterGeneratedFirestore,
  scenesCreateDefaultCatalogueFirestore,
};
