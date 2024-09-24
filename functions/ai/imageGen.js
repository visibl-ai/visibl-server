/* eslint-disable require-jsdoc */
import logger from "../util/logger.js";

import {ENVIRONMENT} from "../config/config.js";
import {
  getScene,
  storeScenes,
} from "../storage/storage.js";

import {
  getSceneFirestore,
  sceneUpdateChapterGeneratedFirestore,
} from "../storage/firestore/scenes.js";

import {
  dispatchTask,
} from "../util/dispatch.js";

import {
  OPENAI_DALLE_3_IMAGES_PER_MINUTE,
} from "./openai/openaiLimits.js";

import {
  sceneFromCurrentTime,
  scenesToGenerateFromCurrentTime,
} from "../util/sceneHelpers.js";

import {
  queueAddEntries,
  stabilityQueueToUnique,
  dalleQueueToUnique,
} from "../storage/firestore/queue.js";

const TIMEOUT = 60000;

// Return actual scene objects from the fullScenes array.
// based on the scenesToGenerate array.
function formatScenesForGeneration(fullScenes, scenesToGenerate) {
  const scenes = [];
  for (const sceneToGenerate of scenesToGenerate) {
    const sceneToAdd = fullScenes[sceneToGenerate.chapter].find(
        (scene) => scene.scene_number === sceneToGenerate.scene_number,
    );
    if (sceneToAdd) {
      sceneToAdd.chapter = sceneToGenerate.chapter;
      scenes.push(sceneToAdd);
    } else {
      logger.warn(`Scene ${sceneToGenerate.scene_number} not found in chapter ${sceneToGenerate.chapter}`);
    }
  }
  return scenes;
}

async function saveImageResultsMultipleScenes(params) {
  const {results} = params;
  const groupedResults = groupResultsBySceneId(results);
  for (const [sceneId, sceneResults] of Object.entries(groupedResults)) {
    logger.debug(`Saving image results for sceneId ${sceneId}`);
    await saveImageResults({
      images: sceneResults,
      sceneId: sceneId,
    });
  }
}

// saves image results. Expects an output from dalle3 or batchStabilityRequest.
async function saveImageResults(params) {
  const {
    images,
    sceneId,
  } = params;
  logger.debug(`Reloading scenes before editing.`);
  const fullScenes = await getScene({sceneId});
  for (const image of images) {
    // logger.debug(`image = ${JSON.stringify(image)}`);
    if (image.result) {
      const sceneIndex = fullScenes[image.chapter].findIndex((s) => s.scene_number === image.scene_number);
      logger.debug(`chapter ${image.chapter}, sceneIndex ${sceneIndex}, sceneNumber ${image.scene_number}`);
      if (sceneIndex !== -1) {
        if (image.tall) fullScenes[image.chapter][sceneIndex].image = image.tall;
        if (image.square) fullScenes[image.chapter][sceneIndex].square = image.square;
        if (image.squareBucketPath) fullScenes[image.chapter][sceneIndex].squareBucketPath = image.squareBucketPath;
        if (image.tall) fullScenes[image.chapter][sceneIndex].tall = image.tall;
        if (image.tallBucketPath) fullScenes[image.chapter][sceneIndex].tallBucketPath = image.tallBucketPath;
        if (image.wide) fullScenes[image.chapter][sceneIndex].wide = image.wide;
        if (image.wideBucketPath) fullScenes[image.chapter][sceneIndex].wideBucketPath = image.wideBucketPath;
        if (image.description) fullScenes[image.chapter][sceneIndex].prompt = image.description;
        fullScenes[image.chapter][sceneIndex].sceneId = sceneId;
      }
    }
  }
  await storeScenes({sceneId, sceneData: fullScenes});
  logger.debug(`Stored updated scenes.`);
  return fullScenes;
}

// Returns an array of scenes to generate, assuming chapter traversal.
// The number of scenes to generate is limited by OPENAI_DALLE_3_IMAGES_PER_MINUTE.
function getScenesToGenerate(lastSceneGenerated, totalScenes, chapter) {
  const scenesToGenerate = [];
  const i = lastSceneGenerated;
  for (let j = i; j < i + OPENAI_DALLE_3_IMAGES_PER_MINUTE && j < totalScenes; j++) {
    scenesToGenerate.push({scene_number: j, chapter: chapter});
  }
  return scenesToGenerate;
}

function groupResultsBySceneId(results) {
  return results.reduce((acc, result) => {
    if (!acc[result.sceneId]) {
      acc[result.sceneId] = [];
    }
    acc[result.sceneId].push(result);
    return acc;
  }, {});
}

