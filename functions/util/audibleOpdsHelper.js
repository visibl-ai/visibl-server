/* eslint-disable require-jsdoc */
import axios from "axios";
import logger from "firebase-functions/logger";
import ISO6391 from "iso-639-1";

import {AUDIBLE_OPDS_API_KEY,
  AUDIBLE_OPDS_FIREBASE_URL,
  STORAGE_BUCKET_ID,
  ENVIRONMENT,
} from "../config/config.js";

import {
  getAudibleAuthByAudibleId,
  storeAudibleAuthFirestore,
  getAudibleAuthByUid,
  storeAudibleItemsFirestore,
  getAudibleItemsFirestore,
  updateAudibleItemFirestore,
  getAllAudibleAuthFirestore,
} from "../storage/firestore.js";

import {
  populateCatalogueWithAudibleItems,
} from "../storage/firestore/catalogue.js";

import {generateTranscriptions} from "../util/transcribe.js";


function formatFunctionsUrl(functionName) {
  return `${AUDIBLE_OPDS_FIREBASE_URL.value().replace("FUNCTION", functionName.replace(/_/g, "-"))}/${functionName}`;
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
  let itemsToProcess = userItems.filter((item) => item.m4bGenerated !== true);
  logger.info("M4B itemsToProcess", {itemsToProcess});
  await generateM4B(uid, auth, itemsToProcess);
  itemsToProcess = userItems.filter((item) => item.transcriptionsGenerated !== true);
  logger.info("Transcriptions itemsToProcess", {itemsToProcess});
  await transcribe(app, uid, itemsToProcess);
  return {success: true};
}

