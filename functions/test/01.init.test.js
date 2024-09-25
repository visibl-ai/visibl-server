/* eslint-disable require-jsdoc */
/* eslint-disable no-invalid-this */
/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
import "./_env.js";
import console from "../util/_console.js";
import admin from "firebase-admin";
import logger from "../util/logger.js";
import dotenv from "dotenv";

import chai from "chai";
import chaiHttp from "chai-http";

chai.use(chaiHttp);
const expect = chai.expect;

import {Readable} from "stream";
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
  databaseURL: "http://localhost:9000",
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
  v1getLibraryScenes,
  v1addLibraryItemScenes,
  v1updateLibraryItemScenes,
  v1generateTranscriptions,
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
const DISPATCH_URL = `http://127.0.0.1:5001`;
const DISPATCH_REGION = `europe-west1`;
const auth = getAuth();
// const db = getFirestore();

const TEST_USER_EMAIL = `john.${Date.now()}@example.com`;
const DEFAULT_TIMEOUT = 99999999999999;

async function callStabilityQueue() {
  console.log(`Calling launchStabilityQueue manually`);
  const response = await chai
      .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
      .post("/launchStabilityQueue").set("Content-Type", "application/json")
      .send({data: {}});
  return response;
}

async function callDalleQueue() {
  console.log(`Calling launchDalleQueue manually`);
  const response = await chai
      .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
      .post("/launchDalleQueue").set("Content-Type", "application/json")
      .send({data: {}});
  return response;
}

