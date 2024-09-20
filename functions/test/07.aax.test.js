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
import path from "path";
import {newUser} from "../auth/auth.js";
import {getUser,
} from "../storage/firestore.js";
import {getAuth} from "firebase-admin/auth";
const auth = getAuth();

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
  v1getAAXAvailable,
  v1getAAXLoginURL,
  v1getAAXConnectStatus,
  v1refreshAAXTokens,
  v1getPrivateOPDSFeed,
  v1getPrivateOPDSFeedURL,
  v1addItemToLibrary,
  v1getItemManifest,
  v1disconnectAAX,
  v1aaxConnect,
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

// const SETUP_ENV = false;
const DEFAULT_TIMEOUT = 99999999999999;
const DO_AUDIBLE_LOGIN = false;
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
describe("AAX tests", () => {
  let userData;
  const TEST_USER_EMAIL = `john.${Date.now()}@example.com`;
  // eslint-disable-next-line no-undef
  it("Setup environment", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    let testUser = await auth.createUser({
      email: TEST_USER_EMAIL,
      password: "s3cr3tpassword",
      displayName: "John Doe",
    });
    testUser = testUser.toJSON();
    const event = {
      data: testUser,
    };
    // POPULATE CATALOGUE
    // eslint-disable-next-line no-unused-vars
    const result = await newUser(event);
    userData = await getUser(testUser.uid);


    await uploadFiles([
      {from: `bin/ffmpeg`, to: `bin/ffmpeg`},
      {from: `m4b/${process.env.SKU1}.aaxc`, to: `UserData/${userData.uid}/Uploads/AAXRaw/${process.env.SKU1}.aaxc`},
      {from: `m4b/${process.env.SKU1}.jpg`, to: `UserData/${userData.uid}/Uploads/AAXRaw/${process.env.SKU1}.jpg`},
      {from: `m4b/${process.env.SKU1}.json`, to: `UserData/${userData.uid}/Uploads/AAXRaw/${process.env.SKU1}.json`},
      {from: `transcriptions/${process.env.SKU1}-transcriptions.json`, to: `UserData/${userData.uid}/Uploads/Processed/${process.env.SKU1}-transcriptions.json`},
      {from: `m4b/${process.env.SKU2}.aaxc`, to: `UserData/${userData.uid}/Uploads/AAXRaw/${process.env.SKU2}.aaxc`},
      {from: `m4b/${process.env.SKU2}.jpg`, to: `UserData/${userData.uid}/Uploads/AAXRaw/${process.env.SKU2}.jpg`},
      {from: `m4b/${process.env.SKU2}.json`, to: `UserData/${userData.uid}/Uploads/AAXRaw/${process.env.SKU2}.json`},
      {from: `transcriptions/${process.env.SKU2}-transcriptions.json`, to: `UserData/${userData.uid}/Uploads/Processed/${process.env.SKU2}-transcriptions.json`},
    ]);

    // clear the current queue.
    const response = await chai.request(APP_URL)
        .post("/v1/admin/queue/nuke")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({});
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
  });
  // eslint-disable-next-line no-undef
  it("AAX - checks if audible connect is available for user (default true)", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAAXAvailable);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    expect(result.active).to.be.true;
    expect(result.source).to.equal(process.env.AAX_CONNECT_SOURCE);
  });
  // eslint-disable-next-line no-undef
  it("AAX - ADMIN disables audible connect.", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const data = {
      active: false,
      uid: userData.uid,
    };

    const response = await chai
        .request(APP_URL)
        .post("/v1/admin/aax/setAvailable")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send(data);
    expect(response).to.have.status(200);
    expect(response.body).to.deep.equal(data);
  });
  // eslint-disable-next-line no-undef
  it("AAX - checks if audible connect is available for user (false)", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAAXAvailable);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    expect(result).to.be.an("object");
    expect(result.active).to.be.false;
  });

  // eslint-disable-next-line no-undef
  it("AAX - get login URL when disabled", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAAXLoginURL);
    const data = {
      countryCode: "ca",
    };
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result).to.be.an("object");
    expect(result).to.have.property("error");
    expect(result.error).to.equal("AAX not available");
  });
  // eslint-disable-next-line no-undef
  it("AAX - ADMIN enables audible connect.", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const data = {
      active: true,
      uid: userData.uid,
    };
    const response = await chai
        .request(APP_URL)
        .post("/v1/admin/aax/setAvailable")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send(data);
    expect(response).to.have.status(200);
  });
  // eslint-disable-next-line no-undef
  it("AAX - checks if audible connect is available for user (true)", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAAXAvailable);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    expect(result.active).to.be.true;
  });
  // eslint-disable-next-line no-undef
  it(`should check that AAX is not connected`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAAXConnectStatus);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    expect(result).to.have.property("connected").that.is.a("boolean");
    expect(result.connected).to.be.false;
  });
  let loginUrl;
  let redirectUrl;
  // eslint-disable-next-line no-undef
  it("AAX - get login URL", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAAXLoginURL);
    const data = {
      countryCode: "ca",
    };
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result).to.have.property("loginUrl");
    loginUrl = result.loginUrl;
    expect(result).to.have.property("codeVerifier");
    expect(result).to.have.property("serial");
    expect(result).to.have.property("redirectUrl");
    redirectUrl = result.redirectUrl;
    console.log(`AAX: loginUrl: ${loginUrl}, redirectUrl: ${redirectUrl}`);
  });
  // eslint-disable-next-line no-undef
  it("AAX - check login URL redirection", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    // Extract the redirectId from the loginUrl query string
    const redirectId = loginUrl.split("?redirectId=")[1];

    expect(redirectId).to.be.a("string").and.not.be.empty;
    console.log(`Extracted redirectId: ${redirectId}`);
    expect(loginUrl).to.be.a("string").and.not.be.empty;
    expect(redirectUrl).to.be.a("string").and.not.be.empty;
    const REDIRECT_URL = `${APP_URL}/v1/aax/aaxConnectRedirect/${redirectId}`;
    console.log(`AAX: Checking redirect of URL: ${REDIRECT_URL}`);
    const response = await chai.request(REDIRECT_URL).get("").redirects(0);
    console.log(`AAX: response: ${response.text}`);
    expect(response).to.redirectTo(redirectUrl);
    expect(response).to.have.status(302);
  });
  const audibleAuth = JSON.parse(fs.readFileSync(path.join("test", "bindings", "audibleAuth.json"), "utf8"));
  // eslint-disable-next-line no-undef
  it("AAX - ADMIN Delete any existing AAX auth", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const data = {
      aaxId: audibleAuth.customer_info.user_id,
      uid: userData.uid,
    };
    const response = await chai
        .request(APP_URL)
        .post("/v1/admin/aax/deleteAuth")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send(data);
    expect(response).to.have.status(200);
  });
  if (DO_AUDIBLE_LOGIN) {
    // eslint-disable-next-line no-undef
    it("AAX - submit login URL", async function() {
      this.timeout(DEFAULT_TIMEOUT);
      // Load the audibleUrl.json file
      const audibleUrlPath = path.join("test", "bindings", "audibleUrl.json");
      const audibleUrlData = JSON.parse(fs.readFileSync(audibleUrlPath, "utf8"));
      // You can now use audibleUrlData in your test
      expect(audibleUrlData).to.have.property("codeVerifier");
      expect(audibleUrlData).to.have.property("serial");
      expect(audibleUrlData).to.have.property("responseUrl");
      expect(audibleUrlData).to.have.property("countryCode");

      const wrapped = firebaseTest.wrap(v1aaxConnect);
      const data = {
        codeVerifier: audibleUrlData.codeVerifier,
        responseUrl: audibleUrlData.responseUrl,
        serial: audibleUrlData.serial,
        countryCode: audibleUrlData.countryCode,
      };
      const result = await wrapped({
        auth: {
          uid: userData.uid,
        },
        data,
      });
      console.log(result);
      expect(result).to.have.property("access_token");
      expect(result).to.have.property("refresh_token");
      // Write result to audibleAuth.json file
      const audibleAuthPath = path.join("test", "bindings", "audibleAuth.json");
      fs.writeFileSync(audibleAuthPath, JSON.stringify(result, null, 2));
      console.log(`AAX auth data written to ${audibleAuthPath}`);
      await new Promise((resolve) => setTimeout(resolve, 90000));
      console.log("Waited for 30 seconds after setting auth for the user");
    });
  } else {
    // eslint-disable-next-line no-undef
    it("AAX - Post auth hook for AAX auth.", async function() {
      this.timeout(DEFAULT_TIMEOUT);
      const data = {
        uid: userData.uid,
        auth: audibleAuth,
      };
      const response = await chai
          .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
          .post("/aaxPostAuthHook")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
      // Wait for 30 seconds before exiting the function
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("Waited for 2 seconds after setting auth for the user");
    });
  }
  // eslint-disable-next-line no-undef
  it("AAX - Transcribe dispatch.", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const data = {};
    const response = await chai
        .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
        .post("/aaxDispatchTranscriptions")
        .set("Content-Type", "application/json")
        .send({data: data}); // nest object as this is a dispatch.
    expect(response).to.have.status(204);
    // Wait for 30 seconds before exiting the function
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Waited for 2 seconds after setting auth for the user");
  });
  // eslint-disable-next-line no-undef
  it(`should check if audible is connected`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAAXConnectStatus);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result).to.have.property("connected").that.is.a("boolean");
    expect(result).to.have.property("source").that.is.a("string");
    expect(result).to.have.property("accountOwner").that.is.a("string");
    expect(result.connected).to.be.true;
    expect(result.source).to.equal(process.env.AAX_CONNECT_SOURCE);
  });

  // eslint-disable-next-line no-undef
  it("AAX - submit refresh token", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1refreshAAXTokens);
    const data = {
      from: 0,
      to: 999999999999999,
    };
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result).to.be.an("object");
    expect(result).to.have.property("totalProcessed").that.is.a("number");
    expect(result).to.have.property("successful").that.is.a("number");
    expect(result).to.have.property("warnings").that.is.a("number");
    expect(result).to.have.property("errors").that.is.a("number");
    expect(result).to.have.property("details").that.is.an("array");

    // Check if the numbers add up correctly
    expect(result.totalProcessed).to.equal(result.successful + result.warnings + result.errors);

    // Check each detail object
    result.details.forEach((detail) => {
      expect(detail).to.have.property("uid").that.is.a("string");
      expect(detail).to.have.property("status").that.is.oneOf(["success", "warning", "error"]);
      expect(detail).to.have.property("message").that.is.a("string");
    });
  });
  // Get an OPDS feed for the users private items
  // eslint-disable-next-line no-undef
  it("AAX - get private OPDS feeds", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getPrivateOPDSFeed);
    const data = {};

    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result).to.have.property("metadata");
    expect(result.metadata).to.have.property("title", `${process.env.AAX_CONNECT_SOURCE} Import`);
    expect(result).to.have.property("publications");
    console.log(result.publications);
    console.log(result.publications[0].links);
    expect(result.publications).to.be.an("array").that.is.not.empty;
  });
  // Get a manifest with unique stream URLs.
  let privateOPDSUrl;
  // eslint-disable-next-line no-undef
  it("AAX - get private OPDS URL", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getPrivateOPDSFeedURL);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result).to.have.property("url");
    expect(result.url).to.be.a("string");
    privateOPDSUrl = result.url;
  });
  let privateFeed;
  // eslint-disable-next-line no-undef
  it("AAX - get private OPDS feed via URL", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai
        .request(privateOPDSUrl)
        .get("");
    expect(response).to.have.status(200);
    expect(response).to.be.json;
    expect(response.body).to.have.property("metadata");
    expect(response.body.metadata).to.have.property("title", `${process.env.AAX_CONNECT_SOURCE} Import`);
    privateFeed = response.body;
    console.log(privateFeed);
  });
  let streamUrl;
  // eslint-disable-next-line no-undef
  it("AAX - get private OPDS manifest via URL", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai
        .request(privateFeed.publications[0].links[0].href)
        .get("");
    expect(response).to.have.status(200);
    expect(response).to.be.json;
    expect(response.body).to.have.property("metadata");
    console.log(response.body.readingOrder);
    streamUrl = response.body.readingOrder[1].href;
    console.log(`streamUrl: ${streamUrl}`);
  });

  // Test the stream URL HEAD and Range requests.
  const STREAM_TEST = true;
  if (STREAM_TEST) {
    // eslint-disable-next-line no-undef
    it("Request Headers", async function() {
      this.timeout(DEFAULT_TIMEOUT);
      // Make HEAD request to /v1/aax/stream
      const response = await chai
          .request(streamUrl)
          .head("")
          .send("");

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
    it("Request Range", async function() {
      this.timeout(DEFAULT_TIMEOUT);
      // Make GET request with range header to /v1/aax/stream
      const response = await chai
          .request(streamUrl)
          .get("")
          .set("Range", "bytes=0-10000")
          .send("");

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
      console.log(`${streamUrl}`);
    });
  }
  let libraryPrivateItem;
  // eslint-disable-next-line no-undef
  it(`test v1addItemToLibrary - private, before scenes exist`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1addItemToLibrary);
    console.log(privateFeed.publications);
    const privateItemId = privateFeed.publications[0].metadata.visiblId;
    // Prepare the data for adding an item to the library
    const addData = {
      catalogueId: privateItemId,
    };

    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: addData,
    });

    console.log(result);
    expect(result).to.have.property("id");
    expect(result).to.have.property("uid");
    expect(result).to.have.property("catalogueId");
    expect(result).to.have.property("addedAt");

    expect(result.uid).to.equal(userData.uid);
    expect(result.catalogueId).to.equal(privateItemId);
    expect(result.addedAt).to.exist;

    libraryPrivateItem = result;
    console.log(`Testing adding duplicate of ${result.id}`);
    // Try to add the same item again, it should return the existing item
    const duplicateResult = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: addData,
    });

    console.log("Duplicate add result:", duplicateResult);
    expect(duplicateResult).to.deep.equal(result);
    expect(duplicateResult.id).to.equal(libraryPrivateItem.id);
    expect(duplicateResult.uid).to.equal(userData.uid);
    expect(duplicateResult.catalogueId).to.equal(privateItemId);
    expect(duplicateResult.addedAt).to.exist;
  });

  // eslint-disable-next-line no-undef
  it(`test v1getItemManifest - private`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getItemManifest);

    // Prepare the data for getting the item manifest
    const getManifestData = {
      libraryId: libraryPrivateItem.id,
    };

    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: getManifestData,
    });

    console.log(result);
    expect(result).to.exist;

    // Try to get manifest for a non-existent item, it should throw an error
    try {
      await wrapped({
        auth: {
          uid: userData.uid,
        },
        data: {libraryId: "non-existent-id"},
      });
      // If we reach here, the test should fail
      expect.fail("Should have thrown an error for non-existent item");
    } catch (error) {
      expect(error.message).to.include("Item not found in the user's library");
    }
  });

  // eslint-disable-next-line no-undef
  it(`should disconnect from AAX`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1disconnectAAX);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result).to.have.property("deletedCount").that.is.a("number");
    expect(result.deletedCount).to.equal(1);
  });
  // eslint-disable-next-line no-undef
  it(`should check that AAX is not connected`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAAXConnectStatus);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    expect(result).to.have.property("connected").that.is.a("boolean");
    expect(result.connected).to.be.false;
  });
});

