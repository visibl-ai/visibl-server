/* eslint-disable camelcase */
/* eslint-disable require-jsdoc */

import {
  getTranscriptions,
  getGraph,
  storeGraph,
} from "../storage/storage.js";

import {
  geminiRequest,
} from "./gemini/gemini.js";

import logger from "firebase-functions/logger";
import novel from "./openai/novel.js";
import nerFunctions from "./openai/ner.js";
import csv from "./csv.js";

const WAIT_TIME = 20;

function consolidateTranscriptions(params) {
  const {transcriptions} = params;
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

// eslint-disable-next-line no-unused-vars
function lowerCaseObjectKeys(params) {
  const {object} = params;
  return Object.fromEntries(
      Object.entries(object).map(([key, value]) => [
        key.toLowerCase(),
      typeof value === "object" ? lowerCaseObjectKeys({object: value}) : value,
      ]),
  );
}

function lowercaseCharacters(characterList) {
  return characterList.map((character) => {
    const lowercasedCharacter = {
      name: character.name.toLowerCase(),
    };
    if (character.aliases && character.aliases.length > 0) {
      lowercasedCharacter.aliases = character.aliases.map((alias) => alias.toLowerCase());
    }
    return lowercasedCharacter;
  });
}

async function graphCharacters(params) {
  const {uid, sku, visiblity} = params;
  // 1. load transcriptions.
  const transcriptions = await getTranscriptions({uid, sku, visiblity});
  // 2. consolidate transcriptions into single string.
  const fullText = consolidateTranscriptions({transcriptions});
  // 3. send to gemini.
  const characterList = await geminiRequest({
    "prompt": "getCharacters",
    "message": fullText,
    "type": "json",
  });
  // 4. store graph.
  characterList.characters = lowercaseCharacters(characterList.characters);
  await storeGraph({uid, sku, visiblity, data: characterList, type: "characters"});
  return characterList;
}

async function graphCharacterDescriptions(params) {
  const {uid, sku, visiblity} = params;
  const transcriptions = await getTranscriptions({uid, sku, visiblity});
  const fullText = consolidateTranscriptions({transcriptions});
  let characters = await getGraph({uid, sku, visiblity, type: "characters"});
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
    const name = character.name;
    // Lets assume the model is smart enough to understand aliases for now.
    // if (character.aliases && character.aliases.length > 0) {
    //   name = `${name} aka `;
    //   for (const alias of character.aliases) {
    //     name = `${name} ${alias}, `;
    //   }
    // }
    logger.debug(`Getting character description for ${name}`);
    const description = await geminiRequest({
      "prompt": "getCharacterDescription", // "getCharacterDescription",
      "message": fullText,
      "replacements": [
        {
          key: "%CHARACTER%",
          value: name,
        },
      ],
    });
    characterDescriptions[character] = description;
    logger.debug(`Character description for ${character}: ${characterDescriptions[character]}`);
    // Add a 15-second delay
    logger.debug(`Waiting ${WAIT_TIME} seconds before next request`);
    await storeGraph({uid, sku, visiblity, data: characterDescriptions, type: "characterDescriptions"});
    await new Promise((resolve) => setTimeout(resolve, WAIT_TIME * 1000));
  }
  return characterDescriptions;
}

function flattenLocations(data) {
  const flattened = [];

  function traverse(location, path = []) {
    const currentPath = [...path, location.name.toLowerCase()];
    flattened.push({
      name: location.name.toLowerCase(),
      type: location.type.toLowerCase(),
      path: currentPath.join(" > "),
    });

    if (location.SubLocations) {
      location.SubLocations.forEach((subLocation) => traverse(subLocation, currentPath));
    }

    if (location.MicroLocation) {
      location.MicroLocation.forEach((microLocation) => traverse(microLocation, currentPath));
    }
  }

  data.MainLocations.forEach((mainLocation) => traverse(mainLocation));
  return flattened;
}

async function graphLocations(params) {
  const {uid, sku, visiblity} = params;
  // 1. load transcriptions.
  const transcriptions = await getTranscriptions({uid, sku, visiblity});
  // 2. consolidate transcriptions into single string.
  const fullText = consolidateTranscriptions({transcriptions});
  // 3. send to gemini.
  const locationList = await geminiRequest({
    "prompt": "getLocations",
    "message": fullText,
    "type": "json",
  });
  // locationList.locations = lowerCaseArrayStrings({array: locationList.locations});
  const flatLocations = {locations: flattenLocations(locationList)};
  // 4. store graph.
  await storeGraph({uid, sku, visiblity, data: flatLocations, type: "locations"});
  return locationList;
}

