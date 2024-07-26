/* eslint-disable require-jsdoc */
import {promisify} from "util";
import {exec as execCb} from "child_process";
const exec = promisify(execCb);
import ffmpeg from "fluent-ffmpeg";
import ffmpegTools from "./util/ffmpeg.js";
import ffprobeTools from "./util/ffprobe.js";
import whisper from "./util/whisper.js";
import logger from "./util/logger.js";
import fs from "fs";
import {ENVIRONMENT} from "../config/config.js";

const MAX_SIZE = ENV.MAX_SIZE || 24;
const NUM_THREADS = process.env.NUM_THREADS || 32;

async function writeJSONToBucket(bucket, bookName, localPath, cloudPath, json) {
  await fs.promises.writeFile(`${localPath}${bookName}.json`, JSON.stringify(json, null, 2));
  await bucket.upload(`${localPath}${bookName}.json`, {destination: `${cloudPath}/${bookName}.json`, public: false});
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${cloudPath}/${bookName}.json`;
  return publicUrl;
}

async function uploadFilesToBucket(bucket, bookName, outputFiles, cloudPath = "splitAudio") {
  const uploads = await Promise.all(outputFiles.map((outputFile) =>
    bucket.upload(outputFile, {destination: `${cloudPath}/${outputFile.split("/tmp/")[1]}`, public: false}),
  ));
  return uploads.map((uploadResponse) => {
    const file = uploadResponse[0];
    return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
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

async function getMetaData(ffprobePath, inputFilePath, path) {
  const ffprobeOutput = await ffmpegTools.ffprobe(inputFilePath, ffprobePath);
  const bookData = ffprobeTools.parseFluentFFprobeOutput(ffprobeOutput);
  logger.debug(`Book Data: ${JSON.stringify(bookData, null, 2)}`);
  const inputFiles = Object.values(bookData.chapters).map(() => inputFilePath);
  const outputFiles = Object.keys(bookData.chapters).map(
      (chapterIndex) => `${path}${bookData.title}-ch${chapterIndex}.m4a`,
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
async function pipeline(fileName, uid, bookId, ffmpegPath ) {
  // 1. Download file from bucket to local - or, use the one already there.
  let inputFilePath = `/tmp/${fileName}`;
  let path = `/tmp/`;
  if (bucket) {
    logger.debug(`Downloading file from bucket: UserData/${uid}/Uploads/AudibleRaw/${fileName}`);

    await downloadFileFromBucket(bucket, `UserData/${uid}/Uploads/AudibleRaw/${fileName}`, inputFilePath);
  } else {
    inputFilePath = `../${fileName}`; // TEST
    path = `./tmp/`;
  }
  logger.debug("STEP 1: File downloaded from bucket.");
  // 2. get metadata from audio file
  const metadata = await getMetaData(ffprobePath, inputFilePath, path);
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
  let bookData = "";
  let splitAudio = "";
  if (bucket) {
    bookData = await writeJSONToBucket(bucket, metadata.bookData.title, path, `${uid}/books/${bookId}/metadata`, metadata.bookData);
    splitAudio = await uploadFilesToBucket(bucket, metadata.bookData.title, outputFiles, `${uid}/books/${bookId}/splitAudio`);
  }
  logger.debug("STEP 4: Files uploaded to bucket.");
  // 5. Transcribe the files
  const transcriptions = await transcribeFilesInParallel(metadata.bookData, outputFiles);
  logger.debug("STEP 5: Transcriptions Complete");
  // 6. Upload Transcriptions to Bucket.
  let publicUrl = "";
  if (bucket) {
    publicUrl = await writeJSONToBucket(bucket, metadata.bookData.title, path, `${uid}/books/${bookId}/transcriptions`, transcriptions);
  }
  logger.debug("STEP 6: Transcriptions Uploaded to Bucket.");
  return {transcriptions: publicUrl, metadata: bookData, splitAudio};
}

async function generateTranscriptions(uid, data, app) {
  logger.debug(JSON.stringify(data));
  //   if (data.run !== true) {
  //     logger.debug("not running due to body.run");
  //     return {pong: true};
  //   }
  const asin = data.asin;
  const fileName = `${asin}.m4b`;
  logger.debug(`Processing FileName: ${fileName} for ${uid}`);
  let ffmpegPath;
  if (ENVIRONMENT.value() === "development") {
    ffmpegPath = `ffmpeg`;
  } else {
    ffmpegPath = `./ffmpeg`;
  }
  const urls = await pipeline(fileName, uid, asin, ffmpegPath);
  return urls;
}


export {generateTranscriptions};
