

/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
// import admin from "firebase-admin";
import "./_env.js";
import console from "../util/_console.js";
import dotenv from "dotenv";
import chai from "chai";
import chaiHttp from "chai-http";
chai.use(chaiHttp);
const expect = chai.expect;
import {initializeApp} from "firebase-admin/app";
// import {getAuth} from "firebase-admin/auth";
import {getStorage} from "firebase-admin/storage";
import fs from "fs";


import test from "firebase-functions-test";
dotenv.config({path: ".env.local"}); // because firebase-functions-test doesn't work with conf.
const APP_ID = process.env.APP_ID;
const DISPATCH_REGION = `europe-west1`;
const APP_URL = `http://127.0.0.1:5001/`;
const HOSTING_URL = `http://127.0.0.1:5002`;
// Start the Firebase Functions test environment
// eslint-disable-next-line no-unused-vars
const firebaseTest = test({
  databaseURL: "http://localhost:8080",
  storageBucket: `${APP_ID}.appspot.com`,
  projectId: APP_ID,
});
// to get the app
import {
  // eslint-disable-next-line no-unused-vars
  helloWorld,
} from "../index.js";

const app = initializeApp({
  projectId: APP_ID,
  storageBucket: `${APP_ID}.appspot.com`,
}, "2");
// Point to the local Auth and Firestore emulators
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";


const GENERATE_CHARACTERS = false;
const GENERATE_LOCATIONS = false;
// const CHARACTERS_TIMELINE = false;
// const LOCATIONS_TIMELINE = false;
const GENERATE_CHARACTER_DESCRIPTIONS = false;
const GENERATE_LOCATION_DESCRIPTIONS = false;
const GENERATE_CHARACTER_DESCRIPTIONS_OAI = false;
const GENERATE_LOCATION_DESCRIPTIONS_OAI = false;
const SUMMARIZE_DESCRIPTIONS = false;
const GENERATE_SCENES = false;
const GENERATE_SCENES_16K = false;
const GENERATE_AUGMENT_SCENES = false;
const GENERATE_AUGMENT_SCENES_OAI = false;

const SYM_PATH = "./test/bindings/";
const GRAPH_PATH = fs.realpathSync(SYM_PATH);
console.log(GRAPH_PATH);
const DEFAULT_TIMEOUT = 9999999999999;

const NUM_CHAPTERS = 2;

async function uploadFiles(fileList) {
  const bucket = getStorage(app).bucket();
  for (const thisFile of fileList) {
    // console.log(`Uploading file: ${thisFile.from}`);
    const filePath = thisFile.to;
    const file = bucket.file(filePath);
    try {
      const stream = fs.createReadStream(`${SYM_PATH}${thisFile.from}`);
      await new Promise((resolve, reject) => {
        stream.pipe(file.createWriteStream({}))
            .on("error", (error) => {
              console.error(`Upload failed for ${thisFile.from}:`, error);
              reject(error);
            })
            .on("finish", () => {
              // console.log(`File ${thisFile.from} uploaded successfully`);
              resolve();
            });
      });
    } catch (error) {
      console.error(`Failed to upload file ${thisFile.from}:`, error);
    }
  }
}