async function generateM4B(uid, auth, itemsToProcess) {
  await Promise.all(itemsToProcess.map(async (item) => {
    try {
      if (ENVIRONMENT.value() === "development") {
        logger.info(`Skipping generation of m4b for item ${item.asin} in development environment.`);
        item.m4bGenerated = true;
        await updateAudibleItemFirestore(item);
        return;
      }
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

async function transcribe(app, uid, itemsToProcess) {
  await Promise.all(itemsToProcess.map(async (item) => {
    try {
      const transcription = await generateTranscriptions(uid, item, app);
      item.transcriptions = transcription.transcriptions;
      item.metadata = transcription.metadata;
      item.splitAudio = transcription.splitAudio;
      item.transcriptionsGenerated = true;
      await updateAudibleItemFirestore(item);
    } catch (error) {
      logger.error(`Error generating transcriptions for item ${item.asin}`, error);
    }
  }));
}

async function updateUsersAudibleCatalogue(uid, app) {
  const auth = await getAudibleAuthByUid(uid);
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
        const asins = [process.env.ASIN1, process.env.ASIN2];
        library = library.filter((item) => asins.includes(item.asin));
        logger.info(`Reduced library to ${library.length} items for development environment.`);
      }
      // Process the library data here
      // For example, you might want to store it in Firestore or perform other operations
      logger.info(`Successfully retrieved Audible library for user ${uid}`);
      await storeAudibleItemsFirestore(uid, library);
      library = library.map((item) => ({
        type: "audiobook",
        title: item.title,
        visibility: "private",
        addedBy: uid,
        sku: item.sku_lite,
        feedTemplate: itemToOPDSFeed(item),
      }));
      const addedItems = await populateCatalogueWithAudibleItems(uid, library);
      logger.info(`Added ${addedItems.map((item) => item.sku).join(", ")} items to catalogue`);
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

async function refreshAudibleTokens(data) {
  // TODO Add pagination.
  const itemsToRefresh = await getAllAudibleAuthFirestore({from: data.from, to: data.to});
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
          logger.info(`Refreshed Audible tokens for user ${item.uid} from ${originalExpiry} to ${newExpiry}`);
          await storeAudibleAuthFirestore(item.uid, item.audibleUserId, result.updated_auth);
          return {uid: item.uid, status: "success", message: "Tokens refreshed successfully", originalExpiry, newExpiry};
        } else {
          logger.warn(`No updated auth received for user ${item.uid}`);
          return {uid: item.uid, status: "warning", message: "No updated auth received"};
        }
      } else {
        logger.error(`Failed to refresh Audible tokens for user ${item.uid}`, response.data);
        return {uid: item.uid, status: "error", message: "Failed to refresh tokens", error: response.data};
      }
    } catch (error) {
      logger.error(`Error refreshing Audible tokens for user ${item.uid}`, error);
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

/* OPDS Catalogue item template
{
  "metadata": {
    "@type": "http://schema.org/Audiobook",
    "title": "Neuromancer: Sprawl Trilogy, Book 1",
    "author": {
      "name": "William Gibson",
      "sortAs": "Gibson, William",
    },
    "identifier": "riw7PiKBeKZF70WUMoSw",
    "language": "en",
    "modified": "2024-06-28T15:28:26.000Z",
    "published": "2021",
    "duration": 30777.168345,
    "description": "Neuromancer: Sprawl Trilogy, Book 1",
    "visiblId": "riw7PiKBeKZF70WUMoSw",
  },
  "images": [
    {
      "href": "https://firebasestorage.googleapis.com/v0/b/visibl-dev-ali.appspot.com/o/Catalogue%2Friw7PiKBeKZF70WUMoSw%2Fcover.jpg?alt=media&token=97680a18-f041-4e9e-9d72-90e9e85280c5",
      "type": "image/jpeg",
    },
  ],
  "links": [
    {
      "href": "https://visibl-dev-ali.web.app/v1/tmp/catalogue/riw7PiKBeKZF70WUMoSw",
      "type": "application/audiobook+json",
      "rel": "http://opds-spec.org/acquisition/buy",
    },
  ],
};
*//*
{
  asin: "B07231BVRJ",
  asset_details: [],
  available_codecs: [
    {
      enhanced_codec: "LC_64_22050_stereo",
      format: "Enhanced",
      is_kindle_enhanced: true,
      name: "aax_22_64",
    },
    {
      enhanced_codec: "LC_32_22050_stereo",
      format: "Enhanced",
      is_kindle_enhanced: true,
      name: "aax_22_32",
    },
    {
      enhanced_codec: "format4",
      format: "Format4",
      is_kindle_enhanced: false,
      name: "format4",
    },
    {
      enhanced_codec: "mp42264",
      format: "Enhanced",
      is_kindle_enhanced: true,
      name: "mp4_22_64",
    },
    {
      enhanced_codec: "piff2232",
      format: "Enhanced",
      is_kindle_enhanced: true,
      name: "piff_22_32",
    },
    {
      enhanced_codec: "mp42232",
      format: "Enhanced",
      is_kindle_enhanced: true,
      name: "mp4_22_32",
    },
    {
      enhanced_codec: "piff2264",
      format: "Enhanced",
      is_kindle_enhanced: true,
      name: "piff_22_64",
    },
    {
      enhanced_codec: "aax",
      format: "Enhanced",
      is_kindle_enhanced: false,
      name: "aax",
    },
  ],
  content_delivery_type: "MultiPartBook",
  content_type: "Product",
  format_type: "unabridged",
  has_children: true,
  is_adult_product: false,
  is_ayce: false,
  is_listenable: true,
  is_purchasability_suppressed: false,
  is_removable_by_parent: true,
  is_vvab: false,
  issue_date: "2011-08-16",
  language: "english",
  library_status: {
    date_added: "2019-08-31T23:20:57.950Z",
    is_pending: null,
    is_preordered: null,
    is_removable: null,
    is_visible: null,
  },
  merchandising_summary: "<p>In the year 2045, reality is an ugly place. The only time Wade Watts really feels alive is when he’s jacked into the OASIS, a vast virtual world where most of humanity spends their days....</p>",
  publication_datetime: "2011-08-16T05:00:00Z",
  publication_name: "Ready Player One",
  purchase_date: "2019-08-31T23:20:57.950Z",
  release_date: "2011-08-16",
  runtime_length_min: 940,
  sku: "BK_RAND_002735CA",
  sku_lite: "BK_RAND_002735",
  status: "Active",
  thesaurus_subject_keywords: ["literature-and-fiction"],
  title: "Ready Player One",
};
*/

function itemToOPDSFeed(item) {
  const feed = {
    metadata: {
      "@type": "http://schema.org/Audiobook",
      "title": item.title,
      // "author": get  from metadata.
      "identifier": item.sku_lite,
    },
    links: item.links,
    images: item.images,
    language: ISO6391.getCode(item.language) || item.language,
    modified: "",
    published: item.publication_datetime.split("T")[0],
    // duration: get from metadata.
    description: item.merchandising_summary.replace(/<[^>]*>/g, ""),
    visiblId: "",
  };
  return feed;
}

export {
  getAudibleLoginURL,
  getAudibleAuth,
  audiblePostAuthHook,
  refreshAudibleTokens,
};
