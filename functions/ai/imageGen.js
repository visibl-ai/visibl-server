/* eslint-disable require-jsdoc */
import {logger} from "firebase-functions/v2";

import {ENVIRONMENT} from "../config/config.js";
import {
  getScene,
  storeScenes,
} from "../storage/storage.js";

import {
  // getSceneFirestore,
  sceneUpdateChapterGeneratedFirestore,
} from "../storage/firestore/scenes.js";

import {
  dispatchTask,
} from "../util/dispatch.js";

import {
  outpaintTall,
  batchStabilityRequest,
} from "./stability/stability.js";

import {
  OPENAI_DALLE_3_IMAGES_PER_MINUTE,
} from "./openai/openaiLimits.js";

import {
  sceneFromCurrentTime,
  scenesToGenerateFromCurrentTime,
} from "../util/sceneHelpers.js";

import {
  dalle3,
} from "./openai/dallE.js";

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

async function batchOutpaint(params) {
  const {images, sceneId} = params;
  // Now we need to outpaint the generated images.
  const resultKeys = [];
  const functionsToCall = [];
  const paramsForFunctions = [];
  const successKeys = [];
  images.forEach((image) => {
    if (image.square) {
      const timestamp = Date.now();
      const imagePath = `Scenes/${sceneId}/${image.chapter}_scene${image.scene_number}_${timestamp}`;
      successKeys.push("tall");
      resultKeys.push({
        type: sceneId,
        result: true,
        chapter: image.chapter,
        scene_number: image.scene_number,
        // TODO: We need to update tallBucketPath here somehow!
      });
      functionsToCall.push(outpaintTall);
      paramsForFunctions.push({
        inputPath: image.squareBucketPath,
        outputPathWithoutExtension: imagePath,
      });
    }
  });
  logger.debug(`======= STARTING BATCH OUTPAINT WITH STABILITY =========`);
  const outpaintedImages = await batchStabilityRequest({
    functionsToCall: functionsToCall,
    paramsForFunctions: paramsForFunctions,
    resultKeys: resultKeys,
    successKeys: successKeys,
  });
  logger.debug(`======= ENDING BATCH OUTPAINT WITH STABILITY =========`);
  return outpaintedImages;
}

// Recursively generates images for a chapter.
// Assumes chapter traversal.
async function imageGenChapterRecursive(req) {
  logger.debug(`imageGenChapterRecursive`);
  logger.debug(JSON.stringify(req.body));
  const {sceneId, lastSceneGenerated, totalScenes, chapter} = req.body;
  await sceneUpdateChapterGeneratedFirestore(sceneId, chapter, false, Date.now());
  const scenesToGenerate = getScenesToGenerate(lastSceneGenerated, totalScenes, chapter);
  logger.debug(`scenesToGenerate = ${JSON.stringify(scenesToGenerate)}`);
  const fullScenes = await getScene({sceneId});
  const scenes = formatScenesForGeneration(fullScenes, scenesToGenerate);
  const startTime = Date.now();
  const images = await dalle3(
      {
        scenes: scenes,
        sceneId: sceneId,
      },
  );
  await saveImageResults({
    images: images,
    sceneId: sceneId,
  });
  const outpaintedImages = await batchOutpaint({
    images: images,
    sceneId: sceneId,
  });
  await saveImageResults({
    images: outpaintedImages,
    sceneId: sceneId,
  });


  // Calculate the remaining time
  const endTime = Date.now();
  const elapsedTime = endTime - startTime;
  const remainingTime = Math.max(TIMEOUT - elapsedTime, 0);
  logger.debug(`Elapsed time: ${elapsedTime}ms, remaining time: ${remainingTime}ms`);
  const remainingTimeSeconds = Math.ceil(remainingTime / 1000);
  logger.debug(`imageGen complete for ${JSON.stringify(scenesToGenerate)} starting at ${lastSceneGenerated}.`);
  const nextSceneToGenerate = scenesToGenerate.pop().scene_number + 1;
  if (isNaN(nextSceneToGenerate) ||nextSceneToGenerate >= totalScenes) {
    logger.debug(`No more scenes to generate for ${sceneId} chapter ${chapter}`);
    await sceneUpdateChapterGeneratedFirestore(sceneId, chapter, true, Date.now());
    return;
  } else {
    await sceneUpdateChapterGeneratedFirestore(sceneId, chapter, false, Date.now());
    logger.debug(`Dispatching imageGenDispatcher with: delay ${remainingTimeSeconds}, lastSceneGenerated ${nextSceneToGenerate}, totalScenes ${totalScenes}, chapter ${chapter}`);
    // Dispatch with delay of remainingTime
    await imageDispatcher({
      sceneId: sceneId,
      lastSceneGenerated: nextSceneToGenerate,
      totalScenes: totalScenes,
      chapter: chapter,
    }, remainingTimeSeconds);
  }
}

async function imageDispatcher(request, delay) {
  await dispatchTask("generateSceneImages", request, 60 * 5, delay);
}

// start at 0.
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
    throw new Error("No matching scene found for the given currentTime");
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
  let scenes = formatScenesForGeneration(fullScenes, scenesToGenerate);
  const filteredScenes = scenes.filter((scene) => scene.sceneId !== sceneId);
  logger.debug(`Filtered out ${scenes.length - filteredScenes.length} scenes with matching sceneId`);
  scenes = filteredScenes;

  // const scene = await getSceneFirestore(sceneId);
  // const style = scene.prompt;

  const images = await dalle3({
    scenes: scenes,
    sceneId: sceneId,
  });
  await saveImageResults({
    images: images,
    sceneId: sceneId,
  });
  const outpaintedImages = await batchOutpaint({
    images: images,
    sceneId: sceneId,
  });
  const generatedScenes = await saveImageResults({
    images: outpaintedImages,
    sceneId: sceneId,
  });

  return scenesToGenerateFromCurrentTime({currentSceneNumber: sceneNumber, currentChapter: chapter, fullScenes: generatedScenes});
}

export {
  imageGenChapterRecursive,
  imageDispatcher,
  imageGenCurrentTime,
};
