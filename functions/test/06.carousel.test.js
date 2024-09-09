/* eslint-disable require-jsdoc */
/* eslint-disable max-len */
/* eslint-disable no-invalid-this */
// import admin from "firebase-admin";
import "./_env.js";
import dotenv from "dotenv";
dotenv.config({path: ".env.local"}); // because firebase-functions-test doesn't work with conf.
import chai from "chai";
import chaiHttp from "chai-http";
chai.use(chaiHttp);
const expect = chai.expect;
import {initializeApp} from "firebase-admin/app";
// import {getAuth} from "firebase-admin/auth";
import {getStorage} from "firebase-admin/storage";
import {getAuth} from "firebase-admin/auth";
import {newUser} from "../auth/auth.js";
import {getUser,
} from "../storage/firestore.js";
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
  v1catalogueGet,
  v1addLibraryItemScenes,
  v1addItemToLibrary,
  v1getAiCarousel,
  v1getLibraryScenes,
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
const DISPATCH_REGION = `us-central1`;
const auth = getAuth();
const TEST_USER_EMAIL = `john.${Date.now()}@example.com`;
const SYM_PATH = "./test/bindings/";
const bucketScenePath = `Scenes/`;


const SETUP_ENV = true;
const DEFAULT_TIMEOUT = 99999999999999;
const sceneThemes = [
  {title: "Miyazaki", prompt: "Miyazaki style"},
  {title: "Wes Anderson", prompt: "Wes Anderson style"},
  {title: "Renassaince", prompt: "Renassaince style"},
  {title: "Egyptian Hieroglyphs", prompt: "Egyptian Hieroglyphs"},
  {title: "Cyberpunk", prompt: "Cyberpunk"},
  {title: "Steampunk", prompt: "Steampunk"},
  {title: "Baroque", prompt: "Baroque"},
  {title: "Art Deco", prompt: "Art Deco"},
  {title: "Art Nouveau", prompt: "Art Nouveau"},
  {title: "Gothic", prompt: "Gothic"},
  {title: "Victorian", prompt: "Victorian"},
  {title: "Sumi-e", prompt: "Sumi-e"},
  {title: "Picasso Cubism", prompt: "Picasso Cubism"},
  {title: "Fauvism", prompt: "Fauvism"},
  {title: "Expressionism", prompt: "Expressionism"},
];

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
describe("Carousel Tests", () => {
// 1 create 15 scenes.

  let userData;
  let catalogueBook;
  let libraryItem;
  const scenesCreated = [];
  if (SETUP_ENV) {
  // eslint-disable-next-line no-undef
    it("Setup environment", async function() {
      this.timeout(DEFAULT_TIMEOUT);
      // create a user
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
      let result = await newUser(event);
      userData = await getUser(testUser.uid);
      await uploadFiles([
        {from: `bin/ffmpeg`, to: `bin/ffmpeg`},
        {from: `m4b/${process.env.PUBLIC_SKU1}.json`, to: `Catalogue/Raw/${process.env.PUBLIC_SKU1}.json`},
        {from: `m4b/${process.env.PUBLIC_SKU1}.jpg`, to: `Catalogue/Raw/${process.env.PUBLIC_SKU1}.jpg`},
        {from: `m4b/${process.env.PUBLIC_SKU1}.m4b`, to: `Catalogue/Raw/${process.env.PUBLIC_SKU1}.m4b`},
      ]);
      const response = await chai
          .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
          .post("/processM4B")
          .set("Content-Type", "application/json")
          .send({
            data:
          {sku: process.env.PUBLIC_SKU1},
          });
      expect(response).to.have.status(204);
      let wrapped = firebaseTest.wrap(v1catalogueGet);
      const data = {};
      result = await wrapped({
        auth: {
          uid: userData.uid,
        },
        data,
      });
      catalogueBook = result[0];
      // upload scenes for the new catalogue item.
      await uploadFiles([{
        from: `graph/${catalogueBook.sku}-scenes-graph.json`,
        to: `Catalogue/Processed/${catalogueBook.sku}/${catalogueBook.sku}-scenes.json`},
      ]);
      // Add item to users library.
      wrapped = firebaseTest.wrap(v1addItemToLibrary);
      result = await wrapped({
        auth: {
          uid: userData.uid,
        },
        data: {
          catalogueId: catalogueBook.id,
        },
      });
      libraryItem = result;
      wrapped = firebaseTest.wrap(v1getLibraryScenes);

      result = await wrapped({
        auth: {
          uid: userData.uid,
        },
        data: {
          libraryId: libraryItem.id,
        },
      });
      // eslint-disable-next-line no-prototype-builtins
      const defaultScene = result.find((scene) => scene.hasOwnProperty("userDefault"));
      await uploadFiles([{
        from: `graph/${catalogueBook.sku}-scenes-graph.json`,
        to: `${bucketScenePath}${defaultScene.id}/scenes.json`,
      }]);
      wrapped = firebaseTest.wrap(v1addLibraryItemScenes);
      for (let i = 0; i < 15; i++) {
      // console.log(`Iteration ${i + 1}`);
      // You can add more code here if needed for each iteration
        result = await wrapped({
          auth: {
            uid: userData.uid,
          },
          data: {
            libraryId: libraryItem.id,
            prompt: sceneThemes[i],
            userDefault: false,
            chapter: 3,
          },
        });
        // console.log(result);
        expect(result).to.have.property("id");
        scenesCreated.push(result);
      }
      // console.log(scenesCreated);
      // Upload scenes.json for each scene.
      const scenesFileList = [];
      for (const scene of scenesCreated) {
        scenesFileList.push({
          from: `graph/${catalogueBook.sku}-scenes-graph.json`,
          to: `${bucketScenePath}${scene.id}/scenes.json`,
        });
      }
      // console.log(scenesFileList);
      await uploadFiles(scenesFileList);
    });
  }
  // eslint-disable-next-line no-undef
  it("populate the cache with scenes ID", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai
        .request(`${DISPATCH_URL}/${APP_ID}/${DISPATCH_REGION}`)
        .post("/populateSceneCache")
        .set("Content-Type", "application/json")
        .send({
          data:
          {catalogueId: catalogueBook.id},
        });
    expect(response).to.have.status(204);
  });
  // getCarouselImages with no ID
  // eslint-disable-next-line no-undef
  it("getCarouselImages with no ID", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAiCarousel);
    const data = {
      libraryId: libraryItem.id,
      currentTime: 314.22,
    };
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    // console.log(result);
    expect(result).to.have.length(11);
    // console.log(result[0].scenes);
  });
  // get CarouselImages with ID
  // eslint-disable-next-line no-undef
  it("getCarouselImages with no ID", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const wrapped = firebaseTest.wrap(v1getAiCarousel);
    const data = {
      libraryId: libraryItem.id,
      currentTime: 314.22,
      sceneId: scenesCreated[0].id,
    };
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    // console.log(result);
    expect(result).to.have.length(11);
    console.log(result[0]);
  });
  // check that paging works.
});

// At the end of your test file
// eslint-disable-next-line no-undef
// after(() => {
//   process.on("exit", (code) => {
//     console.log(`About to exit with code: ${code}`);
//     console.log(process._getActiveHandles());
//     console.log(process._getActiveRequests());
//   });
// });
