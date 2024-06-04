/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
// import {onRequest} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
const app = initializeApp();
import {onCall} from "firebase-functions/v2/https";
import {getAuth} from "firebase-admin/auth";
import logger from "firebase-functions/logger";
import {newUser, validateOnCallAuth} from "./auth/auth.js";
import {
  createBookFirestore,
  getBookFirestore,
} from "./storage/firestore.js";

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
export const helloWorld = onCall({region: "europe-west1"}, async (context) => {
  // Check if the request is made by an authenticated user
  let uid;
  let data;
  try {
    const req = await validateOnCallAuth(context);
    uid = req.uid;
    data = req.data;
  } catch (error) {
    return {error: "User not authenticated"};
  }
  return {uid: uid, message: `Success! You made an authenticated request.`};
});

/**
 * Cloud Function to create a new book entry.
 * This function is triggered by an on-call request and requires the user to be authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to an object containing the user's UID and the data provided.
 */
export const createBook = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return createBookFirestore(uid, data);
});

/**
 * Retrieves a book from the Firestore database based on the user's UID and the book ID provided in the data.
 * This function is triggered by an on-call request and requires the user to be authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to the book data if found and the user is authenticated, otherwise null.
 */
export const getBook = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return getBookFirestore(uid, data);
});
