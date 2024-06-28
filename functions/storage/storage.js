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

export {
  createUserFolder,
  createCatalogueFolder,
  getCatalogueManifest,
  fileExists,
  deleteFile,
};

