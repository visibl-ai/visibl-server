// ffmpeg -ss 7.94 -to 3215.87 -i yourfile.m4b -acodec libmp3lame outputfile.mp3
// ffmpeg -ss 0 -to 7.94 -i test/tmp/audio/nm.m4b -acodec libmp3lame test/tmp/audio/nm-ch0.mp3 -y

// Need to fork fluent-ffmpeg to add support for -activation_bytes
// ffmpeg -y -activation_bytes XXXXXX -i  './XXX.aax' -codec copy 'XXX.m4b'


import ffmpeg from "fluent-ffmpeg";
import {
  downloadFileFromBucket,
  getFileStream,
} from "../storage/storage.js";
import fs from "fs/promises";
// import fs from 'fs/promises';
import logger from "../util/logger.js";
import {ENVIRONMENT} from "../config/config.js";


const splitAudioInParallel = async (
    inputFile,
    outputFiles,
    startTimes,
    endTimes,
    maxSizeInMb,
    codec,
    currentBitrateKbps,
    numThreads,
    ffmpegPath = ffmpeg,
) => {
  const results = [];
  let i = 0;

  while (i < outputFiles.length) {
    const tasks = [];
    for (let j = 0; j < numThreads && i < outputFiles.length; j++, i++) {
      const task = splitAudioWithMaxSize(
          inputFile,
          outputFiles[i],
          startTimes[i],
          endTimes[i],
          maxSizeInMb,
          codec,
          currentBitrateKbps,
          ffmpegPath);
      tasks.push(task);
    }
    results.push(...await Promise.all(tasks));
  }

  return results;
};

const splitAudioWithMaxSize = async (
    inputFile,
    outputFile,
    startTime,
    endTime,
    maxSizeInMb,
    codec,
    currentBitrateKbps,
    ffmpegPath = ffmpeg) => {
  const durationInSeconds = endTime - startTime;
  const estimatedSize = (durationInSeconds * currentBitrateKbps / 8) / (1024);
  logger.debug(`estimated size of ${outputFile} is ${estimatedSize} MB`);
  if (estimatedSize < maxSizeInMb) {
    return splitAudio(inputFile, outputFile, startTime, durationInSeconds, ffmpegPath);
  } else {
    const durationInSeconds = endTime - startTime;
    const desiredSizeBytes = maxSizeInMb * 1024 * 1024;
    const desiredBitrate = Math.floor((desiredSizeBytes * 8) / durationInSeconds / 1000);
    return splitAndCompressAudio(inputFile, outputFile, startTime, durationInSeconds, codec, desiredBitrate, ffmpegPath);
  }
};

const splitAudio = async (inputFile, outputFile, startTime, durationInSeconds, ffmpegPath = ffmpeg) => {
  return new Promise((resolve, reject) => {
    logger.debug(`Splitting ${inputFile} into ${outputFile} from ${startTime} for ${durationInSeconds}`);
    ffmpeg(inputFile).setFfmpegPath(ffmpegPath)
        .setStartTime(startTime)
        .setDuration(durationInSeconds)
        .audioCodec("copy")
        .noVideo()
        .output(outputFile)
        .on("end", () => {
          logger.debug(`split ${inputFile} into ${outputFile} from ${startTime} for ${durationInSeconds} complete`);
          resolve(outputFile);
        })
        .on("error", (err) => {
          logger.error("An error occurred: " + err.message);
          reject(err);
        })
        .run();
  });
};

const splitAndCompressAudio = async (
    inputFile,
    outputFile,
    startTime,
    durationInSeconds,
    codec,
    desiredBitrate,
    ffmpegPath = ffmpeg) => {
  return new Promise((resolve, reject) => {
    let codecString = "aac";
    if (codec === "mp3") {
      codecString = "libmp3lame";
    }
    logger.debug(`Compressing ${inputFile} into ${outputFile} from ${startTime} for ${durationInSeconds} at ${desiredBitrate}k`);
    ffmpeg(inputFile).setFfmpegPath(ffmpegPath)
        .setStartTime(startTime)
        .setDuration(durationInSeconds)
        .audioCodec(codecString)
        .audioBitrate(`${desiredBitrate}k`)
        .noVideo()
        .output(outputFile)
        .on("end", () => {
          logger.debug(`Compressed ${inputFile} into ${outputFile} from ${startTime} for ${durationInSeconds} complete`);
          resolve(outputFile);
        })
        .on("error", (err) => {
          logger.error("An error occurred: " + err.message);
          reject(err);
        })
        .run();
  });
};

const ffprobe = async (inputFile, ffprobePath) => {
  return new Promise((resolve, reject) => {
    const options = ["-show_chapters"];
    ffmpeg.setFfprobePath(ffprobePath);
    ffmpeg.ffprobe(inputFile, options, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata);
      }
    });
  });
};

// eslint-disable-next-line require-jsdoc
async function generateM4bInMem(params) {
  let ffmpegPath = await downloadFffmpegBinary();
  if (ENVIRONMENT.value() === "development") {
    ffmpegPath = `ffmpeg`;
  }
  logger.debug(`Current working directory: ${process.cwd()}`);
  const inputStream = await getFileStream({path: `UserData/${params.uid}/Uploads/AAXRaw/${params.sku}.aaxc`});
  return new Promise((resolve, reject) => {
    const outputPath = params.outputFile;
    logger.debug(`generateM4bInMem params: ${JSON.stringify(params)}`);
    ffmpeg(inputStream).setFfmpegPath(ffmpegPath)
        .setStartTime(params.startTime)
        .setDuration(params.durationInSeconds)
        .audibleKey(params.audibleKey)
        .audibleIv(params.audibleIv)
        .audioCodec("copy")
        .noVideo()
        // Firebase Functions use an in-memory file system
        // So it is faster to write to the in memory fs than
        // use a buffer with a passthrough.
        .output(outputPath)
        .on("start", (commandLine) => {
          logger.debug("FFmpeg command: " + commandLine);
        })
        .on("end", () => {
          logger.debug(`Generated ${params.outputFile} in memory from ${params.startTime} for ${params.durationInSeconds} complete`);
          resolve(outputPath);
        }).on("error", (err) => {
          logger.error("An error occurred: " + err.message);
          reject(err);
        })
        .run();
  });
}

// eslint-disable-next-line require-jsdoc
async function downloadFffmpegBinary() {
  const ffmpegPath = "./bin/ffmpeg";
  await downloadFileFromBucket({bucketPath: "bin/ffmpeg", localPath: ffmpegPath});
  await fs.chmod(ffmpegPath, 0o755);
  return ffmpegPath;
}


const ffmpegTools = {
  splitAudio,
  splitAudioInParallel,
  ffprobe,
  splitAudioWithMaxSize,
  generateM4bInMem,
  downloadFffmpegBinary,
};

export default ffmpegTools;
