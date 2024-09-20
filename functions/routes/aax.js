/* eslint-disable require-jsdoc */
import {onCall, onRequest} from "firebase-functions/v2/https";
import logger from "../util/logger.js";
import {validateOnCallAuth, validateOnRequestAdmin} from "../auth/auth.js";
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import {
  getAAXLoginURL,
  getAAXAuth,
  refreshAAXTokens,
  audiblePostAuthHook,
  submitAAXAuth,
  disconnectAAXAuth,
  redirectToAAXLogin,
  aaxcTranscribe,
} from "../util/audibleOpdsHelper.js";

import {
  getAAXAvailableFirestore,
  setAAXAvailableFirestore,
  getAAXConnectStatusFirestore,
  deleteAAXAuthFirestore,
} from "../storage/firestore/users.js";

import {
  largeDispatchInstance,
  dataToBody,
  dispatchTask,
} from "../util/dispatch.js";

import {
  aaxcStreamer,
} from "../audio/aaxStream.js";

// /v1/ai/dalle3

// Endpoints to use audible-opds-firebase
export const v1getAAXLoginURL = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getAAXLoginURL(uid, data);
});

export const v1aaxConnect = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  const auth = await getAAXAuth(uid, data);
  await dispatchTask({
    functionName: "aaxPostAuthHook",
    data: {uid: uid, auth: auth},
    location: "us-central1",
  });
  return auth;
});

export const v1AdminSubmitAAXAuth = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await submitAAXAuth(req));
});

export const v1getAAXConnectStatus = onCall({region: "europe-west1"}, async (context) => {
  const {uid} = await validateOnCallAuth(context);
  return await getAAXConnectStatusFirestore(uid);
});

export const v1disconnectAAX = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await disconnectAAXAuth(uid, data);
});

export const v1refreshAAXTokens = onCall({region: "europe-west1"}, async (context) => {
  const {data} = await validateOnCallAuth(context);
  return await refreshAAXTokens(data);
});

export const v1getAAXAvailable = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getAAXAvailableFirestore(uid, data);
});

export const v1AdminSetAAXAvailable = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await setAAXAvailableFirestore(req));
});

export const v1AdminDeleteAAXAuth = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await deleteAAXAuthFirestore(req));
});

export const aaxPostAuthHook = onTaskDispatched(
    largeDispatchInstance(),
    async (req) => {
      // logger.debug(`aaxPostAuthHook: ${JSON.stringify(req.data)}`);
      // const body = req.data;
      const {body: body} = dataToBody(req);
      return await audiblePostAuthHook(body.uid, {auth: body.auth});
    },
);

export const aaxDispatchTranscriptions = onTaskDispatched(
    largeDispatchInstance(),
    async (req) => {
      logger.debug(`aaxDispatchTranscriptions: ${JSON.stringify(req.data)}`);
      return await aaxcTranscribe(dataToBody(req).body);
    },
);

export const v1streamAax = onRequest({region: "europe-west1"}, async (req, res) => {
  // await validateOnRequestAdmin(req);
  await aaxcStreamer(req, res);
});

export const v1aaxConnectRedirect = onRequest({region: "europe-west1"}, async (req, res) => {
  await redirectToAAXLogin(req, res);
});