const SYM_PATH = "./test/bindings/";
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
describe("Full functional tests of visibl api", () => {
  let userData;
  // eslint-disable-next-line no-undef
  it("creates a new user and checks Firestore for the user data", async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
    const result = await newUser(event);
    // Assume a Firestore trigger or function in index.js populates Firestore based on Auth user creation
    // Wait for Firestore to be updated (this might require a delay or a more complex event-driven approach in a real scenario)

    // Fetch the newly created user data from Firestore to verify it's there
    userData = await getUser(testUser.uid);
    expect(userData).to.not.be.null;
    expect(userData.bucketPath).to.not.be.null;
  });
  // eslint-disable-next-line no-undef
  it(`test an unauthenticated function`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(helloWorld);
    const data = {};
    const result = await wrapped(data);
    console.log(result);
    expect(result.error).to.exist;
  });
  // eslint-disable-next-line no-undef
  it(`test an authenticated function`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
  it(`test getting current user`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
  it(`upload ffmpeg binary to test bucket`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
  it(`uploads a audio for public item`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
  it(`test processM4B taskQueue`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai
        .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
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
    it(`test v1catalogueProcessRaw`, async function() {
      this.timeout(DEFAULT_TIMEOUT);
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
  it(`test v1catalogueGet`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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

  // add scenes to graph here?
  // eslint-disable-next-line no-undef
  it(`upload scenes to default graph`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    await uploadFiles([
      {from: `scenes/${catalogueBook.sku}-scenes-graph.json`, to: `Graphs/${catalogueBook.defaultGraphId}/${catalogueBook.sku}-augmentedScenes.json`},
    ]);
  });

  // eslint-disable-next-line no-undef
  it(`test v1catalogueUpdate`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
  it(`test v1catalogueGetOPDS (public)`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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

  const GENERATE_TRANSCRIPTIONS = true;
  if (GENERATE_TRANSCRIPTIONS) {
    // eslint-disable-next-line no-undef
    it(`generates transcriptions for the book`, async function() {
      this.timeout(DEFAULT_TIMEOUT);
      const wrapped = firebaseTest.wrap(v1generateTranscriptions);
      const result = await wrapped({
        auth: {
          uid: "admin",
        },
        data: {
          sku: process.env.PUBLIC_SKU1,
        },
      });
      console.log(result);
    });
  }
  // Add item to the library
  let libraryItem;
  // eslint-disable-next-line no-undef
  it(`test v1addItemToLibrary - public, before scenes exist`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
  it(`test v1getItemManifest - public`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
  it(`test v1catalogueGetManifest`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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

  // eslint-disable-next-line no-undef
  it(`Create Default scene in graph.`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    let response = await chai.request(APP_URL)
        .post("/v1/admin/queue/nuke")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({});
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
    const data = {
      graphId: catalogueBook.defaultGraphId,
      stage: "createDefaultScene",
    };
    response = await chai
        .request(APP_URL)
        .post("/v1/graph/continue")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send(data);
    expect(response).to.have.status(200);
    console.log(response.body);

    response = await chai
        .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
        .post("/graphPipeline")
        .set("Content-Type", "application/json")
        .send({data: {}}); // nest object as this is a dispatch.
    expect(response).to.have.status(204);

    // update catalogue book with the new scene.
    const wrapped = firebaseTest.wrap(v1catalogueGet);
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {},
    });
    expect(result).to.be.an("array");
    expect(result.length).to.be.at.least(1);
    catalogueBook = result[0];
  });

  // eslint-disable-next-line no-undef
  it(`test getAi without a sceneId`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
    expect(result).to.be.an("object");
    expect(result["3"]).to.be.an("array");
    expect(result["3"][0]).to.have.property("scene_number");
    expect(result["3"][0]).to.have.property("description");
    expect(result["3"][0]).to.have.property("characters");
    expect(result["3"][0]).to.have.property("locations");
    expect(result["3"][0]).to.have.property("viewpoint");

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
      expect(error.message).to.include("Item not found in the user's library");
    }
  });

  // eslint-disable-next-line no-undef
  it(`test v1getLibrary with includeManifest=false`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
  it(`test v1getLibraryScenes`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getLibraryScenes);

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
    result.forEach((scene, i) => {
      expect(scene).to.have.property("id");
      //  expect(scene).to.have.property("uid").that.equals("admin"); // this is the global default scene.
      expect(scene).to.have.property("catalogueId").that.equals(libraryItem.catalogueId);
      expect(scene).to.have.property("prompt");
      expect(scene).to.have.property("title");
      expect(scene).to.have.property("userDefault").that.is.a("boolean");
      expect(scene).to.have.property("createdAt");
    });

    // Check if there's a default scene
    const defaultScene = result.find((scene) => scene.globalDefault === true);
    expect(defaultScene).to.exist;
    originalScene = defaultScene;
    // Test with a non-existent library item
    try {
      const nonExistentResult = await wrapped({
        auth: {
          uid: userData.uid,
        },
        data: {
          libraryId: "non-existent-id",
        },
      });
    } catch (error) {
      expect(error.message).to.include("Item not found in the user's library");
    }
  });

  let addedScene;
  // eslint-disable-next-line no-undef
  it(`test v1addLibraryItemScenes miyazaki`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1addLibraryItemScenes);
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
        prompt: "Miyazaki",
        userDefault: true,
        chapter: 3,
      },
    });
    console.log(result);
    expect(result).to.have.property("id");
    // expect(result.prompt.toLowerCase()).to.contain("miyazaki");
    expect(result).to.have.property("title");
    addedScene = result;
  });


  // Manually call the dispatched function.
  // eslint-disable-next-line no-undef
  it(`test generateSceneImages with a rejected image taskQueue`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const sceneId = addedScene.id;
    const lastSceneGenerated = 0;
    const totalScenes = 1;
    const chapter = 0;
    const response = await chai
        .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
        .post("/generateSceneImages")
        .set("Content-Type", "application/json")
        .send({
          data:
            {sceneId, lastSceneGenerated, totalScenes, chapter},
        });
    logger.debug(`generateSceneImages response ${JSON.stringify(response)}`);
    await callDalleQueue();
    expect(await callStabilityQueue()).to.have.status(204);
    // We need to now get the scenes and check that no image is here.
    const wrapped = firebaseTest.wrap(v1getAi);
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
        chapter,
      },
    });
    console.log(JSON.stringify(result).substring(0, 1000));
    // Now lets see if the moderated image is generated.
    // Dall it re-calls itself if the queue is not empty.
    expect(result).to.exist;
    expect(result).to.be.an("array");
    expect(result[0]).to.have.property("scene_number");
    expect(result[0]).to.have.property("description");
    expect(result[0]).to.have.property("characters");
    expect(result[0]).to.have.property("locations");
    expect(result[0]).to.have.property("viewpoint");
    expect(result[0]).to.have.property("image");
    expect(result[0]).to.have.property("square");
  });
  // eslint-disable-next-line no-undef
  it(`test generateSceneImages taskQueue`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const sceneId = addedScene.id;
    const lastSceneGenerated = 0;
    const totalScenes = 6;
    const chapter = 3;
    const response = await chai
        .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
        .post("/generateSceneImages")
        .set("Content-Type", "application/json")
        .send({
          data:
          {sceneId, lastSceneGenerated, totalScenes, chapter},
        });
    await callDalleQueue();
    expect(await callStabilityQueue()).to.have.status(204);
    // Call again in case anything was rejected by content moderation
    await callDalleQueue();
    expect(await callStabilityQueue()).to.have.status(204);
    // We need to now get the scenes and check that an image is generated.
    const wrapped = firebaseTest.wrap(v1getAi);
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
        chapter,
      },
    });
    console.log(JSON.stringify(result).substring(0, 1000));
    expect(result).to.exist;
    expect(result).to.be.an("array");
    // Loop through each scene in the result array
    for (let i = lastSceneGenerated; i < totalScenes; i++) {
      expect(result[i]).to.have.property("scene_number");
      expect(result[i]).to.have.property("description");
      expect(result[i]).to.have.property("characters");
      expect(result[i]).to.have.property("locations");
      expect(result[i]).to.have.property("viewpoint");
      expect(result[i]).to.have.property("square");
      expect(result[i]).to.have.property("image");
    }
  });
  // eslint-disable-next-line no-undef
  it(`test generateSceneImagesCurrentTime taskQueue`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const sceneId = addedScene.id;
    const response = await chai
        .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
        .post("/generateSceneImagesCurrentTime")
        .set("Content-Type", "application/json")
        .send({
          data:
            {sceneId, currentTime: 30320.1},
          // Should be Chapter 30 scene 1.
        });
    // expect(response).to.have.status(204); // Dispatch at end will fail, so not 204.
    await callDalleQueue();
    expect(await callStabilityQueue()).to.have.status(204);

    // NO IMAGE EXISTS for the styled scene. TODO: Fix this..
    // const wrapped = firebaseTest.wrap(v1getAi);
    // const result = await wrapped({
    //   auth: {
    //     uid: userData.uid,
    //   },
    //   data: {
    //     libraryId: libraryItem.id,
    //     chapter: 30,
    //   },
    // });
    // console.log(JSON.stringify(result).substring(0, 1000));
    // expect(result).to.exist;
    // expect(result).to.be.an("array");
    // // Loop through each scene in the result array
    // // Should be Chapter 30 scene 1.
    // // expect(result[1]).to.have.property("scene_number", 1);
    // // expect(result[1]).to.have.property("description");
    // // expect(result[1]).to.have.property("characters");
    // // expect(result[1]).to.have.property("locations");
    // // expect(result[1]).to.have.property("viewpoint");
    // // expect(result[1]).to.have.property("square");
    // // expect(result[1]).to.have.property("image");
  });
  // eslint-disable-next-line no-undef
  it(`test generateSceneImagesCurrentTime, overlapping previous generation`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const sceneId = addedScene.id;
    const lastSceneGenerated = 0;
    const totalScenes = 6;
    const chapter = 3;
    const response = await chai
        .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
        .post("/generateSceneImagesCurrentTime")
        .set("Content-Type", "application/json")
        .send({
          data:
            {sceneId, currentTime: 30395.1},
          // Should be Chapter 30 scene 1.
        });
    // expect(response).to.have.status(204); // Dispatch at end will fail, so not 204.
    await callDalleQueue();
    expect(await callStabilityQueue()).to.have.status(204);
  });
  // eslint-disable-next-line no-undef
  it(`test v1getLibraryScenes with a single scene`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getLibraryScenes);

    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
        sceneId: addedScene.id,
      },
    });
    console.log(result);
    expect(result).to.be.an("object");
    expect(result).to.have.property("id");
    expect(result).to.have.property("uid").that.equals(userData.uid);
    expect(result).to.have.property("catalogueId").that.equals(libraryItem.catalogueId);
    expect(result).to.have.property("prompt");
    expect(result).to.have.property("title");
    expect(result).to.have.property("userDefault").that.is.a("boolean");
    expect(result).to.have.property("createdAt");
  });
  // eslint-disable-next-line no-undef
  it(`test v1getLibraryScenes after adding a new scene`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getLibraryScenes);
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
    expect(addedSceneInResult.prompt.toLowerCase()).to.match(/miyazaki|ghibli/);
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
  it(`test v1updateLibraryItemScenes to set original scene back to default`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
    expect(result).to.have.property("id", libraryItem.id);
    expect(result).to.have.property("defaultSceneId", originalScene.id);

    // Now get the scenes again to verify the changes
    const getScenes = firebaseTest.wrap(v1getLibraryScenes);
    const scenesResult = await getScenes({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
      },
    });

    console.log(JSON.stringify(scenesResult).substring(0, 150));
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
  it(`test getAi without a sceneId`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
    expect(result).to.be.an("object");
    expect(result["3"]).to.be.an("array");
    expect(result["3"][0]).to.have.property("scene_number");
    expect(result["3"][0]).to.have.property("description");
    expect(result["3"][0]).to.have.property("characters");
    expect(result["3"][0]).to.have.property("locations");
    expect(result["3"][0]).to.have.property("viewpoint");
  });


  let defaultChapterScene;
  // eslint-disable-next-line no-undef
  it(`test getAi without a sceneId and a chapter`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAi);

    // Prepare the data for getting AI content
    const getAiData = {
      libraryId: libraryItem.id,
      chapter: 3,
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
    defaultChapterScene = result[0];
  });

  // eslint-disable-next-line no-undef
  it(`test getAi with a sceneId and a chapter`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAi);

    // Prepare the data for getting AI content
    const getAiData = {
      libraryId: libraryItem.id,
      chapter: 3,
      sceneId: addedScene.id,
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
    console.log(result[0]);
    expect(result[0]).to.have.property("scene_number");
    expect(result[0]).to.have.property("description");
    expect(result[0]).to.have.property("characters");
    expect(result[0]).to.have.property("locations");
    expect(result[0]).to.have.property("viewpoint");
    expect(result[0].image).to.not.equal(defaultChapterScene.image);
  });
  // eslint-disable-next-line no-undef
  it(`test getAi with a sceneId and a currentTime.`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAi);

    // Prepare the data for getting AI content
    const getAiData = {
      libraryId: libraryItem.id,
      currentTime: 20320.1,
      chapter: 20,
      sceneId: addedScene.id,
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
    console.log(result[0]);
    expect(result[0]).to.have.property("scene_number");
    expect(result[0]).to.have.property("description");
    expect(result[0]).to.have.property("characters");
    expect(result[0]).to.have.property("locations");
    expect(result[0]).to.have.property("viewpoint");
  });
  // GET AI WITH currentTime, create scene with current time!
  // eslint-disable-next-line no-undef
  it(`test v1addLibraryItemScenes with currentTime and a styled scene`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    // First we need to update the default scenes for the chapter with one with images.
    let wrapped = firebaseTest.wrap(v1getAi);
    const getAiData = {
      libraryId: libraryItem.id,
      sceneId: addedScene.id,
    };

    let result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: getAiData,
    });
    const bucket = getStorage(app).bucket();
    const bucketPath = `Scenes/${catalogueBook.defaultSceneId}/scenes.json`;
    const file = bucket.file(bucketPath);
    try {
      const stream = Readable.from(JSON.stringify(result));

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

    const theme = "neon punk style";
    const time = 66.1; // Chapter 3, scene 3
    wrapped = firebaseTest.wrap(v1addLibraryItemScenes);
    result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
        prompt: theme,
        userDefault: true,
        currentTime: time,
      },
    });
    console.log(result);
    expect(result).to.have.property("id");
    expect(result).to.have.property("prompt");
    expect(result.prompt.toLowerCase()).to.contain(theme);
    expect(result).to.have.property("title");
    addedScene = result;
    const styledSceneId = result.id;
    logger.debug(`Manually calling imageGenCurrentTime as dispatch doesn't work in test.`);
    const data = {
      sceneId: styledSceneId,
      currentTime: time,
    };
    const response = await chai
        .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
        .post("/generateSceneImagesCurrentTime")
        .set("Content-Type", "application/json")
        .send({
          data,
        });
    // expect(response).to.have.status(204); // Dispatch at end will fail, so not 204.
    await callDalleQueue();
    expect(await callStabilityQueue()).to.have.status(204);

    // We need to now get the scenes and check that an image is generated.
    wrapped = firebaseTest.wrap(v1getAi);
    result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data: {
        libraryId: libraryItem.id,
        sceneId: result.id,
        chapter: 3, // Chapter 3, scene 3
      },
    });
    console.log(JSON.stringify(result).substring(0, 1000));
    expect(result).to.exist;
    expect(result).to.be.an("array");
    // Loop through each scene in the result array
    expect(result[3]).to.have.property("scene_number");
    expect(result[3]).to.have.property("description");
    expect(result[3]).to.have.property("characters");
    expect(result[3]).to.have.property("locations");
    expect(result[3]).to.have.property("viewpoint");
    expect(result[3]).to.have.property("square");
    expect(result[3]).to.have.property("image");
    expect(result[3]).to.have.property("image");
    expect(result[3].image).to.contain("structured");
    expect(result[3]).to.have.property("tall");
    expect(result[3].tall).to.contain("structured");
    expect(result[3]).to.have.property("sceneId", styledSceneId);
  });
  // eslint-disable-next-line no-undef
  it(`test v1getLibrary with includeManifest=true`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
  it(`test v1getLibrary with non-existent user`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
  it(`test v1deleteItemsFromLibrary`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1deleteItemsFromLibrary);
    // Now, delete the item
    const data = {libraryIds: [libraryItem.id]};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });

    expect(result).to.be.an("object");
    expect(result).to.have.property("message", "Deletion process completed");
    expect(result).to.have.property("results");
    expect(result.results).to.have.property("success");
    expect(result.results).to.have.property("failed");
    expect(result.results.success).to.be.an("array").that.includes(libraryItem.id);
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
    expect(libraryAfterDeletion.find((item) => item.id === libraryItem.id)).to.be.undefined;
  });

  // eslint-disable-next-line no-undef
  it(`test no scenes for deleted book`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getLibraryScenes);

    // Try to get scenes for the deleted book
    try {
      const result = await wrapped({
        auth: {
          uid: userData.uid,
        },
        data: {
          libraryId: libraryItem.id, // Using the itemId from the previous test
        },
      });
    } catch (error) {
      expect(error.message).to.include("Item not found in the user's library");
    }

    // Verify that the scenes collection is empty for this book
    const db = getFirestore();
    const scenesSnapshot = await db.collection("Scenes")
        .where("uid", "==", userData.uid)
        .where("libraryId", "==", libraryItem.id)
        .get();

    expect(scenesSnapshot.empty).to.be.true;
  });

  // eslint-disable-next-line no-undef
  it(`test v1catalogueDelete`, async function() {
    this.timeout(DEFAULT_TIMEOUT);
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
