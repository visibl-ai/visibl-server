/* eslint-disable require-jsdoc */
import {logger} from "firebase-functions/v2";
import OpenAI from "openai";
import {OPENAI_API_KEY} from "../../config/config.js";
import axios from "axios";
import {
  uploadStreamAndGetPublicLink,
  getScene,
  storeScenes,
} from "../../storage/storage.js";

import {
  getSceneFirestore,
  sceneUpdateChapterGeneratedFirestore,
} from "../../storage/firestore/scenes.js";

import {
  dispatchTask,
} from "../../util/dispatch.js";

import {
  outpaintTall,
} from "../stability/stability.js";

import {
  OPENAI_DALLE_3_IMAGES_PER_MINUTE,
} from "./openaiLimits.js";

import {
  sceneFromCurrentTime,
  scenesToGenerateFromCurrentTime,
} from "../../util/sceneHelpers.js";

const TIMEOUT = 60000;

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

async function generateImages(req) {
  try {
    // Scenes to generate is a [5,6,7,8] . Maximum 5.
    const {
      scenes,
      sceneId} = req;

    if (scenes.length > OPENAI_DALLE_3_IMAGES_PER_MINUTE) {
      throw new Error(`Maximum ${OPENAI_DALLE_3_IMAGES_PER_MINUTE} scenes per request`);
    }
    if (sceneId === undefined) {
      throw new Error("generateImages: sceneId is required");
    }
    const scene = await getSceneFirestore(sceneId);
    const theme = scene.prompt;
    let fullScenes = await getScene({sceneId});
    // /const scenes = formatScenesForGeneration(fullScenes, scenesToGenerate);
    // const scenes = chapterScenes.filter((singleScene, index) => scenesToGenerate.includes(index));
    logger.debug("scenes.length = " + scenes.length);
    logger.info("scenes = " + JSON.stringify(scenes).substring(0, 100));
    if (!scenes) {
      throw new Error("No scenes found - use interpretChapter first.");
    }
    // Now we save the scenes to the chapter.
    logger.info("===Starting DALL-E-3 image generation===");
    const images = await dalle3({
      scenes,
      theme,
      sceneId,
    });
    logger.info("===ENDING DALL-E-3 image generation===");
    logger.debug(`Reloading scenes before editing.`);
    fullScenes = await getScene({sceneId});
    for (const image of images) {
      // logger.debug(`image = ${JSON.stringify(image)}`);
      if (image.result) {
        const sceneIndex = fullScenes[image.chapter].findIndex((s) => s.scene_number === image.scene_number);
        logger.debug(`chapter ${image.chapter}, sceneIndex ${sceneIndex}, sceneNumber ${image.scene_number}`);
        if (sceneIndex !== -1) {
          fullScenes[image.chapter][sceneIndex].image = image.tall;
          fullScenes[image.chapter][sceneIndex].square = image.square;
          fullScenes[image.chapter][sceneIndex].tall = image.tall;
          fullScenes[image.chapter][sceneIndex].prompt = image.description;
          fullScenes[image.chapter][sceneIndex].sceneId = sceneId;
          logger.info("fullScenes[image.chapter][sceneIndex].image = " + fullScenes[image.chapter][sceneIndex].image);
        }
      }
    }

    // fullScenes[chapter] = chapterScenes;
    await storeScenes({sceneId, sceneData: fullScenes});
    logger.debug(`Stored updated scenes.`);
    return fullScenes;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

async function downloadImage(url, filename) {
  const response = await axios({
    method: "GET",
    url: url,
    responseType: "stream",
  });
  return uploadStreamAndGetPublicLink({stream: response.data, filename}).then(async (publicUrl) => {
    logger.debug("uploaded to GCP, publicURL is = " + publicUrl);
    return publicUrl;
  }).catch((err) => {
    logger.error("Error uploading file:", err);
    return "";
  });
}

async function singleGeneration(request) {
  const {
    scene, theme, sceneId, retry, openai,
  } = request;
  let imageGenResult = false;
  // DALL-E-3 Configs
  const dallE3Config = {
    model: "dall-e-3",
    quality: "hd",
    size: "1024x1024",
    style: "vivid",
    n: 1,
    response_format: "url",
  };
  // dallE3Config.prompt = imageTheme + ' ' + scene.description;
  const sceneDescription = {
    "description": scene.description,
    "characters": scene.characters,
    "locations": scene.locations,
    "viewpoint": scene.viewpoint,
    // "aspect_ratio": "Vertical Aspect Ratio",
  };
  if (theme !== "") {
    sceneDescription.theme = `Image theme must be ${theme}`;
  }
  dallE3Config.prompt = JSON.stringify(sceneDescription);
  logger.debug("image description = " + dallE3Config.prompt.substring(0, 250));
  let gcpURL = "";
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
    const squareImagePath = `${imagePath}.4.3.jpg`;
    // logger.debug("imageName = " + imageName);
    gcpURL = await downloadImage(imageUrl, squareImagePath);
    imageGenResult = true;
    logger.debug(`Outpainting ${squareImagePath} with Stability.`);
    outpaintResult = await outpaintTall({
      inputPath: squareImagePath,
      outputPathWithoutExtension: imagePath,
    });

    // logger.debug("gcpURL = " + gcpURL);
  } catch (error) {
    logger.error(`Error generating image: ${scene.scene_number} ${scene.chapter} ${sceneId} ${JSON.stringify(sceneDescription)} ${error.toString()}`);
    if (retry) {
      logger.warn(`Going to retry image generation for scene ${scene.scene_number} in chapter ${scene.chapter} for scene ${sceneId}`);
      request.retry = false;
      return await singleGeneration(request);
    } else {
      logger.warn(`Not retrying image generation for scene ${scene.scene_number} in chapter ${scene.chapter} for scene ${sceneId}, returning default object.`);
    }
  }
  return {
    type: "image",
    result: imageGenResult,
    url: outpaintResult,
    square: gcpURL,
    tall: outpaintResult,
    description: description,
    scene_number: scene.scene_number,
    chapter: scene.chapter,
    sceneId: sceneId,
  };
}

async function dalle3(request) {
  const {
    scenes, theme, sceneId, retry = true,
  } = request;
  const openai = new OpenAI(OPENAI_API_KEY.value());
  logger.debug(`scenes length = ${scenes.length}`);
  const promises = scenes.map(async (scene) => singleGeneration({
    scene, theme, sceneId, retry, openai,
  }));
  return Promise.all(promises);
}

function getScenesToGenerate(lastSceneGenerated, totalScenes, chapter) {
  const scenesToGenerate = [];
  const i = lastSceneGenerated;
  for (let j = i; j < i + OPENAI_DALLE_3_IMAGES_PER_MINUTE && j < totalScenes; j++) {
    scenesToGenerate.push({scene_number: j, chapter: chapter});
  }
  return scenesToGenerate;
}

// start at 0.
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
  await generateImages(
      {
        scenes: scenes,
        sceneId: sceneId,
      },
  );
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
  const fullScenes = await getScene({sceneId});
  const {chapter, sceneNumber} = sceneFromCurrentTime(fullScenes, currentTime) || {};

  if (chapter === undefined || sceneNumber === undefined) {
    throw new Error("No matching scene found for the given currentTime");
  }

  logger.debug(`Found scene: Chapter ${chapter}, Scene ${sceneNumber}`);
  const scenesToGenerate = scenesToGenerateFromCurrentTime({currentSceneNumber: sceneNumber, currentChapter: chapter, fullScenes});
  let scenes = formatScenesForGeneration(fullScenes, scenesToGenerate);
  const filteredScenes = scenes.filter((scene) => scene.sceneId !== sceneId);
  logger.debug(`Filtered out ${scenes.length - filteredScenes.length} scenes with matching sceneId`);
  scenes = filteredScenes;
  const generatedScenes = await generateImages(
      {
        scenes: scenes,
        sceneId: sceneId,
      },
  );
  return scenesToGenerateFromCurrentTime({currentSceneNumber: sceneNumber, currentChapter: chapter, fullScenes: generatedScenes});
}

export {
  generateImages,
  imageGenChapterRecursive,
  imageDispatcher,
  imageGenCurrentTime,
};
