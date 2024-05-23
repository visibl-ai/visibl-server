/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
// import {onRequest} from "firebase-functions/v2/https";
import logger from "firebase-functions/logger";
import {newUser} from "./auth/auth.js";
import {initializeApp} from "firebase-admin/app";
initializeApp();
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
      await newUser(event);
    } catch (error) {
      logger.error(error);
    }
    return;
  });
