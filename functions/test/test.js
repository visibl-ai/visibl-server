/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
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
  updateBookFirestore,
  deleteBookFirestore,
} from "../storage/firestore.js";
import {getStorage} from "firebase-admin/storage";
import fs from "fs";

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
  createBook,
  getBook,
} from "../index.js";


// Initialize Firebase Admin with local emulator settings
const APP_ID = process.env.APP_ID || "visibl-dev-ali";
const app = initializeApp({
  projectId: APP_ID,
  storageBucket: `${APP_ID}.appspot.com`,
}, "2");

// Point to the local Auth and Firestore emulators
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

const auth = getAuth();
const db = getFirestore();

const TEST_USER_EMAIL = `john.doe@example.com`;
describe("Customer creation via Firebase Auth", () => {
  let userData;
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
  it(`test an unauthenticated function`, async () => {
    const wrapped = firebaseTest.wrap(helloWorld);
    const data = {};
    const result = await wrapped(data);
    console.log(result);
    expect(result.error).to.exist;
  });
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
  let bookData;
  const filename = `Neuromancer: Sprawl Trilogy, Book 1.m4b`;
  it(`test createBook`, async () => {
    const wrapped = firebaseTest.wrap(createBook);
    const data = {filename: filename};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result.uid).to.equal(userData.uid);
    expect(result.id).to.not.be.null;
    bookData = result;
  });
  it(`test getBook`, async () => {
    const wrapped = firebaseTest.wrap(getBook);
    const data = {id: bookData.id};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result).to.deep.equal(bookData);
    bookData = result;
  });
  it(`test updateBook before upload`, async () => {
    const data = {id: bookData.id};
    const result = await updateBookFirestore(userData.uid, bookData, app);
    console.log(result);
    expect(result.rawBookInStorage).to.equal(false);
    bookData = result;
  });
  it(`test getBook after update`, async () => {
    const wrapped = firebaseTest.wrap(getBook);
    const data = {id: bookData.id};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result).to.deep.equal(bookData);
    bookData = result;
  });
  it(`uploads a m4a file to the user's storage bucket`, async () => {
    const bucket = getStorage(app).bucket();
    const bucketPath = userData.bucketPath;
    console.log(bucketPath);
    const extension = filename.split(".").pop();
    const bucketFilename = `${bookData.id}.${extension}`;
    console.log(`Bucket filename: ${bucketFilename}`);
    const filePath = `${bucketPath}${bucketFilename}`;
    const file = bucket.file(filePath);

    try {
      const stream = fs.createReadStream(`./test/bindings/m4b/${filename}`);
      const contentType = "audio/x-m4b";

      await new Promise((resolve, reject) => {
        stream.pipe(file.createWriteStream({
          metadata: {
            contentType: contentType,
          },
        }))
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
  it(`test updateBook after upload`, async () => {
    const data = {id: bookData.id};
    const result = await updateBookFirestore(userData.uid, bookData, app);
    console.log(result);
    expect(result.rawBookInStorage).to.equal(true);
    bookData = result;
  });
  it(`test getBook after update and upload`, async () => {
    const wrapped = firebaseTest.wrap(getBook);
    const data = {id: bookData.id};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    console.log(result);
    expect(result).to.deep.equal(bookData);
    bookData = result;
  });


  it(`test transcription`, (done) => {
    const BOOK = "Neuromancer: Sprawl Trilogy, Book 1";
    chai.request(`http://127.0.0.1:5001/visibl-dev-ali/us-central1/preProcessBook`)
        .post("")
        .send({run: true, fileName: `${BOOK}.m4b`, bookName: BOOK, type: "m4b"})
        .end((err, res) => {
          console.log("res.body = " + JSON.stringify(res.body));
          expect(err).to.be.null;
          expect(res).to.have.status(200);
          done();
        });
  });

  it(`test deleteBook after upload`, async () => {
    const data = {id: bookData.id};
    const result = await deleteBookFirestore(userData.uid, bookData, app);
    expect(result.success).to.equal(true);
    console.log(result);
  });
  it(`test getBook after delete`, async () => {
    const wrapped = firebaseTest.wrap(getBook);
    const data = {id: bookData.id};
    const result = await wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    });
    expect(result.error).to.equal("Book not found");
  });
});
