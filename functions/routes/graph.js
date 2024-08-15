/* eslint-disable require-jsdoc */
import app from "../firebase.js";
import logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import {validateOnRequestAdmin} from "../auth/auth.js";

import {
  graphCharacters,
  graphLocations,
  graphCharacterDescriptions,
  graphLocationDescriptions,
  graphSummarizeDescriptions,
  graphScenes,
} from "../ai/graph.js";

import {
  outpaintWideAndTall,
} from "../ai/stability/stability.js";

import {
  microDispatchInstance,
  dataToBody,
} from "../util/dispatch.js";

export const v1AdminGraphCharacters = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await graphCharacters(app, req));
});

export const v1AdminGraphLocations = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await graphLocations(app, req));
});

export const v1AdminOutpaintImage = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await outpaintWideAndTall(app, req.body));
});

// Dispatch Tasks.

export const generateGraphCharacterDescriptions = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphCharacterDescriptions: ${JSON.stringify(req.data)}`);
      return await graphCharacterDescriptions(app, dataToBody(req));
    });

export const generateGraphLocationDescriptions = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphLocationDescriptions: ${JSON.stringify(req.data)}`);
      return await graphLocationDescriptions(app, dataToBody(req));
    });

export const generateGraphSummarizeDescriptions = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphSummarizeDescriptions: ${JSON.stringify(req.data)}`);
      return await graphSummarizeDescriptions(app, dataToBody(req));
    });

export const generateGraphScenes = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphScenes: ${JSON.stringify(req.data)}`);
      return await graphScenes(app, dataToBody(req));
    });

