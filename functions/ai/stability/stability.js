/* eslint-disable camelcase */
/* eslint-disable require-jsdoc */
import axios from "axios";
import FormData from "form-data";
import {Readable} from "stream";
import logger from "firebase-functions/logger";
import {
  STABILITY_API_KEY,
} from "../../config/config.js";

import {
  getFileStream,
  uploadStreamAndGetPublicLink,
} from "../../storage/storage.js";

import {
  queueGetEntries,
  queueSetItemsToProcessing,
  queueSetItemsToComplete,
} from "../../storage/firestore/queue.js";

import {
  saveImageResultsMultipleScenes,
} from "../imageGen.js";

import {
  webpStream,
} from "../../util/sharp.js";

const STABILITY_API_URL = "https://api.stability.ai/v2beta/stable-image";
const STABILITY_API_REQUESTS_PER_10_SECONDS = 150;
const STABILITY_DEFAULT_CONTROL_STRENGTH = 0.85; // 0.35 is way too low. We might need to increase this.

async function stabilityForm({inputPath, formData}) {
  const imageStream = await getFileStream({path: inputPath});
  const inputFileName = inputPath.split("/").pop();
  const form = new FormData();
  form.append("image", imageStream,
      {
        filename: inputFileName, // Adjust as necessary
      },
  );
  Object.entries(formData).forEach(([key, value]) => {
    form.append(key, value);
  });
  return form;
}

async function stabilityRequestToStream({url, form}) {
  const response = await axios.postForm(
      url,
      form,
      {
        validateStatus: undefined,
        responseType: "arraybuffer",
        headers: {
          Authorization: `Bearer ${STABILITY_API_KEY.value()}`,
          Accept: "image/*",
          ...form.getHeaders(),
        },
      },
  );
  if (response.status === 200) {
    const buffer = Buffer.from(response.data);
    const stream = Readable.from(buffer);
    return stream;
  } else {
    throw new Error(`${response.status}: ${response.data.toString()}`);
  }
}


async function outpaint(request) {
  const {
    inputPath,
    outputPath,
    left=0,
    right=0,
    down=0,
    up=0,
    outputFormat="jpeg"} = request;

  const form = await stabilityForm({inputPath, formData: {
    left,
    right,
    down,
    up,
    output_format: outputFormat,
  }});
  const stream = await stabilityRequestToStream({url: `${STABILITY_API_URL}/edit/outpaint`, form});
  logger.debug(`Outpainting image complete ${outputPath}`);
  return await uploadStreamAndGetPublicLink({stream: webpStream({sourceStream: stream}), filename: outputPath});
}

const outpaintTall = async (request) => {
  const {inputPath, outputPathWithoutExtension, pixels=384} = request;
  return await outpaint({
    inputPath,
    outputPath: `${outputPathWithoutExtension}.9.16.webp`,
    up: pixels,
    down: pixels,
  });
};

const outpaintWideAndTall = async (request) => {
  const {inputPath, outputPathWithoutExtension, pixels=384} = request;
  logger.debug(`Outpainting image ${inputPath} to ${outputPathWithoutExtension}`);
  const tallPromise = outpaint({
    inputPath,
    outputPath: `${outputPathWithoutExtension}.9.16.webp`,
    up: pixels,
    down: pixels,
  });

  const widePromise = outpaint({
    inputPath,
    outputPath: `${outputPathWithoutExtension}.16.9.webp`,
    left: pixels,
    right: pixels,
  });

  const [upDownResult, leftRightResult] = await Promise.all([tallPromise, widePromise]);

  return {
    tall: upDownResult,
    wide: leftRightResult,
  };
};

// Recursively generates images for a chapter.
// will return a array of results with the resultKeys in each object,
// and the result in successKeys[i]
/* For stability, resultKeys should be:
 * {
 *   result: true,
 *   chapter: chapter,
 *   scene_number: scene_number,
 *   theme: theme, (can be undefined for outpaint)
 * }
 *
 * successKeys should be:
 *
 */
const batchStabilityRequest = async (params) => {
  const {
    functionsToCall,
    paramsForFunctions,
    resultKeys = [],
    successKeys = [],
    requestsPer10Seconds = STABILITY_API_REQUESTS_PER_10_SECONDS,
  } = params;
  let startTime = Date.now();
  let promises = [];
  let results = [];

  for (let i = 0; i < functionsToCall.length; i++) {
    resultKeys[i] = resultKeys[i] || {}; // check for empty list.
    successKeys[i] = successKeys[i] || "result";

    promises.push((async () => {
      try {
        const result = await functionsToCall[i](paramsForFunctions[i]);
        return {
          ...resultKeys[i],
          [successKeys[i]]: result,
        };
      } catch (error) {
        logger.error(`Error in function call: ${error.message}`);
        return {
          ...resultKeys[i],
          result: false,
          [successKeys[i]]: {error: error.message},
        };
      }
    })());

    if (promises.length >= requestsPer10Seconds) {
      logger.debug(`STABILITY: Making ${promises.length} requests`);
      results = results.concat(await Promise.all(promises));
      promises = []; // clear old promises.
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < 10000) {
        logger.debug(`Waiting ${10000 - elapsedTime} milliseconds`);
        await new Promise((resolve) => setTimeout(resolve, 10000 - elapsedTime));
      }
      startTime = Date.now();
    }
  }

  logger.debug(`STABILITY: Making final ${promises.length} requests`);
  results = results.concat(await Promise.all(promises));
  return results;
};

