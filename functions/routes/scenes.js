/* eslint-disable require-jsdoc */
// import logger from "firebase-functions/logger";
import {onCall, onRequest} from "firebase-functions/v2/https";
import {validateOnCallAuth, validateOnRequestAdmin} from "../auth/auth.js";

import {
  getAiFirestore,
} from "../storage/firestore.js";

import {
  getGlobalScenesFirestore,
  getCatalogueScenesFirestore,
  scenesCreateLibraryItemFirestore,
  scenesUpdateLibraryItemFirestore,
} from "../storage/firestore/scenes.js";

import {
  dispatchTask,
} from "../util/dispatch.js";

export const v1generateSceneImages = onRequest({region: "europe-west1", cors: true}, async (req, res) => {
  await validateOnRequestAdmin(req);
  await dispatchTask("generateSceneImages", req.body, 60 * 5, 1);
  res.status(200).send({dispatched: true});
});

export const v1getAi = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getAiFirestore(uid, data);
});

export const v1getLibraryScenes = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getGlobalScenesFirestore(uid, data);
});

export const v1getCatalogueItemScenes = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await getCatalogueScenesFirestore(uid, data);
});


export const v1addLibraryItemScenes = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await scenesCreateLibraryItemFirestore(uid, data);
});

export const v1updateLibraryItemScenes = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await scenesUpdateLibraryItemFirestore(uid, data);
});