async function outpaintWithQueue(params) {
  const {results} = params;
  // First we group results by sceneId.
  const groupedResults = groupResultsBySceneId(results);
  // For each sceneId group, we batch add the outpaint requests to the queue.
  for (const [sceneId, sceneResults] of Object.entries(groupedResults)) {
  // Now we need to outpaint the generated images.
    const types = [];
    const entryTypes = [];
    const entryParams = [];
    const uniques = [];
    sceneResults.forEach((image) => {
      if (image.square) {
        const timestamp = Date.now();
        const imagePath = `Scenes/${sceneId}/${image.chapter}_scene${image.scene_number}_${timestamp}`;
        types.push("stability");
        entryTypes.push("outpaintTall");
        entryParams.push({
          inputPath: image.squareBucketPath,
          outputPathWithoutExtension: imagePath,
          sceneId: sceneId,
          chapter: image.chapter,
          scene_number: image.scene_number,
          retry: true,
        });
        uniques.push(stabilityQueueToUnique({
          type: "stability",
          entryType: "outpaintTall",
          sceneId: sceneId,
          chapter: image.chapter,
          scene_number: image.scene_number,
          retry: true,
        }));
      }
    });
    await queueAddEntries({
      types,
      entryTypes,
      entryParams,
      uniques,
    });
  }
  // Now we dispatch the queue.
  await dispatchTask({
    functionName: "launchStabilityQueue",
    data: {},
  });
}

async function composeScenesWithQueue(params) {
  const {scenes, sceneId} = params;
  // Simply add to the queue, and dispatch the queue.
  const types = [];
  const entryTypes = [];
  const entryParams = [];
  const uniques = [];
  scenes.forEach((scene) => {
    types.push("dalle");
    entryTypes.push("dalle3");
    entryParams.push({
      scene,
      sceneId,
      retry: true,
    });
    uniques.push(dalleQueueToUnique({
      type: "dalle",
      entryType: "dalle3",
      sceneId,
      chapter: scene.chapter,
      scene_number: scene.scene_number,
      retry: true,
    }));
  });
  await queueAddEntries({
    types,
    entryTypes,
    entryParams,
    uniques,
  });
  await dispatchTask({
    functionName: "launchDalleQueue",
    data: {},
  });
  return;
}

// Add scenes to the queue for styling and launch queue.
async function styleScenesWithQueue(params) {
  let {scenes, sceneId, theme} = params;
  // Now we need to outpaint the generated images.
  const types = [];
  const entryTypes = [];
  const entryParams = [];
  const uniques = [];
  scenes = scenes.filter((scene) => scene.tall !== undefined);
  logger.debug(`Filtered out scenes without images, there are ${scenes.length} remaining.`);
  scenes.forEach((scene) => {
    if (scene.tall && sceneId) {
      const timestamp = Date.now();
      const bucketPath = `Scenes/${scene.sceneId}/${scene.tall.split("/").pop()}`; // Tall is not compressed.
      const imagePath = `Scenes/${sceneId}/${scene.chapter}_scene${scene.scene_number}_${timestamp}`;
      types.push("stability");
      entryTypes.push("structure");
      entryParams.push({
        inputPath: bucketPath,
        outputPathWithoutExtension: imagePath,
        prompt: theme,
        sceneId: sceneId,
        chapter: scene.chapter,
        scene_number: scene.scene_number,
        retry: true,
      });
      uniques.push(stabilityQueueToUnique({
        type: "stability",
        entryType: "structure",
        sceneId: sceneId,
        chapter: scene.chapter,
        scene_number: scene.scene_number,
        retry: true,
      }));
    }
  });
  await queueAddEntries({
    types,
    entryTypes,
    entryParams,
    uniques,
  });
  await dispatchTask({
    functionName: "launchStabilityQueue",
    data: {},
  });
}

// This function was written before the queue was implemented.
// Therefore it should be simplified to just add everything to the queue at once.
// But I'm busy, so I just removed the delay and let it run.
async function imageGenChapterRecursive(req) {
  logger.debug(`imageGenChapterRecursive`);
  logger.debug(JSON.stringify(req.body));
  let {sceneId, lastSceneGenerated, totalScenes, chapter} = req.body;
  const fullScenes = await getScene({sceneId});
  if (!totalScenes) {
    totalScenes = fullScenes[chapter].length;
  }
  await sceneUpdateChapterGeneratedFirestore(sceneId, chapter, false, Date.now());
  const scenesToGenerate = getScenesToGenerate(lastSceneGenerated, totalScenes, chapter);
  logger.debug(`scenesToGenerate = ${JSON.stringify(scenesToGenerate)}`);
  const scenes = formatScenesForGeneration(fullScenes, scenesToGenerate);
  const startTime = Date.now();
  await composeScenesWithQueue({scenes, sceneId});
  // Calculate the remaining time
  const endTime = Date.now();
  const elapsedTime = endTime - startTime;
  const remainingTime = Math.max(TIMEOUT - elapsedTime, 0);
  logger.debug(`Elapsed time: ${elapsedTime}ms, remaining time: ${remainingTime}ms`);
  // const remainingTimeSeconds = Math.ceil(remainingTime / 1000);
  logger.debug(`imageGen complete for ${JSON.stringify(scenesToGenerate)} starting at ${lastSceneGenerated}.`);
  const nextSceneToGenerate = scenesToGenerate.pop().scene_number + 1;
  if (isNaN(nextSceneToGenerate) ||nextSceneToGenerate >= totalScenes) {
    logger.debug(`No more scenes to generate for ${sceneId} chapter ${chapter}`);
    await sceneUpdateChapterGeneratedFirestore(sceneId, chapter, true, Date.now());
    return;
  } else {
    await sceneUpdateChapterGeneratedFirestore(sceneId, chapter, false, Date.now());
    logger.debug(`Dispatching imageGenDispatcher with: lastSceneGenerated ${nextSceneToGenerate}, totalScenes ${totalScenes}, chapter ${chapter}`);
    // Dispatch with delay of remainingTime
    await imageDispatcher({
      sceneId: sceneId,
      lastSceneGenerated: nextSceneToGenerate,
      totalScenes: totalScenes,
      chapter: chapter,
    }, 0);// remainingTimeSeconds);
  }
}

