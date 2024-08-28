/* eslint-disable require-jsdoc */

import {
  getFirestore} from "firebase-admin/firestore";
import {
  getCatalogueDefaultScene,
  storeScenes,
  getScene,
  fileExists,
  getDefaultSceneFilename,
  getSceneFilename,
} from "./storage.js";
import {logger} from "firebase-functions/v2";
import {libraryGetFirestore} from "./firestore/library.js";
import {catalogueGetFirestore} from "./firestore/catalogue.js";

import {
  dispatchTask,
  // dataToBody,
} from "../util/dispatch.js";

/**
 * Adds a new user to the Firestore database.
 *
 * @param {string} user - The user object from firestor auth.
 */
async function saveUser(user) {
  await getFirestore().collection("Users").doc(user.uid).set(user);
}


/**
 * Retrieves a user from the Firestore database by their unique identifier.
 *
 * @param {string} uid - The unique identifier of the user to retrieve.
 * @return {Promise<FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>>}
 * A promise that resolves to the document snapshot of the user.
 */
async function getUser(uid) {
  const snapshot = await getFirestore().collection("Users").doc(uid).get();
  return snapshot.exists ? snapshot.data() : null;
}

/**
 * Creates a new pipeline in the Firestore database.
 *
 * @param {object} data - The data of the pipeline to be stored.
 * @return {Promise<object>} A promise that resolves to the full document data of the newly created pipeline.
 */
async function createPipelineFirestore(data) {
  // Remove any undefined properties from data
  data = removeUndefinedProperties(data);
  const docRef = getFirestore().collection("Pipelines").doc(); // Create a document reference
  await docRef.set({...data}); // Set the data
  const snapshot = await docRef.get(); // Get the document snapshot
  const r = snapshot.data();
  r.id = snapshot.id; // Add the document ID to the data
  return r; // Return the full document data with ID
}

/**
 * Retrieves a pipeline from the Firestore database based on the provided UID and pipeline data.
 *
 * @param {string} uid - The unique identifier of the user.
 * @param {object} data - The data containing the pipeline ID to be retrieved.
 * @return {Promise<object>} A promise that resolves to the pipeline data if found, otherwise null.
 */
async function getPipelineFirestore(uid, data) {
  const id = data.id;
  const snapshot = await getFirestore().collection("Pipelines").doc(id).get();
  const pipelineData = snapshot.data();
  if (pipelineData && pipelineData.uid === uid) {
    pipelineData.id = snapshot.id; // Add the document ID to the data
    return pipelineData; // Return the full document data with ID
  } else {
    return {error: "Pipeline not found"}; // Return error if there is no match
  }
}

/**
 * Creates a new pipeline in the Firestore database.
 *
 * @param {string} id - The unique identifier of the pipeline to be updated.
 * @param {object} data - The data of the pipeline to be stored.
 * @return {Promise<object>} A promise that resolves to the full document data of the newly created pipeline.
 */
async function updatePipelineFirestore(id, data) {
  const docRef = getFirestore().collection("Pipelines").doc(id); // Create a document reference
  await docRef.update(data); // Update the data
  const snapshot = await docRef.get(); // Get the document snapshot
  const r = snapshot.data();
  r.id = snapshot.id; // Add the document ID to the data
  return r; // Return the full document data with ID
}

/**
 * Removes undefined properties from an object.
 *
 * This function iterates over all properties of the given object and deletes any property
 * that has a value of undefined. This is useful for cleaning up objects before saving them
 * to a database where undefined values may not be allowed.
 *
 * @param {object} data - The object from which to remove undefined properties.
 * @return {object} The cleaned object with all undefined properties removed.
 */
function removeUndefinedProperties(data) {
  // Remove any undefined properties from data
  Object.keys(data).forEach((key) => {
    if (data[key] === undefined) {
      delete data[key];
    }
  });
  return data;
}

