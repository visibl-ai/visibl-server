/* eslint-disable camelcase */
/* eslint-disable require-jsdoc */

import {
  getTranscriptions,
  getGraph,
  storeGraph,
} from "../storage/storage.js";

import {
  geminiRequest,
} from "./gemini.js";

import logger from "firebase-functions/logger";
import novel from "./novel.js";
import nerFunctions from "./ner.js";
import csv from "./csv.js";

const WAIT_TIME = 20;

function consolidateTranscriptions(transcriptions) {
  let consolidatedText = "";
  for (const key in transcriptions) {
    if (Object.prototype.hasOwnProperty.call(transcriptions, key)) {
      const transcriptionArray = transcriptions[key];
      transcriptionArray.forEach((item) => {
        consolidatedText += item.text + " ";
      });
    }
  }
  return consolidatedText.trim();
}


async function graphCharacters(app, req) {
  const {uid, sku, visiblity} = req.body;
  // 1. load transcriptions.
  const transcriptions = await getTranscriptions(app, uid, sku, visiblity);
  // 2. consolidate transcriptions into single string.
  const fullText = consolidateTranscriptions(transcriptions);
  // 3. send to gemini.
  const characterList = await geminiRequest({
    "prompt": "getCharacters",
    "message": fullText,
    "type": "json",
  });
  // 4. store graph.
  await storeGraph(app, uid, sku, visiblity, characterList, "characters");
  return characterList;
}

async function graphCharacterDescriptions(app, req) {
  const {uid, sku, visiblity} = req.body;
  const transcriptions = await getTranscriptions(app, uid, sku, visiblity);
  const fullText = consolidateTranscriptions(transcriptions);
  let characters = await getGraph(app, uid, sku, visiblity, "characters");
  const characterDescriptions = {};
  if (!characters.characters || !Array.isArray(characters.characters)) {
    if (Array.isArray(characters)) {
      characters = {
        characters: characters,
      };
    } else {
      logger.error(`No characters found for ${uid} ${sku} ${visiblity}`);
      return {};
    }
  }
  for (const character of characters.characters) {
    logger.debug(`Getting character description for ${character}`);
    const description = await geminiRequest({
      "prompt": "getCharacterDescription",
      "message": fullText,
      "replacements": [
        {
          key: "%CHARACTER%",
          value: character,
        },
      ],
    });
    characterDescriptions[character] = description;
    logger.debug(`Character description for ${character}: ${characterDescriptions[character]}`);
    // Add a 15-second delay
    logger.debug(`Waiting ${WAIT_TIME} seconds before next request`);
    await storeGraph(app, uid, sku, visiblity, characterDescriptions, "characterDescriptions");
    await new Promise((resolve) => setTimeout(resolve, WAIT_TIME * 1000));
  }
  return characterDescriptions;
}

async function graphLocations(app, req) {
  const {uid, sku, visiblity} = req.body;
  // 1. load transcriptions.
  const transcriptions = await getTranscriptions(app, uid, sku, visiblity);
  // 2. consolidate transcriptions into single string.
  const fullText = consolidateTranscriptions(transcriptions);
  // 3. send to gemini.
  const locationList = await geminiRequest({
    "prompt": "getLocations",
    "message": fullText,
    "type": "json",
  });
  // 4. store graph.
  await storeGraph(app, uid, sku, visiblity, locationList, "locations");
  return locationList;
}

async function graphLocationDescriptions(app, req) {
  const {uid, sku, visiblity} = req.body;
  const transcriptions = await getTranscriptions(app, uid, sku, visiblity);
  const fullText = consolidateTranscriptions(transcriptions);
  let locations = await getGraph(app, uid, sku, visiblity, "locations");
  const locationDescriptions = {};
  if (!locations.locations || !Array.isArray(locations.locations)) {
    if (Array.isArray(locations)) {
      locations = {
        locations: locations,
      };
    } else {
      logger.error(`No locations found for ${uid} ${sku} ${visiblity}`);
      return {};
    }
  }
  for (const location of locations.locations) {
    logger.debug(`Getting location description for ${location}`);
    const description = await geminiRequest({
      "prompt": "getLocationDescription",
      "message": fullText,
      "replacements": [
        {
          key: "%LOCATION%",
          value: location,
        },
      ],
    });
    locationDescriptions[location] = description;
    logger.debug(`location description for ${location}: ${locationDescriptions[location]}`);
    // Add a 15-second delay
    logger.debug(`Waiting ${WAIT_TIME} seconds before next request`);
    await storeGraph(app, uid, sku, visiblity, locationDescriptions, "locationDescriptions");
    await new Promise((resolve) => setTimeout(resolve, WAIT_TIME * 1000));
  }
  return locationDescriptions;
}