const structure = async (request) => {
  const {
    inputPath,
    outputPathWithoutExtension,
    prompt,
    control_strength=STABILITY_DEFAULT_CONTROL_STRENGTH,
    outputFormat="jpeg"} = request;
  const form = await stabilityForm({inputPath, formData: {
    prompt,
    control_strength,
    output_format: outputFormat,
  }});
  const stream = await stabilityRequestToStream({url: `${STABILITY_API_URL}/control/structure`, form});
  logger.debug(`Structuring image complete ${outputPathWithoutExtension}`);
  return await uploadStreamAndGetPublicLink({stream: webpStream({sourceStream: stream}), filename: `${outputPathWithoutExtension}.structured.webp`});
};

const testStabilityBatch = async (request) => {
  const {
    paramsForFunctions,
    resultKeys,
    requestsPer10Seconds,
    successKeys,
  } = request;
  logger.debug(JSON.stringify(paramsForFunctions));
  logger.debug(`Testing stability batch with ${paramsForFunctions.length} requests, ${JSON.stringify(paramsForFunctions)}`);
  return await batchStabilityRequest({
    functionsToCall: [
      outpaintWideAndTall,
      structure,
      structure,
      () => {
        throw Error("This is a test error");
      },
    ],
    paramsForFunctions,
    resultKeys,
    requestsPer10Seconds,
    successKeys,
  });
};

const queueEntryTypeToFunction = (entryType) => {
  switch (entryType) {
    case "outpaint":
      return outpaint;
    case "outpaintTall":
      return outpaintTall;
    case "outpaintWideAndTall":
      return outpaintWideAndTall;
    case "structure":
      return structure;
    default:
      throw new Error(`Unknown entry type: ${entryType}`);
  }
};

function validateQueueEntry(queueEntry) {
  // Check that mandatory params are present.
  if (queueEntry.inputPath === undefined || queueEntry.outputPathWithoutExtension === undefined ||
      queueEntry.sceneId === undefined || queueEntry.chapter === undefined ||
      queueEntry.scene_number === undefined) {
    const missingEntries = [];
    if (queueEntry.inputPath === undefined) missingEntries.push("inputPath");
    if (queueEntry.outputPathWithoutExtension === undefined) missingEntries.push("outputPathWithoutExtension");
    if (queueEntry.sceneId === undefined) missingEntries.push("sceneId");
    if (queueEntry.chapter === undefined) missingEntries.push("chapter");
    if (queueEntry.scene_number === undefined) missingEntries.push("scene_number");
    if (missingEntries.length > 0) {
      logger.warn(`stabilityQueue: Missing mandatory params for queue item: ${missingEntries.join(", ")}`);
    }
    return false;
  }
  return true;
}

// This function is the main entry point for the stability queue.
// It will get the pending items from the queue, process them, and then update the queue.
// It will also handle the case where there are more items in the queue than can be processed in a single call.
// It will recursively call itself until all items are processed.
const stabilityQueue = async () => {
  // 1. get pending items from the queue.
  let queue = await queueGetEntries({type: "stability", status: "pending", limit: STABILITY_API_REQUESTS_PER_10_SECONDS});
  logger.debug(`stabilityQueue: ${queue.length} items in the queue`);
  if (queue.length === 0) {
    logger.debug("stabilityQueue: No items in the queue");
    return;
  }
  // 2. set those items to processing.
  await queueSetItemsToProcessing({queue});
  // 3. process the items.
  const functionsToCall = [];
  const paramsForFunctions = [];
  const resultKeys = [];
  const successKeys = [];
  for (let i = 0; i < queue.length; i++) {
    if (!validateQueueEntry(queue[i].params)) {
      logger.warn(`stabilityQueue: queueEntry: ${JSON.stringify(queue[i])}`);
      continue;
    }
    functionsToCall.push(queueEntryTypeToFunction(queue[i].entryType));
    paramsForFunctions.push({
      inputPath: queue[i].params.inputPath,
      outputPathWithoutExtension: queue[i].params.outputPathWithoutExtension,
      prompt: queue[i].params.prompt,
    });
    resultKeys.push({
      result: true,
      chapter: queue[i].params.chapter,
      scene_number: queue[i].params.scene_number,
      theme: queue[i].params.prompt,
      sceneId: queue[i].params.sceneId,
    });
    successKeys.push("tall");
  }
  logger.debug(`======= STARTING BATCH WITH STABILITY =========`);
  const results = await batchStabilityRequest({
    functionsToCall,
    paramsForFunctions,
    resultKeys,
    successKeys,
  });
  logger.debug(`======= ENDING BATCH WITH STABILITY =========`);
  logger.debug(`batchStabilityRequest results: ${JSON.stringify(results)}`);
  // 4. save results as required
  await saveImageResultsMultipleScenes({results});

  // 5. update items to completed.
  await queueSetItemsToComplete({queue});

  // 5. if there remaining items in the queue, initiate the next batch.
  queue = await queueGetEntries({type: "stability", status: "pending", limit: STABILITY_API_REQUESTS_PER_10_SECONDS});
  if (queue.length > 0) {
    await stabilityQueue();
  }
};

export {
  outpaint,
  structure,
  outpaintTall,
  outpaintWideAndTall,
  batchStabilityRequest,
  testStabilityBatch,
  stabilityQueue,
};
