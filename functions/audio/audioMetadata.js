/* eslint-disable require-jsdoc */
import {
  getJsonFile,
} from "../storage/storage.js";

import {ENVIRONMENT} from "../config/config.js";

function getMetadataPath(uid, sku) {
  if (uid === "admin") {
    return `Catalogue/Raw/${sku}.json`;
  } else {
    return `UserData/${uid}/Uploads/AAXRaw/${sku}.json`;
  }
}

async function getMetaData(uid, sku, path) {
  if (!path) {
    path = `./bin/`;
  }
  const bookData = await getJsonFile({filename: getMetadataPath(uid, sku)});
  // logger.debug(`Book Data: ${JSON.stringify(bookData, null, 2)}`);
  if (ENVIRONMENT.value() === "development") {
    bookData.chapters = Object.fromEntries(
        Object.entries(bookData.chapters).slice(0, 2),
    );
  }
  const outputFiles = Object.keys(bookData.chapters).map(
      (chapterIndex) => `${path}${sku}-ch${chapterIndex}.m4a`,
  );
  const startTimes = Object.values(bookData.chapters).map(
      (chapter) => chapter.startTime,
  );
  const endTimes = Object.values(bookData.chapters).map(
      (chapter) => chapter.endTime,
  );
  return {bookData, outputFiles, startTimes, endTimes};
}

function getAudioPath(uid, sku) {
  if (uid === "admin") {
    return `Catalogue/Raw/${sku}.m4b`;
  } else {
    return `UserData/${uid}/Uploads/AAXRaw/${sku}.aaxc`;
  }
}

function getSplitAudioPath(uid, sku) {
  if (uid === "admin") {
    return `Catalogue/Processed/${sku}/`;
  } else {
    return `UserData/${uid}/Uploads/Processed/${sku}/`;
  }
}

export {getMetaData, getAudioPath, getSplitAudioPath};
