/* eslint-disable require-jsdoc */
import fetch from "node-fetch";
import logger from "../util/logger.js";
import {promises as fsPromises} from "fs";
import fs from "fs";
import ffmpegTools from "./ffmpeg.js";

const demoOPDS = async (req, res) => {
  res.json({
    "metadata": {
      "title": "Visibl Catalog",
    },
    "publications": [
      {
        "metadata": {
          "@type": "http://schema.org/Audiobook",
          "title": "AAX DEMO",
          "author": [
            "MOE ADHAM",
          ],
          "identifier": "VISIBL_000001",
          "language": "en",
          "published": "2021-07-13",
          "description": "The sky above the port was the colour of television, tuned to a dead channel....",
          "duration": 3196,
          "visiblId": "47E2xaFuV0iRXzMJCzFK",
        },
        "images": [
          {
            "href": "https://firebasestorage.googleapis.com/v0/b/visibl-dev-ali.appspot.com/o/Catalogue%2FProcessed%2FVISIBL_000001%2FVISIBL_000001.jpg?alt=media&token=b65c29ad-e913-4605-9b16-5341e815242f",
            "type": "image/jpeg",
          },
        ],
        "links": [
          {
            "href": "http://localhost:5002/v1/aax/demoManifest",
            "type": "application/audiobook+json",
            "rel": "http://opds-spec.org/acquisition/buy",
          },
        ],
      },
    ],
  });
};

const demoManifest = async (req, res) => {
  res.json({
    "@context": "https://readium.org/webpub-manifest/context.jsonld",
    "metadata": {
      "@type": "http://schema.org/Audiobook",
      "title": "Neuromancer: Sprawl Trilogy, Book 1",
      "author": [
        "William Gibson",
      ],
      "identifier": "VISIBL_000001",
      "language": "en",
      "published": "2021-07-13",
      "description": "The sky above the port was the colour of television, tuned to a dead channel....",
      "duration": 3196,
      "visiblId": "47E2xaFuV0iRXzMJCzFK",
    },
    "links": [
      {
        "href": "https://firebasestorage.googleapis.com/v0/b/visibl-dev-ali.appspot.com/o/Catalogue%2FProcessed%2FVISIBL_000001%2FVISIBL_000001.jpg?alt=media&token=b65c29ad-e913-4605-9b16-5341e815242f",
        "type": "image/jpeg",
        "rel": "cover",
      },
    ],
    "readingOrder": [
      {
        "type": "audio/mp4",
        "duration": 3196,
        "title": "AAX DEMO",
        "href": "http://127.0.0.1:5002/v1/aax/stream?audibleKey=XXX&audibleIv=XXX&inputFile=%2Fbin%2FBK_HOWE_007172.aaxc&outputFile=%2Fbin%2FBK_HOWE_007172-ch3.m4a&startTime=19.751995&durationInSeconds=3196.070998",
      },
    ],
  });
};

const streamAaxFfmpeg = async (req, res) => {
  try {
    logger.debug("New request to streamAaxFfmpeg");
    const url = "http://127.0.0.1:8089/";

    // Forward the original request headers for non-HEAD requests
    const headers = {...req.headers};
    delete headers.host; // Remove the 'host' header as it will be set by fetch
    delete headers["x-forwarded-host"];
    delete headers["x-original-url"];
    delete headers.connection;

    // Ensure the 'range' header is forwarded if present
    if (headers.range) {
      headers.Range = headers.range;
      delete headers.range;
    }
    logger.debug(`METHOD: ${req.method}`);
    logger.debug(`HEADERS: ${JSON.stringify(headers)}`);

    // Handle HEAD request separately
    if (req.method === "HEAD") {
      logger.debug("Handling HEAD request");

      // Here we respond with the correct headers for the content.
      res.writeHead(200, {
        "Accept-Ranges": "bytes",
        "Content-Type": "audio/aac", // Correct content type for ADTS-wrapped AAC
        "Connection": "close",
        "Content-Length": "25974816", // Omit or dynamically calculate if static file
        "Cache-Control": "private, max-age=0",
        "Date": new Date().toUTCString(),
        "Server": "FFmpeg-Server",
      });

      res.end(); // End the response without sending a body
    } else {
      const response = await fetch(url, {headers, method: req.method});

      // Forward the response status and headers to the client
      res.writeHead(response.status, {
        ...response.headers.raw(),
        "Access-Control-Allow-Origin": "*", // Enable CORS if needed
      });

      // Ensure the body is piped correctly
      response.body.pipe(res);

      // Handle any errors in the stream
      response.body.on("error", (err) => {
        logger.error("Error while piping the response body:", err);
        res.end(); // Ensure the response is closed properly
      });

      // Handle the end of the stream gracefully
      response.body.on("end", () => {
        logger.debug("Stream ended");
        res.end(); // Close the response properly when the stream ends
      });
    }
  } catch (error) {
    logger.error("Error proxying request:", error);
    res.status(500).send("Internal Server Error");
  }
};

