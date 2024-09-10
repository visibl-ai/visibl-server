/* eslint-disable require-jsdoc */

// eslint-disable-next-line no-unused-vars
import {getDatabase, getDatabaseWithUrl} from "firebase-admin/database";
import logger from "../../util/logger.js";
import app from "../../firebase.js";

let dbGlobal = null;

function getDb() {
  if (!dbGlobal) {
    if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
      logger.debug(`Using database emulator with URL: ${process.env.FIREBASE_DATABASE_EMULATOR_HOST}`);
      dbGlobal = getDatabaseWithUrl(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}`);
    } else {
      dbGlobal = getDatabase(app);
    }
  }
  return dbGlobal;
}

async function storeData({ref, data}) {
  const db = getDb();
  await db.ref(ref).set(data);
}

async function getData({ref}) {
  const db = getDb();
  const snapshot = await db.ref(ref).get();
  return snapshot.val();
}

async function deleteData({ref}) {
  const db = getDb();
  await db.ref(ref).remove();
}

async function deleteAllData() {
  const db = getDb();
  await db.ref().remove();
}

export {
  storeData,
  getData,
  deleteData,
  deleteAllData,
};
