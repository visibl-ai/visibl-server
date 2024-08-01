/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
import {
  getFirestore,
  Timestamp} from "firebase-admin/firestore";
import {
  getCatalogueScenes,
  storeUserScenes,
  getUserScenes,
} from "./storage.js";
import {logger} from "firebase-functions/v2";
import {createBookPipeline} from "../util/pipeline.js";
import {generateManifest} from "../util/opds.js";

/**
 * Adds a new user to the Firestore database.
 *
 * @param {string} user - The user object from firestor auth.
 */
async function saveUser(user) {
  await getFirestore().collection("Users").doc(user.uid).set(user);
}
import fs from "fs/promises";
import path from "path";


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

async function getLibraryItemFirestore(uid, data) {
  const db = getFirestore();
  logger.debug(`getting library item ${data.libraryId}`);
  const libraryRef = db.collection("Library").doc(data.libraryId);
  const doc = await libraryRef.get();

  if (!doc.exists) {
    throw new Error("Item not found in the user's library");
  }

  const docData = doc.data();
  if (docData.uid !== uid) {
    throw new Error("Unauthorized access to library item");
  }

  return {
    id: doc.id,
    ...docData,
  };
}

/**
 * Retrieves the user's library items from Firestore.
 *
 * @param {object} app - The Firebase app instance.
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing optional parameters.
 * @return {Promise<Array>} A promise that resolves to an array of library items.
 */
async function getLibraryFirestore(app, uid, data) {
  const db = getFirestore();
  const libraryRef = db.collection("Library").where("uid", "==", uid);

  const snapshot = await libraryRef.get();

  if (snapshot.empty) {
    return [];
  }

  let libraryItems = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  if (data.includeManifest) {
    libraryItems = await Promise.all(libraryItems.map(async (item) => {
      try {
        const manifest = await generateManifest(app, uid, item.catalogueId);
        return {...item, manifest};
      } catch (error) {
        console.error(`Error fetching manifest for item ${item.id}:`, error);
        return item;
      }
    }));
  }

  return libraryItems;
}

/**
 * Deletes multiple items from the user's library in Firestore.
 *
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing the libraryIds to delete.
 * @param {object} app - The Firebase app instance.
 * @return {Promise<object>} A promise that resolves to an object with the deletion results.
 */
async function deleteItemFromLibraryFirestore(uid, data, app) {
  const db = getFirestore();
  const libraryRef = db.collection("Library");
  const scenesRef = db.collection("Scenes");
  const {libraryIds} = data;

  if (!Array.isArray(libraryIds) || libraryIds.length === 0) {
    throw new Error("Invalid or empty libraryIds array provided");
  }

  const batch = db.batch();
  const deletionResults = {success: [], failed: []};

  for (const libraryId of libraryIds) {
    const docRef = libraryRef.doc(libraryId);
    const doc = await docRef.get();

    if (doc.exists && doc.data().uid === uid) {
      batch.delete(docRef);

      // Delete corresponding Scenes document
      const sceneQuery = await scenesRef.where("uid", "==", uid).where("libraryId", "==", libraryId).get();
      sceneQuery.forEach((sceneDoc) => {
        batch.delete(sceneDoc.ref);
      });

      deletionResults.success.push(libraryId);
    } else {
      deletionResults.failed.push(libraryId);
    }
  }

  await batch.commit();

  return {
    message: "Deletion process completed",
    results: deletionResults,
  };
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
  const db = getFirestore();
  const {libraryId} = data;

  if (!libraryId) {
    throw new Error("Invalid or missing libraryId");
  }

  const libraryRef = db.collection("Library").doc(libraryId);
  const libraryDoc = await libraryRef.get();

  if (!libraryDoc.exists) {
    logger.debug(`Library item with id ${libraryId} not found`);
    logger.debug(`Library item data: ${typeof data === "object" ? JSON.stringify(data) : data}`);
    throw new Error("Library item not found");
  }

  const libraryData = libraryDoc.data();
  if (libraryData.uid !== uid) {
    throw new Error("Unauthorized access to library item");
  }

  const {catalogueId} = libraryData;
  if (!catalogueId) {
    throw new Error("CatalogueId not found in library item");
  }

  // Retrieve the scenes data for the catalogueId
  let scenes;
  try {
    scenes = await getUserLibraryScene(app, uid, libraryId);
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
//     await updateUserLibraryDefault(db, uid, newSceneRef, libraryId, newSceneRef.id);
//   }
//   return {id: newSceneRef.id, ...newScene};
// }

async function getUserLibraryScene(app, uid, libraryId, sceneId) {
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
    const defaultSceneQuery = await db.collection("Scenes")
        .where("uid", "==", uid)
        .where("libraryId", "==", libraryId)
        .where("userDefault", "==", true)
        .limit(1)
        .get();

    if (defaultSceneQuery.empty) {
      throw new Error("No default scene found for this library item");
    }

    sceneToFetch = defaultSceneQuery.docs[0].id;
  }
  return await getUserScenes(app, uid, libraryId, sceneToFetch);
}

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

async function updateLibraryItemScenesFirestore(uid, data, app) {
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
    await updateUserLibraryDefault(db, uid, scenesRef, libraryId, sceneId);
  }
  await sceneToUpdate.ref.update({userDefault: isUserDefault});
  // Return the updated scene data
  return {
    id: sceneId,
    ...sceneData,
    userDefault: isUserDefault,
  };
}

