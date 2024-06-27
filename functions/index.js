/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
// import {onRequest} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
const app = initializeApp();
import {onRequest, onCall} from "firebase-functions/v2/https";
// import {onObjectFinalized} from "firebase-functions/v2/storage";
import {getAuth} from "firebase-admin/auth";
import logger from "firebase-functions/logger";
import {newUser, validateOnCallAuth} from "./auth/auth.js";
import {
  preProcess,
  hookFromBucket,
} from "./util/pipeline.js";

import {
  getUser,
  getPipelineFirestore,
  catalogueAddFirestore,
  catalogueGetFirestore,
  catalogueDeleteFirestore,
  catalogueUpdateFirestore,
  addItemToLibraryFirestore,
  deleteItemFromLibraryFirestore,
  getItemManifestFirestore,
  getLibraryFirestore,
} from "./storage/firestore.js";

import {
  beforeUserCreated,
  // beforeUserSignedIn,
} from "firebase-functions/v2/identity";

import {
  ENVIRONMENT,
  OPENAI_API_KEY,
} from "./config/config.js";

// import {onInit} from "firebase-functions/v2/core";
// let openaiKey;
// onInit(() => {
//   openaiKey = OPENAI_API_KEY.value();
//   console.log(openaiKey);
// });

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
  logger.debug(`ENVIRONMENT: ${ENVIRONMENT.value()}`);
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
 * Cloud function to get the current auth'd user
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to an object containing the user's UID and the data provided.
 */
export const getCurrentUser = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return getUser(uid);
});

/**
 * Cloud Function to create a new book entry.
 * This function is triggered by an on-call request and requires the user to be authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to an object containing the user's UID and the data provided.
 */
export const v1addItemToLibrary = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return addItemToLibraryFirestore(uid, data, app);
});

/**
 * Cloud Function to get the manifest for a specific item in the user's library.
 * This function is triggered by an on-call request and requires the user to be authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to the item manifest if found and the user is authenticated.
 */
export const v1getItemManifest = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return getItemManifestFirestore(uid, data, app);
});


/**
 * Retrieves a book from the Firestore database based on the user's UID and the book ID provided in the data.
 * This function is triggered by an on-call request and requires the user to be authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to the book data if found and the user is authenticated, otherwise null.
 */
export const v1getLibrary = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return getLibraryFirestore(uid, data, app);
});

/**
 * Requests the server delete a book, including any items in storage
 * This function is triggered by an on-call request and requires the user to be authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to the book data if found and the user is authenticated, otherwise null.
 */
export const v1deleteItemsFromLibrary = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return deleteItemFromLibraryFirestore(uid, data, app);
});

/**
 * Requests the server to update a book object, and return
 * the updated book.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to the book data if found and the user is authenticated, otherwise null.
 */
export const updateBook = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return;
});

export const getPipeline = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return getPipelineFirestore(uid, data, app);
});

/**
 * Retrieves a pipeline from the Firestore database based on the user's UID and the pipeline ID provided in the data.
 * This function is triggered by an on-call request and requires the user to be authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to the pipeline data if found and the user is authenticated, otherwise null.
 */
export const preProcessBook = onRequest({region: "europe-west1"},
    // {cors: [/firebase\.com$/, "flutter.com"]},
    async (req, res) => {
      return preProcess(req, res);
    });

export const v1catalogueAdd = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return catalogueAddFirestore(uid, data, app);
});

export const v1catalogueGet = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return catalogueGetFirestore(uid, data, app);
});


export const v1catalogueDelete = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return catalogueDeleteFirestore(uid, data, app);
});

export const v1catalogueUpdate = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return catalogueUpdateFirestore(uid, data, app);
});
