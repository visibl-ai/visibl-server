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
// Start the Firebase Functions test environment
// eslint-disable-next-line no-unused-vars
const firebaseTest = test({
  databaseURL: "http://localhost:8080",
  storageBucket: "visibl-dev-ali.appspot.com",
  projectId: "visibl-dev-ali",
});
// to get the app
import {
  // eslint-disable-next-line no-unused-vars
  helloWorld,
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
const APP_URL = `http://127.0.0.1:5002`;

const SYM_PATH = "./test/bindings/images/";
const bucketPath = `Images/`;

// eslint-disable-next-line no-undef
describe("Graph tests", () => {
  // eslint-disable-next-line no-undef
  it(`Upload bindings to bucket.`, async () => {
    const fileList = [
      `jardethe.png`,
      `linda.jpg`,
    ];
    const bucket = getStorage(app).bucket();

    console.log(bucketPath);
    for (const fileName of fileList) {
      console.log(`Uploading file: ${fileName}`);
      const filePath = `${bucketPath}${fileName}`;
      const file = bucket.file(filePath);
      try {
        const stream = fs.createReadStream(`${SYM_PATH}${fileName}`);

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
  // it("should outpaint an image", async () => {
  //   const data = {
  //     inputPath: `${bucketPath}jardethe.png`,
  //     outputPathWithoutExtension: `${bucketPath}jardethe`,
  //   };

  //   const response = await chai.request(APP_URL)
  //       .post("/v1/admin/ai/outpaint")
  //       .set("API-KEY", process.env.ADMIN_API_KEY)
  //       .send(data);
  //   expect(response).to.have.status(200);
  // });
  // eslint-disable-next-line no-undef
  it("should structure an image", async () => {
    const data = {
      inputPath: `${bucketPath}linda.jpg`,
      outputPathWithoutExtension: `${bucketPath}linda`,
      prompt: `Neon punk style`,
    };

    const response = await chai.request(APP_URL)
        .post("/v1/admin/ai/structure")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send(data);
    expect(response).to.have.status(200);
  });
});
