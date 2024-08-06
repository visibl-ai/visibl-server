/* eslint-disable require-jsdoc */
import {
  getFirestore} from "firebase-admin/firestore";

import logger from "firebase-functions/logger";

import {
  AAX_CONNECT_SOURCE,
} from "../../config/config.js";

const AAX_ACTIVE_DEFAULT = true;


async function getAAXAvailableFirestore(uid) {
  const snapshot = await getFirestore().collection("AAXActive").doc(uid).get();
  const active = snapshot.exists ? snapshot.data().active : AAX_ACTIVE_DEFAULT;
  if (active) {
    return {active: active, source: AAX_CONNECT_SOURCE.value()};
  }
  return {active: active};
}

async function setAAXAvailableFirestore(req) {
  await getFirestore().collection("AAXActive").doc(req.body.uid).set({active: req.body.active});
  return {active: req.body.active, uid: req.body.uid};
}

async function getAAXConnectStatusFirestore(uid) {
  const db = getFirestore();
  logger.debug(`getAAXConnectStatusFirestore: ${uid}`);
  const authRef = db.collection("AAXAuth").where("uid", "==", uid);
  const snapshot = await authRef.get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      connected: true,
      lastUpdated: data.lastUpdated ? data.lastUpdated.toDate() : null,
      accountOwner: data.auth.customer_info.name,
      source: AAX_CONNECT_SOURCE.value(),
    };
  } else {
    return {
      connected: false,
    };
  }
}

async function setAAXConnectDisableFirestore(uid) {
  const db = getFirestore();
  logger.debug(`setAAXConnectDisableFirestore: ${uid}`);
  const authRef = db.collection("AAXAuth").where("uid", "==", uid);
  const snapshot = await authRef.get();
  if (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    logger.info(`Deleted ${snapshot.docs.length} AAX connection(s) for user: ${uid}`);
    return {deletedCount: snapshot.docs.length};
  } else {
    logger.info(`No AAX connection found for user: ${uid}`);
    return {deletedCount: 0};
  }
}

export {
  getAAXAvailableFirestore,
  setAAXAvailableFirestore,
  getAAXConnectStatusFirestore,
  setAAXConnectDisableFirestore,
};
