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

async function getGraphFirestore({graphId, catalogueId, sku}) {
  if (!catalogueId && !sku && !graphId) {
    throw new Error("catalogueId or sku or graphId is required");
  }
  const db = getFirestore();
  if (graphId) {
    const graphRef = db.collection("Graphs").doc(graphId);
    const graph = await graphRef.get();
    return {
      id: graph.id,
      ...graph.data(),
    };
  } else if (catalogueId) {
    const graphs = await db.collection("Graphs")
        .where("catalogueId", "==", catalogueId)
        .where("sku", "==", sku)
        .get();
    return graphs.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } else if (sku) {
    const graphs = await db.collection("Graphs")
        .where("sku", "==", sku)
        .get();
    return graphs.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }
}

function updateGraphStatus({graphItem, statusName, statusValue, nextGraphStep}) {
  if (!graphItem) {
    throw new Error("Graph does not exist");
  }
  if (!graphItem.progress) {
    graphItem.progress = {};
  }
  graphItem.progress[statusName] = statusValue;
  graphItem.nextGraphStep = nextGraphStep;
  return graphItem;
}

async function updateGraph({graphData}) {
  const db = getFirestore();
  const graphRef = db.collection("Graphs").doc(graphData.id);
  await graphRef.update(graphData);
}

export {
  createGraph,
  deleteGraph,
  getGraphFirestore,
  updateGraphStatus,
  updateGraph,
};
