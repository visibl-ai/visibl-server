/* eslint-disable max-len */
/* eslint-disable no-unused-vars */
import {onCall} from "firebase-functions/v2/https";
import logger from "firebase-functions/logger";
import {validateOnCallAuth} from "./auth/auth.js";
import {ENVIRONMENT} from "./config/config.js";

export * from "./routes/users.js";
export * from "./routes/library.js";
export * from "./routes/scenes.js";
export * from "./routes/catalogue.js";
export * from "./routes/opds.js";
export * from "./routes/aax.js";
export * from "./routes/graph.js";
export * from "./routes/pipeline.js";

/**
 * HTTP Cloud Function test.
 *
 * @param {Request} req - The HTTP request object.
 * @param {Response} res - The HTTP response object.
 */
export const helloWorld = onCall({region: "europe-west1"}, async (context) => {
  // Check if the request is made by an authenticated user
  logger.debug(`ENVIRONMENT: ${ENVIRONMENT.value()}`);
  let uid;
  let data;
  try {
    const req = await validateOnCallAuth(context);
    uid = req.uid;
    data = req.data;
  } catch (error) {
    return {error: "User not authenticated"};
  }
  return {uid: uid, message: `Success! You made an authenticated request.`};
});
