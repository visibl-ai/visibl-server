/* eslint-disable require-jsdoc */
// import {promisify} from "util";
// import {exec as execCb} from "child_process";
// const exec = promisify(execCb);
import ffmpegTools from "../util/ffmpeg.js";
import whisper from "./openai/whisper.js";
import {logger} from "firebase-functions/v2";
import {ENVIRONMENT} from "../config/config.js";
import {uploadFileToBucket,
  downloadFileFromBucket,
  getJsonFile,
  uploadJsonToBucket,
} from "../storage/storage.js";
import fs from "fs/promises";

import {aaxAsinFromSkuFirestore} from "../storage/firestore/aax.js";

const MAX_SIZE = process.env.MAX_SIZE || 24;
const NUM_THREADS = process.env.NUM_THREADS || 32;

async function uploadFilesToBucket(app, bookName, outputFiles, cloudPath = "splitAudio") {
  const uploads = await Promise.all(outputFiles.map(async (outputFile) => {
    try {
      const uploadResponse = await uploadFileToBucket(app, outputFile, `${cloudPath}${outputFile.split("./bin/")[1]}`);
      logger.debug(`uploadFilesToBucket Upload response for ${outputFile}: ${JSON.stringify(uploadResponse.metadata.name)}`);
      return uploadResponse;
    } catch (error) {
      logger.error(`Error uploading ${outputFile}: ${error}`);
      return null;
    }
  },
  ));
  return uploads.map((uploadResponse) => {
    logger.log(`Uploaded ${uploadResponse} to bucket`);
    return `${uploadResponse.metadata.name}`;
  });
}

async function transcribeFilesInParallel(bookData, outputFiles) {
  const transcriptions = {};
  outputFiles.forEach((outputFile, index) => {
    bookData.chapters[index].outputFile = outputFile;
  });
  const promises = Object.entries(bookData.chapters).map(
      async ([chapterIndex, chapter]) => {
        const {startTime, endTime} = chapter;
        logger.debug(
            `Transcribing chapter ${chapterIndex} from ${startTime} to ${endTime}`,
        );
        const transcription = await whisper.whisper(
            chapter.outputFile,
            startTime,
        );
        logger.debug(`Chapter ${chapterIndex} transcription complete.`);
        transcriptions[chapterIndex] = transcription;
        return;
      },
  );
  if (ENVIRONMENT.value() === "development") {
    logger.debug("***Skipping transcription in development mode***");
    return transcriptions;
  } else {
    await Promise.all(promises);
    return transcriptions;
  }
}

function getMetadataPath(uid, sku) {
  if (uid === "admin") {
    return `Catalogue/Raw/${sku}.json`;
  } else {
    return `UserData/${uid}/Uploads/AAXRaw/${sku}.json`;
  }
}

function getM4BPath(uid, sku) {
  if (uid === "admin") {
    return `Catalogue/Raw/${sku}.m4b`;
  } else {
    return `UserData/${uid}/Uploads/AAXRaw/${sku}.m4b`;
  }
}

function getSplitAudioPath(uid, sku) {
  if (uid === "admin") {
    return `Catalogue/Processed/${sku}/`;
  } else {
    return `UserData/${uid}/Uploads/Processed/${sku}/`;
  }
}

function getTranscriptionsPath(uid, sku) {
  if (uid === "admin") {
    return `Catalogue/Processed/${sku}/${sku}-transcriptions.json`;
  } else {
    return `UserData/${uid}/Uploads/Processed/${sku}/${sku}-transcriptions.json`;
  }
}

async function getMetaData(app, uid, sku, path) {
  const bookData = await getJsonFile(app, getMetadataPath(uid, sku));
  logger.debug(`Book Data: ${JSON.stringify(bookData, null, 2)}`);
  if (ENVIRONMENT.value() === "development") {
    bookData.chapters = Object.fromEntries(
        Object.entries(bookData.chapters).slice(0, 2),
    );
  }
  const inputFiles = Object.values(bookData.chapters).map(() => `${path}${sku}.m4b`);
  const outputFiles = Object.keys(bookData.chapters).map(
      (chapterIndex) => `${path}${sku}-ch${chapterIndex}.m4a`,
  );
  const startTimes = Object.values(bookData.chapters).map(
      (chapter) => chapter.startTime,
  );
  const endTimes = Object.values(bookData.chapters).map(
      (chapter) => chapter.endTime,
  );
  logger.debug(inputFiles);
  return {bookData, inputFiles, outputFiles, startTimes, endTimes};
}

// TODO: Add AAX support.
async function pipeline(app, uid, sku, ffmpegPath ) {
  // 1. Download file from bucket to local - or, use the one already there.
  const inputFilePath = `./bin/${sku}.m4b`;
  const path = `./bin/`;

  await downloadFileFromBucket(app, getM4BPath(uid, sku), inputFilePath);
  logger.debug("STEP 1: File downloaded from bucket.");
  // 2. get metadata from audio file

  const metadata = await getMetaData(app, uid, sku, path);
  logger.debug("STEP 2: Metadata Obtained");
  // 3. Split file in parallel
  const outputFiles = await ffmpegTools.splitAudioInParallel(
      metadata.inputFiles,
      metadata.outputFiles,
      metadata.startTimes,
      metadata.endTimes,
      MAX_SIZE,
      metadata.bookData.codec,
      metadata.bookData.bitrate_kbs,
      NUM_THREADS,
      ffmpegPath,
  );
  logger.debug(`STEP 3: File Split into chapters of ${MAX_SIZE}mb`);
  // 4. Upload the split files to bucket?
  let splitAudio = "";
  splitAudio = await uploadFilesToBucket(app, sku, outputFiles, getSplitAudioPath(uid, sku));
  logger.debug("STEP 4: Files uploaded to bucket.");
  // 5. Transcribe the files
  console.log(metadata);
  const transcriptions = await transcribeFilesInParallel(metadata.bookData, outputFiles);
  if (transcriptions === undefined) {
    logger.error(`Transcriptions are undefined for ${sku}`);
    return;
  } else {
    logger.debug("STEP 5: Transcriptions Complete");
  }
  // 6. Upload Transcriptions to Bucket.
  const transcriptionsFile = await uploadJsonToBucket(app, transcriptions, getTranscriptionsPath(uid, sku));
  logger.debug("STEP 6: Transcriptions Uploaded to Bucket.");
  return {transcriptions: transcriptionsFile.metadata.name, metadata: metadata.bookData, splitAudio};
}

async function downloadFffmpegBinary(app) {
  const ffmpegPath = "./bin/ffmpeg";
  await downloadFileFromBucket(app, "bin/ffmpeg", ffmpegPath);
  await fs.chmod(ffmpegPath, 0o755);
  return ffmpegPath;
}

async function generateTranscriptions(uid, data, app) {
  logger.debug(JSON.stringify(data));
  //   if (data.run !== true) {
  //     logger.debug("not running due to body.run");
  //     return {pong: true};
  //   }
  const sku = data.sku;
  logger.debug(`Processing FileName: ${sku} for ${uid}`);
  const asin = await aaxAsinFromSkuFirestore(uid, sku);
  logger.debug(`Asin for SKU: ${sku} is ${asin}`);
  let ffmpegPath;
  logger.debug(`Downloading ffmpeg binary`);
  ffmpegPath = await downloadFffmpegBinary(app);
  if (ENVIRONMENT.value() === "development") {
    ffmpegPath = `ffmpeg`;
  }
  logger.debug(`using ffmpeg path: ${ffmpegPath}`);
  const urls = await pipeline(app, uid, sku, ffmpegPath);
  return urls;
}


export {generateTranscriptions};
