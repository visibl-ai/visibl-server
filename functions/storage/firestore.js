/* eslint-disable require-jsdoc */

import {
  getFirestore} from "firebase-admin/firestore";
import {
  getCatalogueDefaultScene,
  storeScenes,
  getScene,
  fileExists,
  getDefaultSceneFilename,
  getSceneFilename,
} from "./storage.js";
import logger from "../util/logger.js";
import {libraryGetFirestore} from "./firestore/library.js";
import {catalogueGetFirestore} from "./firestore/catalogue.js";
import {getGlobalScenesFirestore} from "./firestore/scenes.js";
import {
  getAdjacentScenes,
  sceneFromCurrentTime,
  scenesFromCurrentTime,
} from "../util/sceneHelpers.js";
import {
  dispatchTask,
  // dataToBody,
} from "../util/dispatch.js";

import {getScenesFromCache} from "./realtimeDb/scenesCache.js";
import _ from "lodash";

/**
 * Adds a new user to the Firestore database.
 *
 * @param {string} user - The user object from firestor auth.
 */
async function saveUser(user) {
  await getFirestore().collection("Users").doc(user.uid).set(user);
}


/**
 * Retrieves a user from the Firestore database by their unique identifier.
 *
 * @param {string} uid - The unique identifier of the user to retrieve.
 * @return {Promise<FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>>}
 * A promise that resolves to the document snapshot of the user.
 */
async function getUser(uid) {
  const snapshot = await getFirestore().collection("Users").doc(uid).get();
  return snapshot.exists ? snapshot.data() : null;
}

/**
 * Retrieves a pipeline from the Firestore database based on the provided UID and pipeline data.
 *
 * @param {string} uid - The unique identifier of the user.
 * @param {object} data - The data containing the pipeline ID to be retrieved.
 * @return {Promise<object>} A promise that resolves to the pipeline data if found, otherwise null.
 */
async function getPipelineFirestore(uid, data) {
  const id = data.id;
  const snapshot = await getFirestore().collection("Pipelines").doc(id).get();
  const pipelineData = snapshot.data();
  if (pipelineData && pipelineData.uid === uid) {
    pipelineData.id = snapshot.id; // Add the document ID to the data
    return pipelineData; // Return the full document data with ID
  } else {
    return {error: "Pipeline not found"}; // Return error if there is no match
  }
}

/**
 * Removes undefined properties from an object.
 *
 * This function iterates over all properties of the given object and deletes any property
 * that has a value of undefined. This is useful for cleaning up objects before saving them
 * to a database where undefined values may not be allowed.
 *
 * @param {object} data - The object from which to remove undefined properties.
 * @return {object} The cleaned object with all undefined properties removed.
 */
function removeUndefinedProperties(data) {
  // Remove any undefined properties from data
  Object.keys(data).forEach((key) => {
    if (data[key] === undefined) {
      delete data[key];
    }
  });
  return data;
}

/**
 * Retrieves AI-generated content based on a library item.
 *
 * @param {string} uid - The user ID of the authenticated user.
 * @param {object} data - The data object containing the libraryId.
 * @return {Promise<object>} A promise that resolves to the AI-generated content.
 */
