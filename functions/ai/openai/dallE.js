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
  outpaintWideAndTall,
} from "../stability/stability.js";


const SCENES_PER_REQUEST = 15;
const TIMEOUT = 60000;


async function generateImages(req) {
  try {
    // Scenes to generate is a [5,6,7,8] . Maximum 5.
    const {
      chapter,
      scenesToGenerate,
      sceneId} = req;

    if (scenesToGenerate.length > SCENES_PER_REQUEST) {
      throw new Error(`Maximum ${SCENES_PER_REQUEST} scenes per request`);
    }
    if (sceneId === undefined) {
      throw new Error("generateImages: sceneId is required");
    }
    const scene = await getSceneFirestore(sceneId);
    const theme = scene.prompt;
    let fullScenes = await getScene({sceneId});
    if (!fullScenes[chapter]) {
      logger.warn(`Chapter ${chapter} not found in scenes. Build the graph and try again!`);
      return fullScenes;
    }
    let chapterScenes = fullScenes[chapter];
    const scenes = chapterScenes.filter((singleScene, index) => scenesToGenerate.includes(index));
    logger.debug("scenes.length = " + scenes.length);
    logger.info("scenes = " + JSON.stringify(scenes).substring(0, 100));
    if (!scenes) {
      throw new Error("No scenes found - use interpretChapter first.");
    }
    // Now we save the scenes to the chapter.
    logger.info("===Starting DALL-E-3 image generation===");
    const images = await dalle3({
      chapter,
      scenes,
      theme,
      sceneId,
    });
    logger.info("===ENDING DALL-E-3 image generation===");
    logger.debug(`Reloading scenes before editing.`);
    fullScenes = await getScene({sceneId});
    chapterScenes = fullScenes[chapter];
    for (const image of images) {
      const sceneIndex = chapterScenes.findIndex((s) => s.scene_number === image.metadata.scene_number);
      logger.debug("sceneIndex, sceneNumber = " + sceneIndex + ", " + image.metadata.scene_number);
      if (sceneIndex !== -1) {
        chapterScenes[sceneIndex].image = image.tall;
        chapterScenes[sceneIndex].square = image.square;
        chapterScenes[sceneIndex].wide = image.wide;
        chapterScenes[sceneIndex].tall = image.tall;
        chapterScenes[sceneIndex].prompt = image.description;
        logger.info("chapterScenes[sceneIndex].image = " + chapterScenes[sceneIndex].image);
      }
    }

    fullScenes[chapter] = chapterScenes;
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
    chapter, scene, theme, sceneId, retry, openai,
  } = request;
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
  let outpaintResult = {};
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
    const imagePath = `Scenes/${sceneId}/${chapter}_scene${scene.scene_number}_${timestamp}`;
    const squareImagePath = `${imagePath}.4.3.jpg`;
    // logger.debug("imageName = " + imageName);
    gcpURL = await downloadImage(imageUrl, squareImagePath);

    logger.debug(`Outpainting ${squareImagePath} with Stability.`);
    outpaintResult = await outpaintWideAndTall({
      inputPath: squareImagePath,
      outputPathWithoutExtension: imagePath,
    });

    // logger.debug("gcpURL = " + gcpURL);
  } catch (error) {
    logger.error(`Error generating image: ${scene.scene_number} ${chapter} ${sceneId} ${JSON.stringify(sceneDescription)} ${error.toString()}`);
    if (retry) {
      logger.warn(`Going to retry image generation for scene ${scene.scene_number} in chapter ${chapter} for scene ${sceneId}`);
      request.retry = false;
      return await singleGeneration(request);
    } else {
      logger.warn(`Not retrying image generation for scene ${scene.scene_number} in chapter ${chapter} for scene ${sceneId}, returning default object.`);
    }
  }
  return {
    type: "image",
    url: outpaintResult.tall,
    square: gcpURL,
    wide: outpaintResult.wide,
    tall: outpaintResult.tall,
    description: description,
    metadata: {
      scene_number: scene.scene_number,
      chapterNumber: chapter,
      sceneId: sceneId},
  };
}

async function dalle3(request) {
  const {
    chapter, scenes, theme, sceneId, retry = true,
  } = request;
  const openai = new OpenAI(OPENAI_API_KEY.value());
  logger.debug(`scenes length = ${scenes.length}`);
  const promises = scenes.map(async (scene) => singleGeneration({
    chapter, scene, theme, sceneId, retry, openai,
  }));
  return Promise.all(promises);
}

function getScenesToGenerate(lastSceneGenerated, totalScenes) {
  const scenesToGenerate = [];
  const i = lastSceneGenerated;
  for (let j = i; j < i + SCENES_PER_REQUEST && j < totalScenes; j++) {
    scenesToGenerate.push(j);
  }
  return scenesToGenerate;
}

// start at 0.
async function imageGenRecursive(req) {
  logger.debug(`imageGenRecursive`);
  logger.debug(JSON.stringify(req.body));
  const {sceneId, lastSceneGenerated, totalScenes, chapter} = req.body;

  await sceneUpdateChapterGeneratedFirestore(sceneId, chapter, false, Date.now());
  const scenesToGenerate = getScenesToGenerate(lastSceneGenerated, totalScenes);
  const startTime = Date.now();
  await generateImages(
      {
        chapter: chapter,
        scenesToGenerate: scenesToGenerate,
        sceneId: sceneId,
      },
  );
  const endTime = Date.now();
  const elapsedTime = endTime - startTime;
  const remainingTime = Math.max(TIMEOUT - elapsedTime, 0);
  logger.debug(`Elapsed time: ${elapsedTime}ms, remaining time: ${remainingTime}ms`);
  const remainingTimeSeconds = Math.ceil(remainingTime / 1000);
  logger.debug(`imageGen complete for ${JSON.stringify(scenesToGenerate)} starting at ${lastSceneGenerated}.`);
  const nextSceneToGenerate = scenesToGenerate.pop() + 1;
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

export {
  generateImages,
  imageGenRecursive,
  imageDispatcher,
};