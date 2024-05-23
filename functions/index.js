/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
// import {onRequest} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
const app = initializeApp();
import {onCall} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import logger from "firebase-functions/logger";
import {newUser} from "./auth/auth.js";

import {
  beforeUserCreated,
  // beforeUserSignedIn,
} from "firebase-functions/v2/identity";


/**
 * Cloud Function triggered before a new user is created.
 * This function logs the event details and can be extended to handle more complex logic.
 *
 * @param {object} event - The event payload containing details about the user being created.
 * @returns {Promise<void>} A promise that resolves when the function is complete.
 *
 * Sample event object:
 *
 */

export const newUserTriggers =
  beforeUserCreated({region: "europe-west1"}, async (event) => {
    logger.debug(`FUNCTION: beforeUserCreated - newUserTriggers`);
    logger.debug(event);
    try {
      await newUser(app, event);
    } catch (error) {
      logger.error(error);
    }
    return;
  });

/**
 * HTTP Cloud Function test.
 *
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 */
export const helloWorld = onCall({region: "europe-west1"}, async (data, context) => {
  // Check if the request is made by an authenticated user
  if (!context.auth) {
    // Respond with an error if the user is not authenticated
    logger.error("The function must be called while authenticated.");
    return {error: "Not authenticated."};
  }

  // Retrieve the UID of the authenticated user
  const uid = context.auth.uid;

  // Respond with the UID of the user
  logger.debug(`Authenticated request made by UID: ${uid}`);
  return {uid: uid, message: `Success! You made an authenticated request.`};
});