async function getAiFirestore(uid, data) {
  let {libraryId, sceneId, chapter, currentTime} = data;
  logger.debug(`Getting AI for ${uid} to libraryId ${libraryId} sceneId ${sceneId} chapter ${chapter} and currentTime ${currentTime}`);
  if (!libraryId) {
    throw new Error("Invalid or missing libraryId");
  }

  const libraryData = await libraryGetFirestore(uid, libraryId);
  if (!libraryData) {
    logger.debug(`Library item with id ${libraryId} not found`);
    logger.debug(`Library item data: ${typeof data === "object" ? JSON.stringify(data) : data}`);
    throw new Error("Library item not found");
  }

  if (libraryData.uid !== uid) {
    logger.debug(`Unauthorized access to library item for ${uid} to ${JSON.stringify(libraryData)}`);
    throw new Error("Unauthorized access to library item");
  }

  const {catalogueId} = libraryData;
  if (!catalogueId) {
    throw new Error("CatalogueId not found in library item");
  }

  if (!sceneId && libraryData.defaultSceneId) {
    logger.debug(`Using default library sceneId ${libraryData.defaultSceneId} for libraryId ${libraryId}`);
    sceneId = libraryData.defaultSceneId;
  } else if (!sceneId) {
    const catalogueItem = await catalogueGetFirestore({id: catalogueId});
    logger.debug(`Using default catalogue sceneId ${catalogueItem.defaultSceneId} for catalogueId ${catalogueId}`);
    sceneId = catalogueItem.defaultSceneId;
  }

  // Retrieve the scenes data for the catalogueId
  let scenes;
  try {
    scenes = await getUserLibraryScene({libraryData, sceneId});
  } catch (error) {
    logger.error(`Error retrieving scenes for libraryId ${libraryId}:`, error);
    throw new Error("Failed to retrieve scenes data");
  }

  if (scenes.error) {
    throw new Error("No scenes data found for the given libraryId");
  }

  if (currentTime) {
    logger.debug(`Generating scenes starting at currentTime: ${currentTime}`);
    await dispatchTask({
      functionName: "generateSceneImagesCurrentTime",
      data: {sceneId, currentTime},
    });
  }

  if (chapter !== undefined && scenes[chapter]) {
    logger.debug(`Returning chapter ${chapter} of scenes: ${JSON.stringify(scenes[chapter]).substring(0, 150)}`);
    return scenes[chapter];
  } else {
    logger.debug(`Returning all scenes: ${JSON.stringify(scenes).substring(0, 150)}`);
    return scenes;
  }
}

async function getUserLibraryScene(params) {
  const {libraryData, sceneId} = params;
  const sku = libraryData.sku;
  // Check if the default scene exists.
  const exists = await fileExists({path: getSceneFilename(sceneId)});
  logger.debug(`Scenes for ${sceneId} exists: ${exists} ${typeof exists}`);
  if (!exists) {
    logger.warn(`Scenes for ${sceneId} not found in Firestore, will try to copy now.`);
    logger.debug(`Checking for catalogue scenes for ${sku}`);
    const defaultExist = await fileExists({path: await getDefaultSceneFilename({sku})});
    logger.debug(`Catalogue scenes for ${sku} exist: ${defaultExist}`);
    if (defaultExist) {
      logger.debug(`Copying default catalogue scenes for ${sku}`);
      await storeScenes({sceneId: sceneId, sceneData: await getCatalogueDefaultScene({sku})});
    } else {
      logger.warn(`Default scene ${sceneId} not found in Firestore, and catalogue scenes not found.`);
      return {error: "Scenes not found - likely still being generatred"};
    }
  } else {
    logger.debug(`Scenes exist for ${sceneId} - will return that.`);
  }

  return await getScene({sceneId: sceneId});
}

async function populateCarousel({carousel, catalogueItem, currentTime}) {
  const scenesCarousel = await Promise.all(carousel.map(async (scene) => {
    const fetchTime = Date.now();
    const fullScenes = await getScenesFromCache({sceneId: scene.id});
    logger.debug(`Time to fetch scene ${scene.id} from cache: ${Date.now() - fetchTime}ms`);
    // logger.debug(`fullScenes for ${scene.id}: ${JSON.stringify(fullScenes).substring(0, 150)}`);
    // 4. for each scene, sceneFromCurrentTime
    const currentScene = sceneFromCurrentTime(fullScenes, currentTime);
    if (!currentScene) {
      logger.error(`No current scene found for ${scene.id} at ${currentTime}`);
      return {};
    }
    // logger.debug(`Current scene ${JSON.stringify(currentScene)} for ${scene.id} at ${currentTime}`);
    let chapters = {};
    if (catalogueItem?.metadata?.chapters) {
      chapters = _.cloneDeep(catalogueItem.metadata.chapters);
      // Set the length of each chapter
      Object.keys(chapters).forEach((chapterKey) => {
        if (fullScenes[chapterKey]) {
          chapters[chapterKey].numberOfScenes = fullScenes[chapterKey].length;
        } else {
          chapters[chapterKey].numberOfScenes = 0; // Set to 0 if the chapter doesn't exist in fullScenes
        }
      });
    }

    // 5. scenesToGenerateFromCurrentTime (5 forward and 5 backward)
    return {
      sceneId: scene.id,
      chapters,
      scenes: scenesFromCurrentTime({
        currentSceneNumber: currentScene.sceneNumber,
        currentChapter: currentScene.chapter,
        fullScenes,
        precedingScenes: 5,
        followingScenes: 5,
      })};
  }));
  return scenesCarousel;
}