async function updateUserLibraryDefault(db, uid, scenesRef, libraryId, sceneId) {
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

async function storeAudibleAuthFirestore(uid, audibleUserId, auth) {
  const db = getFirestore();
  const authRef = db.collection("AudibleAuth").doc(audibleUserId);
  await authRef.set({uid, audibleUserId, auth, expires: auth.expires});
}

async function getAllAudibleAuthFirestore(expiry, lastDocId = null, limit = 100) {
  const db = getFirestore();
  const authRef = db.collection("AudibleAuth");

  let query = authRef.where("expires", ">=", expiry.from)
      .where("expires", "<", expiry.to)
      .orderBy("expires")
      .limit(limit);

  if (lastDocId) {
    const lastDoc = await authRef.doc(lastDocId).get();
    query = query.startAfter(lastDoc);
  }

  const snapshot = await query.get();

  const results = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  const hasMore = snapshot.docs.length === limit;

  return {
    results,
    lastVisible: hasMore ? lastVisible.id : null,
    hasMore,
  };
}


async function getAudibleAuthByAudibleId(audibleUserId) {
  const db = getFirestore();
  const authRef = db.collection("AudibleAuth").doc(audibleUserId);
  const auth = await authRef.get();
  return auth.data();
}

async function getAudibleAuthByUid(uid) {
  const db = getFirestore();
  const authRef = db.collection("AudibleAuth").where("uid", "==", uid);
  const auth = await authRef.get();
  return auth.docs[0].data().auth;
}

async function storeAudibleItemsFirestore(uid, library) {
  const db = getFirestore();

  const batch = db.batch();

  for (const libraryItem of library) {
    const asin = libraryItem.asin;
    const title = libraryItem.title;
    const sku = libraryItem.sku_lite;
    const libraryRef = db.collection("UserAudibleSync").doc(`${uid}:${sku}`);
    batch.set(libraryRef, {
      uid,
      title,
      asin,
      sku,
    }, {merge: true});
  }
  await batch.commit();
}

async function getAudibleItemsFirestore(uid) {
  const db = getFirestore();
  const itemsRef = db.collection("UserAudibleSync").where("uid", "==", uid);
  const items = await itemsRef.get();
  return items.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function getAsinFromSkuFirestore(uid, sku) {
  const db = getFirestore();
  const itemRef = db.collection("UserAudibleSync").doc(`${uid}:${sku}`);
  const item = await itemRef.get();

  if (!item.exists) {
    return null; // or throw an error, depending on your preference
  }

  const data = item.data();
  return data && data.asin ? data.asin : null;
}

async function updateAudibleItemFirestore(item) {
  const db = getFirestore();
  const itemRef = db.collection("UserAudibleSync").doc(item.id);
  await itemRef.update(item);
}

export {
  saveUser,
  getUser,
  createPipelineFirestore,
  updatePipelineFirestore,
  getPipelineFirestore,
  addItemToLibraryFirestore,
  getLibraryFirestore,
  deleteItemFromLibraryFirestore,
  getAiFirestore,
  getLibraryScenesFirestore,
  addLibraryItemScenesFirestore,
  updateLibraryItemScenesFirestore,
  storeAudibleAuthFirestore,
  getAudibleAuthByAudibleId,
  getAudibleAuthByUid,
  storeAudibleItemsFirestore,
  updateAudibleItemFirestore,
  getAudibleItemsFirestore,
  getAllAudibleAuthFirestore,
  removeUndefinedProperties,
  getAsinFromSkuFirestore,
  getLibraryItemFirestore,
};
