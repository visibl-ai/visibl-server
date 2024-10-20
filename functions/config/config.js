/* eslint-disable no-unused-vars */
import {defineSecret, defineString, defineBoolean} from "firebase-functions/params";

const ENVIRONMENT = defineString("ENVIRONMENT");
const OPENAI_API_KEY = defineString("OPENAI_API_KEY");
const ADMIN_API_KEY = defineString("ADMIN_API_KEY");
const STORAGE_BUCKET_ID = defineString("STORAGE_BUCKET_ID");
const AUDIBLE_OPDS_API_KEY = defineString("AUDIBLE_OPDS_API_KEY");
const AUDIBLE_OPDS_FIREBASE_URL = defineString("AUDIBLE_OPDS_FIREBASE_URL");
const HOSTING_DOMAIN = defineString("HOSTING_DOMAIN");
const AAX_CONNECT_SOURCE = defineString("AAX_CONNECT_SOURCE");
const GEMINI_API_KEY = defineString("GEMINI_API_KEY");
const MOCK_LLM = defineBoolean("MOCK_LLM");
const STABILITY_API_KEY_1 = defineString("STABILITY_API_KEY_1");
const STABILITY_API_KEY_2 = defineString("STABILITY_API_KEY_2");
const STABILITY_API_KEY_3 = defineString("STABILITY_API_KEY_3");
const STABILITY_API_KEY_4 = defineString("STABILITY_API_KEY_4");
const STABILITY_API_KEY_5 = defineString("STABILITY_API_KEY_5");
const STABILITY_API_KEY_6 = defineString("STABILITY_API_KEY_6");
const STABILITY_API_KEY_7 = defineString("STABILITY_API_KEY_7");
const STABILITY_API_KEY_8 = defineString("STABILITY_API_KEY_8");
const STABILITY_API_KEY_9 = defineString("STABILITY_API_KEY_9");
const STABILITY_API_KEY_10 = defineString("STABILITY_API_KEY_10");


// SECRETS - warning: https://firebase.google.com/docs/functions/config-env?gen=2nd#node.js_6
// I think secrets are broken on test so not using it for now.
// const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// for testing: https://github.com/firebase/firebase-functions-test/issues/196#issuecomment-1900541854
export {
  OPENAI_API_KEY,
  ENVIRONMENT,
  ADMIN_API_KEY,
  STORAGE_BUCKET_ID,
  AUDIBLE_OPDS_API_KEY,
  AUDIBLE_OPDS_FIREBASE_URL,
  HOSTING_DOMAIN,
  AAX_CONNECT_SOURCE,
  GEMINI_API_KEY,
  STABILITY_API_KEY_1,
  STABILITY_API_KEY_2,
  STABILITY_API_KEY_3,
  STABILITY_API_KEY_4,
  STABILITY_API_KEY_5,
  STABILITY_API_KEY_6,
  STABILITY_API_KEY_7,
  STABILITY_API_KEY_8,
  STABILITY_API_KEY_9,
  STABILITY_API_KEY_10,
  MOCK_LLM,
};

