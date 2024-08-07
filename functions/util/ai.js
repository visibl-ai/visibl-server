/* eslint-disable require-jsdoc */
import {logger} from "firebase-functions/v2";
import OpenAI from "openai";
import {OPENAI_API_KEY} from "../config/config.js";
import axios from "axios";
import {
  uploadStreamAndGetPublicLink,
  getScene,
  storeScenes,
} from "../storage/storage.js";

import {
  getSceneFirestore,
  sceneUpdateChapterGeneratedFirestore,
} from "../storage/firestore/scenes.js";

import {
  dispatchTask,
} from "./dispatch.js";


const SCENES_PER_REQUEST = 15;
const TIMEOUT = 60000;


async function generateImages(req, app) {
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
    const fullScenes = await getScene(app, sceneId);
    if (!fullScenes[chapter]) {
      logger.warn(`Chapter ${chapter} not found in scenes. Build the graph and try again!`);
      return fullScenes;
    }
    const chapterScenes = fullScenes[chapter];
    const scenes = chapterScenes.filter((singleScene, index) => scenesToGenerate.includes(index));
    logger.debug("scenes.length = " + scenes.length);
    logger.info("scenes = " + JSON.stringify(scenes).substring(0, 100));
    if (!scenes) {
      throw new Error("No scenes found - use interpretChapter first.");
    }
    // Now we save the scenes to the chapter.
    logger.info("===Starting DALL-E-3 image generation===");
    const images = await dalle3({
      app,
      chapter,
      scenes,
      theme,
      sceneId,
    });
    logger.info("===ENDING DALL-E-3 image generation===");
    for (const image of images) {
      const sceneIndex = chapterScenes.findIndex((s) => s.scene_number === image.metadata.scene_number);
      logger.debug("sceneIndex, sceneNumber = " + sceneIndex + ", " + image.metadata.scene_number);
      if (sceneIndex !== -1) {
        chapterScenes[sceneIndex].image = image.url;
        chapterScenes[sceneIndex].prompt = image.description;
        logger.info("chapterScenes[sceneIndex].image = " + chapterScenes[sceneIndex].image);
      }
    }
    fullScenes[chapter] = chapterScenes;
    await storeScenes(app, sceneId, fullScenes);
    return fullScenes;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

async function downloadImage(app, url, filename) {
  const response = await axios({
    method: "GET",
    url: url,
    responseType: "stream",
  });
  return uploadStreamAndGetPublicLink(app, response.data, filename).then(async (publicUrl) => {
    logger.debug("uploaded to GCP, publicURL is = " + publicUrl);
    return publicUrl;
  }).catch((err) => {
    logger.error("Error uploading file:", err);
    return "";
  });
}

async function dalle3(request) {
  const {
    app, chapter, scenes, theme, sceneId,
  } = request;
  logger.debug(`scenes length = ${scenes.length}`);
  const openai = new OpenAI(OPENAI_API_KEY.value());
  const promises = scenes.map(async (scene) => {
    // DALL-E-3 Configs
    const dallE3Config = {
      model: "dall-e-3",
      quality: "hd",
      size: "1024x1792",
      style: "vivid",
      n: 1,
      response_format: "url",
    };
      // dallE3Config.prompt = imageTheme + ' ' + scene.description;
    const sceneDescription = {
      description: scene.description,
      characters: scene.characters,
      locations: scene.locations,
      viewpoint: scene.viewpoint,
    };
    if (theme !== "") {
      sceneDescription.theme = `Image theme must be ${theme}`;
    }
    dallE3Config.prompt = JSON.stringify(sceneDescription);
    logger.debug("image description = " + dallE3Config.prompt.substring(0, 250));
    let gcpURL = "";
    let imageResponse;
    let description = "";
    try {
      imageResponse = await openai.images.generate(dallE3Config);
      const imageUrl = imageResponse.data[0].url;
      logger.debug("imageUrl = " + imageUrl);// .substring(0, 100));
      // logger.debug(`imageResponse = ${JSON.stringify(imageResponse.data[0], null, 2)}`)
      description = imageResponse.data[0].revised_prompt;
      logger.debug(`revised prompt = ${description}`);
      // const imagePath = `${imageDir}/${i + 1}.jpg`;
      const timestamp = Date.now();
      const imageName = `Scenes/${sceneId}/${chapter}_scene${scene.scene_number}_${timestamp}.jpg`;
      // logger.debug("imageName = " + imageName);
      gcpURL = await downloadImage(app, imageUrl, imageName);
      // logger.debug("gcpURL = " + gcpURL);
    } catch (error) {
      logger.error("Error generating image: " + error);
    }
    return {
      type: "image",
      url: gcpURL,
      description: description,
      metadata: {
        scene_number: scene.scene_number,
        chapterNumber: chapter,
        sceneId: sceneId},
    };
  });
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
async function imageGenRecursive(req, app) {
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
  if (nextSceneToGenerate >= totalScenes) {
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