async function aaxcStreamer(req, res) {
  // Handle HEAD request separately
  if (req.method === "HEAD") {
    return handleHeadRequest(req, res);
  } else if (req.method === "GET") {
    return handleGetRequest(req, res);
  }
}

function getOutputFilePath(params) {
  return `${process.cwd()}/bin/${params.sku}-${params.audibleKey}-${params.startTime}.m4a`;
}

function paramsFromReq(req) {
  const {
    audibleKey,
    audibleIv,
    sku,
    uid,
    startTime,
    durationInSeconds,
  } = req.query;
  logger.debug(`paramsFromReq: ${JSON.stringify(req.query)}`);
  const outputFile = getOutputFilePath(req.query);
  return {
    audibleKey,
    audibleIv,
    sku,
    uid,
    outputFile,
    startTime: startTime ? parseFloat(startTime) : undefined,
    durationInSeconds: durationInSeconds ? parseFloat(durationInSeconds) : undefined,
  };
}

async function m4bInMem(params) {
  const outputPath = getOutputFilePath(params);
  try {
    await fsPromises.access(outputPath);
    logger.debug(`File ${outputPath} already exists, using cached version`);
    return outputPath;
  } catch (error) {
    // File doesn't exist, proceed with generation
    logger.debug(`File ${outputPath} does not exist, generating new file`);
  }
  const path = await ffmpegTools.generateM4bInMem(params);
  return path;
}

async function splitAaxc(params) {
  const {metadata, uid, sku, audibleKey, audibleIv, numThreads} = params;
  logger.debug(`splitAaxc metadata: ${JSON.stringify(params, null, 2)}`);
  const outputFiles = metadata.outputFiles;
  const results = [];
  let i = 0;

  while (i < outputFiles.length) {
    const tasks = [];
    for (let j = 0; j < numThreads && i < outputFiles.length; j++, i++) {
      const task = ffmpegTools.generateM4bInMem({
        uid,
        sku,
        startTime: metadata.startTimes[i],
        durationInSeconds: parseFloat(metadata.endTimes[i] - metadata.startTimes[i]),
        audibleKey,
        audibleIv,
        outputFile: outputFiles[i]});
      tasks.push(task);
    }
    results.push(...await Promise.all(tasks));
  }

  return results;
}

async function handleHeadRequest(req, res) {
  logger.debug("Handling HEAD request");

  const params = paramsFromReq(req);
  const path = await m4bInMem(params);
  const stats = await fsPromises.stat(path);
  logger.debug(`stats: ${JSON.stringify(stats)}`);
  const contentLength = stats.size;
  logger.debug(`contentLength: ${path} ${contentLength}`);
  // Here we respond with the correct headers for the content.
  res.writeHead(200, {
    "Accept-Ranges": "bytes",
    "Content-Type": "audio/m4a", // Correct content type for ADTS-wrapped AAC
    "Connection": "close",
    "Content-Length": contentLength, // Omit or dynamically calculate if static file
    // "Cache-Control": "private, max-age=0",
    // "Date": new Date().toUTCString(),
    // "Server": "FFmpeg-Server",
  });

  res.end(); // End the response without sending a body
}

async function handleGetRequest(req, res) {
  logger.debug("Headers:", req.headers);
  const range = req.headers.range;
  if (!range) {
    return res.status(416).send("Range required supported");
  }
  const params = paramsFromReq(req);
  const outputPath = await m4bInMem(params);
  const stats = await fsPromises.stat(outputPath);
  logger.debug(`stats: ${JSON.stringify(stats)}`);
  const contentLength = stats.size;
  // Parse the byte range from the request
  const parts = range.replace(/bytes=/, "").split("-");
  const startByte = parseInt(parts[0], 10);
  const endByte = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
  let endbyteToSend = endByte;
  if (endByte == contentLength) {
    endbyteToSend = contentLength - 1;
  }
  const headersToSend = {
    // 'Content-Range': `bytes ${newStartByte}-${newEndByte}/${audioFileSize}`,
    "Content-Range": `bytes ${startByte}-${endbyteToSend}/${contentLength}`,
    "Accept-Ranges": "bytes",
    // 'Content-Length': `${newEndByte-newStartByte}`,
    "Content-Length": `${endByte-startByte}`,
    "Content-Type": "audio/m4a",
    // 'Connection':"close",
  };
  console.log(`Sending headers:`, headersToSend);
  res.writeHead(206, headersToSend);
  const fileStream = fs.createReadStream(outputPath, {start: startByte, end: endByte});
  fileStream.on("error", (err) => {
    console.error("Error reading file:", err);
    if (!res.headersSent) {
      res.status(500).send("Error during streaming");
    }
  });

  fileStream.on("end", () => {
    console.log("Reached the end of the partial file stream");
  });

  fileStream.pipe(res);

  res.on("close", () => {
    console.log("Client closed connection");
    fileStream.destroy();
  });
}

export {
  demoOPDS,
  demoManifest,
  streamAaxFfmpeg,
  aaxcStreamer,
  splitAaxc,
};
