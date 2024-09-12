/* eslint-disable require-jsdoc */
/* eslint-disable max-len */
/* eslint-disable no-invalid-this */
// import admin from "firebase-admin";
import "./_env.js";
import console from "../util/_console.js";
import dotenv from "dotenv";
dotenv.config({path: ".env.local"}); // because firebase-functions-test doesn't work with conf.
import chai from "chai";
import chaiHttp from "chai-http";
chai.use(chaiHttp);
const expect = chai.expect;
import {initializeApp} from "firebase-admin/app";
// import {getAuth} from "firebase-admin/auth";
import {getStorage} from "firebase-admin/storage";
// import {getAuth} from "firebase-admin/auth";
import fs from "fs";


import test from "firebase-functions-test";

// Start the Firebase Functions test environment
// eslint-disable-next-line no-unused-vars
const firebaseTest = test({
  databaseURL: "http://localhost:9000",
  storageBucket: "visibl-dev-ali.appspot.com",
  projectId: "visibl-dev-ali",
});
// to get the app
import {
  // eslint-disable-next-line no-unused-vars
  helloWorld,
  // v1catalogueGet,
} from "../index.js";
const APP_ID = process.env.APP_ID;
const app = initializeApp({
  projectId: APP_ID,
  storageBucket: `${APP_ID}.appspot.com`,
}, "2");
// Point to the local Auth and Firestore emulators
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";

const DISPATCH_URL = `http://127.0.0.1:5001`;
const APP_URL = `http://127.0.0.1:5002`;
const DISPATCH_REGION = `europe-west1`;
const SYM_PATH = "./test/bindings/";


const SETUP_ENV = false;
const DEFAULT_TIMEOUT = 99999999999999;

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
describe("AAX Stream tests", () => {
// 1 create 15 scenes.
  if (SETUP_ENV) {
  // eslint-disable-next-line no-undef
    it("Setup environment", async function() {
      this.timeout(DEFAULT_TIMEOUT);
      await uploadFiles([
        {from: `bin/ffmpeg`, to: `bin/ffmpeg`},
        {from: `m4b/${process.env.PUBLIC_SKU1}.json`, to: `Catalogue/Raw/${process.env.PUBLIC_SKU1}.json`},
        {from: `m4b/${process.env.PUBLIC_SKU1}.jpg`, to: `Catalogue/Raw/${process.env.PUBLIC_SKU1}.jpg`},
        {from: `m4b/${process.env.PUBLIC_SKU1}.m4b`, to: `Catalogue/Raw/${process.env.PUBLIC_SKU1}.m4b`},
      ]);
      let response = await chai
          .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
          .post("/processM4B")
          .set("Content-Type", "application/json")
          .send({
            data:
          {sku: process.env.PUBLIC_SKU1},
          });
      expect(response).to.have.status(204);
      // upload scenes for the new catalogue item.
      await uploadFiles([{
        from: `graph/${process.env.PUBLIC_SKU1}-scenes-graph.json`,
        to: `Catalogue/Processed/${process.env.PUBLIC_SKU1}/${process.env.PUBLIC_SKU1}-scenes.json`},
      ]);
      response = await chai
          .request(`${APP_URL}`)
          .get("/v1/aax/demoOPDS");
      expect(response).to.have.status(200);
      console.log(response.body);
      response = await chai
          .request(`${APP_URL}`)
          .get("/v1/aax/demoManifest");
      expect(response).to.have.status(200);
      console.log(response.body);
    });
  }
  const queryParams = new URLSearchParams({
    audibleKey: "XXX",
    audibleIv: "XXX",
    inputFile: "/bin/BK_HOWE_007172.aaxc",
    outputFile: "/bin/BK_HOWE_007172-ch1.m4a",
    startTime: "19.751995",
    durationInSeconds: "3196.070998",
  });
  // eslint-disable-next-line no-undef
  it("Request Headers", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    // Make HEAD request to /v1/aax/stream
    const response = await chai
        .request(`${APP_URL}`)
        .head(`/v1/aax/stream?${queryParams.toString()}`)
        .send();

    // Assert the response
    expect(response).to.have.status(200);
    expect(response).to.have.header("Accept-Ranges", "bytes");
    expect(response).to.have.header("Content-Type", "audio/m4a");
    expect(response).to.have.header("Content-Length");
    expect(response).to.have.header("Connection", "close");

    // Log headers for debugging
    console.log("Response headers:", response.headers);
  });
  // eslint-disable-next-line no-undef
  it("Request Headers", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    // Make GET request with range header to /v1/aax/stream
    const response = await chai
        .request(`${APP_URL}`)
        .get(`/v1/aax/stream?${queryParams.toString()}`)
        .set("Range", "bytes=0-10000")
        .send();

    // Assert the response
    expect(response).to.have.status(206); // Partial Content
    expect(response).to.have.header("Content-Type", "audio/m4a");
    expect(response).to.have.header("Content-Range");
    expect(response).to.have.header("Content-Length", "10000"); // 10001 bytes (0-10000 inclusive)
    expect(response).to.have.header("Accept-Ranges", "bytes");

    // Verify content length matches the requested range
    const contentLength = parseInt(response.headers["content-length"]);
    expect(contentLength).to.equal(10000);

    // Log headers and body length for debugging
    console.log("Response headers:", response.headers);
    console.log("Response body length:", response.body.length);
    console.log(`${APP_URL}/v1/aax/stream?${queryParams.toString()}`);
  });
});

