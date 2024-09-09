/* eslint-disable require-jsdoc */
import {onRequest} from "firebase-functions/v2/https";
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import logger from "firebase-functions/logger";
import {validateOnRequestAdmin} from "../auth/auth.js";
import {
  deleteAllData,
} from "../storage/realtimeDb/database.js";

import {
  storeScenesInCache,
} from "../storage/realtimeDb/scenesCache.js";

import {
  microDispatchInstance,
  dataToBody,
  dispatchTask,
} from "../util/dispatch.js";

export const v1cacheNuke = onRequest({region: "europe-west1"}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await deleteAllData());
});

export const v1populateSceneCache = onRequest({
  region: "europe-west1",
}, async (req, res) => {
  await validateOnRequestAdmin(req);
  res.status(200).send(await dispatchTask("populateSceneCache", req.body));
});


export const populateSceneCache = onTaskDispatched(
    microDispatchInstance(),
    async (req) => {
      logger.debug(`populateSceneCache: ${JSON.stringify(req.data)}`);
      return await storeScenesInCache(dataToBody(req));
    },
);

