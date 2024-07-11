/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
import {
  getFirestore,
  Timestamp} from "firebase-admin/firestore";
import {
  getCatalogueManifest,
  getCatalogueScenes,
  storeUserScenes,
  getUserScenes,
} from "./storage.js";
import {logger} from "firebase-functions/v2";
import {createBookPipeline} from "../util/pipeline.js";
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
   * Validates the audiobook data object.
   * @param {object} data - The audiobook data to validate.
   * @throws {Error} If any required field is missing or invalid.
   */
function validateAudiobookData(data) {
  // Ensure required fields are present
  const requiredFields = ["type", "title", "author", "duration", "metadata", "language"];
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate required fields
  if (data.type !== "audiobook") {
    throw new Error("Type must be 'audiobook'");
  }
  if (!Array.isArray(data.author)) {
    throw new Error("Author must be an array");
  }
  if (typeof data.duration !== "number") {
    throw new Error("Duration must be a number");
  }
  if (typeof data.metadata !== "object") {
    throw new Error("Metadata must be an object");
  }
  if (typeof data.language !== "string") {
    throw new Error("Language must be a string");
  }

  // Optional fields with type checking
  if (data.narrator && !Array.isArray(data.narrator)) {
    throw new Error("Narrator must be an array");
  }
  if (data.genres && !Array.isArray(data.genres)) {
    throw new Error("Genres must be an array");
  }
  if (data.publicationDate && !(data.publicationDate instanceof Timestamp)) {
    throw new Error("PublicationDate must be a Timestamp");
  }
  if (data.rating && typeof data.rating !== "number") {
    throw new Error("Rating must be a number");
  }
  if (data.tags && !Array.isArray(data.tags)) {
    throw new Error("Tags must be an array");
  }
}

/**
 * Adds a new item to the Catalogue collection in Firestore.
 *
 * @param {object} req - The request object from Express.
 * @param {object} app - The Firebase app instance.
 * @return {Promise<object>} A promise that resolves to the full document data of the newly created catalogue item.
 */
async function catalogueAddFirestore(req, app) {
  // Remove any undefined properties from data
  let data = req.body;
  data = removeUndefinedProperties(data);
  // Validate the audiobook data
  validateAudiobookData(data);
  const docRef = getFirestore().collection("Catalogue").doc(); // Create a document reference
  // Add createdAt and updatedAt timestamps
  data.createdAt = Timestamp.now();
  data.updatedAt = Timestamp.now();
  await docRef.set({...data}); // Set the data
  const snapshot = await docRef.get(); // Get the document snapshot
  const r = snapshot.data();
  r.id = snapshot.id; // Add the document ID to the data
  return r; // Return the full document data with ID
}

/**
 * Retrieves all items from the Catalogue collection in Firestore.
 *
 * @param {object} app - The Firebase app instance.
 * @return {Promise<Array<object>>} A promise that resolves to an array of all catalogue items.
 */
async function catalogueGetFirestore(app) {
  const catalogueRef = getFirestore().collection("Catalogue");
  const snapshot = await catalogueRef.get();

  if (snapshot.empty) {
    return [];
  }

  const catalogueItems = [];
  snapshot.forEach((doc) => {
    const item = doc.data();
    item.id = doc.id;
    catalogueItems.push(item);
  });

  return catalogueItems;
}

/**
 * Deletes an item from the Catalogue collection in Firestore.
 *
 * @param {object} req - The request object from Express.
 * @param {object} app - The Firebase app instance.
 * @return {Promise<object>} A promise that resolves to an object indicating the success of the deletion.
 */
async function catalogueDeleteFirestore(req, app) {
  const data = req.body;
  if (!data.id) {
    throw new Error("Item ID is required for deletion");
  }

  const docRef = getFirestore().collection("Catalogue").doc(data.id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error("Item not found");
  }

  await docRef.delete();

  return {success: true, message: "Item deleted successfully"};
}

/**
 * Updates an item in the Catalogue collection in Firestore.
 *
 * @param {object} req - The request object from Express.
 * @param {object} app - The Firebase app instance.
 * @return {Promise<object>} A promise that resolves to the updated catalogue item.
 */
async function catalogueUpdateFirestore(req, app) {
  const data = req.body;
  if (!data.id) {
    throw new Error("Item ID is required for update");
  }

  const docRef = getFirestore().collection("Catalogue").doc(data.id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error("Item not found");
  }

  const updatedData = {
    ...data,
    updatedAt: new Date(),
  };

  delete updatedData.id; // Remove the id from the data to be updated

  await docRef.update(updatedData);

  const updatedDoc = await docRef.get();
  const updatedItem = updatedDoc.data();
  updatedItem.id = updatedDoc.id;

  return updatedItem;
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
  const sceneData = await createLibraryScenesFirestore(uid, {
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

/**
 * Retrieves the manifest for a specific item in the user's library from Firestore.
 *
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing the item ID.
 * @param {object} app - The Firebase app instance.
 * @return {Promise<object>} A promise that resolves to the item manifest.
 */
async function getItemManifestFirestore(uid, data, app) {
  if (!data.libraryId) {
    throw new Error("Library ID is required");
  }

  const db = getFirestore();
  const libraryRef = db.collection("Library").doc(data.libraryId);

  const doc = await libraryRef.get();

  if (!doc.exists || doc.data().uid !== uid) {
    throw new Error("Item not found in the user's library");
  }

  try {
    const catalogueId = doc.data().catalogueId;
    const manifest = await getCatalogueManifest(app, catalogueId);
    if (!manifest) {
      throw new Error("Manifest not found");
    }
    return manifest;
  } catch (error) {
    console.error("Error retrieving manifest:", error);
    throw new Error("Failed to retrieve item manifest");
  }
}

/**
 * Retrieves the user's library items from Firestore.
 *
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing optional parameters.
 * @param {object} app - The Firebase app instance.
 * @return {Promise<Array>} A promise that resolves to an array of library items.
 */
async function getLibraryFirestore(uid, data, app) {
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
        const manifest = await getItemManifestFirestore(uid, {libraryId: item.id}, app);
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

async function createLibraryScenesFirestore(uid, data, app) {
  const db = getFirestore();
  // eslint-disable-next-line prefer-const
  let {libraryId, prompt, userDefault} = data;
  if (!libraryId) {
    throw new Error("Both libraryId and prompt are required");
  }
  // Set userDefault to false if it's undefined
  if (prompt === undefined) {
    throw new Error("Prompt cannot be undefined");
  }
  userDefault === undefined ? false : userDefault;
  const scenesRef = db.collection("Scenes");

  // Check for existing scene
  const existingScene = await scenesRef
      .where("uid", "==", uid)
      .where("libraryId", "==", libraryId)
      .where("prompt", "==", prompt)
      .limit(1)
      .get();

  if (!existingScene.empty) {
    const existingSceneData = existingScene.docs[0].data();
    return {id: existingScene.docs[0].id, ...existingSceneData};
  }

  // Create new scene if not exists
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


export {
  saveUser,
  getUser,
  createPipelineFirestore,
  updatePipelineFirestore,
  getPipelineFirestore,
  catalogueAddFirestore,
  catalogueGetFirestore,
  catalogueDeleteFirestore,
  catalogueUpdateFirestore,
  addItemToLibraryFirestore,
  getItemManifestFirestore,
  getLibraryFirestore,
  deleteItemFromLibraryFirestore,
  getAiFirestore,
};
