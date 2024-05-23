/* eslint-disable max-len */
import logger from "firebase-functions/logger";
import {saveUser} from "../db/firestore.js";
/**
 * This function is triggered when a new user is created.
 * It handles the creation of a new user
 * in the Firestore database and sets up a personal
 * storage bucket for the user's files.
 *
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
async function newUser(event) {
  logger.debug(`FUNCTION: new user creation.`);
  const user = {
    uid: event.data.uid,
    email: event.data.email,
  };
  return await saveUser(user);
}

export {newUser};

