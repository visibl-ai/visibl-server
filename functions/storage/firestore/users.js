/* eslint-disable require-jsdoc */
import {
  getFirestore} from "firebase-admin/firestore";

const AAX_ACTIVE_DEFAULT = true;

async function getAAXAvailableFirestore(uid) {
  const snapshot = await getFirestore().collection("AAXActive").doc(uid).get();
  return snapshot.exists ? snapshot.data().active : AAX_ACTIVE_DEFAULT;
}

async function setAAXAvailableFirestore(req) {
  await getFirestore().collection("AAXActive").doc(req.body.uid).set({active: req.body.active});
  return {active: req.body.active, uid: req.body.uid};
}

export {
  getAAXAvailableFirestore,
  setAAXAvailableFirestore,
};

