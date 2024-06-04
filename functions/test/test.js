/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable max-len */
import admin from "firebase-admin";
import logger from "firebase-functions/logger";
import {expect} from "chai";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {newUser} from "../auth/auth.js";
import {getUser} from "../storage/firestore.js";
import {getStorage} from "firebase-admin/storage";

import test from "firebase-functions-test";

// Start the Firebase Functions test environment
const firebaseTest = test({
  databaseURL: "http://localhost:8080",
  storageBucket: "visibl-dev-ali.appspot.com",
  projectId: "visibl-dev-ali",
});
import {
  helloWorld,
  createBook,
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
    wrapped(data).then((result) => {
      console.log(result);
      expect(result.error).to.exist();
    });
  });
  it(`test an authenticated function`, async () => {
    const wrapped = firebaseTest.wrap(helloWorld);
    const data = {};
    wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    }).then((result) => {
      console.log(result);
      expect(result.uid).to.equal(userData.uid);
    });
  });

  it(`test createBook`, async () => {
    const wrapped = firebaseTest.wrap(createBook);
    const data = {filename: "test.m4a"};
    wrapped({
      auth: {
        uid: userData.uid,
      },
      data,
    }).then((result) => {
      console.log(result);
      expect(result.uid).to.equal(userData.uid);
    });
  });
  // it(`uploads a m4a file to the user's storage bucket`, async () => {
  //   const bucket = getStorage(app).bucket();
  //   const bucketPath = userData.bucketPath;
  //   console.log(bucketPath);
  //   const filePath = `${bucketPath}/rawUploads/test.m4a`;
  //   const file = bucket.file(filePath);
  //   // await file.save(`./test/bindings/m4b/Neuromancer: Sprawl Trilogy, Book 1.m4b`, {
  //   const result = await file.save(`fdsafsa.m4b`, {
  //     contentType: "audio/x-m4b",
  //   });
  //   console.log(result);
  // });
});
