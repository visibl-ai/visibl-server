/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
// import {onRequest} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import {getFunctions} from "firebase-admin/functions";

const app = initializeApp();
import {onRequest, onCall} from "firebase-functions/v2/https";
// import {onObjectFinalized} from "firebase-functions/v2/storage";
import {getAuth} from "firebase-admin/auth";
import logger from "firebase-functions/logger";
import {newUser, validateOnCallAuth, validateOnRequestAdmin} from "./auth/auth.js";
import {
  preProcess,
  hookFromBucket,
} from "./util/pipeline.js";

import {
  getUser,
  getPipelineFirestore,
  getAiFirestore,
} from "./storage/firestore.js";

import {
  libraryAddItemFirestore,
  libraryGetAllFirestore,
  libraryDeleteItemFirestore,
} from "./storage/firestore/library.js";

import {
  getLibraryScenesFirestore,
  getCatalogueScenesFirestore,
  scenesCreateLibraryItemFirestore,
  scenesUpdateLibraryItemFirestore,
} from "./storage/firestore/scenes.js";

import {
  catalogueAddFirestore,
  catalogueGetAllFirestore,
  catalogueDeleteFirestore,
  catalogueUpdateFirestore,
} from "./storage/firestore/catalogue.js";

import {
  getAAXAvailableFirestore,
  setAAXAvailableFirestore,
  getAAXConnectStatusFirestore,
} from "./storage/firestore/users.js";

import {generateImages} from "./util/ai.js";

import {
  beforeUserCreated,
  // beforeUserSignedIn,
} from "firebase-functions/v2/identity";

import {
  generatePublicOPDS,
  generatePrivateOPDS,
  processRawPublicItem,
  generateManifest,
  generateUserItemManifest,
} from "./util/opds.js";

import {
  getAAXLoginURL,
  getAAXAuth,
  audiblePostAuthHook,
  refreshAAXTokens,
  submitAAXAuth,
  disconnectAAXAuth,
} from "./util/audibleOpdsHelper.js";

import {
  ENVIRONMENT,
  OPENAI_API_KEY,
  HOSTING_DOMAIN,
} from "./config/config.js";

import {
  generateTranscriptions,
} from "./util/transcribe.js";

import {
  getFunctionUrl,
  dataToBody,
  largeDispatchInstance,
  dispatchTask,
} from "./util/dispatch.js";

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
  return libraryAddItemFirestore(uid, data, app);
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
  return generateUserItemManifest(app, uid, data);
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
  return libraryGetAllFirestore(app, uid, data);
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
  return libraryDeleteItemFirestore(uid, data, app);
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

export const v1catalogueAdd = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await catalogueAddFirestore(req, app));
});

export const v1catalogueGet = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return catalogueGetAllFirestore(app);
});

export const v1catalogueGetOPDS = onRequest({region: "europe-west1"}, async (req, res) => {
  res.status(200).send(await generatePublicOPDS(app));
});

export const v1catalogueGetManifest = onRequest({region: "europe-west1"}, async (req, res) => {
  const catalogueId = req.path.split("/").pop();
  if (!catalogueId) {
    res.status(400).send("Catalogue ID is required");
    return;
  }
  console.log(`catalogueId: ${catalogueId}`);
  res.status(200).send(await generateManifest(app, "admin", catalogueId));
});

export const v1catalogueDelete = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await catalogueDeleteFirestore(req, app));
});

export const v1catalogueUpdate = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await catalogueUpdateFirestore(req, app));
});

// /v1/ai/generateImages
export const v1generateSceneImages = onRequest({region: "europe-west1", cors: true}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await generateImages(req, app));
});

export const v1getAi = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getAiFirestore(uid, data, app);
});

export const v1getLibraryItemScenes = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getLibraryScenesFirestore(uid, data, app);
});

export const v1getCatalogueItemScenes = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getCatalogueScenesFirestore(uid, data, app);
});


export const v1addLibraryItemScenes = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await scenesCreateLibraryItemFirestore(uid, data, app);
});

export const v1updateLibraryItemScenes = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await scenesUpdateLibraryItemFirestore(uid, data, app);
});

// Endpoints to use audible-opds-firebase
export const v1getAAXLoginURL = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getAAXLoginURL(uid, data, app);
});

export const v1aaxConnect = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  const auth = await getAAXAuth(uid, data, app);
  await dispatchTask("aaxPostAuthHook", {uid: uid, auth: auth});
  return auth;
});

export const v1AdminSubmitAAXAuth = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await submitAAXAuth(req, app));
});

// export const v1TMPaudiblePostAuthHook = onCall({
//   region: "europe-west1",
//   memory: "32GiB",
//   concurrency: 1,
//   timeoutSeconds: 540,
// }, async (context) => {
//   const {uid, data} = await validateOnCallAuth(context);
//   return await audiblePostAuthHook(uid, data, app);
// });

export const v1getAAXConnectStatus = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getAAXConnectStatusFirestore(uid);
});

export const v1disconnectAAX = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await disconnectAAXAuth(uid, data, app);
});

export const v1refreshAAXTokens = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await refreshAAXTokens(data);
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

export const v1catalogueProcessRaw = onRequest({
  region: "europe-west1",
}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await dispatchTask("processM4B", {sku: req.body.sku}));
});

export const v1getAAXAvailable = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getAAXAvailableFirestore(uid, data, app);
});

export const v1AdminSetAAXAvailable = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await setAAXAvailableFirestore(req, app));
});

export const v1getPrivateOPDSFeed = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await generatePrivateOPDS(uid, data, app);
});

export const v1getPrivateOPDSFeedURL = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return {url: `${HOSTING_DOMAIN.value()}/v1/tmp/privateOPDS/${uid}`};
});

export const v1TMPgetPrivateOPDSFeed = onRequest({region: "europe-west1"}, async (req, res) => {
  const uid = req.path.split("/").pop();
  res.status(200).send(await generatePrivateOPDS(uid, req.body, app));
});

export const v1TMPgetPrivateManifest = onRequest({region: "europe-west1"}, async (req, res) => {
  const pathParts = req.path.split("/");
  const uid = pathParts[pathParts.length - 2];
  const catalogueId = pathParts[pathParts.length - 1];
  res.status(200).send(await generateManifest(app, uid, catalogueId));
});

export const aaxPostAuthHook = onTaskDispatched(
    largeDispatchInstance(),
    async (req) => {
      // logger.debug(`aaxPostAuthHook: ${JSON.stringify(req.data)}`);
      // const body = req.data;
      const {body: body} = dataToBody(req);
      return await audiblePostAuthHook(body.uid, {auth: body.auth}, app);
    },
);

export const processM4B = onTaskDispatched(
    largeDispatchInstance(),
    async (req) => {
      logger.debug(`processM4B: ${JSON.stringify(req.data)}`);
      return await processRawPublicItem(dataToBody(req), app);
    },
);
