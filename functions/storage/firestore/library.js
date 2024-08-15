/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
import {
  getFirestore,
  Timestamp} from "firebase-admin/firestore";
import {
  removeUndefinedProperties,
} from "../firestore.js";
import {logger} from "firebase-functions/v2";

import {
  catalogueGetFirestore,
} from "./catalogue.js";

import {
  scenesCreateLibraryItemFirestore,
} from "./scenes.js";

import {generateManifest} from "../../util/opds.js";

async function libraryGetFirestore(uid, libraryId) {
  const db = getFirestore();
  logger.debug(`getting library item ${libraryId}`);
  const libraryRef = db.collection("Library").doc(libraryId);
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
 * Adds an item from the Catalogue to the user's Library in Firestore.
 *
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing the catalogueId of the item to be added.
 * @return {Promise<object>} A promise that resolves to the added library item.
 */
async function libraryAddItemFirestore(uid, data) {
  if (!data.catalogueId) {
    throw new Error("Catalogue ID is required");
  }
  logger.debug(`Request to add item ${data.catalogueId} to library for user ${uid}`);
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

  // get the catalogue item SKU
  const catalogueItem = await catalogueGetFirestore(data.catalogueId);
  const sku = catalogueItem.sku;

  // Add the new item to the Library
  const newItem = {
    uid: uid,
    catalogueId: data.catalogueId,
    sku: sku,
    addedAt: new Date(),
  };

  const docRef = await libraryRef.add(newItem);
  const addedDoc = await docRef.get();

  // Create a new scene for the library item
  const sceneData = await scenesCreateLibraryItemFirestore(uid, {
    libraryId: addedDoc.id,
    prompt: "",
    userDefault: true,
  });

  return {
    id: addedDoc.id,
    ...addedDoc.data(),
  };
}

/**
 * Retrieves the user's library items from Firestore.
 *
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing optional parameters.
 * @return {Promise<Array>} A promise that resolves to an array of library items.
 */
async function libraryGetAllFirestore(uid, data) {
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
        const manifest = await generateManifest(uid, item.catalogueId);
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
 * @return {Promise<object>} A promise that resolves to an object with the deletion results.
 */
async function libraryDeleteItemFirestore(uid, data) {
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


export {
  libraryGetFirestore,
  libraryAddItemFirestore,
  libraryGetAllFirestore,
  libraryDeleteItemFirestore,
};
