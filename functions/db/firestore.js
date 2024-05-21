
import {getFirestore} from "firebase-admin/firestore";
/**
 * Adds a new user to the Firestore database.
 *
 * @param {string} user - The user object from firestore
 */
async function saveUser(user) {
  await getFirestore().collection("Users").doc(user.uid).set(user);
}

export {saveUser};
