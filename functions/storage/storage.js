/* eslint-disable require-jsdoc */
import {getStorage, getDownloadURL} from "firebase-admin/storage";
import {logger} from "firebase-functions/v2";
import {STORAGE_BUCKET_ID} from "../config/config.js";
import fs from "fs/promises";
import path from "path";
// Get a reference to the default storage bucket

/**
 * Creates a folder in the default Firestore bucket with the name based on the UID
 * @param {Object} app - The Firebase app instance
 * @param {string} uid - The user's unique identifier
 */
async function createUserFolder(app, uid) {
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
 * @param {Object} app - The Firebase app instance
 * @param {string} catalogueId - The unique identifier for the catalogue
 */
async function createCatalogueFolder(app, catalogueId) {
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
 * @param {Object} app - The Firebase app instance
 * @param {string} path - The path to the file in the bucket
 * @param {string} filename - The name of the file
 */
async function fileExists(app, path) {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(path);
  const [exists] = await file.exists();
  return exists;
}

/**
 * Deletes a file from the storage bucket
 * @param {Object} app - The Firebase app instance
 * @param {string} uid - The user's unique identifier
 * @param {string} path - The path to the file in the bucket
 * @param {string} filename - The name of the file
 */
async function deleteFile(app, uid, path, filename) {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const filePath = `UserData/${uid}/${path}${filename}`;
  const file = bucket.file(filePath);
  return file.delete();
}

const uploadStreamAndGetPublicLink = async (app, stream, filename) => {
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


async function storeUserScenes(app, uid, libraryId, sceneId, sceneData) {
  const filename = `UserData/${uid}/Library/${libraryId}/Scenes/${sceneId}.json`;
  return storeJsonFile(app, filename, sceneData);
}

/**
 * Stores JSON data as a file in the storage bucket
 * @param {Object} app - The Firebase app instance
 * @param {string} filename - The name of the file to be stored
 * @param {Object} data - The JSON data to be stored
 * @return {Promise<void>} A promise that resolves when the file is stored
 */
async function storeJsonFile(app, filename, data) {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(filename);

  const jsonString = JSON.stringify(data, null, 2);
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
 * @param {Object} app - The Firebase app instance
 * @param {string} sku - The catalogue's unique identifier
 * @return {Promise<Object>} A promise that resolves to the parsed JSON data
 */
async function getCatalogueDefaultScene(app, sku) {
  const filename = `Catalogue/Processed/${sku}/${sku}-scenes.json`;
  return getJsonFile(app, filename);
}

async function getScene(app, sceneId, chapter) {
  const filename = `Scenes/${sceneId}/${chapter}-scenes.json`;
  return getJsonFile(app, filename);
}

/**
 * Stores scene data as a JSON file in the storage bucket
 * @param {Object} app - The Firebase app instance
 * @param {string} sceneId - The scene's unique identifier
 * @param {string} chapter - The chapter number
 * @param {Object} sceneData - The JSON data to be stored
 * @return {Promise<void>} A promise that resolves when the file is stored
 */
async function storeScenes(app, sceneId, chapter, sceneData) {
  const filename = `Scenes/${sceneId}/${chapter}-scenes.json`;
  return storeJsonFile(app, filename, sceneData);
}


/**
 * Retrieves a JSON file from the storage bucket and parses its contents
 *
 * @param {Object} app - The Firebase app instance
 * @param {string} filename - The name of the file to retrieve
 * @return {Promise<Object>} A promise that resolves to the parsed JSON data
 * @throws {Error} If there's an error downloading or parsing the file
 */
async function getJsonFile(app, filename) {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(filename);

  return new Promise((resolve, reject) => {
    file.download((err, contents) => {
      if (err) {
        logger.error("Error downloading scenes JSON from GCP: " + err);
        reject(err);
      } else {
        try {
          const sceneData = JSON.parse(contents.toString());
          resolve(sceneData);
        } catch (parseError) {
          logger.error("Error parsing JSON: " + parseError);
          reject(parseError);
        }
      }
    });
  });
}

async function downloadFileFromBucket(app, bucketPath, localPath) {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(bucketPath);


  // Ensure the directory exists
  await fs.mkdir(path.dirname(localPath), {recursive: true});

  // Download the file
  return await file.download({destination: localPath});
}

async function uploadFileToBucket(app, localPath, bucketPath) {
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

async function uploadJsonToBucket(app, json, bucketPath) {
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

async function copyFile(app, sourcePath, destinationPath) {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const sourceFile = bucket.file(sourcePath);
  const destinationFile = bucket.file(destinationPath);
  await sourceFile.copy(destinationFile);
  return destinationFile;
}

async function getPublicUrl(app, path) {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const file = bucket.file(path);

  const downloadUrl = await getDownloadURL(file);
  return downloadUrl;
}


export {
  createUserFolder,
  createCatalogueFolder,
  fileExists,
  deleteFile,
  uploadStreamAndGetPublicLink,
  storeScenes,
  getCatalogueDefaultScene,
  storeUserScenes,
  getScene,
  downloadFileFromBucket,
  uploadFileToBucket,
  getJsonFile,
  uploadJsonToBucket,
  copyFile,
  getPublicUrl,
};