async function graphLocationDescriptions(params) {
  const {uid, sku, visiblity} = params;
  const transcriptions = await getTranscriptions({uid, sku, visiblity});
  const fullText = consolidateTranscriptions({transcriptions});
  let locations = await getGraph({uid, sku, visiblity, type: "locations"});
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
    const name = location.name;
    logger.debug(`Getting location description for ${name}`);
    const description = await geminiRequest({
      "prompt": "getLocationDescription",
      "message": fullText,
      "replacements": [
        {
          key: "%LOCATION%",
          value: name,
        },
      ],
    });
    locationDescriptions[name] = description;
    logger.debug(`location description for ${name}: ${locationDescriptions[name]}`);
    // Add a 15-second delay
    logger.debug(`Waiting ${WAIT_TIME} seconds before next request`);
    await storeGraph({uid, sku, visiblity, data: locationDescriptions, type: "locationDescriptions"});
    await new Promise((resolve) => setTimeout(resolve, WAIT_TIME * 1000));
  }
  return locationDescriptions;
}

async function graphSummarizeDescriptions(params) {
  const {uid, sku, visiblity} = params;
  const characterDescriptions = await getGraph({uid, sku, visiblity, type: "characterDescriptions"});
  const characterSummaries = await novel.entityImageSummarize(
      "character_image_summarize_prompt",
      characterDescriptions,
      250000,
  );
  await storeGraph({uid, sku, visiblity, data: characterSummaries, type: "characterSummaries"});
  const locationDescriptions = await getGraph({uid, sku, visiblity, type: "locationDescriptions"});
  const locationSummaries = await novel.entityImageSummarize(
      "location_image_summarize_prompt",
      locationDescriptions,
      250000,
  );
  await storeGraph({uid, sku, visiblity, data: locationSummaries, type: "locationSummaries"});

  return {characterSummaries, locationSummaries};
}

async function graphScenes(params) {
  const {uid, sku, visiblity, chapter} = params;
  let scenes_result = [];
  const locations = await getGraph({uid, sku, visiblity, type: "locations"});
  locations.locations = locations.locations.map((location) => location.toLowerCase());
  const characters = await getGraph({uid, sku, visiblity, type: "characters"});
  characters.characters = characters.characters.map((character) => character.toLowerCase());
  const transcriptions = await getTranscriptions({uid, sku, visiblity});
  const CHAPTER_FULL = transcriptions[chapter];
  let charactersDescription = await getGraph({uid, sku, visiblity, type: "characterSummaries"});
  charactersDescription = Object.fromEntries(
      Object.entries(charactersDescription).map(([key, value]) => [key.toLowerCase(), value]),
  );
  let locationDescription = await getGraph({uid, sku, visiblity, type: "locationSummaries"});
  locationDescription = Object.fromEntries(
      Object.entries(locationDescription).map(([key, value]) => [key.toLowerCase(), value]),
  );
  // Loop
  const SLICE_SIZE = 25;
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

  // Set the start time of the first scene to when the chapter starts.
  if (descriptive_scenes.length > 0) {
    descriptive_scenes[0].startTime = CHAPTER_FULL[0].startTime;
  }
  descriptive_scenes.forEach((scene, i) => {
    if (i < (descriptive_scenes.length - 1)) {
      scene.endTime = descriptive_scenes[i + 1].startTime;
    } else {
      console.log("last scene");
      scene.endTime = CHAPTER_FULL[CHAPTER_FULL.length - 1].startTime;
    }
  });
  let scenes;
  try {
    scenes = await getGraph({uid, sku, visiblity, type: "scenes"});
    scenes[chapter] = descriptive_scenes;
  } catch (e) {
    logger.warn(`Error storing scenes: ${e}`);
    scenes = {};
    scenes[chapter] = descriptive_scenes;
  }
  await storeGraph({uid, sku, visiblity, data: scenes, type: "scenes"});
  return descriptive_scenes;
}

async function graphScenes16k(params) {
  const {uid, sku, visiblity, chapter} = params;
  const locations = await getGraph({uid, sku, visiblity, type: "locations"});
  const locationsList = locations.locations.map((location) => location.name);
  logger.debug(`locationsList: ${JSON.stringify(locationsList)}`);
  const characters = await getGraph({uid, sku, visiblity, type: "characters"});
  const charactersList = characters.characters.map((character) => character.name);
  logger.debug(`charactersList: ${JSON.stringify(charactersList)}`);
  const transcriptions = await getTranscriptions({uid, sku, visiblity});
  const chapterJson = transcriptions[chapter];
  chapterJson.forEach((item) => {
    if (typeof item.startTime === "number") {
      item.startTime = item.startTime.toFixed(1);
    }
  });
  const csvText = csv(chapterJson);
  // logger.debug(`csvText: ${csvText}`);
  const numScenes = 180;
  const scenes = await nerFunctions.filmDirector16k({
    charactersList,
    locationsList,
    csvText: JSON.stringify(csvText),
    numScenes,
  });
  await storeGraph({uid, sku, visiblity, data: scenes, type: "scenes16k"});
  return scenes;
}

export {
  graphCharacters,
  graphLocations,
  graphCharacterDescriptions,
  graphLocationDescriptions,
  graphSummarizeDescriptions,
  graphScenes,
  graphScenes16k,
};
