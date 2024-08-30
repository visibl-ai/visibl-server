/* eslint-disable require-jsdoc */
import logger from "firebase-functions/logger";
import {onCall} from "firebase-functions/v2/https";
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import {validateOnCallAuth} from "../auth/auth.js";
import {
  largeDispatchInstance,
  mediumDispatchInstance,
  dataToBody,
} from "../util/dispatch.js";
import {
  imageGenChapterRecursive,
  imageGenCurrentTime,
} from "../ai/imageGen.js";

import {
  processRawPublicItem,
} from "../util/opds.js";
import {
  generateTranscriptions,
} from "../ai/transcribe.js";

export const v1generateTranscriptions = onCall({
  region: "europe-west1",
  memory: "32GiB",
  concurrency: 1,
  timeoutSeconds: 540,
}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return await generateTranscriptions(uid, data);
});

export const processM4B = onTaskDispatched(
    largeDispatchInstance(),
    async (req) => {
      logger.debug(`processM4B: ${JSON.stringify(req.data)}`);
      return await processRawPublicItem(dataToBody(req));
    },
);

export const generateSceneImages = onTaskDispatched(
    mediumDispatchInstance(50),
    async (req) => {
      logger.debug(`generateSceneImages: ${JSON.stringify(req.data)}`);
      return await imageGenChapterRecursive(dataToBody(req));
    },
);

export const generateSceneImagesCurrentTime = onTaskDispatched(
    mediumDispatchInstance(50),
    async (req) => {
      logger.debug(`generateSceneImagesCurrentTime: ${JSON.stringify(req.data)}`);
      return await imageGenCurrentTime(dataToBody(req));
    },
);