async function dispatchCarouselGeneration({carousel, sceneId, currentTime}) {
  const stepTime = Date.now();
  const ADJACENT_CAROUSEL_GENERATION_COUNT = 2;

  let currentIndex;
  try {
    currentIndex = carousel.findIndex((scene) => scene.id === sceneId);
    if (currentIndex === -1) {
      logger.error(`dispatchCarouselGeneration: Scene with id ${sceneId} not found in carousel`);
      return;
    }
  } catch (error) {
    logger.error(`dispatchCarouselGeneration: Error finding scene with id ${sceneId} in carousel: ${error}`);
    return;
  }

  const scenesToGenerate = [
    ...carousel.slice(Math.max(0, currentIndex - ADJACENT_CAROUSEL_GENERATION_COUNT), currentIndex),
    carousel[currentIndex],
    ...carousel.slice(currentIndex + 1, currentIndex + 1 + ADJACENT_CAROUSEL_GENERATION_COUNT),
  ];

  await Promise.all(scenesToGenerate.map((scene) =>
    dispatchTask({
      functionName: "generateSceneImagesCurrentTime",
      data: {sceneId: scene.id, currentTime},
    }),
  ));
  logger.debug(`Time to dispatchCarouselGeneration: ${Date.now() - stepTime}ms`);
  return;
}

async function getAiCarouselFirestore(uid, data) {
  let {libraryId, sceneId, currentTime} = data;
  logger.debug(`Getting AI carousel for ${uid} to libraryId ${libraryId} sceneId ${sceneId} and currentTime ${currentTime}`);
  let stepTime = Date.now();
  if (libraryId === undefined || currentTime === undefined) {
    throw new Error("Invalid or missing libraryId or currentTime");
  }

  const libraryData = await libraryGetFirestore(uid, libraryId);
  if (!libraryData) {
    logger.debug(`Library item with id ${libraryId} not found`);
    throw new Error("Library item not found");
  }
  const {catalogueId} = libraryData;
  if (!catalogueId) {
    throw new Error("CatalogueId not found in library item");
  }
  const catalogueItem = await catalogueGetFirestore({id: catalogueId});
  if (!sceneId && libraryData.defaultSceneId) {
    logger.debug(`Using default library sceneId ${libraryData.defaultSceneId} for libraryId ${libraryId}`);
    sceneId = libraryData.defaultSceneId;
  } else if (!sceneId) {
    logger.debug(`Using default catalogue sceneId ${catalogueItem.defaultSceneId} for catalogueId ${catalogueId}`);
    sceneId = catalogueItem.defaultSceneId;
  }
  logger.debug(`Time to get defaultScene: ${Date.now() - stepTime}ms`);
  stepTime = Date.now();

  // 1. get all scenes in a sorted list.
  const scenesList = await getGlobalScenesFirestore(uid, {libraryId});
  logger.debug(`Scenes List: ${JSON.stringify(scenesList)}`);
  logger.debug(`Time to get scenesList: ${Date.now() - stepTime}ms`);
  stepTime = Date.now();
  // 2. create the carousel object based on position of sceneId.
  const carousel = getAdjacentScenes({scenesList, sceneId});
  logger.debug(`Scenes Carousel: ${JSON.stringify(carousel).substring(0, 250)}`);
  stepTime = Date.now();
  // 3. Load the scenes from storage in parallel.
  // Call dispatchCarouselGeneration and populateCarousel in parallel
  const [, scenesCarousel] = await Promise.all([
    dispatchCarouselGeneration({carousel, sceneId, currentTime}),
    populateCarousel({carousel, catalogueItem, currentTime}),
  ]);
  logger.debug(`Time to scenesCarousel: ${Date.now() - stepTime}ms`);
  stepTime = Date.now();
  // 6. construct the final carousel object
  for (const scene of carousel) {
    const carouselScene = scenesCarousel.find((s) => s.sceneId === scene.id);
    if (carouselScene) {
      scene.scenes = carouselScene.scenes;
      scene.chapters = carouselScene.chapters;
    }
  }
  stepTime = Date.now();
  // 7. return the carousel object.
  return carousel;
}

export {
  saveUser,
  getUser,
  getPipelineFirestore,
  getAiFirestore,
  removeUndefinedProperties,
  getAiCarouselFirestore,
};
