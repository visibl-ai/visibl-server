/* eslint-disable camelcase */
/* eslint-disable require-jsdoc */
import {
  getFirestore} from "firebase-admin/firestore";
// import {removeUndefinedProperties} from "../firestore.js";
import logger from "../../util/logger.js";


// A graph will have a unique id.
// It will reference a specific catalogueId, and SKU
// It will be created by a createdBy: uid
// It will then have a path in storage /Graphs/${graphId}/specificGraph.json
// The final output of the graph is the scenes.json file.
// And the final step of graph creation is to make the default scene
// With all the images from that default scene. All styles are a derivative of that scene

async function createGraph({uid, catalogueId, sku, numChapters, visibility}) {
  if (!uid || !catalogueId || !sku) {
    throw new Error("createGraph: Missing parameters");
  }
  logger.debug(`createGraph: Creating graph for uid: ${uid}, catalogueId: ${catalogueId}, sku: ${sku}, numChapters: ${numChapters}, visibility: ${visibility}`);
  const db = getFirestore();
  const newGraph = {
    uid,
    catalogueId,
    sku,
    createdAt: new Date(),
    updatedAt: new Date(),
    visibility,
    numChapters,
  };
  const docRef = await db.collection("Graphs").add(newGraph);
  const addedDoc = await docRef.get();
  return {
    id: addedDoc.id,
    ...addedDoc.data(),
  };
}

async function deleteGraph() {
  // const db = getFirestore();
}

async function getGraph() {
  // const db = getFirestore();
}

async function updateGraphStatus({graphId, statusName, statusValue, nextGraphStep}) {
  const db = getFirestore();
  const graphRef = db.collection("Graphs").doc(graphId);
  const graph = await graphRef.get();
  if (!graph.exists) {
    throw new Error("Graph does not exist");
  }
  const graphData = graph.data();
  if (!graphData.progress) {
    graphData.progress = {};
  }
  graphData.progress[statusName] = statusValue;
  graphData.nextGraphStep = nextGraphStep;
  await graphRef.update(graphData);
}

export {
  createGraph,
  deleteGraph,
  getGraph,
  updateGraphStatus,
};
