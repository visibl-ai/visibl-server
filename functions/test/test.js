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
import {getUser} from "../db/firestore.js";

// Initialize Firebase Admin with local emulator settings
initializeApp({
  projectId: "visibl-dev-ali",
});

// Point to the local Auth and Firestore emulators
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const auth = getAuth();
const db = getFirestore();

describe("Customer creation via Firebase Auth", () => {
  it("creates a new user and checks Firestore for the user data", async () => {
    // Create a new user in Firebase Authentication
    logger.debug(`Creating new user.`);
    let testUser = await auth.createUser({
      email: "john.doe@example.com",
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
    const userData = await getUser(testUser.uid);
    console.log(userData);
    expect(userData).to.not.be.null;
    expect(userData.email).to.equal("john.doe@example.com");
  });
});
