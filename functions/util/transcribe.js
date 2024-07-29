/* eslint-disable require-jsdoc */
// import {promisify} from "util";
// import {exec as execCb} from "child_process";
// const exec = promisify(execCb);
import ffmpegTools from "./ffmpeg.js";
import whisper from "./whisper.js";
import {logger} from "firebase-functions/v2";
import {ENVIRONMENT} from "../config/config.js";
import {uploadFileToBucket,
  downloadFileFromBucket,
  getJsonFile,
  uploadJsonToBucket,
} from "../storage/storage.js";

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
  await Promise.all(promises);
  return transcriptions;
}

async function getMetaData(app, uid, asin, path) {
  const bookData = await getJsonFile(app, `UserData/${uid}/Uploads/AudibleRaw/${asin}.json`);
  logger.debug(`Book Data: ${JSON.stringify(bookData, null, 2)}`);
  if (ENVIRONMENT.value() === "development") {
    bookData.chapters = Object.fromEntries(
        Object.entries(bookData.chapters).slice(0, 6),
    );
  }
  const inputFiles = Object.values(bookData.chapters).map(() => `${path}${asin}.m4b`);
  const outputFiles = Object.keys(bookData.chapters).map(
      (chapterIndex) => `${path}${asin}-ch${chapterIndex}.m4a`,
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
async function pipeline(app, asin, uid, bookId, ffmpegPath ) {
  // 1. Download file from bucket to local - or, use the one already there.
  const inputFilePath = `./bin/${asin}.m4b`;
  const path = `./bin/`;

  await downloadFileFromBucket(app, `UserData/${uid}/Uploads/AudibleRaw/${asin}.m4b`, inputFilePath);
  logger.debug("STEP 1: File downloaded from bucket.");
  // 2. get metadata from audio file

  const metadata = await getMetaData(app, uid, asin, path);
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
  splitAudio = await uploadFilesToBucket(app, asin, outputFiles, `UserData/${uid}/Uploads/Processed/${asin}/`);
  logger.debug("STEP 4: Files uploaded to bucket.");
  // 5. Transcribe the files
  console.log(metadata);
  // if (ENVIRONMENT.value() === "development") {
  //   // Trim outputFiles to the first 6 items for development purposes
  //   outputFiles = outputFiles.slice(0, 6);
  //   metadata.bookData.chapters = Object.fromEntries(
  //       Object.entries(metadata.bookData.chapters).slice(0, 6),
  //   );
  //   logger.debug(`Trimmed outputFiles to first 6 items: ${JSON.stringify(metadata.outputFiles)}`);
  // }
  const transcriptions = await transcribeFilesInParallel(metadata.bookData, outputFiles);
  if (transcriptions === undefined) {
    logger.error(`Transcriptions are undefined for ${asin}`);
    return;
  } else {
    logger.debug("STEP 5: Transcriptions Complete");
  }
  // 6. Upload Transcriptions to Bucket.
  const transcriptionsFile = await uploadJsonToBucket(app, transcriptions, `UserData/${uid}/Uploads/Processed/${asin}/${asin}-transcriptions.json`);
  logger.debug("STEP 6: Transcriptions Uploaded to Bucket.");
  return {transcriptions: transcriptionsFile.metadata.name, metadata: metadata.bookData, splitAudio};
}

async function downloadFffmpegBinary(app) {
  const ffmpegPath = await downloadFileFromBucket(app, "bin/ffmpeg", "./bin/ffmpeg");
  return ffmpegPath;
}

async function generateTranscriptions(uid, data, app) {
  logger.debug(JSON.stringify(data));
  //   if (data.run !== true) {
  //     logger.debug("not running due to body.run");
  //     return {pong: true};
  //   }
  const asin = data.asin;
  logger.debug(`Processing FileName: ${asin} for ${uid}`);
  let ffmpegPath;
  logger.debug(`Downloading ffmpeg binary`);
  ffmpegPath = await downloadFffmpegBinary(app);
  if (ENVIRONMENT.value() === "development") {
    ffmpegPath = `ffmpeg`;
  }
  const urls = await pipeline(app, asin, uid, asin, ffmpegPath);
  return urls;
}


export {generateTranscriptions};
