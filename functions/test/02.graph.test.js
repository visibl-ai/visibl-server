

/* eslint-disable max-len */
// import admin from "firebase-admin";
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
const APP_URL = `http://127.0.0.1:5001/`;
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
const GENERATE_AUGMENT_SCENES = true;

const SYM_PATH = "./test/bindings/graph/";
const GRAPH_PATH = fs.realpathSync(SYM_PATH);
console.log(GRAPH_PATH);

// eslint-disable-next-line no-undef
describe("Graph tests", () => {
  // eslint-disable-next-line no-undef
  it(`Upload transcripts`, async () => {
    const fileList = [
      `${process.env.PUBLIC_SKU1}-transcriptions.json`,
      `${process.env.PUBLIC_SKU1}-characters-graph.json`,
      `${process.env.PUBLIC_SKU1}-locations-graph.json`,
      `${process.env.PUBLIC_SKU1}-characterDescriptions-graph.json`,
      `${process.env.PUBLIC_SKU1}-locationDescriptions-graph.json`,
      `${process.env.PUBLIC_SKU1}-characterSummaries-graph.json`,
      `${process.env.PUBLIC_SKU1}-locationSummaries-graph.json`,
      `${process.env.PUBLIC_SKU1}-scenes-graph.json`,
    ];
    const bucket = getStorage(app).bucket();
    const bucketPath = `Catalogue/Processed/${process.env.PUBLIC_SKU1}/`;
    console.log(bucketPath);

    for (const fileName of fileList) {
      console.log(`Uploading file: ${fileName}`);
      const filePath = `${bucketPath}${fileName}`;
      const file = bucket.file(filePath);
      try {
        const stream = fs.createReadStream(`./test/bindings/graph/${fileName}`);

        await new Promise((resolve, reject) => {
          stream.pipe(file.createWriteStream({}))
              .on("error", (error) => {
                console.error(`Upload failed for ${fileName}:`, error);
                reject(error);
              })
              .on("finish", () => {
                console.log(`File ${fileName} uploaded successfully`);
                resolve();
              });
        });
      } catch (error) {
        console.error(`Failed to upload file ${fileName}:`, error);
      }
    }
    // Ensure the directory exists
    if (!fs.existsSync(GRAPH_PATH)) {
      fs.mkdirSync(GRAPH_PATH, {recursive: true});
    }
  });
  if (GENERATE_CHARACTERS) {
  // eslint-disable-next-line no-undef
    it(`test graphCharacters`, async () => {
    // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };

      const response = await chai
          .request(`${APP_URL}${APP_ID}/us-central1`)
          .post("/generateGraphCharacters")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_LOCATIONS) {
    // eslint-disable-next-line no-undef
    it(`test graphLocations`, async () => {
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/us-central1`)
          .post("/generateGraphLocations")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_CHARACTER_DESCRIPTIONS) {
    // eslint-disable-next-line no-undef
    it(`test graphCharacterDescriptions`, async () => {
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/us-central1`)
          .post("/generateGraphCharacterDescriptions")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_CHARACTER_DESCRIPTIONS_OAI) {
    // eslint-disable-next-line no-undef
    it(`test graphCharacterDescriptionsOAI`, async () => {
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/us-central1`)
          .post("/generateGraphCharacterDescriptionsOAI")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_LOCATION_DESCRIPTIONS) {
    // eslint-disable-next-line no-undef
    it(`test graphLocationDescriptions`, async () => {
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/us-central1`)
          .post("/generateGraphLocationDescriptions")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_LOCATION_DESCRIPTIONS_OAI) {
    // eslint-disable-next-line no-undef
    it(`test graphLocationDescriptionsOAI`, async () => {
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/us-central1`)
          .post("/generateGraphLocationDescriptionsOAI")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (SUMMARIZE_DESCRIPTIONS) {
    // eslint-disable-next-line no-undef
    it(`test graphSummarizeDescriptions`, async () => {
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/us-central1`)
          .post("/generateGraphSummarizeDescriptions")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
  if (GENERATE_SCENES) {
    // eslint-disable-next-line no-undef
    it(`test generateGraphScenes`, async () => {
      for (let chapter = 3; chapter < 4; chapter++) {
      // for (let chapter = 0; chapter < 31; chapter++) {
        // Prepare the update data
        const data = {
          uid: "admin",
          sku: process.env.PUBLIC_SKU1,
          visiblity: "public",
          chapter: chapter,
        };
        const response = await chai
            .request(`${APP_URL}${APP_ID}/us-central1`)
            .post("/generateGraphScenes")
            .set("Content-Type", "application/json")
            .send({data: data}); // nest object as this is a dispatch.
        expect(response).to.have.status(204);
      }
    });
  }
  if (GENERATE_SCENES_16K) {
    // eslint-disable-next-line no-undef
    it(`test generateGraphScenes16k`, async () => {
      // Prepare the update data
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
        chapter: 3,
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/us-central1`)
          .post("/generateGraphScenes16k")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }

  if (GENERATE_AUGMENT_SCENES) {
    // eslint-disable-next-line no-undef
    it(`test generateAugmentScenes`, async () => {
      const data = {
        uid: "admin",
        sku: process.env.PUBLIC_SKU1,
        visiblity: "public",
        chapter: 3,
      };
      const response = await chai
          .request(`${APP_URL}${APP_ID}/us-central1`)
          .post("/generateAugmentScenes")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
    });
  }
});
