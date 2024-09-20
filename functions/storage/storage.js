/* eslint-disable require-jsdoc */
import {getStorage, getDownloadURL} from "firebase-admin/storage";
import logger from "../util/logger.js";
import {STORAGE_BUCKET_ID} from "../config/config.js";
import fs from "fs/promises";
import axios from "axios";
import path from "path";
import app from "../firebase.js";
import {storeSceneInCacheFromMemory} from "./realtimeDb/scenesCache.js";
// Get a reference to the default storage bucket

/**
 * Creates a folder in the default Firestore bucket with the name based on the UID
 * @param {Object} params - must contain uid
 */
async function createUserFolder(params) {
  const {uid} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const folderPath = `UserData/${uid}/`; // Folder path in the bucket
  const file = bucket.file(folderPath + ".placeholder"); // Create a placeholder file to establish the folder

  try {
    await file.save("Placeholder content", {
      metadata: {
        contentType: "text/plain",
      },
    });
    logger.debug(`Folder created with path: ${folderPath}`);
    return `${folderPath}`;
  } catch (error) {
    logger.error(`Error creating folder for user ${uid}:`, error);
    return null;
  }
}

/**
 * Creates a folder in the default Firestore bucket with the name based on the catalogueId
 * @param {Object} params - must contain catalogueId
 */
async function createCatalogueFolder(params) {
  const {catalogueId} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const folderPath = `Catalogue/${catalogueId}/`;
  const file = bucket.file(folderPath + ".placeholder");

  try {
    await file.save("Placeholder content", {
      metadata: {
        contentType: "text/plain",
      },
    });
    logger.debug(`Catalogue folder created with path: ${folderPath}`);
    return folderPath;
  } catch (error) {
    logger.error(`Error creating folder for catalogue ${catalogueId}:`, error);
    return null;
  }
}


/**
 * Checks if a file exists in storage given the UID, path an filename
 * @param {Object} params - must contain path
 */
async function fileExists(params) {
  const {path} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(path);
  const [exists] = await file.exists();
  return exists;
}

/**
 * Deletes a file from the storage bucket
 * @param {Object} params - must contain uid, path, filename
 */
async function deleteFile(params) {
  const {uid, path, filename} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const filePath = `UserData/${uid}/${path}${filename}`;
  const file = bucket.file(filePath);
  return file.delete();
}

const getFileStream = async (params) => {
  const {path} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`File ${path} does not exist`);
  }
  return file.createReadStream();
};

const uploadStreamAndGetPublicLink = async (params) => {
  const {stream, filename} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(filename);
  const blobStream = file.createWriteStream();
  stream.pipe(blobStream);
  return new Promise((resolve, reject) => {
    blobStream.on("error", (err) => {
      logger.error("Error uploading file to GCP: " + err);
      reject(err);
    });
    blobStream.on("finish", async () => {
      // Make the file public
      await file.makePublic().catch((err) => {
        logger.error("Error making file public: " + err);
        reject(err);
      });

      // Now the file is public, construct the public URL
      const publicUrl = `https://storage.googleapis.com/${STORAGE_BUCKET_ID.value()}/${filename}`;
      resolve(publicUrl);
    });
  });
};

/**
 * Stores JSON data as a file in the storage bucket
 * @param {Object} params - must contain filename, data
 * @return {Promise<void>} A promise that resolves when the file is stored
 */
