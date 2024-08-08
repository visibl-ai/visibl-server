/* eslint-disable require-jsdoc */

import {
  getTranscriptions,
  storeGraph,
} from "../storage/storage.js";

import {
  geminiRequest,
} from "./gemini.js";


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
  const characterList = await geminiRequest("getCharacters", fullText);
  // 4. store graph.
  await storeGraph(app, uid, sku, visiblity, characterList, "characters");
  return characterList;
}

async function graphLocations(app, req) {
  const {uid, sku, visiblity} = req.body;
  // 1. load transcriptions.
  const transcriptions = await getTranscriptions(app, uid, sku, visiblity);
  // 2. consolidate transcriptions into single string.
  const fullText = consolidateTranscriptions(transcriptions);
  // 3. send to gemini.
  const locationList = await geminiRequest("getLocations", fullText);
  // 4. store graph.
  await storeGraph(app, uid, sku, visiblity, locationList, "locations");
  return locationList;
}

export {
  graphCharacters,
  graphLocations,
};
