/* eslint-disable require-jsdoc */
import app from "../firebase.js";
import logger from "firebase-functions/logger";
import {onCall, onRequest} from "firebase-functions/v2/https";
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import {validateOnCallAuth} from "../auth/auth.js";
import {
  largeDispatchInstance,
  dataToBody,
} from "../util/dispatch.js";
import {
  preProcess,
} from "../util/pipeline.js";
import {
  imageGenRecursive,
} from "../ai/openai/dallE.js";

import {
  processRawPublicItem,
} from "../util/opds.js";
import {
  generateTranscriptions,
} from "../ai/transcribe.js";
import {
  getPipelineFirestore,
} from "../storage/firestore.js";

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


export const getPipeline = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return getPipelineFirestore(uid, data, app);
});

export const v1generateTranscriptions = onCall({
  region: "europe-west1",
  memory: "32GiB",
  concurrency: 1,
  timeoutSeconds: 540,
}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await generateTranscriptions(uid, data, app);
});

export const processM4B = onTaskDispatched(
    largeDispatchInstance(),
    async (req) => {
      logger.debug(`processM4B: ${JSON.stringify(req.data)}`);
      return await processRawPublicItem(dataToBody(req), app);
    },
);

export const generateSceneImages = onTaskDispatched(
    largeDispatchInstance(),
    async (req) => {
      logger.debug(`generateSceneImages: ${JSON.stringify(req.data)}`);
      return await imageGenRecursive(dataToBody(req), app);
    },
);

