/* eslint-disable require-jsdoc */
import {onRequest} from "firebase-functions/v2/https";
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import logger from "firebase-functions/logger";
import {validateOnRequestAdmin} from "../auth/auth.js";
import {
  queueNuke,
  queueAddEntries,
  queueGetEntries,
  queueUpdateEntries,
} from "../storage/firestore/queue.js";

import {
  largeDispatchInstance,
  dataToBody,
} from "../util/dispatch.js";

import {stabilityQueue} from "../ai/stability/stability.js";
import {dalleQueue} from "../ai/openai/dallE.js";

export const v1queueNuke = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await queueNuke(req.body));
});

export const v1queueAdd = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await queueAddEntries(req.body));
});

export const v1queueGet = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await queueGetEntries(req.body));
});

export const v1queueUpdate = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await queueUpdateEntries(req.body));
});

export const launchStabilityQueue = onTaskDispatched(
    largeDispatchInstance(),
    async (req) => {
      logger.debug(`launchStabilityQueue: ${JSON.stringify(req.data)}`);
      return await stabilityQueue(dataToBody(req));
    },
);

export const launchDalleQueue = onTaskDispatched(
    largeDispatchInstance(),
    async (req) => {
      logger.debug(`launchDalleQueue: ${JSON.stringify(req.data)}`);
      return await dalleQueue(dataToBody(req));
    },
);

