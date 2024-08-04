
/* eslint-disable no-unused-vars */

/* eslint-disable max-len */
import admin from "firebase-admin";
import logger from "firebase-functions/logger";
import dotenv from "dotenv";
// import * as chai from "chai";
// // import {expect} from "chai";
// import chaiHttp from "chai-http";
// import {request} from "chai-http";
// chai.use(chaiHttp);
// const expect = chai.expect;

import chai from "chai";
import chaiHttp from "chai-http";

chai.use(chaiHttp);
const expect = chai.expect;


import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {newUser} from "../auth/auth.js";
import {getUser,
} from "../storage/firestore.js";
import {getStorage} from "firebase-admin/storage";
import fs from "fs";
import path from "path";

import test from "firebase-functions-test";
dotenv.config({path: ".env.local"}); // because firebase-functions-test doesn't work with conf.
// Start the Firebase Functions test environment
const firebaseTest = test({
  databaseURL: "http://localhost:8080",
  storageBucket: "visibl-dev-ali.appspot.com",
  projectId: "visibl-dev-ali",
});
import {
  helloWorld,
  getCurrentUser,
  v1addItemToLibrary,
  v1getLibrary,
  v1deleteItemsFromLibrary,
  v1getItemManifest,
  v1catalogueGet,
  v1getAi,
  v1getLibraryItemScenes,
  v1addLibraryItemScenes,
  v1updateLibraryItemScenes,
  v1getAudibleLoginURL,
  v1aaxGetAuth,
  v1TMPaudiblePostAuthHook,
  v1refreshAudibleTokens,
  v1generateTranscriptions,
  v1getPrivateOPDSFeed,
  v1getAAXAvailable,
} from "../index.js";


// Initialize Firebase Admin with local emulator settings
const APP_ID = process.env.APP_ID || "visibl-dev-ali";
const APP_REGION = process.env.APP_REGION || "europe-west1";
const app = initializeApp({
  projectId: APP_ID,
  storageBucket: `${APP_ID}.appspot.com`,
}, "2");

// Point to the local Auth and Firestore emulators
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const APP_URL = `http://127.0.0.1:5002`;
const auth = getAuth();
// const db = getFirestore();

const TEST_USER_EMAIL = `john.${Date.now()}@example.com`;

