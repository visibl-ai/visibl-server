import {getFirestore} from "firebase-admin/firestore";
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
  return snapshot.data(); // Return the full document data
}

export {saveUser, getUser, createBookFirestore};
