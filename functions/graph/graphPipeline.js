
/* eslint-disable require-jsdoc */
import {
  getGraph,
  createGraph,
  updateGraphStatus,
  updateGraph,
} from "../storage/firestore/graph.js";

import {
  queueAddEntries,
  queueGetEntries,
  queueSetItemsToProcessing,
  queueSetItemsToComplete,
} from "../storage/firestore/queue.js";

import {
  scenesCreateDefaultCatalogueFirestore,
} from "../storage/firestore/scenes.js";

import {
  graphCharacters,
  graphLocations,
  graphCharacterDescriptionsOAI,
  graphLocationDescriptionsOAI,
  graphSummarizeDescriptions,
  graphScenes,
  augmentScenesOAI,
} from "../ai/graph.js";

import {
  dispatchTask,
} from "../util/dispatch.js";

import logger from "../util/logger.js";

const PipelineSteps = {
  CHARACTERS: "characters",
  LOCATIONS: "locations",
  CHARACTER_DESCRIPTIONS: "characterDescriptions",
  LOCATION_DESCRIPTIONS: "locationDescriptions",
  SUMMARIZE_DESCRIPTIONS: "summarizeDescriptions",
  GENERATE_SCENES: "generateScenes",
  AUGMENT_SCENES_OAI: "augmentScenesOai",
  CREATE_DEFAULT_SCENE: "createDefaultScene",
  GENERATE_IMAGES: "generateImages",
};

Object.freeze(PipelineSteps);


// graph pipeline is:
// 1. characters
// 2. locations
// 3. character descriptions
// 4. location descriptions
// 5. summarize descriptions
// 6. generate scenes
// 7. augment scenes oai
// 8. Create default scene
// 9. generate images for each chapter of default scene.

function graphQueueToUnique(params) {
  const {type, entryType, graphId, retry = false, chapter} = params;
  // Check if any of the required parameters are undefined
  if (type === undefined || entryType === undefined || graphId === undefined ) {
    throw new Error("All parameters (type, entryType, graphId, stage) must be defined");
  }

  // If all parameters are defined, return a unique identifier
  const retryString = retry ? "_retry" : "";
  const chapterString = chapter ? `_${chapter}` : "";
  return `${type}_${entryType}_${graphId}${chapterString}${retryString}`;
}

async function generateNewGraph({uid, catalogueId, sku, visibility, numChapters}) {
  const newGraph = await createGraph({uid, catalogueId, sku, visibility, numChapters});
  await addItemToQueue({entryType: PipelineSteps.CHARACTERS, graphItem: newGraph});
  return newGraph;
}

async function continueGraphPipeline({graphId}) {
  const graphItem = await getGraph({graphId});
  if (!graphItem) {
    throw new Error("Graph does not exist");
  }
  const nextStep = graphItem.nextGraphStep;
  if (!nextStep) {
    throw new Error("Graph pipeline is not continuing");
  }
  await addItemToQueue({entryType: nextStep, graphItem: graphItem, retry: true});
}

async function addItemToQueue({entryType, graphItem, retry = false}) {
  await queueAddEntries({
    types: ["graph"],
    entryTypes: [entryType],
    entryParams: [{retry, ...graphItem}],
    uniques: [graphQueueToUnique({
      type: "graph",
      entryType: entryType,
      graphId: graphItem.id,
      chapter: graphItem.chapter,
    })],
  });
}

