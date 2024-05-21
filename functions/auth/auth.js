import logger from "firebase-functions/logger";
import {saveUser} from "../db/firestore.js";
/**
 * This function is triggered when a new user is created.
 * It handles the creation of a new user
 * in the Firestore database and sets up a personal
 * storage bucket for the user's files.
 *
 * @param {Object} event - The event object from firebase
 */
async function newUser(event) {
  logger.debug(`new user creation.`);
  const user = event.data;
  return await saveUser(user);
}

export {newUser};