async function graphSummarizeDescriptions(app, req) {
  const {uid, sku, visiblity} = req.body;
  const characterDescriptions = await getGraph(app, uid, sku, visiblity, "characterDescriptions");
  // const locationDescriptions = await getGraph(app, uid, sku, visiblity, "locationDescriptions");
  const characterSummaries = await novel.entityImageSummarize(
      "character_image_summarize_prompt",
      characterDescriptions,
      250000,
  );
  await storeGraph(app, uid, sku, visiblity, characterSummaries, "characterSummaries");
  const locationDescriptions = await getGraph(app, uid, sku, visiblity, "locationDescriptions");
  const locationSummaries = await novel.entityImageSummarize(
      "location_image_summarize_prompt",
      locationDescriptions,
      250000,
  );
  await storeGraph(app, uid, sku, visiblity, locationSummaries, "locationSummaries");

  return {characterSummaries, locationSummaries};
}

async function graphScenes(app, req) {
  const {uid, sku, visiblity, chapter} = req.body;
  let scenes_result = [];
  const locations = await getGraph(app, uid, sku, visiblity, "locations");
  locations.locations = locations.locations.map((location) => location.toLowerCase());
  const characters = await getGraph(app, uid, sku, visiblity, "characters");
  characters.characters = characters.characters.map((character) => character.toLowerCase());
  const transcriptions = await getTranscriptions(app, uid, sku, visiblity);
  const CHAPTER_FULL = transcriptions[chapter];
  let charactersDescription = await getGraph(app, uid, sku, visiblity, "characterSummaries");
  charactersDescription = Object.fromEntries(
      Object.entries(charactersDescription).map(([key, value]) => [key.toLowerCase(), value]),
  );
  let locationDescription = await getGraph(app, uid, sku, visiblity, "locationSummaries");
  locationDescription = Object.fromEntries(
      Object.entries(locationDescription).map(([key, value]) => [key.toLowerCase(), value]),
  );
  // Loop
  const SLICE_SIZE = 15;
  // const promises = [];

  const prompt = "transcribe_film_director_prompt";
  const paramsList = [
    {name: "CHARACTER_LIST", value: characters},
    {name: "LOCATIONS_LIST", value: locations},
  ];
  const tokensPerMinute = 1900000;
  const temp = 0.8;
  const textList = [];
  for (let i = 0; i < CHAPTER_FULL.length; i += SLICE_SIZE) {
    const chapterChunkCSV = csv(CHAPTER_FULL, i, i + SLICE_SIZE);
    textList.push(chapterChunkCSV);
  }
  // TMP: testing.
  // textList = textList.slice(0, 10);
  logger.debug(`textList: ${JSON.stringify(textList, null, 2).substring(0, 150)}...`);
  logger.debug(`paramsList: ${JSON.stringify(paramsList, null, 2).substring(0, 150)}...`);
  scenes_result = await nerFunctions.batchRequest(
      prompt,
      paramsList,
      textList,
      tokensPerMinute,
      temp,
  );
  const flattened_scenes_result = [];
  let scene_number = 0;
  for (const scenes of scenes_result) {
    for (const scene of scenes.scenes) {
      // object is scenes = {scenes: [] }
      scene.scene_number = scene_number++;
      flattened_scenes_result.push(scene);
    }
  }
  scenes_result = flattened_scenes_result;
  // logger.debug(`scenes_result: ${JSON.stringify(scenes_result, null, 2)}`);

  const descriptive_scenes = scenes_result.map((scene) => {
    const newCharacters = {};
    for (const character of scene.characters) {
      if (charactersDescription[character.toLowerCase()]) {
        newCharacters[character.toLowerCase()] =
            charactersDescription[character.toLowerCase()];
      } else {
        logger.warn(
            `AI referenced non-existent character ${character.toLowerCase()}`,
        );
        newCharacters[character.toLowerCase()] = character.toLowerCase();
      }
    }
    scene.characters = newCharacters;
    const newLocations = {};
    for (const location of scene.locations) {
      if (locationDescription[location.toLowerCase()]) {
        newLocations[location.toLowerCase()] =
            locationDescription[location.toLowerCase()];
      } else {
        logger.warn(
            `AI referenced non-existent location ${location.toLowerCase()}`,
        );
        newLocations[location.toLowerCase()] = location.toLowerCase();
      }
    }
    scene.locations = newLocations;
    return scene;
  });

  // Fix some stupid naming of time and add EndTime.
  descriptive_scenes.forEach((scene, i) => {
    if (i < descriptive_scenes.length - 1) {
      scene.endTime = descriptive_scenes[i + 1].startTime;
    } else {
      console.log("last scene");
      scene.endTime = CHAPTER_FULL[CHAPTER_FULL.length - 1].startTime;
    }
  });
  let scenes;
  try {
    scenes = await getGraph(app, uid, sku, visiblity, "scenes");
    scenes[chapter] = descriptive_scenes;
  } catch (e) {
    logger.warn(`Error storing scenes: ${e}`);
    scenes = {};
    scenes[chapter] = descriptive_scenes;
  }
  await storeGraph(app, uid, sku, visiblity, scenes, "scenes");
  return descriptive_scenes;
}

export {
  graphCharacters,
  graphLocations,
  graphCharacterDescriptions,
  graphLocationDescriptions,
  graphSummarizeDescriptions,
  graphScenes,
};
