/* eslint-disable camelcase */
/* eslint-disable require-jsdoc */
import {
  getFirestore} from "firebase-admin/firestore";
import {removeUndefinedProperties} from "../firestore.js";

import logger from "../../util/logger.js";

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

function stabilityQueueToUnique(params) {
  const {type, entryType, sceneId, chapter, scene_number, retry = false} = params;
  // Check if any of the required parameters are undefined
  if (type === undefined || entryType === undefined || sceneId === undefined ||
      chapter === undefined || scene_number === undefined) {
    throw new Error("All parameters (type, entryType, sceneId, chapter, scene_number) must be defined");
  }

  // If all parameters are defined, return a unique identifier
  const retryString = retry ? "_retry" : "";
  return `${type}_${entryType}_${sceneId}_${chapter}_${scene_number}${retryString}`;
}

function dalleQueueToUnique(params) {
  const {type, entryType, sceneId, chapter, scene_number, retry = false} = params;
  // Check if any of the required parameters are undefined
  if (type === undefined || entryType === undefined || sceneId === undefined ||
      chapter === undefined || scene_number === undefined) {
    throw new Error("All parameters (type, entryType, sceneId, chapter, scene_number) must be defined");
  }

  // If all parameters are defined, return a unique identifier
  const retryString = retry ? "_retry" : "";
  return `${type}_${entryType}_${sceneId}_${chapter}_${scene_number}${retryString}`;
}

function deduplicateEntries(params) {
  const {types, entryTypes, entryParams, uniques, statuses = [], traces = []} = params;
  // Ensure that types, entryTypes, entryParams and unique are not null
  if (!types || !entryTypes || !entryParams || !uniques) {
    throw new Error("types, entryTypes, entryParams, and unique must not be null");
  }
  // Check for duplicates in uniques and remove them along with corresponding entries
  const uniqueSet = new Set();
  const indicesToRemove = [];

  for (let i = uniques.length - 1; i >= 0; i--) {
    if (uniqueSet.has(uniques[i])) {
      indicesToRemove.push(i);
    } else {
      uniqueSet.add(uniques[i]);
    }
  }

  for (const index of indicesToRemove) {
    types.splice(index, 1);
    entryTypes.splice(index, 1);
    entryParams.splice(index, 1);
    uniques.splice(index, 1);
    if (statuses.length > 0) statuses.splice(index, 1);
    if (traces.length > 0) traces.splice(index, 1);
  }

  if (indicesToRemove.length > 0) {
    logger.debug(`Removed ${indicesToRemove.length} duplicate entries`);
  }
  return {types, entryTypes, entryParams, uniques, statuses, traces};
}

async function queueAddEntries(params) {
  const {types, entryTypes, entryParams, uniques, statuses = [], traces = []} = deduplicateEntries(params);
  const db = getFirestore();
  const queueRef = db.collection("Queue");
  const batch = db.batch();
  const entriesAdded = [];
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
    const docRef = queueRef.doc(uniques[i]);
    const docSnapshot = await docRef.get();
    if (!docSnapshot.exists) {
      batch.create(docRef, entry);
      entriesAdded.push(entry);
    } else {
      logger.debug(`Entry ${uniques[i]} already exists in the queue, not re-adding.`);
    }
  }
  try {
    await batch.commit();
    logger.debug(`Added ${entriesAdded.length} entries to the queue`);
    return {success: true};
  } catch (error) {
    logger.error(`Failed to commit batch: ${error.message} ${JSON.stringify(entriesAdded)}`);
    return {success: false};
  }
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
  stabilityQueueToUnique,
  dalleQueueToUnique,
};
