// import {onRequest} from "firebase-functions/v2/https";
// import logger from "firebase-functions/logger";
import {newUser} from "./auth/auth.js";
import {
  beforeUserCreated,
  // beforeUserSignedIn,
} from "firebase-functions/v2/identity";

export const beforecreated = beforeUserCreated(async (event) => {
  return await newUser(event);
});
