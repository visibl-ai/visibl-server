/* eslint-disable require-jsdoc */
import logger from "firebase-functions/logger";
import OpenAI from "openai";
import {OPENAI_API_KEY} from "../../config/config.js";
import {downloadImage} from "../../storage/storage.js";


const OPENAI_DALLE_3_IMAGES_PER_MINUTE = 200;

// Generate the seed images for scenes using Dall-E-3.
// Images are square, so they need to be outpainted to tall late
// Makes a batch request to singleGeneration
// Returns an array of image results.
async function dalle3(request) {
  try {
    const {
      scenes, sceneId, retry = true,
    } = request;
    if (scenes.length > OPENAI_DALLE_3_IMAGES_PER_MINUTE) {
      throw new Error(`Maximum ${OPENAI_DALLE_3_IMAGES_PER_MINUTE} scenes per request`);
    }
    if (sceneId === undefined) {
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
    const promises = scenes.map(async (scene) => singleGeneration({
      scene, sceneId, retry, openai,
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
    squareImagePath = `${imagePath}.4.3.jpg`;
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
    squareBucketPath: squareImagePath,
    // tall: outpaintResult,
    description: description,
    scene_number: scene.scene_number,
    chapter: scene.chapter,
    sceneId: sceneId,
  };
}

export {
  dalle3,
};