async function imageDispatcher(request, delay) {
  await dispatchTask({
    functionName: "generateSceneImages",
    data: request,
    deadline: 60 * 5,
    scheduleDelaySeconds: delay,
  });
}


async function imageGenCurrentTime(req) {
  logger.debug(`imageGenChapterRecursive`);
  logger.debug(JSON.stringify(req.body));
  const {sceneId, currentTime} = req.body;
  if (!sceneId || !currentTime) {
    throw new Error("sceneId and currentTime are required");
  }
  let fullScenes;
  try {
    fullScenes = await getScene({sceneId});
  } catch (error) {
    logger.error(`Error getting full scenes for ${sceneId}`);
    return {};
  }
  const {chapter, sceneNumber} = sceneFromCurrentTime(fullScenes, currentTime) || {};

  if (chapter === undefined || sceneNumber === undefined) {
    logger.warn(`No matching scene found for the given currentTime`);
    return;
  }

  logger.debug(`Found scene: Chapter ${chapter}, Scene ${sceneNumber}`);
  let precedingScenes = 2;
  let followingScenes = 10;
  if (ENVIRONMENT.value() === "development") {
    precedingScenes = 1;
    followingScenes = 1;
  }
  const scenesToGenerate = scenesToGenerateFromCurrentTime({
    currentSceneNumber: sceneNumber,
    currentChapter: chapter,
    fullScenes,
    precedingScenes,
    followingScenes,
  });
  const startingScenes = formatScenesForGeneration(fullScenes, scenesToGenerate);
  const filteredScenes = startingScenes.filter((scene) => scene.sceneId !== sceneId);
  logger.debug(`Filtered out ${startingScenes.length - filteredScenes.length} scenes with matching sceneId`);


  const scene = await getSceneFirestore(sceneId);

  const style = scene.prompt;
  if (style && style != "") {
    logger.debug(`Scene ID ${sceneId} has a style prompt: ${style}, styling ${filteredScenes.length} scenes`);
    return await styleScenesWithQueue({scenes: filteredScenes, sceneId, theme: style});
  } else {
    logger.debug(`Scene ID ${sceneId} no style prompt, composing images.`);
    await composeScenesWithQueue({scenes: filteredScenes, sceneId});
  }
  return;
}

async function retryFailedStabilityRequests({results}) {
  const failedRequests = results.filter((request) => request.result === false);
  if (failedRequests.length > 0) {
    logger.debug(`STABILITY: Number of failed requests: ${failedRequests.length}`);
    const types = [];
    const entryTypes = [];
    const entryParams = [];
    const uniques = [];
    failedRequests.forEach((request) => {
      logger.debug(`STABILITY: retryFailedStabilityRequests: request = ${JSON.stringify(request)}`);
      if (request.retry) {
        types.push("stability");
        entryTypes.push(request.entryType);
        entryParams.push({
          inputPath: request.inputPath,
          outputPathWithoutExtension: request.outputPathWithoutExtension,
          prompt: request.prompt,
          chapter: request.chapter,
          scene_number: request.scene_number,
          sceneId: request.sceneId,
          retry: false, // retry once.
        });
        uniques.push(stabilityQueueToUnique({
          type: "stability",
          entryType: request.entryType,
          sceneId: request.sceneId,
          chapter: request.chapter,
          scene_number: request.scene_number,
          retry: false,
        }));
      }
    });
    await queueAddEntries({
      types,
      entryTypes,
      entryParams,
      uniques,
    });
  }
}

export {
  imageGenChapterRecursive,
  imageDispatcher,
  imageGenCurrentTime,
  saveImageResults,
  saveImageResultsMultipleScenes,
  outpaintWithQueue,
  retryFailedStabilityRequests,
};
