/* eslint-disable require-jsdoc */
import {
  getFirestore} from "firebase-admin/firestore";
import {removeUndefinedProperties} from "../firestore.js";

import logger from "firebase-functions/logger";

async function queueNuke() {
  const db = getFirestore();
  const queueRef = db.collection("Queue");
  const snapshot = await queueRef.get();

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  logger.debug(`Nuked ${snapshot.size} entries from the queue`);
  return {success: true, deletedCount: snapshot.size};
}

async function queueAddEntries(params) {
  const {types, entryTypes, entryParams, statuses = [], traces = []} = params;
  const db = getFirestore();
  const queueRef = db.collection("Queue");
  const batch = db.batch();

  for (let i = 0; i < types.length; i++) {
    const now = Date.now();
    const entry = {
      type: types[i],
      entryType: entryTypes[i],
      params: entryParams[i],
      status: statuses[i] || "pending",
      trace: traces[i] || `Added to queue at ${now.toString()}`,
      timeRequested: now,
      timeUpdated: now,
    };
    const docRef = queueRef.doc();
    batch.set(docRef, entry);
  }
  await batch.commit();
  logger.debug(`Added ${types.length} entries to the queue`);
  return {success: true};
}


async function queueGetEntries(params) {
  const {type, status, limit} = params;
  logger.debug(`Getting entries from the queue with type: ${type}, status: ${status}, limit: ${limit}`);
  const db = getFirestore();
  const queueRef = db.collection("Queue");
  let query = queueRef
      .where("type", "==", type)
      .orderBy("timeRequested", "asc")
      .limit(limit);
  if (status) {
    query = query.where("status", "==", status);
  }
  const snapshot = await query.get();
  const entries = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  logger.debug(`Got ${entries.length} entries from the queue for type: ${type}, status: ${status}, limit: ${limit}`);
  return entries;
}

async function queueUpdateEntries(params) {
  const {ids, statuses, traces = [], results = []} = params;
  const db = getFirestore();
  const queueRef = db.collection("Queue");
  const batch = db.batch();

  for (let i = 0; i < ids.length; i++) {
    const docRef = queueRef.doc(ids[i]);
    const updateData = {
      status: statuses[i],
      timeUpdated: Date.now(),
    };
    if (traces[i]) {
      updateData.trace = traces[i];
    }
    if (results[i]) {
      updateData.result = removeUndefinedProperties(results[i]);
    }
    batch.update(docRef, updateData);
  }
  await batch.commit();
  logger.debug(`Updated ${ids.length} entries in the queue`);
  return {success: true};
}

async function queueSetItemStatuses(params) {
  const {queue, status} = params;
  const updateParams = {
    ids: queue.map((entry) => entry.id),
    statuses: Array(queue.length).fill(status),
  };
  await queueUpdateEntries(updateParams);
}

async function queueSetItemsToProcessing(params) {
  params.status = "processing";
  await queueSetItemStatuses(params);
}

async function queueSetItemsToComplete(params) {
  params.status = "complete";
  await queueSetItemStatuses(params);
}


export {
  queueAddEntries,
  queueGetEntries,
  queueUpdateEntries,
  queueNuke,
  queueSetItemsToProcessing,
  queueSetItemsToComplete,
};
