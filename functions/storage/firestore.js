/* eslint-disable require-jsdoc */

import {
  getFirestore} from "firebase-admin/firestore";
import {
  getCatalogueDefaultScene,
  storeScenes,
  getScene,
  fileExists,
} from "./storage.js";
import {logger} from "firebase-functions/v2";
import {libraryGetFirestore} from "./firestore/library.js";

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
 * @param {object} app - The Firebase app instance.
 * @return {Promise<object>} A promise that resolves to the AI-generated content.
 */
async function getAiFirestore(uid, data, app) {
  const {libraryId, sceneId, chapter} = data;

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

  // Retrieve the scenes data for the catalogueId
  let scenes;
  try {
    scenes = await getUserLibraryScene(app, uid, libraryId, sceneId, chapter);
  } catch (error) {
    logger.error(`Error retrieving scenes for libraryId ${libraryId}:`, error);
    throw new Error("Failed to retrieve scenes data");
  }

  if (!scenes) {
    throw new Error("No scenes data found for the given libraryId");
  }

  // Here you would typically process the catalogueManifest and generate AI content
  // For now, we'll return a placeholder response
  return scenes;
}

// async function createLibraryScenesFirestore(uid, data, app) {
//   const db = getFirestore();
//   // eslint-disable-next-line prefer-const
//   let {libraryId, prompt, userDefault} = data;
//   if (!libraryId) {
//     throw new Error("Both libraryId and prompt are required");
//   }
//   // Set userDefault to false if it's undefined
//   if (prompt === undefined) {
//     throw new Error("Prompt cannot be undefined");
//   }
//   userDefault === undefined ? false : userDefault;
//   const scenesRef = db.collection("Scenes");

//   // Check for existing scene
//   const existingScene = await scenesRef
//       .where("uid", "==", uid)
//       .where("libraryId", "==", libraryId)
//       .where("prompt", "==", prompt)
//       .limit(1)
//       .get();

//   if (!existingScene.empty) {
//     const existingSceneData = existingScene.docs[0].data();
//     return {id: existingScene.docs[0].id, ...existingSceneData};
//   }


//   // Create new scene if not exists
//   const newScene = {
//     uid,
//     libraryId,
//     prompt,
//     userDefault,
//     createdAt: Timestamp.now(),
//   };
//   const newSceneRef = await scenesRef.add(newScene);
//   if (userDefault) {
//     await scenesUpdateUserLibraryDefaultFirestore(db, uid, newSceneRef, libraryId, newSceneRef.id);
//   }
//   return {id: newSceneRef.id, ...newScene};
// }

async function getUserLibraryScene(app, uid, libraryId, sceneId, chapter) {
  const db = getFirestore();
  let sceneToFetch;
  // We're told what scene to get.
  if (sceneId) {
    const sceneRef = db.collection("Scenes").doc(sceneId);
    const scene = await sceneRef.get();

    if (!scene.exists || scene.data().uid !== uid) {
      throw new Error("Scene not found or does not belong to the user");
    }

    sceneToFetch = sceneId;
  } else {
    // No scene Id given. Get the default scene.
    logger.debug(`Getting default scene for ${uid} to ${libraryId}`);
    const defaultSceneQuery = await db.collection("Scenes")
        .where("uid", "==", uid)
        .where("libraryId", "==", libraryId)
        .where("userDefault", "==", true)
        .limit(1)
        .get();

    if (defaultSceneQuery.empty) {
      logger.debug(`No default scene found for ${uid} to ${libraryId}`);
      throw new Error("No default scene found for this library item");
    }

    sceneToFetch = defaultSceneQuery.docs[0].id;
    const libraryData = await libraryGetFirestore(uid, libraryId);
    const sku = libraryData.sku;
    // Check if the default scene exists.
    const exists = await fileExists(app, `Scenes/${sceneToFetch}/${chapter}-scenes.json`);
    logger.debug(`Default scene ${sceneToFetch} exists: ${exists} ${typeof exists}`);
    if (!exists) {
      logger.warn(`Default scene ${sceneToFetch} not found in Firestore, will try to copy now.`);
      logger.debug(`Checking for catalogue scenes for ${sku}`);
      const defaultExist = await fileExists(app, `Catalogue/Processed/${sku}/${sku}-scenes.json`);
      logger.debug(`Catalogue scenes for ${sku} exist: ${defaultExist}`);
      if (defaultExist) {
        logger.debug(`Copying default catalogue scenes for ${sku}`);
        await storeScenes(app, sceneId, chapter, await getCatalogueDefaultScene(app, sku));
      } else {
        logger.warn(`Default scene ${sceneToFetch} not found in Firestore, and catalogue scenes not found.`);
        return {error: "Scenes not found - likely still being generatred"};
      }
    } else {
      logger.debug(`we should not see this log message.`);
    }
  }
  return await getScene(app, sceneId, chapter);
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
