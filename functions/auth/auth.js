/* eslint-disable max-len */
import logger from "firebase-functions/logger";
import {saveUser} from "../storage/firestore.js";
import {createUserFolder} from "../storage/storage.js";
import {ADMIN_API_KEY} from "../config/config.js";
/**
 * This function is triggered when a new user is created.
 * It handles the creation of a new user
 * in the Firestore database and sets up a personal
 * storage bucket for the user's files.
 * @param {Object} app - The application instance
 * @param {Object} event - The event object from firebase
 *
 * Event looks like:
 *
 {
  locale: 'und',
  ipAddress: '18.xxx.125',
  userAgent: 'FirebaseAuth.iOS/10.26.0 com.xxxx/5.2.8 iPhone/17.5 hw/sim,gzip(gfe),gzip(gfe)',
  eventId: '7******Q',
  eventType: 'providers/cloud.auth/eventTypes/user.beforeCreate:password',
  authType: 'USER',
  resource: {
    service: 'identitytoolkit.googleapis.com',
    name: 'projects/visibl-dev-ali'
  },
  timestamp: 'Wed, 22 May 2024 14:53:22 GMT',
  additionalUserInfo: {
    providerId: 'password',
    profile: undefined,
    username: undefined,
    isNewUser: true,
    recaptchaScore: undefined
  },
  credential: null,
  params: {},
  data: {
    uid: 'W****2',
    email: 'xxxxxx@xxxxxx.com',
    emailVerified: false,
    displayName: undefined,
    photoURL: undefined,
    phoneNumber: undefined,
    disabled: false,
    metadata: {
      creationTime: 'Wed, 22 May 2024 14:53:22 GMT',
      lastSignInTime: 'Wed, 22 May 2024 14:53:22 GMT'
    },
    providerData: [ [Object] ],
    passwordHash: ,
    passwordSalt: ,
    customClaims: ,
    tenantId: ,
    tokensValidAfterTime: null,
    multiFactor: null
  }
}
 */
async function newUser(app, event) {
  logger.debug(`FUNCTION: new user creation.`);
  const user = {
    uid: event.data.uid,
  };
  const bucketPath = await createUserFolder(app, user.uid);
  user.bucketPath = bucketPath;
  await saveUser(user);
  return;
}

/**
 * Validates the authentication context for an on-call function.
 * Ensures that the user making the request is authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions.
 * @return {Promise<object>} A promise that resolves with the user's UID and data if authenticated.
 * @throws {Error} If the user is not authenticated.
 */
async function validateOnCallAuth(context) {
  if (!context.auth || !context.auth.uid) {
    logger.error("User not authenticated");
    logger.error(context);
    throw new Error("User not authenticated");
  } else {
    return {uid: context.auth.uid, data: context.data};
  }
}
/**
 * Validates the authentication for an admin request using an API key.
 * Ensures that the request header contains a valid API key matching ADMIN_API_KEY.
 *
 * @param {object} req - The request object from Express.
 * @throws {Error} If the API key is missing or invalid.
 */
async function validateOnRequestAdmin(req) {
  const apiKey = req.get("API-KEY");
  if (!apiKey) {
    logger.error("API key is missing");
    throw new Error("API key is required");
  }

  if (apiKey !== ADMIN_API_KEY.value()) {
    logger.error("Invalid API key");
    throw new Error("Invalid API key");
  }
  return true;
}


export {
  newUser,
  validateOnCallAuth,
  validateOnRequestAdmin,
};

