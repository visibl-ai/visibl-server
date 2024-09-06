/* eslint-disable require-jsdoc */
import logger from "firebase-functions/logger";
import OpenAI from "openai";
import {OPENAI_API_KEY} from "../../config/config.js";
import {downloadImage} from "../../storage/storage.js";
import {
  queueGetEntries,
  queueSetItemsToProcessing,
  queueSetItemsToComplete,
} from "../../storage/firestore/queue.js";

import {
  saveImageResultsMultipleScenes,
  outpaintWithQueue,
} from "../imageGen.js";

import {geminiRequest} from "../gemini/gemini.js";
import {
  queueAddEntries,
  dalleQueueToUnique,
} from "../../storage/firestore/queue.js";


const OPENAI_DALLE_3_IMAGES_PER_MINUTE = 200;

// Generate the seed images for scenes using Dall-E-3.
// Images are square, so they need to be outpainted to tall late
// Makes a batch request to singleGeneration
// Returns an array of image results.
async function dalle3(request) {
  try {
    const {
      scenes, sceneIds, retries = [],
    } = request;
    if (scenes.length > OPENAI_DALLE_3_IMAGES_PER_MINUTE) {
      throw new Error(`Maximum ${OPENAI_DALLE_3_IMAGES_PER_MINUTE} scenes per request`);
    }
    if (sceneIds === undefined) {
      throw new Error("dalle3: sceneId is required");
    }
    logger.debug("scenes.length = " + scenes.length);
    logger.info("scenes = " + JSON.stringify(scenes).substring(0, 100));
    if (!scenes) {
      throw new Error("No scenes found - use interpretChapter first.");
    }
    // Now we save the scenes to the chapter.
    logger.info("===Starting DALL-E-3 image generation===");

    const openai = new OpenAI(OPENAI_API_KEY.value());
    logger.debug(`scenes length = ${scenes.length}`);
    const promises = scenes.map(async (scene, i) => singleGeneration({
      scene, sceneId: sceneIds[i], retry: retries[i] || true, openai,
    }));
    const images = await Promise.all(promises);
    logger.info("===ENDING DALL-E-3 image generation===");
    return images;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

// Generate a single image for a scene using Dall-E-3.
// Returns the image URL.
// Retrys a single time if there is an error on the first try.
async function singleGeneration(request) {
  const {
    scene, sceneId, retry, openai,
  } = request;
  let imageGenResult = false;
  const dallE3Config = {
    model: "dall-e-3",
    quality: "hd",
    size: "1024x1024",
    style: "vivid",
    n: 1,
    response_format: "url",
  };
  const sceneDescription = {
    "description": scene.description,
    "characters": scene.characters,
    "locations": scene.locations,
    "viewpoint": scene.viewpoint,
    // "aspect_ratio": "Vertical Aspect Ratio",
  };
  dallE3Config.prompt = JSON.stringify(sceneDescription);
  logger.debug("image description = " + dallE3Config.prompt.substring(0, 250));
  let gcpURL = "";
  let squareImagePath;
  let outpaintResult;
  let imageResponse;
  let description = "";
  try {
    imageResponse = await openai.images.generate(dallE3Config);
    const imageUrl = imageResponse.data[0].url;
    logger.debug("imageUrl = " + imageUrl);// .substring(0, 100));
    // logger.debug(`imageResponse = ${JSON.stringify(imageResponse.data[0], null, 2)}`)
    description = imageResponse.data[0].revised_prompt;
    logger.debug(`revised prompt = ${description.substring(0, 150)}${description.length > 150 ? "..." : ""}`);
    // const imagePath = `${imageDir}/${i + 1}.jpg`;
    const timestamp = Date.now();
    const imagePath = `Scenes/${sceneId}/${scene.chapter}_scene${scene.scene_number}_${timestamp}`;
    squareImagePath = `${imagePath}.4.3.png`;
    // logger.debug("imageName = " + imageName);
    gcpURL = await downloadImage(imageUrl, squareImagePath);
    imageGenResult = true;
    // logger.debug(`Outpainting ${squareImagePath} with Stability.`);
    // outpaintResult = await outpaintTall({
    //   inputPath: squareImagePath,
    //   outputPathWithoutExtension: imagePath,
    // });
  } catch (error) {
    logger.error(`Error generating image: ${scene.scene_number} ${scene.chapter} ${sceneId} ${JSON.stringify(sceneDescription)} ${error.toString()}`);
    await handleDalle3Error({scene, sceneId, retry, error});
  }
  return {
    type: "image",
    result: imageGenResult,
    url: outpaintResult,
    square: gcpURL,
    squareBucketPath: squareImagePath,
    // tall: outpaintResult,
    description: description,
    scene_number: scene.scene_number,
    chapter: scene.chapter,
    sceneId: sceneId,
  };
}

async function handleDalle3Error(params) {
  let {scene, sceneId, retry, error} = params;
  if (retry) {
    retry = false;
    logger.warn(`Going to retry image generation for scene ${scene.scene_number} in chapter ${scene.chapter} for scene ${sceneId}`);
    if (error.message.includes("safety") || error.message.includes("filter")) {
      logger.warn(`Safety error, moderating scene description once.`);
      scene = await moderateSceneDescription({scene, sceneId});
    } else {
      logger.warn(`Unkown error, lets retry once.`);
    }
    await addSceneToQueue({scene, sceneId, retry});
  } else {
    logger.warn(`Not retrying image generation for scene ${scene.scene_number} in chapter ${scene.chapter} for scene ${sceneId}, returning default object.`);
  }
}

async function moderateSceneDescription(params) {
  const {scene, sceneId} = params;
  const geminiResponse = await geminiRequest({
    prompt: "moderateScene",
    message: JSON.stringify(scene),
    replacements: [],
  });
  if (geminiResponse.result && geminiResponse.result.scene) {
    const moderatedScene = {
      ...scene,
      ...geminiResponse.result.scene,
    };
    return moderatedScene;
  } else {
    logger.error(`Failed to moderate scene description for scene ${scene.scene_number} in chapter ${scene.chapter} for scene ${sceneId}`);
    return scene;
  }
}

async function addSceneToQueue(params) {
  const {scene, sceneId, retry} = params;
  const types = ["dalle"];
  const entryTypes = ["dalle3"];
  const entryParams = [{scene, sceneId, retry}];
  const uniques = [dalleQueueToUnique({
    type: "dalle",
    entryType: "dalle3",
    sceneId,
    chapter: scene.chapter,
    scene_number: scene.scene_number,
    retry,
  })];
  await queueAddEntries({
    types,
    entryTypes,
    entryParams,
    uniques,
  });
}

function validateQueueEntry(queueEntry) {
  if (!queueEntry.scene || !queueEntry.sceneId ) {
    const missingEntries = [];
    if (!queueEntry.scene) missingEntries.push("scene");
    if (!queueEntry.sceneId) missingEntries.push("sceneId");
    if (missingEntries.length > 0) {
      logger.warn(`dalleQueue: Missing mandatory params for queue item: ${missingEntries.join(", ")}`);
    }
    return false;
  }
  return true;
}

// This function is the main entry point for the dalle queue.
// It will get the pending items from the queue, process them, and then update the queue.
// It will also handle the case where there are more items in the queue than can be processed in a single call.
// It will recursively call itself until all items are processed.
const dalleQueue = async () => {
  // 1. get pending items from the queue.
  let queue = await queueGetEntries({type: "dalle", status: "pending", limit: OPENAI_DALLE_3_IMAGES_PER_MINUTE});
  logger.debug(`dalleQueue: ${queue.length} items in the queue`);
  if (queue.length === 0) {
    logger.debug("dalleQueue: No items in the queue");
    return;
  }
  // 2. set those items to processing.
  await queueSetItemsToProcessing({queue});
  // 3. process the items.
  const scenes = [];
  const sceneIds = [];
  const retries = [];
  for (let i = 0; i < queue.length; i++) {
    if (!validateQueueEntry(queue[i].params)) {
      continue;
    }
    scenes.push(queue[i].params.scene);
    sceneIds.push(queue[i].params.sceneId);
    retries.push(queue[i].params.retry);
  }
  const startTime = Date.now();
  const results = await dalle3({scenes, sceneIds, retries});
  logger.debug(`dalleQueue results: ${JSON.stringify(results)}`);
  const endTime = Date.now();
  // 4. save results as required
  await saveImageResultsMultipleScenes({results});
  await outpaintWithQueue({results});
  // 5. update items to completed.
  await queueSetItemsToComplete({queue});
  // 6. if there remaining items in the queue, initiate the next batch.
  queue = await queueGetEntries({type: "dalle", status: "pending", limit: OPENAI_DALLE_3_IMAGES_PER_MINUTE});
  if (queue.length > 0) {
    // Wait the apropriate amount of time due to the rate limit.
    const waitTime = 60000 - (endTime - startTime);
    logger.debug(`Waiting ${waitTime}ms due to rate limit`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    await dalleQueue();
  }
};

export {
  dalle3,
  dalleQueue,
};