async function storeJsonFile(params) {
  const {filename, data} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(filename);
  let jsonString;
  try {
    jsonString = JSON.stringify(data, null, 2);
  } catch (error) {
    logger.error(`Error parsing JSON for ${filename}`);
    jsonString = data;
  }
  const buffer = Buffer.from(jsonString);
  return new Promise((resolve, reject) => {
    file.save(buffer, {
      contentType: "application/json",
    }, (err) => {
      if (err) {
        logger.error("Error uploading JSON to GCP: " + err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Retrieves scene data as a JSON file from the storage bucket
 * @param {Object} params - must contain sku
 * @return {Promise<Object>} A promise that resolves to the parsed JSON data
 */
async function getCatalogueDefaultScene(params) {
  const {sku} = params;
  const filename = getDefaultSceneFilename({sku});
  return getJsonFile({filename});
}

function getDefaultSceneFilename(params) {
  const {sku} = params;
  return `Catalogue/Processed/${sku}/${sku}-scenes.json`;
}

function getSceneFilename(sceneId) {
  return `Scenes/${sceneId}/scenes.json`;
}

async function getScene(params) {
  const {sceneId} = params;
  const filename = getSceneFilename(sceneId);
  return getJsonFile({filename});
}

/**
 * Stores scene data as a JSON file in the storage bucket
 * @param {Object} params - must contain sceneId, sceneData
 * @return {Promise<void>} A promise that resolves when the file is stored
 */
async function storeScenes(params) {
  const {sceneId, sceneData} = params;
  if (sceneId === undefined) {
    throw new Error("storeScenes: sceneId is required");
  }
  await storeSceneInCacheFromMemory({sceneId, sceneData});
  const filename = `Scenes/${sceneId}/scenes.json`;
  return storeJsonFile({filename, data: sceneData});
}


/**
 * Retrieves a JSON file from the storage bucket and parses its contents
 *
 * @param {Object} params - must contain filename
 * @return {Promise<Object>} A promise that resolves to the parsed JSON data
 * @throws {Error} If there's an error downloading or parsing the file
 */
async function getJsonFile(params) {
  const {filename} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(filename);

  return new Promise((resolve, reject) => {
    file.download((err, contents) => {
      if (err) {
        logger.error("Error downloading JSON from GCP: " + err);
        reject(err);
      } else {
        try {
          // const currentTime = Date.now();
          const sceneData = JSON.parse(contents.toString());
          // logger.debug(`Time to parse JSON from getJsonFile: ${Date.now() - currentTime}ms`);
          resolve(sceneData);
        } catch (parseError) {
          logger.error("Error parsing JSON: " + parseError);
          reject(parseError);
        }
      }
    });
  });
}

async function downloadFileFromBucket(params) {
  const {bucketPath, localPath} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(bucketPath);


  // Ensure the directory exists
  await fs.mkdir(path.dirname(localPath), {recursive: true});

  // Download the file
  return await file.download({destination: localPath});
}

async function deleteLocalFiles(localPaths) {
  await Promise.all(localPaths.map((localPath) =>
    fs.unlink(localPath).catch((error) =>
      logger.error(`Error deleting file ${localPath}:`, error),
    ),
  ));
}

async function uploadFileToBucket(params) {
  const {localPath, bucketPath} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());

  try {
    const [uploadResponse] = await bucket.upload(localPath, {
      destination: bucketPath,
    });

    logger.debug(`uploadFileToBucket: Upload response for ${localPath} to ${bucketPath}: ${uploadResponse.name}`);
    return uploadResponse;
  } catch (error) {
    logger.error(`Error uploading file ${localPath} to ${bucketPath}:`, error);
    throw error;
  }
}

async function uploadJsonToBucket(params) {
  const {json, bucketPath} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(bucketPath);
  const jsonString = JSON.stringify(json);
  logger.debug(`uploadJsonToBucket: Uploading JSON to ${bucketPath}: ${jsonString.substring(0, 100)}`);
  try {
    await file.save(jsonString, {
      contentType: "application/json",
      metadata: {
        cacheControl: "no-cache",
      },
    });
    return file;
  } catch (error) {
    logger.error(`Error uploading JSON to ${bucketPath}:`, error);
    throw error;
  }
}

async function copyFile(params) {
  const {sourcePath, destinationPath} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const sourceFile = bucket.file(sourcePath);
  const destinationFile = bucket.file(destinationPath);
  await sourceFile.copy(destinationFile);
  return destinationFile;
}

async function getPublicUrl(params) {
  const {path} = params;
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(path);

  const downloadUrl = await getDownloadURL(file);
  return downloadUrl;
}

async function getTranscriptions(params) {
  // eslint-disable-next-line no-unused-vars
  const {uid, sku, visiblity} = params;
  let filename;
  if (uid === "admin") {
    filename = `Catalogue/Processed/${sku}/${sku}-transcriptions.json`;
  } else {
    filename = `UserData/${uid}/Uploads/Processed/${sku}/${sku}-transcriptions.json`;
  }
  return await getJsonFile({filename});
}

async function storeGraph(params) {
  // eslint-disable-next-line no-unused-vars
  const {uid, sku, visiblity, data, type, graphId} = params;
  if (!graphId || !type || !sku) {
    throw new Error("storeGraph: graphId is required");
  }
  // let filename;
  // if (uid === "admin") {
  //   filename = `Catalogue/Processed/${sku}/${sku}-${type}-graph.json`;
  // } else {
  //   filename = `UserData/${uid}/Uploads/Processed/${sku}/${sku}-${type}-graph.json`;
  // }
  const filename = `Graphs/${graphId}/${sku}-${type}.json`;
  return await storeJsonFile({filename, data});
}

async function getGraph(params) {
  // eslint-disable-next-line no-unused-vars
  const {uid, sku, visiblity, type, graphId} = params;
  // let filename;
  // if (uid === "admin") {
  //   filename = `Catalogue/Processed/${sku}/${sku}-${type}-graph.json`;
  // } else {
  //   filename = `UserData/${uid}/Uploads/Processed/${sku}/${sku}-${type}-graph.json`;
  // }
  const filename = `Graphs/${graphId}/${sku}-${type}.json`;
  return await getJsonFile({filename});
}

// Download an image from a URL and upload it to GCP.
// Returns the public URL.
async function downloadImage(url, filename) {
  const response = await axios({
    method: "GET",
    url: url,
    responseType: "stream",
  });
  return uploadStreamAndGetPublicLink({stream: response.data, filename}).then(async (publicUrl) => {
    logger.debug("uploaded to GCP, publicURL is = " + publicUrl);
    return publicUrl;
  }).catch((err) => {
    logger.error("Error uploading file:", err);
    return "";
  });
}

export {
  createUserFolder,
  createCatalogueFolder,
  fileExists,
  deleteFile,
  uploadStreamAndGetPublicLink,
  getFileStream,
  storeScenes,
  getCatalogueDefaultScene,
  getScene,
  downloadFileFromBucket,
  uploadFileToBucket,
  getJsonFile,
  uploadJsonToBucket,
  copyFile,
  getPublicUrl,
  getDefaultSceneFilename,
  getSceneFilename,
  getTranscriptions,
  storeGraph,
  getGraph,
  downloadImage,
  deleteLocalFiles,
};