async function graphQueue() {
  const queue = await queueGetEntries({type: "graph", status: "pending", limit: 1});
  if (queue.length === 0) {
    logger.debug("graphQueue: No items in the queue");
    return;
  }
  // 2. set those items to processing.
  await queueSetItemsToProcessing({queue});
  const graphItem = queue[0].params;
  let defaultScene;
  // 3. process the items.
  switch (queue[0].entryType) {
    case PipelineSteps.CHARACTERS:
      logger.debug(`Generating Characters for ${JSON.stringify(graphItem)}`);
      await graphCharacters({uid: graphItem.uid, sku: graphItem.sku, visibility: graphItem.visibility, graphId: graphItem.id});
      await updateGraph({
        graphData: updateGraphStatus({
          graphItem, statusName: PipelineSteps.CHARACTERS,
          statusValue: "complete",
          nextGraphStep: PipelineSteps.LOCATIONS},
        )});
      await addItemToQueue({entryType: PipelineSteps.LOCATIONS, graphItem});
      break;
    case PipelineSteps.LOCATIONS:
      logger.debug(`Generating Locations for ${JSON.stringify(graphItem)}`);
      await graphLocations({uid: graphItem.uid, sku: graphItem.sku, visibility: graphItem.visibility, graphId: graphItem.id});
      await updateGraph({graphData: updateGraphStatus({
        graphItem,
        statusName: PipelineSteps.LOCATIONS,
        statusValue: "complete",
        nextGraphStep: PipelineSteps.CHARACTER_DESCRIPTIONS})});
      await addItemToQueue({entryType: PipelineSteps.CHARACTER_DESCRIPTIONS, graphItem});
      break;
    case PipelineSteps.CHARACTER_DESCRIPTIONS:
      logger.debug(`Generating Character Descriptions for ${JSON.stringify(graphItem)}`);
      await graphCharacterDescriptionsOAI({uid: graphItem.uid, sku: graphItem.sku, visibility: graphItem.visibility, graphId: graphItem.id});
      await updateGraph({graphData: updateGraphStatus({
        graphItem,
        statusName: PipelineSteps.CHARACTER_DESCRIPTIONS,
        statusValue: "complete",
        nextGraphStep: PipelineSteps.LOCATION_DESCRIPTIONS})});
      await addItemToQueue({entryType: PipelineSteps.LOCATION_DESCRIPTIONS, graphItem});
      break;
    case PipelineSteps.LOCATION_DESCRIPTIONS:
      logger.debug(`Generating Location Descriptions for ${JSON.stringify(graphItem)}`);
      await graphLocationDescriptionsOAI({uid: graphItem.uid, sku: graphItem.sku, visibility: graphItem.visibility, graphId: graphItem.id});
      await updateGraph({graphData: updateGraphStatus({
        graphItem,
        statusName: PipelineSteps.LOCATION_DESCRIPTIONS,
        statusValue: "complete",
        nextGraphStep: PipelineSteps.SUMMARIZE_DESCRIPTIONS,
      })});
      await addItemToQueue({entryType: PipelineSteps.SUMMARIZE_DESCRIPTIONS, graphItem});
      break;
    case PipelineSteps.SUMMARIZE_DESCRIPTIONS:
      logger.debug(`Summarizing Descriptions for ${JSON.stringify(graphItem)}`);
      await graphSummarizeDescriptions({uid: graphItem.uid, sku: graphItem.sku, visibility: graphItem.visibility, graphId: graphItem.id});
      await updateGraph({graphData: updateGraphStatus({
        graphItem,
        statusName: PipelineSteps.SUMMARIZE_DESCRIPTIONS,
        statusValue: "complete",
        nextGraphStep: PipelineSteps.GENERATE_SCENES,
      })});
      graphItem.chapter = 0;
      await addItemToQueue({entryType: PipelineSteps.GENERATE_SCENES, graphItem});
      break;
    case PipelineSteps.GENERATE_SCENES:
      logger.debug(`Generating Scenes for ${JSON.stringify(graphItem)}`);
      await graphScenes({uid: graphItem.uid, sku: graphItem.sku, visibility: graphItem.visibility, graphId: graphItem.id, chapter: graphItem.chapter});
      if (graphItem.chapter < graphItem.numChapters) {
        graphItem.chapter = graphItem.chapter + 1;
        await addItemToQueue({entryType: PipelineSteps.GENERATE_SCENES, graphItem});
      } else {
        await updateGraph({graphData: updateGraphStatus({
          graphItem,
          statusName: PipelineSteps.GENERATE_SCENES,
          statusValue: "complete",
          nextGraphStep: PipelineSteps.AUGMENT_SCENES_OAI,
        })});
        graphItem.chapter = 0;
        await addItemToQueue({entryType: PipelineSteps.AUGMENT_SCENES_OAI, graphItem});
      }
      break;
    case PipelineSteps.AUGMENT_SCENES_OAI:
      logger.debug(`Augmenting Scenes for ${JSON.stringify(graphItem)}`);
      await augmentScenesOAI({uid: graphItem.uid, sku: graphItem.sku, visibility: graphItem.visibility, graphId: graphItem.id, chapter: graphItem.chapter});
      if (graphItem.chapter < graphItem.numChapters) {
        graphItem.chapter = graphItem.chapter + 1;
        await addItemToQueue({entryType: PipelineSteps.AUGMENT_SCENES_OAI, graphItem});
      } else {
        await updateGraph({graphData: updateGraphStatus({
          graphItem,
          statusName: PipelineSteps.AUGMENT_SCENES_OAI,
          statusValue: "complete",
          nextGraphStep: PipelineSteps.CREATE_DEFAULT_SCENE,
        })});
        await addItemToQueue({entryType: PipelineSteps.CREATE_DEFAULT_SCENE, graphItem});
      }
      break;
    case PipelineSteps.CREATE_DEFAULT_SCENE:
      logger.debug(`Creating Default Scene for ${JSON.stringify(graphItem)}`);
      defaultScene = await scenesCreateDefaultCatalogueFirestore({
        uid: graphItem.uid,
        sku: graphItem.sku,
        visibility: graphItem.visibility,
        graphId: graphItem.id,
        catalogueId: graphItem.catalogueId,
      });
      graphItem.defaultSceneId = defaultScene.id;
      await updateGraph({graphData: updateGraphStatus({
        graphItem,
        statusName: PipelineSteps.CREATE_DEFAULT_SCENE,
        statusValue: "complete",
        nextGraphStep: PipelineSteps.GENERATE_IMAGES,
      })});
      await addItemToQueue({entryType: PipelineSteps.GENERATE_IMAGES, graphItem});
      break;
  }
  // 4. set the items to complete.
  await queueSetItemsToComplete({queue});
  // relaunch the queue via dispatch.
  await dispatchTask({functionName: "graphPipeline", data: {}});
}


export {
  generateNewGraph,
  graphQueue,
  continueGraphPipeline,
};
