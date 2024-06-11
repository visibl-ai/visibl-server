import {getFirestore} from "firebase-admin/firestore";
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
};
