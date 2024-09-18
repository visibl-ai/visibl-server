/* eslint-disable require-jsdoc */
// import {promisify} from "util";
// import {exec as execCb} from "child_process";
// const exec = promisify(execCb);
import ffmpegTools from "../audio/ffmpeg.js";
import whisper from "./openai/whisper.js";
import logger from "../util/logger.js";
import fs from "fs";
import {ENVIRONMENT} from "../config/config.js";
import {
  uploadJsonToBucket,
} from "../storage/storage.js";
import {
  getMetaData,
} from "../audio/audioMetadata.js";
import {splitM4b} from "../audio/splitM4b.js";
import {splitAaxc} from "../audio/aaxStream.js";
import {updateAAXCChapterFileSizes} from "../util/audibleOpdsHelper.js";


async function transcribeFilesInParallel(bookData, outputStreams) {
  const transcriptions = {};
  outputStreams.forEach((outputStream, index) => {
    bookData.chapters[index].outputStream = outputStream;
  });
  const prompt = `The transcript is an audiobook version of ${bookData.title} by ${bookData.author}.`;
  const promises = Object.entries(bookData.chapters).map(
      async ([chapterIndex, chapter]) => {
        const {startTime, endTime} = chapter;
        logger.debug(
            `Transcribing chapter ${chapterIndex} from ${startTime} to ${endTime} with prompt ${prompt}`,
        );
        const transcription = await whisper.whisper(
            chapter.outputStream,
            startTime,
            prompt,
        );
        logger.debug(`Chapter ${chapterIndex} transcription complete.`);
        transcriptions[chapterIndex] = transcription;
        return;
      },
  );
  if (ENVIRONMENT.value() === "development") {
    logger.debug("***Skipping transcription in development mode***");
    // await Promise.all(promises);
    return transcriptions;
  } else {
    await Promise.all(promises);
    return transcriptions;
  }
}

function getTranscriptionsPath(uid, sku) {
  if (uid === "admin") {
    return `Catalogue/Processed/${sku}/${sku}-transcriptions.json`;
  } else {
    return `UserData/${uid}/Uploads/Processed/${sku}/${sku}-transcriptions.json`;
  }
}

async function generateTranscriptions({uid, item, numThreads = 32, entryType}) {
  logger.debug(JSON.stringify(item));
  const sku = item.sku;
  logger.debug(`Processing FileName: ${sku} for ${uid}`);
  let ffmpegPath;
  logger.debug(`Downloading ffmpeg binary`);
  ffmpegPath = await ffmpegTools.downloadFffmpegBinary();
  if (ENVIRONMENT.value() === "development") {
    ffmpegPath = `ffmpeg`;
  }
  logger.debug(`using ffmpeg path: ${ffmpegPath}`);
  let outputStreams; let chapters;
  if (entryType === "m4b") {
    outputStreams = await outputStreamsFromM4b({uid, sku, ffmpegPath});
  } else if (entryType === "aaxc") {
    ({outputStreams, chapters} = await outputStreamsFromAaxc({uid, sku, audibleKey: item.key, audibleIv: item.iv, numThreads: numThreads}));
    await updateAAXCChapterFileSizes({chapters, item});
  }
  const metadata = await getMetaData(uid, sku);
  const transcriptions = await transcribeFilesInParallel(metadata.bookData, outputStreams);
  if (transcriptions === undefined) {
    logger.error(`Transcriptions are undefined for ${sku}`);
    return;
  } else {
    logger.debug("STEP 5: Transcriptions Complete");
  }
  // 6. Upload Transcriptions to Bucket.
  const transcriptionsFile = await uploadJsonToBucket({json: transcriptions, bucketPath: getTranscriptionsPath(uid, sku)});
  logger.debug("STEP 6: Transcriptions Uploaded to Bucket.");
  return {transcriptions: transcriptionsFile.metadata.name, metadata: metadata.bookData};
}

async function outputStreamsFromM4b({uid, sku, ffmpegPath}) {
  const outputFiles = await splitM4b(uid, sku, ffmpegPath);
  // Map each outputFile to a readable stream
  const outputStreams = outputFiles.map((file) => fs.createReadStream(file));
  return outputStreams;
}


async function outputStreamsFromAaxc({uid, sku, audibleKey, audibleIv, numThreads}) {
  const metadata = await getMetaData(uid, sku);
  const chapters = await splitAaxc({metadata, uid, sku, audibleKey, audibleIv, numThreads});
  const outputStreams = chapters.map((file) => fs.createReadStream(file));
  return {outputStreams, chapters};
}

export {generateTranscriptions};
