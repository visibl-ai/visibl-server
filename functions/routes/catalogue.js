/* eslint-disable require-jsdoc */
import app from "../firebase.js";
// import logger from "firebase-functions/logger";
import {onCall, onRequest} from "firebase-functions/v2/https";
import {validateOnCallAuth, validateOnRequestAdmin} from "../auth/auth.js";
import {
  catalogueAddFirestore,
  catalogueGetAllFirestore,
  catalogueDeleteFirestore,
  catalogueUpdateFirestore,
} from "../storage/firestore/catalogue.js";
import {
  generatePublicOPDS,
  generateManifest,
} from "../util/opds.js";
import {
  dispatchTask,
} from "../util/dispatch.js";

export const v1catalogueAdd = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await catalogueAddFirestore(req, app));
});

export const v1catalogueGet = onCall({region: "europe-west1"}, async (context) => {
  // eslint-disable-next-line no-unused-vars
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

export const v1catalogueProcessRaw = onRequest({
  region: "europe-west1",
}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await dispatchTask("processM4B", {sku: req.body.sku}));
});
