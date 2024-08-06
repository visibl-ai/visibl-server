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
  return {id: newSceneRef.id, ...newScene};
}


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

export {
  getLibraryScenesFirestore,
  scenesCreateLibraryItemFirestore,
  scenesUpdateLibraryItemFirestore,
  getCatalogueScenesFirestore,
};
