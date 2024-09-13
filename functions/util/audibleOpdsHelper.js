
/* eslint-disable require-jsdoc */
import axios from "axios";
import logger from "../util/logger.js";

import {AUDIBLE_OPDS_API_KEY,
  AUDIBLE_OPDS_FIREBASE_URL,
  STORAGE_BUCKET_ID,
  ENVIRONMENT,
} from "../config/config.js";

import {
  getAAXAvailableFirestore,
  setAAXConnectDisableFirestore,
} from "../storage/firestore/users.js";

import {
  aaxStoreAuthFirestore,
  aaxGetAuthByAAXIdFirestore,
  aaxGetAuthByUidFirestore,
  aaxStoreItemsFirestore,
  aaxUpdateItemFirestore,
  aaxGetItemsFirestore,
  aaxGetAllAuthFirestore,
} from "../storage/firestore/aax.js";


import {generateTranscriptions} from "../ai/transcribe.js";

import {addSkuToCatalogue} from "./opds.js";


function formatFunctionsUrl(functionName) {
  return `${AUDIBLE_OPDS_FIREBASE_URL.value().replace("FUNCTION", functionName.replace(/_/g, "-"))}/${functionName}`;
}

/**
 * Retrieves the AAX login URL for a given user and country code.
 *
 * @param {string} uid - The user ID.
 * @param {Object} data - The data object containing the country code.
 * @param {string} data.country_code - The country code for the AAX store.
 * @return {Promise<Object>} A promise that resolves to the response data containing the login URL and related information.
 * @throws {Error} If there's an issue with the API request.
 */
async function getAAXLoginURL(uid, data) {
  const aaxAvailable = await getAAXAvailableFirestore(uid);
  logger.debug(`aaxAvailable: ${aaxAvailable.active} for ${uid}`);
  if (!aaxAvailable.active) {
    return {error: "AAX not available"};
  }
  const response = await axios.post(formatFunctionsUrl("get_login_url"), {
    country_code: data.countryCode,
  }, {
    headers: {
      "API-KEY": AUDIBLE_OPDS_API_KEY.value(),
    },
  });

  const loginUrl = response.data.login_url;
  const codeVerifier = response.data.code_verifier;
  const serial = response.data.serial;
  return {loginUrl, codeVerifier, serial};
}


// eslint-disable-next-line require-jsdoc
async function getAAXAuth(uid, data) {
  logger.info("getAAXAuth", {data});
  const response = await axios.post(formatFunctionsUrl("do_login"), {
    code_verifier: data.codeVerifier,
    response_url: data.responseUrl,
    serial: data.serial,
    country_code: data.countryCode,
  }, {
    headers: {
      "API-KEY": AUDIBLE_OPDS_API_KEY.value(),
    },
  });
  logger.info("getAAXAuth response", {response: response.data});
  const auth = response.data.auth;
  return auth;
}

async function audiblePostAuthHook(uid, data) {
  // logger.debug(`audiblePostAuthHook: uid: ${uid}, data: ${JSON.stringify(data)}`);
  const auth = data.auth;
  const audibleUserId = auth.customer_info.user_id;
  // 1. Check that no other user has already registered this AAX account
  // (no account sharing/piracy)
  const existingAuth = await aaxGetAuthByAAXIdFirestore(audibleUserId);
  if (existingAuth) {
    logger.error(`AAX account already registered, ${audibleUserId}, ${existingAuth.uid}`);
    throw new Error("AAX Account already in use by another user. Please have that user disconnect their account and try again.");
  }
  await aaxStoreAuthFirestore(uid, audibleUserId, auth);

  // 2. Update the users audible items - this adds any new purchases
  await updateUsersAAXCatalogue(uid, auth);

  // 3. For any items that are not currently in the catalogue,
  // or not in the users Bucket, do it!.
  const userItems = await aaxGetItemsFirestore(uid);
  logger.info("userItems", {userItems});
  let itemsToProcess = userItems.filter((item) => item.fileSize !== true);
  logger.info("M4B itemsToProcess", {itemsToProcess});
  await generateM4B(uid, auth, itemsToProcess);
  itemsToProcess = userItems.filter((item) => item.transcriptionsGenerated !== true);
  logger.info("Transcriptions itemsToProcess", {itemsToProcess});
  await transcribe(uid, itemsToProcess);
  return {success: true};
}

async function generateM4B(uid, auth, itemsToProcess) {
  await Promise.all(itemsToProcess.map(async (item) => {
    try {
      if (ENVIRONMENT.value() === "development") {
        logger.info(`Skipping generation of m4b for item ${item.asin} in development environment.`);
        item.fileSize = true;
        await aaxUpdateItemFirestore(item);
        return;
      }
      const response = await axios.post(formatFunctionsUrl("audible_download_aaxc"), {
        country_code: auth.locale_code, // You might want to make this dynamic based on user's country
        auth: auth,
        asin: item.asin,
        sku: item.sku,
        bucket: STORAGE_BUCKET_ID.value(),
        path: `UserData/${uid}/Uploads/AAXRaw/`,
      }, {
        headers: {
          "API-KEY": AUDIBLE_OPDS_API_KEY.value(),
        },
      });
      TODO: use ffmpeg to get the size here!!
      if (response.status === 200 && response.data.status === "success") {
        logger.info(`Successfully downloaded generated m4b for item ${item.asin}`);
        // Here you would typically process the downloaded file
        // For example, convert it to M4B format
        // Then update the item status in Firestore
        item.fileSize = true;
        item.key = response.key;
        item.iv = response.iv;
        item.licenceRules = response.licence_rules;
        await aaxUpdateItemFirestore(item);
      } else {
        logger.error(`Failed to download generated m4b for item ${item.asin}`, response.data);
      }
    } catch (error) {
      const errorMessage = error.toString().substring(0, 500);
      logger.error(`Error generating m4b for item ${item.asin}`, errorMessage);
    }
  }));
}


