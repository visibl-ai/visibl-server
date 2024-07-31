/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
import {
  getFirestore,
  Timestamp} from "firebase-admin/firestore";
import {
  removeUndefinedProperties,
} from "../firestore.js";
import {logger} from "firebase-functions/v2";

/**
 * Adds an item from the Catalogue to the user's Library in Firestore.
 *
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing the catalogueId of the item to be added.
 * @param {object} app - The Firebase app instance.
 * @return {Promise<object>} A promise that resolves to the added library item.
 */
async function addItemToLibraryFirestore(uid, data, app) {
  if (!data.catalogueId) {
    throw new Error("Catalogue ID is required");
  }

  const db = getFirestore();
  const libraryRef = db.collection("Library");

  // Check for duplicates
  const existingItem = await libraryRef
      .where("uid", "==", uid)
      .where("catalogueId", "==", data.catalogueId)
      .get();

  if (!existingItem.empty) {
    logger.info(`Item with catalogueId ${data.catalogueId} already exists in user ${uid}'s library`);
    return {
      id: existingItem.docs[0].id,
      ...existingItem.docs[0].data(),
    };
  }

  // Add the new item to the Library
  const newItem = {
    uid: uid,
    catalogueId: data.catalogueId,
    addedAt: new Date(),
  };

  const docRef = await libraryRef.add(newItem);
  const addedDoc = await docRef.get();

  // Create a new scene for the library item
  const sceneData = await addLibraryItemScenesFirestore(uid, {
    libraryId: addedDoc.id,
    prompt: "",
    userDefault: true,
  }, app);
  try {
    await storeUserScenes(app, uid, addedDoc.id, sceneData.id, await getCatalogueScenes(app, data.catalogueId));
  } catch (error) {
    logger.error(`Error storing user scenes for library item ${addedDoc.id}:`, error);
  }

  return {
    id: addedDoc.id,
    ...addedDoc.data(),
  };
}

async function addLibraryItemScenesFirestore(uid, data, app) {
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
    await updateUserLibraryDefault(db, uid, scenesRef, libraryId);
  }

  const newScene = {
    uid,
    libraryId,
    prompt,
    userDefault,
    createdAt: Timestamp.now(),
  };

  const newSceneRef = await scenesRef.add(newScene);
  return {id: newSceneRef.id, ...newScene};
}
