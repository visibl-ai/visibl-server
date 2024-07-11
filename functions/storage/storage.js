/* eslint-disable require-jsdoc */
import {getStorage} from "firebase-admin/storage";
import {logger} from "firebase-functions/v2";
import {STORAGE_BUCKET_ID} from "../config/config.js";
// Get a reference to the default storage bucket

/**
 * Creates a folder in the default Firestore bucket with the name based on the UID
 * @param {Object} app - The Firebase app instance
 * @param {string} uid - The user's unique identifier
 */
async function createUserFolder(app, uid) {
  const bucket = getStorage(app).bucket();
  const folderPath = `UserData/${uid}/rawUploads/`; // Folder path in the bucket
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
  const bucket = getStorage(app).bucket();
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
 * Retrieves the manifest file for a catalogue item
 * @param {Object} app - The Firebase app instance
 * @param {string} catalogueId - The unique identifier for the catalogue item
 * @return {Promise<Object|null>} The manifest JSON object or null if not found
 */
async function getCatalogueManifest(app, catalogueId) {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const filePath = `Catalogue/${catalogueId}/manifest.json`;
  const file = bucket.file(filePath);

  try {
    const [exists] = await file.exists();
    if (!exists) {
      logger.warn(`Manifest file not found for catalogue ${catalogueId}`);
      return null;
    }

    const [content] = await file.download();
    const manifest = JSON.parse(content.toString());
    manifest.metadata.visiblId = catalogueId;
    return manifest;
  } catch (error) {
    logger.error(`Error retrieving manifest for catalogue ${catalogueId}:`, error);
    return null;
  }
}


/**
 * Checks if a file exists in storage given the UID, path an filename
 * @param {Object} app - The Firebase app instance
 * @param {string} uid - The user's unique identifier
 * @param {string} path - The path to the file in the bucket
 * @param {string} filename - The name of the file
 */
async function fileExists(app, uid, path, filename) {
  const bucket = getStorage(app).bucket();
  const filePath = `UserData/${uid}/${path}${filename}`;
  const file = bucket.file(filePath);
  return file.exists();
}

/**
 * Deletes a file from the storage bucket
 * @param {Object} app - The Firebase app instance
 * @param {string} uid - The user's unique identifier
 * @param {string} path - The path to the file in the bucket
 * @param {string} filename - The name of the file
 */
async function deleteFile(app, uid, path, filename) {
  const bucket = getStorage(app).bucket();
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

/**
 * Stores scene data as a JSON file in the storage bucket
 * @param {Object} app - The Firebase app instance
 * @param {string} catalogueId - The catalogue's unique identifier
 * @param {Object} sceneData - The JSON data to be stored
 * @return {Promise<void>} A promise that resolves when the file is stored
 */
async function storeCatalogueScenes(app, catalogueId, sceneData) {
  const filename = `Catalogue/${catalogueId}/scenes.json`;
  return storeJsonFile(app, filename, sceneData);
}


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
 * @param {string} catalogueId - The catalogue's unique identifier
 * @return {Promise<Object>} A promise that resolves to the parsed JSON data
 */
async function getCatalogueScenes(app, catalogueId) {
  const filename = `Catalogue/${catalogueId}/scenes.json`;
  return getJsonFile(app, filename);
}

async function getUserScenes(app, uid, libraryId, sceneId) {
  const filename = `UserData/${uid}/Library/${libraryId}/Scenes/${sceneId}.json`;
  return getJsonFile(app, filename);
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


export {
  createUserFolder,
  createCatalogueFolder,
  getCatalogueManifest,
  fileExists,
  deleteFile,
  uploadStreamAndGetPublicLink,
  storeCatalogueScenes,
  getCatalogueScenes,
  storeUserScenes,
  getUserScenes,
};

