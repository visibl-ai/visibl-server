/* eslint-disable require-jsdoc */
import {logger} from "firebase-functions/v2";
import OpenAI from "openai";
import {OPENAI_API_KEY} from "../config/config.js";
import axios from "axios";
import {
  uploadStreamAndGetPublicLink,
  storeScenes,
} from "../storage/storage.js";

async function generateImages(req, app) {
  try {
    // Scenes to generate is a [5,6,7,8] . Maximum 5.
    const {fullScenes,
      bookTitle,
      chapterNumber,
      imageTheme,
      scenesToGenerate,
      catalogueId,
      sceneId} = req.body;
    if (scenesToGenerate.length > 15) {
      throw new Error("Maximum 15 scenes per request");
    }
    const scenes = fullScenes.filter((scene, index) => scenesToGenerate.includes(index));
    logger.debug("scenes.length = " + scenes.length);
    logger.info("scenes = " + JSON.stringify(scenes).substring(0, 100));
    if (!scenes) {
      throw new Error("No scenes found - use interpretChapter first.");
    }
    // Now we save the scenes to the chapter.
    logger.info("===Starting DALL-E-3 image generation===");
    const images = await dalle3(app, bookTitle, chapterNumber, scenes, imageTheme, catalogueId);
    logger.info("===ENDING DALL-E-3 image generation===");
    for (const image of images) {
      const sceneIndex = fullScenes.findIndex((s) => s.scene_number === image.metadata.scene_number);
      logger.debug("sceneIndex, sceneNumber = " + sceneIndex + ", " + image.metadata.scene_number);
      if (sceneIndex !== -1) {
        fullScenes[sceneIndex].image = image.url;
        logger.info("fullScenes[sceneIndex].image = " + fullScenes[sceneIndex].image);
      }
    }
    await storeScenes(app, sceneId, chapterNumber, fullScenes);
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

async function dalle3(app, bookTitle, chapterNumber, scenes, imageTheme, catalogueId) {
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
      theme: imageTheme,
    };
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
      const imageName = `Catalogue/${catalogueId}/ImageGen/${bookTitle}_ch${chapterNumber}_scene${scene.scene_number}_${timestamp}.jpg`;
      // logger.debug("imageName = " + imageName);
      gcpURL = await downloadImage(app, imageUrl, imageName);
      // logger.debug("gcpURL = " + gcpURL);
    } catch (error) {
      logger.error("Error generating image: " + error);
    }
    return {type: "image", url: gcpURL, description: description, metadata: {scene_number: scene.scene_number, chapterNumber: chapterNumber, bookTitle: bookTitle}};
  });
  return Promise.all(promises);
}

export {
  generateImages,
};
