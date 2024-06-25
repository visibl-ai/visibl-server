import {
  getFirestore,
  Timestamp} from "firebase-admin/firestore";
import {
  fileExists,
  deleteFile,
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
 * Creates a new book in the Firestore database.
 *
 * @param {string} uid - The unique identifier of the user creating the book.
 * @param {object} data - The data of the book to be stored.
 * @return {Promise<object>} A promise that resolves to the full document data of the newly created book.
 */
async function createBookFirestore(uid, data) {
  const docRef = getFirestore().collection("Books").doc(); // Create a document reference
  await docRef.set({uid: uid, ...data}); // Set the data
  let snapshot = await docRef.get(); // Get the document snapshot
  const pipeline = await createBookPipeline(uid, snapshot.id, "rawBook");
  await docRef.update({pipelineId: pipeline.id}); // Save the book again with the pipeline ID
  snapshot = await docRef.get(); // Get the updated document snapshot after pipeline ID update
  const r = snapshot.data();
  r.id = snapshot.id; // Add the document ID to the data
  return r; // Return the full document data with ID
}


/**
 * Retrieves a book from the Firestore database by its unique identifier.
 * @param {string} uid - The unique identifier of the user to retrieve the book for.
 * @param {string} data - must contain .id
 * @return {Promise<FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>>} A promise that resolves to the document snapshot of the book.
 */
async function getBookFirestore(uid, data) {
  const id = data.id;
  logger.debug(data, uid);
  const snapshot = await getFirestore().collection("Books").doc(id).get();
  const bookData = snapshot.data();
  // Check if the book's uid matches the provided uid
  if (bookData && bookData.uid === uid) {
    bookData.id = snapshot.id; // Add the document ID to the data
    return bookData;
  } else {
    return {error: "Book not found"}; // Return error if there is no match
  }
}

/**
 * Updates a book in firestore, checking if the book is available
 * in the cloud bucket as expected.
 * @param {string} uid - The unique identifier of the user to retrieve the book for.
 * @param {object} data - The data of the book to be stored.
 * @return {Promise<object>} A promise that resolves to the full document data of the newly created book.
 * @param {Object} app - The Firebase app instance
 */
async function updateBookFirestore(uid, data, app) {
  const id = data.id;
  logger.debug(data, uid);
  const snapshot = await getFirestore().collection("Books").doc(id).get();
  const bookData = snapshot.data();
  // Check if the book's uid matches the provided uid
  if (bookData && bookData.uid === uid) {
    const extension = bookData.type;
    let rawBookInStorage = await fileExists(app, uid, `rawUploads/`, `${snapshot.id}.${extension}`);
    if (rawBookInStorage && rawBookInStorage.length) {
      rawBookInStorage = rawBookInStorage[0];
    }
    logger.debug(`UID: ${uid}, book: ${snapshot.id}.${extension} rawBookInStorage: ${rawBookInStorage}`);
    bookData.rawBookInStorage = rawBookInStorage;
    await snapshot.ref.update(bookData); // Update the book data
    bookData.id = snapshot.id; // Add the document ID to the data
    return bookData;
  } else {
    return {error: "Book not found"};
  }
}

/**
 * Deletes a book from the Firestore database and the cloud storage bucket.
 * @param {string} uid - The unique identifier of the user to delete the book for.
 * @param {object} data - The data of the book to be deleted.
 * @param {Object} app - The Firebase app instance
 * @return {Promise<object>} A promise that resolves to the full document data of the deleted book.
 */
async function deleteBookFirestore(uid, data, app) {
  const id = data.id;
  logger.debug(data, uid);
  const snapshot = await getFirestore().collection("Books").doc(id).get();
  const bookData = snapshot.data();
  // Check if the book's uid matches the provided uid
  if (bookData && bookData.uid === uid) {
    if (bookData.rawBookInStorage) {
      const extension = bookData.type;
      await deleteFile(app, uid, `rawUploads/`, `${snapshot.id}.${extension}`);
    }
    await snapshot.ref.delete(); // Delete the book from the database
    return {success: true};
  } else {
    return {error: "Book not found"}; // Return error if there is no match
  }
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
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data of the catalogue item to be stored.
 * @param {object} app - The Firebase app instance.
 * @return {Promise<object>} A promise that resolves to the full document data of the newly created catalogue item.
 */
async function catalogueAddFirestore(uid, data, app) {
  // Remove any undefined properties from data
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
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - Any additional data passed to the function (not used in this implementation).
 * @param {object} app - The Firebase app instance.
 * @return {Promise<Array<object>>} A promise that resolves to an array of all catalogue items.
 */
async function catalogueGetFirestore(uid, data, app) {
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
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing the ID of the catalogue item to be deleted.
 * @param {object} app - The Firebase app instance.
 * @return {Promise<object>} A promise that resolves to an object indicating the success of the deletion.
 */
async function catalogueDeleteFirestore(uid, data, app) {
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
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing the ID of the catalogue item to be updated and the new data.
 * @param {object} app - The Firebase app instance.
 * @return {Promise<object>} A promise that resolves to the updated catalogue item.
 */
async function catalogueUpdateFirestore(uid, data, app) {
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

export {
  saveUser,
  getUser,
  createBookFirestore,
  getBookFirestore,
  updateBookFirestore,
  deleteBookFirestore,
  createPipelineFirestore,
  updatePipelineFirestore,
  getPipelineFirestore,
  catalogueAddFirestore,
  catalogueGetFirestore,
  catalogueDeleteFirestore,
  catalogueUpdateFirestore,
};
