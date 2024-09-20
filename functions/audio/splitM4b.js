/* eslint-disable require-jsdoc */
import {
  downloadFileFromBucket,
  uploadFileToBucket,
  deleteLocalFiles,
} from "../storage/storage.js";

import logger from "../util/logger.js";
import ffmpegTools from "./ffmpeg.js";
import {
  getMetaData,
  getAudioPath,
  getSplitAudioPath} from "./audioMetadata.js";


const MAX_SIZE = process.env.MAX_SIZE || 24;
const NUM_THREADS = process.env.NUM_THREADS || 32;

async function uploadFilesToBucket({bookName, outputFiles, cloudPath = "splitAudio"}) {
  const uploads = await Promise.all(outputFiles.map(async (outputFile) => {
    try {
      const uploadResponse = await uploadFileToBucket({localPath: outputFile, bucketPath: `${cloudPath}${outputFile.split("./bin/")[1]}`});
      logger.debug(`uploadFilesToBucket Upload response for ${outputFile}: ${JSON.stringify(uploadResponse.metadata.name)}`);
      return uploadResponse;
    } catch (error) {
      logger.error(`Error uploading ${outputFile}: ${error}`);
      return null;
    }
  },
  ));
  return uploads.map((uploadResponse) => {
    logger.log(`Uploaded ${uploadResponse.metadata.name} to bucket`);
    return `${uploadResponse.metadata.name}`;
  });
}

// WARN: Delete Output Files when you're done with them!
/* eslint-disable require-jsdoc */
async function splitM4b(uid, sku, ffmpegPath) {
  // 1. Download file from bucket to local - or, use the one already there.
  const inputFilePath = `./bin/${sku}.m4b`;
  await downloadFileFromBucket({bucketPath: getAudioPath(uid, sku), localPath: inputFilePath});
  logger.debug("STEP 1: File downloaded from bucket.");
  // 2. get metadata from audio file
  const metadata = await getMetaData(uid, sku);
  logger.debug("STEP 2: Metadata Obtained");
  // 3. Split file in parallel
  const outputFiles = await ffmpegTools.splitAudioInParallel(
      inputFilePath,
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
  await uploadFilesToBucket({bookName: sku, outputFiles, cloudPath: getSplitAudioPath(uid, sku)});
  logger.debug("STEP 4: Files uploaded to bucket.");
  await deleteLocalFiles([inputFilePath]);
  return outputFiles;
}

export {splitM4b};
