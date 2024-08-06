/* eslint-disable require-jsdoc */
import ISO6391 from "iso-639-1";
import {getJsonFile} from "../storage/storage.js";
import {generateTranscriptions} from "./transcribe.js";
import logger from "firebase-functions/logger";
import {
  copyFile,
  getPublicUrl,
} from "../storage/storage.js";

import {
  catalogueGetItemFirestore,
  catalogueAddFirestore,
  catalogueGetAllFirestore,
  getPrivateCatalogueItemsFirestore,
} from "../storage/firestore/catalogue.js";

import {
  libraryGetFirestore,
} from "../storage/firestore/library.js";

import {AAX_CONNECT_SOURCE, ENVIRONMENT, HOSTING_DOMAIN} from "../config/config.js";

async function generateOPDS(app, uid, catalogueItems, title) {
  console.log(catalogueItems);
  const opdsResponse = {
    metadata: {
      title: title,
    },

    publications: await Promise.all(catalogueItems.map(async (item) => ({
      metadata: metadataToOPDSMetadata(item.metadata, item.id),
      images: [
        {
          href: await getAlbumArtUrl(app, item.visibility, uid, item.sku),
          type: "image/jpeg",
        },
      ],
      links: [
        {
          href: `${HOSTING_DOMAIN.value()}/v1/tmp/catalogue/${item.id}`,
          type: "application/audiobook+json",
          rel: "http://opds-spec.org/acquisition/buy",
        },
      ],
    }))),
  };

  return opdsResponse;
}

async function generatePublicOPDS(app) {
  const uid = "admin";
  const catalogueItems = await catalogueGetAllFirestore(app);
  return await generateOPDS(app, uid, catalogueItems, "Visibl Catalog");
}

async function generatePrivateOPDS(uid, data, app) {
  const catalogueItems = await getPrivateCatalogueItemsFirestore(uid);
  logger.debug(`Generating private OPDS for ${catalogueItems.length} items`);
  return await generateOPDS(app, uid, catalogueItems, `${AAX_CONNECT_SOURCE.value()} Import`);
}

async function generateUserItemManifest(app, uid, data) {
  const libraryItem = await libraryGetFirestore(uid, data.libraryId);
  return await generateManifest(app, uid, libraryItem.catalogueId);
}

async function generateManifest(app, uid, catalogueId) {
  // 1. get the item from the catalogue
  const catalogueItem = await catalogueGetItemFirestore({id: catalogueId});
  logger.debug(`Generating manifest for ${catalogueItem.title} sku ${catalogueItem.sku}`);
  // 2. Determine if it is public or private
  const visibility = catalogueItem.visibility;
  // 3. Generate the manifest
  const metadata = metadataToOPDSMetadata(catalogueItem.metadata, catalogueItem.id);
  const imageUrl = await getAlbumArtUrl(app, visibility, uid, catalogueItem.sku);
  logger.debug(`Image URL: ${imageUrl}`);
  const readingOrder = await metadataToOPDSReadingOrder(app, uid, visibility, catalogueItem.metadata);
  logger.debug(`Reading Order: ${readingOrder}`);
  const manifest = {
    "@context": "https://readium.org/webpub-manifest/context.jsonld",
    "metadata": metadata,
    "links": [
      {
        "href": imageUrl,
        "type": "image/jpeg",
        "rel": "cover",
      },
    ],
    "readingOrder": readingOrder,
  };
  return manifest;
}

async function getAlbumArtUrl(app, visibility, uid, sku) {
  if (visibility === "public") {
    return await getPublicUrl(app, `Catalogue/Processed/${sku}/${sku}.jpg`);
  } else {
    return await getPublicUrl(app, `UserData/${uid}/Uploads/AAXRaw/${sku}.jpg`);
  }
}

async function processRawPublicItem(req, app) {
  const sku = req.body.sku;
  if (!sku) {
    return {
      error: true,
      message: "sku is required",
    };
  }
  const metadata = await getJsonFile(app, `Catalogue/Raw/${sku}.json`);
  if (!metadata) {
    return {
      error: true,
      message: "metadata not found",
    };
  }
  // eslint-disable-next-line no-unused-vars
  const transcriptions = await generateTranscriptions("admin", metadata, app);
  // Now that the transcriptions and metadata are available lets add it to the catalogue.
  await addSkuToCatalogue("admin", metadata, "public");
  // Copy the album art
  await copyAlbumArt(app, sku);
  return;
}

