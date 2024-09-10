import {logger as firebaseLogger} from "firebase-functions/v2";
import devConsole from "./_console.js";

const logger = process.env.ENVIRONMENT === "development" ? devConsole : firebaseLogger;

export default logger;
