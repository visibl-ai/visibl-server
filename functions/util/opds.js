/* eslint-disable require-jsdoc */
import ISO6391 from "iso-639-1";
import {getJsonFile} from "../storage/storage.js";
import {generateTranscriptions} from "../transcriptions/transcriptions.js";

const generateOPDS = (catalogueItems, manifestUrl) => {
  const opdsResponse = {
    metadata: {
      title: "Visibl Catalog",
    },

    publications: catalogueItems.map((item) => ({
      metadata: {
        "@type": "http://schema.org/Audiobook",
        "title": item.title,
        "author": {
          name: item.author[0],
          sortAs: item.author[0].split(" ").reverse().join(", "),
        },
        "identifier": item.id,
        "language": item.language,
        "modified": new Date(item.updatedAt._seconds * 1000).toISOString(),
        "published": item.metadata.year,
        "duration": item.duration,
        "description": item.metadata.title, // You might want to add a separate description field to your catalogue items
        "visiblId": item.id,
      },
      images: [
        {
          href: item.cover,
          type: "image/jpeg",
        },
      ],
      links: [
        {
          href: `https://visibl-dev-ali.web.app/v1/tmp/catalogue/${item.id}`,
          type: "application/audiobook+json",
          rel: "http://opds-spec.org/acquisition/buy",
        },
      ],
    })),
  };

  return opdsResponse;
};

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
  const transcriptions = await generateTranscriptions(metadata);
}

function metadataToOPDSReadingOrder(metadata) {
  const readingOrder = metadata.chapters.map((chapter) => ({
    type: "audio/mp4",
    duration: chapter.endTime - chapter.startTime,
    title: chapter.title,
  }));
  return readingOrder;
}

function metadataToOPDSMetadata(metadata) {
  const feed = {
    metadata: {
      "@type": "http://schema.org/Audiobook",
    },
  };

  if (metadata.title) feed.metadata.title = metadata.title;
  if (metadata.author) feed.metadata.author = metadata.author;
  if (metadata.sku) feed.metadata.identifier = metadata.sku;
  if (metadata.language) feed.metadata.language = ISO6391.getCode(metadata.language) || metadata.language;
  if (metadata.published) feed.metadata.published = metadata.published.split("T")[0];
  if (metadata.description) feed.metadata.description = metadata.description.replace(/<[^>]*>/g, "");
  if (metadata.length) feed.metadata.duration = metadata.length;
  feed.metadata.visiblId = "";
  return feed;
}

export {
  generateOPDS,
  processRawPublicItem,
  metadataToOPDSReadingOrder,
  metadataToOPDSMetadata,
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