async function getM4AUrl(app, visibility, sku, uid, chapterIndex) {
  logger.debug(`Getting M4B URL for uid ${uid} visibility ${visibility} sku ${sku} chapter ${chapterIndex}`);
  if (visibility === "public") {
    return await getPublicUrl(app, `Catalogue/Processed/${sku}/${sku}-ch${chapterIndex}.m4a`);
  } else {
    return await getPublicUrl(app, `UserData/${uid}/Uploads/Processed/${sku}/${sku}-ch${chapterIndex}.m4a`);
  }
}

async function metadataToOPDSReadingOrder(app, uid, visibility, metadata) {
  const sku = metadata.sku;
  if (ENVIRONMENT.value() === "development") {
    metadata.chapters = {
      "0": metadata.chapters["0"],
      "1": metadata.chapters["1"],
    };
  }
  const readingOrder = await Promise.all(Object.entries(metadata.chapters).map(async ([chapterIndex, chapter]) => ({
    type: "audio/mp4",
    duration: chapter.endTime - chapter.startTime,
    title: chapter.title,
    href: await getM4AUrl(app, visibility, sku, uid, chapterIndex),
  })));
  return readingOrder;
}

function metadataToOPDSMetadata(metadata, visiblId) {
  const opdsMetadata = {
    "@type": "http://schema.org/Audiobook",
  };

  if (metadata.title) opdsMetadata.title = metadata.title;
  if (metadata.author) opdsMetadata.author = metadata.author;
  if (metadata.sku) opdsMetadata.identifier = metadata.sku;
  if (metadata.language) opdsMetadata.language = ISO6391.getCode(metadata.language) || metadata.language;
  if (metadata.published) opdsMetadata.published = metadata.published.split("T")[0];
  if (metadata.description) opdsMetadata.description = metadata.description.replace(/<[^>]*>/g, "");
  if (metadata.length) opdsMetadata.duration = metadata.length;
  if (visiblId) opdsMetadata.visiblId = visiblId;
  return opdsMetadata;
}

async function addSkuToCatalogue(uid, metadata, visibility) {
  logger.info(`Updating catalogue with metadata for item ${metadata.sku}`);
  const catalogueItem = await catalogueGetItemFirestore({sku: metadata.sku});
  if (catalogueItem) {
    logger.info(`Catalogue item already exists for ${metadata.sku}`);
    return;
  }
  // Ensure visibility is either 'public' or 'private'
  if (visibility !== "public" && visibility !== "private") {
    throw new Error("Visibility must be either 'public' or 'private'");
  }
  console.log(metadata);
  const itemToAdd = {
    type: "audiobook",
    title: metadata.title,
    author: metadata.author,
    duration: metadata.duration,
    visibility: visibility,
    addedBy: uid,
    sku: metadata.sku,
    metadata: metadata,
  };
  return await catalogueAddFirestore({body: itemToAdd});
}

async function copyAlbumArt(app, sku) {
  await copyFile(app, `Catalogue/Raw/${sku}.jpg`, `Catalogue/Processed/${sku}/${sku}.jpg`);
}

export {
  generatePublicOPDS,
  generateManifest,
  generateUserItemManifest,
  processRawPublicItem,
  metadataToOPDSReadingOrder,
  metadataToOPDSMetadata,
  addSkuToCatalogue,
  generatePrivateOPDS,
};

/* OPDS Catalogue item template
    # https://test.opds.io/2.0/home.json
    # https://readium.org/webpub-manifest/examples/Flatland/manifest.json
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
      "href": "",
      "type": "image/jpeg",
    },
  ],
  "links": [
    {
      "href": "https://visibl-dev-ali.web.app/v1/tmp/catalogue/",
      "type": "application/audiobook+json",
      "rel": "http://opds-spec.org/acquisition/buy",
    },
  ],
};
*/
/*
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
  merchandising_summary: "<p>In the year 2045, reality is an ugly place. The only time Wade Watts really feels alive is when he's jacked into the OASIS, a vast virtual world where most of humanity spends their days....</p>",
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

/*
      library = library.map((item) => ({
        type: "audiobook",
        title: item.title,
        visibility: "private",
        addedBy: uid,
        sku: item.sku_lite,
        feedTemplate: itemToOPDSFeed(item),
      }));
*/
