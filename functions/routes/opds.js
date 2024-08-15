/* eslint-disable require-jsdoc */
import app from "../firebase.js";
// import logger from "firebase-functions/logger";
import {onCall, onRequest} from "firebase-functions/v2/https";
import {validateOnCallAuth} from "../auth/auth.js";
import {
  HOSTING_DOMAIN,
} from "../config/config.js";

import {
  generatePrivateOPDS,
  generateManifest,
  generateUserItemManifest,
} from "../util/opds.js";

export const v1getPrivateOPDSFeed = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await generatePrivateOPDS(uid, data, app);
});

export const v1getPrivateOPDSFeedURL = onCall({region: "europe-west1"}, async (context) => {
  const {uid} = await validateOnCallAuth(context);
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
