/* eslint-disable require-jsdoc */
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
  graphScenes16k,
  graphCharacterDescriptionsOAI,
  graphLocationDescriptionsOAI,
  augmentScenes,
} from "../ai/graph.js";

import {
  outpaintWideAndTall,
  structure,
  testStabilityBatch,
} from "../ai/stability/stability.js";

import {
  microDispatchInstance,
  dataToBody,
} from "../util/dispatch.js";

export const v1AdminOutpaintImage = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await outpaintWideAndTall(req.body));
});

export const v1AdminStructureImage = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await structure(req.body));
});

export const v1AdminBatchStabilityTEST = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await testStabilityBatch(req.body));
});

// Dispatch Tasks.

export const generateGraphCharacters = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`generateGraphCharacters: ${JSON.stringify(req.data)}`);
      return await graphCharacters(dataToBody(req).body);
    });

export const generateGraphLocations = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`generateGraphLocations: ${JSON.stringify(req.data)}`);
      return await graphLocations(dataToBody(req).body);
    });

export const generateGraphCharacterDescriptions = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphCharacterDescriptions: ${JSON.stringify(req.data)}`);
      return await graphCharacterDescriptions(dataToBody(req).body);
    });

export const generateGraphLocationDescriptions = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphLocationDescriptions: ${JSON.stringify(req.data)}`);
      return await graphLocationDescriptions(dataToBody(req).body);
    });

export const generateGraphSummarizeDescriptions = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphSummarizeDescriptions: ${JSON.stringify(req.data)}`);
      return await graphSummarizeDescriptions(dataToBody(req).body);
    });

export const generateGraphScenes = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphScenes: ${JSON.stringify(req.data)}`);
      return await graphScenes(dataToBody(req).body);
    });

export const generateGraphScenes16k = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphScenes16k: ${JSON.stringify(req.data)}`);
      return await graphScenes16k(dataToBody(req).body);
    });

export const generateGraphCharacterDescriptionsOAI = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphCharacterDescriptionsOAI: ${JSON.stringify(req.data)}`);
      return await graphCharacterDescriptionsOAI(dataToBody(req).body);
    });

export const generateGraphLocationDescriptionsOAI = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`graphLocationDescriptionsOAI: ${JSON.stringify(req.data)}`);
      return await graphLocationDescriptionsOAI(dataToBody(req).body);
    });

export const generateAugmentScenes = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`augmentScenes: ${JSON.stringify(req.data)}`);
      return await augmentScenes(dataToBody(req).body);
    });
