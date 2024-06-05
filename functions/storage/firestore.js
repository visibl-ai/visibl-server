import {getFirestore} from "firebase-admin/firestore";
import {
  fileExists,
  deleteFile,
} from "./storage.js";
import logger from "firebase-functions/logger";

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
  const snapshot = await docRef.get(); // Get the document snapshot
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
    return {error: "Book not found"}; // Return null if there is no match
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
    let rawBookInStorage = await fileExists(app, uid, `rawUploads/`, bookData.filename);
    if (rawBookInStorage && rawBookInStorage.length) {
      rawBookInStorage = rawBookInStorage[0];
    }
    logger.debug(`UID: ${uid}, book: ${snapshot.id} rawBookInStorage: ${rawBookInStorage}`);
    bookData.rawBookInStorage = rawBookInStorage;
    await snapshot.ref.update(bookData); // Update the book data
    bookData.id = snapshot.id; // Add the document ID to the data
    return bookData;
  } else {
    return null; // Return null if there is no match
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
      await deleteFile(app, uid, `rawUploads/`, bookData.filename);
    }
    await snapshot.ref.delete(); // Delete the book from the database
    return {success: true};
  } else {
    return {error: "Book not found"}; // Return null if there is no match
  }
}

export {
  saveUser,
  getUser,
  createBookFirestore,
  getBookFirestore,
  updateBookFirestore,
  deleteBookFirestore,
};
