/* eslint-disable require-jsdoc */
import app from "../firebase.js";
import logger from "firebase-functions/logger";
import {onCall} from "firebase-functions/v2/https";
import {beforeUserCreated} from "firebase-functions/v2/identity";
import {newUser, validateOnCallAuth} from "../auth/auth.js";
import {getUser} from "../storage/firestore.js";


export const newUserTriggers =
  beforeUserCreated({region: "europe-west1"}, async (event) => {
    logger.debug(`FUNCTION: beforeUserCreated - newUserTriggers`);
    logger.debug(event);
    try {
      await newUser(app, event);
    } catch (error) {
      logger.error(error);
    }
    return;
  });

export const getCurrentUser = onCall({region: "europe-west1"}, async (context) => {
  const {uid} = await validateOnCallAuth(context);
  return getUser(uid);
});