async function transcribe(uid, itemsToProcess) {
  await Promise.all(itemsToProcess.map(async (item) => {
    try {
      const transcription = await generateTranscriptions(uid, item);
      item.transcriptions = transcription.transcriptions;
      item.metadata = transcription.metadata;
      item.splitAudio = transcription.splitAudio;
      item.transcriptionsGenerated = true;
      await aaxUpdateItemFirestore(item);
      await addSkuToCatalogue(uid, item.metadata, "private");
    } catch (error) {
      logger.error(`Error generating transcriptions for item ${item.asin}`, error);
    }
  }));
}

async function updateUsersAAXCatalogue(uid) {
  const auth = await aaxGetAuthByUidFirestore(uid);
  try {
    const response = await axios.post(formatFunctionsUrl("audible_get_library"), {
      auth: auth,
      type: "raw",
    }, {
      headers: {
        "API-KEY": AUDIBLE_OPDS_API_KEY.value(),
      },
    });
    if (response.status === 200 && response.data.status === "success") {
      let library = response.data.library;
      if (ENVIRONMENT.value() === "development") {
        logger.info("TEST, return reduced list for library.");
        const skus = [process.env.SKU1, process.env.SKU2];
        library = library.filter((item) => skus.includes(item.sku_lite));
        logger.info(`Reduced library to ${library.length} items for development environment.`);
      }
      // Process the library data here
      // For example, you might want to store it in Firestore or perform other operations
      logger.info(`Successfully retrieved AAX library for user ${uid}`);
      await aaxStoreItemsFirestore(uid, library);
      library = library.map((item) => ({
        type: "audiobook",
        title: item.title,
        visibility: "private",
        addedBy: uid,
        sku: item.sku_lite,
        // feedTemplate: itemToOPDSFeed(item),
      }));
      // const addedItems = await populateCatalogueWithAAXItems(uid, library);
      // logger.info(`Added ${addedItems.map((item) => item.sku).join(", ")} items to catalogue`);
      return;
    } else {
      logger.error(`Failed to retrieve AAX library for user ${uid}`, response.data);
      return;
    }
  } catch (error) {
    logger.error(`Error updating AAX catalogue for user ${uid}`, error);
    return {success: false, error: error.message};
  }
}

async function refreshAAXTokens(data) {
  // TODO Add pagination.
  const itemsToRefresh = await aaxGetAllAuthFirestore({from: data.from, to: data.to});
  const auth = itemsToRefresh.results;
  logger.info(`Items to refresh ${auth.length}`);

  const results = await Promise.all(auth.map(async (item) => {
    try {
      const originalExpiry = item.expires;
      const response = await axios.post(formatFunctionsUrl("refresh_audible_tokens"), {
        auth: item.auth,
      }, {
        headers: {
          "API-KEY": AUDIBLE_OPDS_API_KEY.value(),
        },
      });

      if (response.status === 200) {
        const result = response.data;
        if (result.updated_auth) {
          const newExpiry = result.updated_auth.expires;
          logger.info(`Refreshed AAX tokens for user ${item.uid} from ${originalExpiry} to ${newExpiry}`);
          await aaxStoreAuthFirestore(item.uid, item.audibleUserId, result.updated_auth);
          return {uid: item.uid, status: "success", message: "Tokens refreshed successfully", originalExpiry, newExpiry};
        } else {
          logger.warn(`No updated auth received for user ${item.uid}`);
          return {uid: item.uid, status: "warning", message: "No updated auth received"};
        }
      } else {
        logger.error(`Failed to refresh AAX tokens for user ${item.uid}`, response.data);
        return {uid: item.uid, status: "error", message: "Failed to refresh tokens", error: response.data};
      }
    } catch (error) {
      logger.error(`Error refreshing AAX tokens for user ${item.uid}`, error);
      return {uid: item.uid, status: "error", message: "Error refreshing tokens", error: error.message};
    }
  }));

  return {
    totalProcessed: results.length,
    successful: results.filter((r) => r.status === "success").length,
    warnings: results.filter((r) => r.status === "warning").length,
    errors: results.filter((r) => r.status === "error").length,
    details: results,
  };
}

async function submitAAXAuth(req) {
  const auth = req.body.auth;
  const uid = req.body.uid;
  return await audiblePostAuthHook(uid, auth);
}

async function disconnectAAXAuth(uid) {
  // TODO: A lot more to delete here!
  return await setAAXConnectDisableFirestore(uid);
}

export {
  getAAXLoginURL,
  getAAXAuth,
  audiblePostAuthHook,
  refreshAAXTokens,
  submitAAXAuth,
  disconnectAAXAuth,
};