/**
 * Retrieves AI-generated content based on a library item.
 *
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing the libraryId.
 * @return {Promise<object>} A promise that resolves to the AI-generated content.
 */
async function getAiFirestore(uid, data) {
  let {libraryId, sceneId, chapter, currentTime} = data;
  logger.debug(`Getting AI for ${uid} to libraryId ${libraryId} sceneId ${sceneId} chapter ${chapter} and currentTime ${currentTime}`);
  if (!libraryId) {
    throw new Error("Invalid or missing libraryId");
  }

  const libraryData = await libraryGetFirestore(uid, libraryId);
  if (!libraryData) {
    logger.debug(`Library item with id ${libraryId} not found`);
    logger.debug(`Library item data: ${typeof data === "object" ? JSON.stringify(data) : data}`);
    throw new Error("Library item not found");
  }

  if (libraryData.uid !== uid) {
    logger.debug(`Unauthorized access to library item for ${uid} to ${JSON.stringify(libraryData)}`);
    throw new Error("Unauthorized access to library item");
  }

  const {catalogueId} = libraryData;
  if (!catalogueId) {
    throw new Error("CatalogueId not found in library item");
  }

  if (!sceneId && libraryData.defaultSceneId) {
    logger.debug(`Using default library sceneId ${libraryData.defaultSceneId} for libraryId ${libraryId}`);
    sceneId = libraryData.defaultSceneId;
  } else if (!sceneId) {
    const catalogueItem = await catalogueGetFirestore(catalogueId);
    logger.debug(`Using default catalogue sceneId ${catalogueItem.defaultSceneId} for catalogueId ${catalogueId}`);
    sceneId = catalogueItem.defaultSceneId;
  }

  // Retrieve the scenes data for the catalogueId
  let scenes;
  try {
    scenes = await getUserLibraryScene({libraryData, sceneId});
  } catch (error) {
    logger.error(`Error retrieving scenes for libraryId ${libraryId}:`, error);
    throw new Error("Failed to retrieve scenes data");
  }

  if (scenes.error) {
    throw new Error("No scenes data found for the given libraryId");
  }

  if (currentTime) {
    logger.debug(`Generating scenes starting at currentTime: ${currentTime}`);
    await dispatchTask("generateSceneImagesCurrentTime",
        {sceneId, currentTime},
    );
  }
  logger.debug(`Returning scenes: ${JSON.stringify(scenes).substring(0, 150)}`);
  if (chapter) {
    return scenes[chapter];
  } else {
    return scenes;
  }
}

async function getUserLibraryScene(params) {
  const {libraryData, sceneId} = params;
  const sku = libraryData.sku;
  // Check if the default scene exists.
  const exists = await fileExists({path: getSceneFilename(sceneId)});
  logger.debug(`Scenes for ${sceneId} exists: ${exists} ${typeof exists}`);
  if (!exists) {
    logger.warn(`Scenes for ${sceneId} not found in Firestore, will try to copy now.`);
    logger.debug(`Checking for catalogue scenes for ${sku}`);
    const defaultExist = await fileExists({path: getDefaultSceneFilename({sku})});
    logger.debug(`Catalogue scenes for ${sku} exist: ${defaultExist}`);
    if (defaultExist) {
      logger.debug(`Copying default catalogue scenes for ${sku}`);
      await storeScenes({sceneId: sceneId, sceneData: await getCatalogueDefaultScene({sku})});
    } else {
      logger.warn(`Default scene ${sceneId} not found in Firestore, and catalogue scenes not found.`);
      return {error: "Scenes not found - likely still being generatred"};
    }
  } else {
    logger.debug(`Scenes exist for ${sceneId} - will return that.`);
  }

  return await getScene({sceneId: sceneId});
}

export {
  saveUser,
  getUser,
  createPipelineFirestore,
  updatePipelineFirestore,
  getPipelineFirestore,
  getAiFirestore,
  removeUndefinedProperties,
};
