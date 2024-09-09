/* eslint-disable require-jsdoc */

// eslint-disable-next-line no-unused-vars
import {getDatabase, getDatabaseWithUrl} from "firebase-admin/database";
import logger from "firebase-functions/logger";
// import app from "../../firebase.js";
let db;
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
  logger.debug(`Using database emulator with URL: ${process.env.FIREBASE_DATABASE_EMULATOR_HOST}`);
  db = getDatabaseWithUrl(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}`);
} else {
  db = getDatabase();
}

async function storeData({ref, data}) {
  // const db = getDatabase();
  await db.ref(ref).set(data);
}

async function getData({ref}) {
  // const db = getDatabase();
  const snapshot = await db.ref(ref).get();
  return snapshot.val();
}

async function deleteData({ref}) {
  // const db = getDatabase();
  await db.ref(ref).remove();
}

async function deleteAllData() {
  // const db = getDatabase();
  await db.ref().remove();
}

export {
  storeData,
  getData,
  deleteData,
  deleteAllData,
};
