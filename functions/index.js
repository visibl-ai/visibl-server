/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
// import {onRequest} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
const app = initializeApp();
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import {getAuth} from "firebase-admin/auth";
import {getFunctions} from "firebase-admin/functions";
import logger from "firebase-functions/logger";
import {newUser} from "./auth/auth.js";
import {GoogleAuth} from "google-auth-library";

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


/*
  * Cloud task to transcribe a book.
  *
  * The approximate flow is:
  * 1. User uploads book to Cloud Storage.
  * 2. Cloud Storage triggers a Cloud Function which creates a new queue entry in datastore type: "processBook", stage "transcribe"
  * 3. The Cloud Function triggers this function, which calls a google cloud function to transcribe the book.
  * 4. The google cloud function transcribes the book and stores the result in Cloud Storage.
  * 5. When the transcription is complete, this function updates the queue entry in datastore to stage "complete"
  * 6. This cloud function triggers the next stage of the process - graphing the book.
  *
  * @param {Request} req - The HTTP request object.
  */
export const transcribeBook = onTaskDispatched(
    {
      retryConfig: {
        maxAttempts: 5,
        minBackoffSeconds: 60,
      },
      rateLimits: {
        maxConcurrentDispatches: 6,
      },
      timeoutSeconds: 900,
    }, async (req) => {
      logger.debug(`FUNCTION: transcribeBook`);
      return;
    });

let auth;
/**
 * Get the URL of a given v2 cloud function.
 *
 * @param {string} name the function's name
 * @param {string} location the function's location
 * @return {Promise<string>} The URL of the function
 */
async function getFunctionUrl(name, location="europe-west1") {
  if (!auth) {
    auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
  }
  const projectId = await auth.getProjectId();
  const url = "https://cloudfunctions.googleapis.com/v2beta/" +
    `projects/${projectId}/locations/${location}/functions/${name}`;

  const client = await auth.getClient();
  const res = await client.request({url});
  const uri = res.data?.serviceConfig?.uri;
  if (!uri) {
    throw new Error(`Unable to retreive uri for function at ${url}`);
  }
  return uri;
}

export const rawBookUploaded = onCall({region: "europe-west1"}, async (data, context) => {
  // Check if the request is made by an authenticated user
  if (!context.auth) {
    // Respond with an error if the user is not authenticated
    logger.error("The function must be called while authenticated.");
    return {error: "Not authenticated."};
  }

  // Retrieve the UID of the authenticated user
  const uid = context.auth.uid;

  const queue = getFunctions().taskQueue("transcribeBook");
  const targetUri = await getFunctionUrl("transcribeBook");
  await queue.enqueue({}, {
    scheduleDelaySeconds: 0,
    dispatchDeadlineSeconds: 0, // 5 minutes
    uri: targetUri,
  });
  return;
});