// eslint-disable-next-line no-undef
describe("Graph tests", () => {
  // 1. create a user and a graph.

  // 2. initiate the queue.
  let graphItem;
  // eslint-disable-next-line no-undef
  it(`test generateNewGraph`, async function() {
    // clear the current queue.
    let response = await chai.request(HOSTING_URL)
        .post("/v1/admin/queue/nuke")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({});
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const data = {
      uid: "admin",
      catalogueId: "1",
      sku: process.env.PUBLIC_SKU1,
      visibility: "public",
      numChapters: NUM_CHAPTERS,
    };
    response = await chai
        .request(HOSTING_URL)
        .post("/v1/graph/generate")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send(data);
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("id");
    graphItem = response.body;
    console.log("graphItem", graphItem);
  });

  // eslint-disable-next-line no-undef
  it(`Upload bindings.`, async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    await uploadFiles([
      {from: `graph/${process.env.PUBLIC_SKU1}-transcriptions.json`, to: `Catalogue/Processed/${process.env.PUBLIC_SKU1}/${process.env.PUBLIC_SKU1}-transcriptions.json`},
      {from: `graph/${process.env.PUBLIC_SKU1}-characters-graph.json`, to: `Graphs/${graphItem.id}/${process.env.PUBLIC_SKU1}-characters-graph.json`},
      {from: `graph/${process.env.PUBLIC_SKU1}-locations-graph.json`, to: `Graphs/${graphItem.id}/${process.env.PUBLIC_SKU1}-locations-graph.json`},
      {from: `graph/${process.env.PUBLIC_SKU1}-characterDescriptions-graph.json`, to: `Graphs/${graphItem.id}/${process.env.PUBLIC_SKU1}-characterDescriptions-graph.json`},
      {from: `graph/${process.env.PUBLIC_SKU1}-locationDescriptions-graph.json`, to: `Graphs/${graphItem.id}/${process.env.PUBLIC_SKU1}-locationDescriptions-graph.json`},
      {from: `graph/${process.env.PUBLIC_SKU1}-characterSummaries-graph.json`, to: `Graphs/${graphItem.id}/${process.env.PUBLIC_SKU1}-characterSummaries-graph.json`},
      {from: `graph/${process.env.PUBLIC_SKU1}-locationSummaries-graph.json`, to: `Graphs/${graphItem.id}/${process.env.PUBLIC_SKU1}-locationSummaries-graph.json`},
      {from: `graph/${process.env.PUBLIC_SKU1}-scenes-graph.json`, to: `Graphs/${graphItem.id}/${process.env.PUBLIC_SKU1}-scenes-graph.json`},
    ]);
    // Ensure the directory exists
    if (!fs.existsSync(GRAPH_PATH)) {
      fs.mkdirSync(GRAPH_PATH, {recursive: true});
    }
  });

  // eslint-disable-next-line no-undef
  it(`Dispatch graph pipeline: Characters`, async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai
        .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
        .post("/graphPipeline")
        .set("Content-Type", "application/json")
        .send({data: {}}); // nest object as this is a dispatch.
    expect(response).to.have.status(204);
  });

  // eslint-disable-next-line no-undef
  it(`Dispatch graph pipeline: Locations`, async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai
        .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
        .post("/graphPipeline")
        .set("Content-Type", "application/json")
        .send({data: {}}); // nest object as this is a dispatch.
    expect(response).to.have.status(204);
  });

  // eslint-disable-next-line no-undef
  it(`Dispatch graph pipeline: Character Descriptions`, async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai
        .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
        .post("/graphPipeline")
        .set("Content-Type", "application/json")
        .send({data: {}}); // nest object as this is a dispatch.
    expect(response).to.have.status(204);
  });
  // eslint-disable-next-line no-undef
  it(`Dispatch graph pipeline: Location Descriptions`, async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai
        .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
        .post("/graphPipeline")
        .set("Content-Type", "application/json")
        .send({data: {}}); // nest object as this is a dispatch.
    expect(response).to.have.status(204);
  });
  // eslint-disable-next-line no-undef
  it(`Dispatch graph pipeline: Summarize Descriptions`, async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai
        .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
        .post("/graphPipeline")
        .set("Content-Type", "application/json")
        .send({data: {}}); // nest object as this is a dispatch.
    expect(response).to.have.status(204);
  });
  // eslint-disable-next-line no-undef
  it(`Dispatch graph pipeline: generateScenes`, async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    for (let i = 0; i < NUM_CHAPTERS; i++) {
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/graphPipeline")
          .set("Content-Type", "application/json")
          .send({data: {}}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    }
  });
  // eslint-disable-next-line no-undef
  it(`Dispatch graph pipeline: augmentScenes`, async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    for (let i = 0; i < NUM_CHAPTERS; i++) {
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/graphPipeline")
          .set("Content-Type", "application/json")
          .send({data: {}}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    }
  });

  if (GENERATE_CHARACTERS) {
  // eslint-disable-next-line no-undef
    it(`test graphCharacters`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };

      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/generateGraphCharacters")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_LOCATIONS) {
    // eslint-disable-next-line no-undef
    it(`test graphLocations`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/generateGraphLocations")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_CHARACTER_DESCRIPTIONS) {
    // eslint-disable-next-line no-undef
    it(`test graphCharacterDescriptions`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/generateGraphCharacterDescriptions")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_CHARACTER_DESCRIPTIONS_OAI) {
    // eslint-disable-next-line no-undef
    it(`test graphCharacterDescriptionsOAI`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/generateGraphCharacterDescriptionsOAI")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_LOCATION_DESCRIPTIONS) {
    // eslint-disable-next-line no-undef
    it(`test graphLocationDescriptions`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/generateGraphLocationDescriptions")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_LOCATION_DESCRIPTIONS_OAI) {
    // eslint-disable-next-line no-undef
    it(`test graphLocationDescriptionsOAI`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/generateGraphLocationDescriptionsOAI")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (SUMMARIZE_DESCRIPTIONS) {
    // eslint-disable-next-line no-undef
    it(`test graphSummarizeDescriptions`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/generateGraphSummarizeDescriptions")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_SCENES) {
    // eslint-disable-next-line no-undef
    it(`test generateGraphScenes`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      for (let chapter = 5; chapter < 31; chapter++) {
      // for (let chapter = 0; chapter < 31; chapter++) {
        // Prepare the update data
        const data = {
          uid: "admin",
          sku: process.env.PUBLIC_SKU1,
          visiblity: "public",
          chapter: chapter,
        };
        const response = await chai
            .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
            .post("/generateGraphScenes")
            .set("Content-Type", "application/json")
            .send({data: data}); // nest object as this is a dispatch.
        expect(response).to.have.status(204);
      }
    });
  }
  if (GENERATE_SCENES_16K) {
    // eslint-disable-next-line no-undef
    it(`test generateGraphScenes16k`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
        chapter: 3,
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/generateGraphScenes16k")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }

  if (GENERATE_AUGMENT_SCENES) {
    // eslint-disable-next-line no-undef
    it(`test generateAugmentScenes`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
        chapter: 3,
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/generateAugmentScenes")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_AUGMENT_SCENES_OAI) {
    // eslint-disable-next-line no-undef
    it(`test generateAugmentScenesOAI`, async function() {
      // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
        chapter: 4,
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/${DISPATCH_REGION}`)
          .post("/generateAugmentScenesOAI")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
});