// eslint-disable-next-line no-undef
describe("Customer creation via Firebase Auth", () => {
  let userData;
  // eslint-disable-next-line no-undef
  it("creates a new user and checks Firestore for the user data", async () => {
    // Create a new user in Firebase Authentication
    logger.debug(`Creating new user.`);


    let testUser = await auth.createUser({
      email: TEST_USER_EMAIL,
      password: "s3cr3tpassword",
      displayName: "John Doe",
    });
    testUser = testUser.toJSON();
    const event = {
      data: testUser,
    };
    const result = await newUser(app, event);
    // Assume a Firestore trigger or function in index.js populates Firestore based on Auth user creation
    // Wait for Firestore to be updated (this might require a delay or a more complex event-driven approach in a real scenario)

    // Fetch the newly created user data from Firestore to verify it's there
    userData = await getUser(testUser.uid);
    expect(userData).to.not.be.null;
    expect(userData.bucketPath).to.not.be.null;
  });
  // eslint-disable-next-line no-undef
  it(`test an unauthenticated function`, async () => {
    const wrapped = firebaseTest.wrap(helloWorld);
    const data = {};
    const result = await wrapped(data);
    console.log(result);
    expect(result.error).to.exist;
  });
  // eslint-disable-next-line no-undef
  it(`test an authenticated function`, async () => {
    const wrapped = firebaseTest.wrap(helloWorld);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    expect(result.uid).to.equal(userData.uid);
  });
  // eslint-disable-next-line no-undef
  it(`test getting current user`, async () => {
    const wrapped = firebaseTest.wrap(getCurrentUser);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result.uid).to.equal(userData.uid);
  });
  // eslint-disable-next-line no-undef
  it(`upload ffmpeg binary to test bucket`, async () => {
    const bucket = getStorage(app).bucket();
    const bucketPath = `bin/`;
    console.log(bucketPath);
    const bucketFilename = `ffmpeg`;
    console.log(`Bucket filename: ${bucketFilename}`);
    const filePath = `${bucketPath}${bucketFilename}`;
    const file = bucket.file(filePath);
    try {
      const stream = fs.createReadStream(`./test/bindings/bin/ffmpeg`);

      await new Promise((resolve, reject) => {
        stream.pipe(file.createWriteStream({}))
            .on("error", (error) => {
              console.error("Upload failed:", error);
              reject(error);
            })
            .on("finish", () => {
              console.log("File uploaded successfully");
              resolve();
            });
      });
    } catch (error) {
      console.error("Failed to upload file:", error);
    }
  });
  // eslint-disable-next-line no-undef
  it(`uploads a audio for public item`, async () => {
    const fileList = [
      `${process.env.PUBLIC_SKU1}.jpg`,
      `${process.env.PUBLIC_SKU1}.json`,
      `${process.env.PUBLIC_SKU1}.m4b`,
    ];
    const bucket = getStorage(app).bucket();
    const bucketPath = `Catalogue/Raw/`;
    console.log(bucketPath);

    for (const fileName of fileList) {
      console.log(`Uploading file: ${fileName}`);
      const filePath = `${bucketPath}${fileName}`;
      const file = bucket.file(filePath);
      try {
        const stream = fs.createReadStream(`./test/bindings/m4b/${fileName}`);

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
  });
  // eslint-disable-next-line no-undef
  it(`test processM4B taskQueue`, async () => {
    const response = await chai
        .request(`http://127.0.0.1:5001/visibl-dev-ali/us-central1`)
        .post("/processM4B")
        .set("Content-Type", "application/json")
        .send({
          data:
          {sku: process.env.PUBLIC_SKU1},
        });
    expect(response).to.have.status(204);
  });

  const REQUEST_TASKQUEUES = false;
  if (REQUEST_TASKQUEUES) {
  // eslint-disable-next-line no-undef
    it(`test v1catalogueProcessRaw`, async () => {
      const response = await chai
          .request(APP_URL)
          .post("/v1/admin/catalogue/process")
          .set("API-KEY", process.env.ADMIN_API_KEY)
          .send({sku: process.env.PUBLIC_SKU1});
      expect(response).to.have.status(204);
    });
  }

  let catalogueBook;

  // eslint-disable-next-line no-undef
  it(`test v1catalogueGet`, async () => {
    const wrapped = firebaseTest.wrap(v1catalogueGet);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });

    console.log(result);
    expect(result).to.be.an("array");
    expect(result.length).to.be.at.least(1);
    catalogueBook = result[0];
  });

  // eslint-disable-next-line no-undef
  it(`test v1catalogueUpdate`, async () => {
    // Prepare the update data
    const updateData = {
      id: catalogueBook.id,
      genres: ["Science Fiction"],
    };

    const response = await chai
        .request(APP_URL)
        .post("/v1/admin/catalogue/update")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send(updateData);

    expect(response).to.have.status(200);
    const result = response.body;

    console.log(result);
    expect(result).to.have.property("id");
    expect(result.id).to.equal(catalogueBook.id);
    expect(result.genres).to.deep.equal(["Science Fiction"]);
    expect(result.title).to.equal(catalogueBook.title);
    expect(result.author).to.deep.equal(catalogueBook.author);
    expect(result.duration).to.equal(catalogueBook.duration);
    expect(result.updatedAt).to.exist;
    expect(result.updatedAt).to.not.equal(catalogueBook.updatedAt);

    // Update the catalogueBook reference for future tests
    catalogueBook = result;

    // Verify the update with v1catalogueGet
    const getWrapped = firebaseTest.wrap(v1catalogueGet);
    const getResult = await getWrapped({
      auth: {
        uid: userData.uid,
      },
      data: {},
    });

    const updatedBook = getResult.find((book) => book.id === catalogueBook.id);
    expect(updatedBook).to.exist;
    expect(updatedBook).to.deep.equal(catalogueBook);
  });

  let foundBook;
  // eslint-disable-next-line no-undef
  it(`test v1catalogueGetOPDS (public)`, async () => {
    const response = await chai
        .request(APP_URL)
        .get("/v1/public/catalogue/opds");

    expect(response).to.have.status(200);
    expect(response).to.be.json;

    const result = response.body;
    console.log(result);
    console.log(result.publications);
    // Check for basic OPDS structure in JSON format
    expect(result).to.have.property("metadata");
    expect(result.metadata).to.have.property("title", "Visibl Catalog");
    expect(result).to.have.property("publications");
    expect(result.publications).to.be.an("array").that.is.not.empty;

    // Check for specific book entry
    foundBook = result.publications.find((publication) => publication.metadata.title === catalogueBook.title);
    expect(foundBook).to.exist;
    expect(foundBook.metadata.visiblId).to.equal(catalogueBook.id);
    console.log(foundBook);
  });
  // eslint-disable-next-line no-undef
  it("Audible - checks if audible connect is available for user (default true)", async () => {
    const wrapped = firebaseTest.wrap(v1getAAXAvailable);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    expect(result).to.be.true;
  });
  // eslint-disable-next-line no-undef
  it("Audible - ADMIN disables audible connect.", async () => {
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
  it("Audible - checks if audible connect is available for user (false)", async () => {
    const wrapped = firebaseTest.wrap(v1getAAXAvailable);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    expect(result).to.be.false;
  });

  // eslint-disable-next-line no-undef
  it("Audible - get login URL when disabled", async () => {
    const wrapped = firebaseTest.wrap(v1getAudibleLoginURL);
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
  });
  // eslint-disable-next-line no-undef
  it("Audible - ADMIN enables audible connect.", async () => {
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
  it("Audible - checks if audible connect is available for user (true)", async () => {
    const wrapped = firebaseTest.wrap(v1getAAXAvailable);
    const data = {};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    expect(result).to.be.true;
  });
  // eslint-disable-next-line no-undef
  it("Audible - get login URL", async () => {
    const wrapped = firebaseTest.wrap(v1getAudibleLoginURL);
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
    expect(result).to.have.property("codeVerifier");
    expect(result).to.have.property("serial");
  });
  const DO_AUDIBLE_LOGIN = false;
  if (DO_AUDIBLE_LOGIN) {
    // eslint-disable-next-line no-undef
    it("Audible - submit login URL", async () => {
    // Load the audibleUrl.json file
      const audibleUrlPath = path.join("test", "bindings", "audibleUrl.json");
      const audibleUrlData = JSON.parse(fs.readFileSync(audibleUrlPath, "utf8"));
      // You can now use audibleUrlData in your test
      expect(audibleUrlData).to.have.property("codeVerifier");
      expect(audibleUrlData).to.have.property("serial");
      expect(audibleUrlData).to.have.property("responseUrl");
      expect(audibleUrlData).to.have.property("countryCode");

      const wrapped = firebaseTest.wrap(v1aaxGetAuth);
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
      console.log(`Audible auth data written to ${audibleAuthPath}`);
      await new Promise((resolve) => setTimeout(resolve, 30000));
      console.log("Waited for 30 seconds after setting auth for the user");
    });
  } else {
  // eslint-disable-next-line no-undef
    it("Audible - Post auth hook for AAX auth.", async () => {
      const auth = JSON.parse(fs.readFileSync(path.join("test", "bindings", "audibleAuth.json"), "utf8"));
      const data = {
        uid: userData.uid,
        auth: auth,
      };
      const response = await chai
          .request(`http://127.0.0.1:5001/visibl-dev-ali/us-central1`)
          .post("/aaxPostAuthHook")
          .set("Content-Type", "application/json")
          .send({data: data}); // nest object as this is a dispatch.
      expect(response).to.have.status(204);
      // Wait for 30 seconds before exiting the function
      await new Promise((resolve) => setTimeout(resolve, 30000));
      console.log("Waited for 30 seconds after setting auth for the user");
    });
  }
  return;
  // eslint-disable-next-line no-undef
  it(`Uploads audible files to UserData`, async () => {
    const fileList = [
      `${process.env.SKU1}.aaxc`,
      `${process.env.SKU1}.jpg`,
      `${process.env.SKU1}.json`,
      `${process.env.SKU1}.m4b`,
      `${process.env.SKU2}.aaxc`,
      `${process.env.SKU2}.jpg`,
      `${process.env.SKU2}.json`,
      `${process.env.SKU2}.m4b`,
    ];

    const bucket = getStorage(app).bucket();
    const bucketPath = `UserData/${userData.uid}/Uploads/AudibleRaw/`;
    console.log(bucketPath);

    for (const fileName of fileList) {
      console.log(`Uploading file: ${fileName}`);
      const filePath = `${bucketPath}${fileName}`;
      const file = bucket.file(filePath);
      try {
        const stream = fs.createReadStream(`./test/bindings/m4b/${fileName}`);

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
  });
  // eslint-disable-next-line no-undef
  it("Audible - post auth automation.", async () => {
    const audibleAuthPath = path.join("test", "bindings", "audibleAuth.json");
    const auth = JSON.parse(fs.readFileSync(audibleAuthPath, "utf8"));
    const wrapped = firebaseTest.wrap(v1TMPaudiblePostAuthHook);
    const data = {auth};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
  });

  // eslint-disable-next-line no-undef
  it("Audible - submit refresh token", async () => {
    const wrapped = firebaseTest.wrap(v1refreshAudibleTokens);
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


  const GENERATE_TRANSCRIPTIONS = false;
  if (GENERATE_TRANSCRIPTIONS) {
    // eslint-disable-next-line no-undef
    it(`generates transcriptions for the two books`, async () => {
      const wrapped = firebaseTest.wrap(v1generateTranscriptions);
      const result = await wrapped({
        auth: {
          uid: userData.uid,
        },
        data: {
          sku: process.env.SKU1,
        },
      });
      console.log(result);
    });
  }

  // Get an OPDS feed for the users private items
  // eslint-disable-next-line no-undef
  it("TEST1 Audible - get private OPDS feeds", async () => {
    const wrapped = firebaseTest.wrap(v1getPrivateOPDSFeed);
    const data = {auth};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
  });
  return;
  // Add an amazon item to the users library

  // Get an auto-generated manifest for the added item


  // eslint-disable-next-line no-undef
  it(`uploads a scenes file to catalogue item`, async () => {
    const bucket = getStorage(app).bucket();
    const bucketPath = `Catalogue/${catalogueBook.id}/`;
    console.log(bucketPath);
    const bucketFilename = `scenes.json`;
    console.log(`Bucket filename: ${bucketFilename}`);
    const filePath = `${bucketPath}${bucketFilename}`;
    const file = bucket.file(filePath);
    try {
      const stream = fs.createReadStream(`./test/bindings/scenes/transcript_ch1_scenes_images.json`);

      await new Promise((resolve, reject) => {
        stream.pipe(file.createWriteStream({}))
            .on("error", (error) => {
              console.error("Upload failed:", error);
              reject(error);
            })
            .on("finish", () => {
              console.log("File uploaded successfully");
              resolve();
            });
      });
    } catch (error) {
      console.error("Failed to upload file:", error);
    }
  });

  // eslint-disable-next-line no-undef
  it(`test v1catalogueGetManifest`, async () => {
    const visiblId = foundBook.metadata.visiblId;
    const response = await chai
        .request(APP_URL)
        .get(`/v1/tmp/catalogue/${visiblId}`);

    const result = response.body;
    // console.log(result);
    expect(response).to.have.status(200);
    expect(response).to.be.json;


    // Check for basic manifest structure
    expect(result).to.have.property("@context");
    expect(result).to.have.property("metadata");
    expect(result.metadata).to.have.property("title", catalogueBook.title);
    expect(result.metadata).to.have.property("visiblId", catalogueBook.id);
  });

  let libraryItem;
  // eslint-disable-next-line no-undef
  it(`test v1addItemToLibrary`, async () => {
    const wrapped = firebaseTest.wrap(v1addItemToLibrary);

    // Prepare the data for adding an item to the library
    const addData = {
      catalogueId: catalogueBook.id,
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
    expect(result.catalogueId).to.equal(catalogueBook.id);
    expect(result.addedAt).to.exist;

    libraryItem = result;

    // Try to add the same item again, it should return the existing item
    const duplicateResult = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: addData,
    });

    console.log("Duplicate add result:", duplicateResult);
    expect(duplicateResult).to.deep.equal(result);
    expect(duplicateResult.id).to.equal(libraryItem.id);
    expect(duplicateResult.uid).to.equal(userData.uid);
    expect(duplicateResult.catalogueId).to.equal(catalogueBook.id);
    expect(duplicateResult.addedAt).to.exist;
  });

  // eslint-disable-next-line no-undef
  it(`test v1getItemManifest`, async () => {
    const wrapped = firebaseTest.wrap(v1getItemManifest);

    // Prepare the data for getting the item manifest
    const getManifestData = {
      libraryId: libraryItem.id,
    };

    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: getManifestData,
    });

    // console.log(result);
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
  it(`test v1 without a sceneId`, async () => {
    const wrapped = firebaseTest.wrap(v1getAi);

    // Prepare the data for getting AI content
    const getAiData = {
      libraryId: libraryItem.id,
    };

    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: getAiData,
    });

    // console.log(result);
    expect(result).to.exist;
    expect(result).to.be.an("array");
    expect(result[0]).to.have.property("scene_number");
    expect(result[0]).to.have.property("description");
    expect(result[0]).to.have.property("characters");
    expect(result[0]).to.have.property("locations");
    expect(result[0]).to.have.property("viewpoint");

    // Try to get AI content for a non-existent item, it should throw an error
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
      expect(error.message).to.include("Library item not found");
    }
  });

  // eslint-disable-next-line no-undef
  it(`test v1getLibrary with includeManifest=false`, async () => {
    const wrapped = firebaseTest.wrap(v1getLibrary);

    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        includeManifest: false,
      },
    });

    expect(result).to.be.an("array");
    expect(result).to.have.lengthOf(1);
    expect(result[0]).to.have.property("id");
    expect(result[0]).to.have.property("catalogueId");
    expect(result[0]).to.not.have.property("manifest");
    console.log(result);
  });
  let originalScene;
  // eslint-disable-next-line no-undef
  it(`test v1getLibraryItemScenes`, async () => {
    const wrapped = firebaseTest.wrap(v1getLibraryItemScenes);

    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
      },
    });
    console.log(result);
    expect(result).to.be.an("array");
    expect(result.length).to.be.at.least(1);

    // Check properties of each scene
    result.forEach((scene) => {
      expect(scene).to.have.property("id");
      expect(scene).to.have.property("uid").that.equals(userData.uid);
      expect(scene).to.have.property("libraryId").that.equals(libraryItem.id);
      expect(scene).to.have.property("prompt");
      expect(scene).to.have.property("userDefault").that.is.a("boolean");
      expect(scene).to.have.property("createdAt");
    });

    // Check if there's a default scene
    const defaultScene = result.find((scene) => scene.userDefault === true);
    expect(defaultScene).to.exist;
    originalScene = defaultScene;
    // Test with a non-existent library item
    const nonExistentResult = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: "non-existent-id",
      },
    });
    expect(nonExistentResult).to.be.an("array").that.is.empty;
  });

  let addedScene;
  // eslint-disable-next-line no-undef
  it(`test v1addLibraryItemScenes`, async () => {
    const wrapped = firebaseTest.wrap(v1addLibraryItemScenes);
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
        prompt: "Miyazaki",
        userDefault: true,
      },
    });
    console.log(result);
    expect(result).to.have.property("id");
    expect(result).to.have.property("prompt", "Miyazaki");
    expect(result).to.have.property("userDefault", true);
    addedScene = result;
  });

  // eslint-disable-next-line no-undef
  it(`test v1getLibraryItemScenes after adding a new scene`, async () => {
    const wrapped = firebaseTest.wrap(v1getLibraryItemScenes);
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
      },
    });

    console.log(result);
    expect(result).to.be.an("array");
    expect(result.length).to.be.at.least(2);

    // Check if the added scene is present
    const addedSceneInResult = result.find((scene) => scene.id === addedScene.id);
    expect(addedSceneInResult).to.exist;
    expect(addedSceneInResult.prompt).to.equal("Miyazaki");
    expect(addedSceneInResult.userDefault).to.be.true;

    // Check if the original scene is no longer the default
    const originalSceneInResult = result.find((scene) => scene.id === originalScene.id);
    expect(originalSceneInResult).to.exist;
    expect(originalSceneInResult.userDefault).to.be.false;

    // Ensure only one scene is set as default
    const defaultScenes = result.filter((scene) => scene.userDefault === true);
    expect(defaultScenes.length).to.equal(1);
    expect(defaultScenes[0].id).to.equal(addedScene.id);
  });

  // eslint-disable-next-line no-undef
  it(`test v1updateLibraryItemScenes to set original scene back to default`, async () => {
    const wrapped = firebaseTest.wrap(v1updateLibraryItemScenes);
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
        sceneId: originalScene.id,
        userDefault: true,
      },
    });

    console.log(result);
    expect(result).to.have.property("id", originalScene.id);
    expect(result).to.have.property("userDefault", true);

    // Now get the scenes again to verify the changes
    const getScenes = firebaseTest.wrap(v1getLibraryItemScenes);
    const scenesResult = await getScenes({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
      },
    });

    console.log(scenesResult);
    expect(scenesResult).to.be.an("array");
    expect(scenesResult.length).to.be.at.least(2);

    // Check if the original scene is now the default
    const updatedOriginalScene = scenesResult.find((scene) => scene.id === originalScene.id);
    expect(updatedOriginalScene).to.exist;
    expect(updatedOriginalScene.userDefault).to.be.true;

    // Check if the previously added scene is no longer the default
    const updatedAddedScene = scenesResult.find((scene) => scene.id === addedScene.id);
    expect(updatedAddedScene).to.exist;
    expect(updatedAddedScene.userDefault).to.be.false;

    // Ensure only one scene is set as default
    const defaultScenes = scenesResult.filter((scene) => scene.userDefault === true);
    expect(defaultScenes.length).to.equal(1);
    expect(defaultScenes[0].id).to.equal(originalScene.id);
  });

  // eslint-disable-next-line no-undef
  it(`test v1getLibrary with includeManifest=true`, async () => {
    const wrapped = firebaseTest.wrap(v1getLibrary);

    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        includeManifest: true,
      },
    });

    expect(result).to.be.an("array");
    expect(result).to.have.lengthOf(1);
    expect(result[0]).to.have.property("id");
    expect(result[0]).to.have.property("catalogueId");
    expect(result[0]).to.have.property("manifest");
    expect(result[0].manifest).to.be.an("object");
    console.log(result);
  });


  // eslint-disable-next-line no-undef
  it(`test v1getLibrary with non-existent user`, async () => {
    const wrapped = firebaseTest.wrap(v1getLibrary);

    const result = await wrapped({
      auth: {
        uid: "non-existent-uid",
      },
      data: {},
    });

    expect(result).to.be.an("array");
    expect(result).to.have.lengthOf(0);
    console.log(result);
  });

  // eslint-disable-next-line no-undef
  it(`test v1deleteItemsFromLibrary`, async () => {
    const wrapped = firebaseTest.wrap(v1deleteItemsFromLibrary);

    // First, add an item to the library
    const addItemResult = await firebaseTest.wrap(v1addItemToLibrary)({
      auth: {
        uid: userData.uid,
      },
      data: {
        catalogueId: "test-catalogue-id",
      },
    });

    expect(addItemResult).to.have.property("id");
    const itemId = addItemResult.id;

    // Now, delete the item
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryIds: [itemId, libraryItem.id],
      },
    });

    expect(result).to.be.an("object");
    expect(result).to.have.property("message", "Deletion process completed");
    expect(result).to.have.property("results");
    expect(result.results).to.have.property("success");
    expect(result.results).to.have.property("failed");
    expect(result.results.success).to.be.an("array").that.includes(itemId);
    expect(result.results.failed).to.be.an("array").that.is.empty;
    // console.log(result);
    // Verify the item is no longer in the library using v1getLibrary
    const libraryAfterDeletion = await firebaseTest.wrap(v1getLibrary)({
      auth: {
        uid: userData.uid,
      },
      data: {},
    });

    expect(libraryAfterDeletion).to.be.an("array");
    expect(libraryAfterDeletion.find((item) => item.id === itemId)).to.be.undefined;
  });

  // eslint-disable-next-line no-undef
  it(`test no scenes for deleted book`, async () => {
    const wrapped = firebaseTest.wrap(v1getLibraryItemScenes);

    // Try to get scenes for the deleted book
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id, // Using the itemId from the previous test
      },
    });

    // Check that the result is an empty array
    expect(result).to.be.an("array").that.is.empty;

    // Verify that the scenes collection is empty for this book
    const db = getFirestore();
    const scenesSnapshot = await db.collection("Scenes")
        .where("uid", "==", userData.uid)
        .where("libraryId", "==", libraryItem.id)
        .get();

    expect(scenesSnapshot.empty).to.be.true;
  });


  // it(`test getPipeline`, async () => {
  //   const wrapped = firebaseTest.wrap(getPipeline);
  //   const data = {id: pipelineId};
  //   const result = await wrapped({
  //     auth: {
  //       uid: userData.uid,
  //     },
  //     data,
  //   });
  //   console.log(result);
  //   expect(result.id).to.equal(pipelineId);
  // });


  // eslint-disable-next-line no-undef
  it(`test transcription`, (done) => {
    const BOOK = "Neuromancer: Sprawl Trilogy, Book 1";
    chai.request(`http://127.0.0.1:5001/visibl-dev-ali/europe-west1/preProcessBook`)
        .post("")
        .send({run: true, fileName: `${BOOK}.m4b`, bookName: BOOK, type: "m4b"})
        .end((err, res) => {
          console.log("res.body = " + JSON.stringify(res.body));
          expect(err).to.be.null;
          expect(res).to.have.status(200);
          done();
        });
  });


  // eslint-disable-next-line no-undef
  it(`test v1catalogueDelete`, async () => {
    const getWrapped = firebaseTest.wrap(v1catalogueGet);

    // First, delete the catalogue item
    const deleteResponse = await chai
        .request(APP_URL)
        .post("/v1/admin/catalogue/delete")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({id: catalogueBook.id});

    expect(deleteResponse).to.have.status(200);
    const deleteResult = deleteResponse.body;

    console.log(deleteResult);
    expect(deleteResult.success).to.be.true;
    expect(deleteResult.message).to.equal("Item deleted successfully");

    // Then, try to get all catalogue items
    const getResult = await getWrapped({
      auth: {
        uid: userData.uid,
      },
      data: {},
    });

    console.log(getResult);
    expect(getResult).to.be.an("array");

    // Check that the deleted item is no longer in the catalogue
    const deletedBook = getResult.find((book) => book.id === catalogueBook.id);
    expect(deletedBook).to.be.undefined;
  });
});
