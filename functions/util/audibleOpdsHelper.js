/* eslint-disable require-jsdoc */
import axios from "axios";
import logger from "firebase-functions/logger";

import {AUDIBLE_OPDS_API_KEY,
  AUDIBLE_OPDS_FIREBASE_URL,
  STORAGE_BUCKET_ID} from "../config/config.js";

import {
  getAudibleAuthByAudibleId,
  storeAudibleAuthFirestore,
  getAudibleAuthByUid,
  storeAudibleItemsFirestore,
  getAudibleItemsFirestore,
  updateAudibleItemFirestore,
} from "../storage/firestore.js";


function formatFunctionsUrl(functionName) {
  return `${AUDIBLE_OPDS_FIREBASE_URL.value().replace("FUNCTION", functionName.replace(/_/g, "-"))}`;
}

/**
 * Retrieves the Audible login URL for a given user and country code.
 *
 * @param {string} uid - The user ID.
 * @param {Object} data - The data object containing the country code.
 * @param {string} data.country_code - The country code for the Audible store.
 * @param {Object} app - The Firebase app instance.
 * @return {Promise<Object>} A promise that resolves to the response data containing the login URL and related information.
 * @throws {Error} If there's an issue with the API request.
 */
async function getAudibleLoginURL(uid, data, app) {
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
async function getAudibleAuth(uid, data, app) {
  logger.info("getAudibleAuth", {data});
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
  logger.info("getAudibleAuth response", {response: response.data});
  const auth = response.data.auth;
  return auth;
}

async function audiblePostAuthHook(uid, data, app) {
  const auth = data.auth;
  const audibleUserId = auth.customer_info.user_id;
  // 1. Check that no other user has already registered this Audible account
  // (no account sharing/piracy)
  const existingAuth = await getAudibleAuthByAudibleId(audibleUserId);
  if (existingAuth) {
    logger.error(`Audible account already registered, ${audibleUserId}, ${existingAuth.uid}`);
    throw new Error("Audible Account already in use by another user. Please have that user disconnect their account and try again.");
  }
  await storeAudibleAuthFirestore(uid, audibleUserId, auth);

  // 2. Update the users audible items - this adds any new purchases
  await updateUsersAudibleCatalogue(uid, auth, app);

  // 3. For any items that are not currently in the catalogue,
  // or not in the users Bucket, do it!.
  const userItems = await getAudibleItemsFirestore(uid);
  logger.info("userItems", {userItems});
  const itemsToProcess = userItems.filter((item) => item.m4bGenerated !== true);
  logger.info("itemsToProcess", {itemsToProcess});
  await generateM4B(uid, auth, itemsToProcess);

  return {success: true};
}

async function generateM4B(uid, auth, itemsToProcess) {
  await Promise.all(itemsToProcess.map(async (item) => {
    try {
      const response = await axios.post(formatFunctionsUrl("audible_download_aaxc"), {
        country_code: auth.locale_code, // You might want to make this dynamic based on user's country
        auth: auth,
        asin: item.asin,
        bucket: STORAGE_BUCKET_ID.value(),
        path: `UserData/${uid}/Uploads/AudibleRaw/`,
      }, {
        headers: {
          "API-KEY": AUDIBLE_OPDS_API_KEY.value(),
        },
      });

      if (response.status === 200 && response.data.status === "success") {
        logger.info(`Successfully downloaded generated m4b for item ${item.asin}`);
        // Here you would typically process the downloaded file
        // For example, convert it to M4B format
        // Then update the item status in Firestore
        item.m4bGenerated = true;
        await updateAudibleItemFirestore(item);
      } else {
        logger.error(`Failed to download generated m4b for item ${item.asin}`, response.data);
      }
    } catch (error) {
      const errorMessage = error.toString().substring(0, 500);
      logger.error(`Error generating m4b for item ${item.asin}`, errorMessage);
    }
  }));
}

async function updateUsersAudibleCatalogue(uid, app) {
  const auth = await getAudibleAuthByUid(uid);
  try {
    const response = await axios.post(formatFunctionsUrl("audible_get_library"), {
      auth: auth,
    }, {
      headers: {
        "API-KEY": AUDIBLE_OPDS_API_KEY.value(),
      },
    });
    logger.info("audible library response", {response: response.data});
    if (response.status === 200 && response.data.status === "success") {
      const library = response.data.library;
      // Process the library data here
      // For example, you might want to store it in Firestore or perform other operations
      logger.info(`Successfully retrieved Audible library for user ${uid}`);
      await storeAudibleItemsFirestore(uid, library);
      return;
    } else {
      logger.error(`Failed to retrieve Audible library for user ${uid}`, response.data);
      return;
    }
  } catch (error) {
    logger.error(`Error updating Audible catalogue for user ${uid}`, error);
    return {success: false, error: error.message};
  }
}

export {
  getAudibleLoginURL,
  getAudibleAuth,
  audiblePostAuthHook,
};
