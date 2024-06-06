/* eslint-disable no-unused-vars */
import {defineSecret, defineString} from "firebase-functions/params";

const ENVIRONMENT = defineString("ENVIRONMENT");
const OPENAI_API_KEY = defineString("OPENAI_API_KEY");


// SECRETS - warning: https://firebase.google.com/docs/functions/config-env?gen=2nd#node.js_6
// I think secrets are broken on test so not using it for now.
// const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// for testing: https://github.com/firebase/firebase-functions-test/issues/196#issuecomment-1900541854
export {
  OPENAI_API_KEY,
  ENVIRONMENT,
};

