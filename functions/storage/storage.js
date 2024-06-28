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
async function storeScenes(app, catalogueId, sceneData) {
  const bucket = getStorage(app).bucket(STORAGE_BUCKET_ID.value());
  const filename = `Catalogue/${catalogueId}/scenes.json`;
  const file = bucket.file(filename);

  const jsonString = JSON.stringify(sceneData, null, 2);
  const buffer = Buffer.from(jsonString);

  return new Promise((resolve, reject) => {
    file.save(buffer, {
      contentType: "application/json",
    }, (err) => {
      if (err) {
        logger.error("Error uploading scenes JSON to GCP: " + err);
        reject(err);
      } else {
        resolve();
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
  storeScenes,
};

