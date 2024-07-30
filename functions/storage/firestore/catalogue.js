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
   * Validates the audiobook data object.
   * @param {object} data - The audiobook data to validate.
   * @throws {Error} If any required field is missing or invalid.
   *
   *     // Prepare the data for the catalogue item
    const data = {
      type: "audiobook",
      title: metadata.title,
      author: [metadata.author],
      duration: metadata.length,
      metadata: metadata,
      visibility: "public",
      language: "en", // Assuming English, adjust if needed
    };
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
async function catalogueAddFirestore(req) {
  // Remove any undefined properties from item
  let item = req.body;
  item = removeUndefinedProperties(item);
  // Call catalogueBatchAddFirestore with a single item
  const addedItems = await catalogueBatchAddFirestore([item]);
  // Return the first (and only) element of the list
  return addedItems[0];
}

/**
 * Batch adds multiple items to the Catalogue collection in Firestore.
 *
 * @param {Array<object>} items - An array of catalogue items to be added.
 * @return {Promise<Array<object>>} A promise that resolves to an array of the added items with their IDs.
 */
async function catalogueBatchAddFirestore(items) {
  const db = getFirestore();
  const batch = db.batch();
  const addedItems = [];

  for (const item of items) {
    // Remove any undefined properties from data
    const data = removeUndefinedProperties(item);
    validateAudiobookData(data);
    const docRef = db.collection("Catalogue").doc();

    // Add createdAt and updatedAt timestamps
    data.createdAt = Timestamp.now();
    data.updatedAt = Timestamp.now();

    batch.set(docRef, data);

    addedItems.push({
      ...data,
      id: docRef.id,
    });
  }

  await batch.commit();

  return addedItems;
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
 * Filters out items that already exist in the Catalogue collection based on SKU.
 *
 * @param {Array} items - An array of objects, each containing an 'sku' property.
 * @return {Promise<Array>} A promise that resolves to an array of items not present in the Catalogue.
 */
async function filterNewSKUItemsForCatalogue(items) {
  const db = getFirestore();
  const catalogueRef = db.collection("Catalogue");

  const filteredItems = await Promise.all(items.map(async (item) => {
    const querySnapshot = await catalogueRef.where("sku", "==", item.sku).limit(1).get();
    return querySnapshot.empty ? item : null;
  }));

  return filteredItems.filter((item) => item !== null);
}

function itemToOPDSFeed(item) {
  return item;
}

function itemToOPDSManifest(item) {
  throw new Error("Not implemented");
}


async function populateCatalogueWithAudibleItems(items, uid) {
  items = await filterNewSKUItemsForCatalogue(items);
  items = items.map((item) => ({
    type: "audiobook",
    title: item.metadata.title,
    author: [item.metadata.author],
    duration: item.metadata.length,
    metadata: item.metadata,
    visibility: "public",
    language: "en", // Assuming English, adjust if needed
    addedBy: uid,
    feedTemplate: itemToOPDSFeed(item),
  }));

  return await catalogueBatchAddFirestore(items);
}

// TODO: Add an OPDS template to the cataloge document

// TODO: after transcription is compelte, add a template for the manifest


export {
  catalogueAddFirestore,
  catalogueGetFirestore,
  catalogueDeleteFirestore,
  catalogueUpdateFirestore,
};
