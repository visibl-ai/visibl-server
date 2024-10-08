/* eslint-disable require-jsdoc */
import {storeData, getData} from "./database.js";
import {getScene} from "../storage.js";
import {getCatalogueScenesFirestore} from "../firestore/scenes.js";
import {sanitizeSceneForCache} from "../../util/sceneHelpers.js";

function sceneToDbRef({sceneId}) {
  return `scenes/${sceneId}`;
}

async function storeScenesInCache(params) {
  let {scenes, catalogueId} = params.body;
  if (!catalogueId && !scenes) {
    throw new Error("storeScenesInCache: catalogueId is required");
  }
  if (!scenes || scenes.length === 0) {
    scenes = await getCatalogueScenesFirestore({catalogueId});
  }
  for (const scene of scenes) {
    try {
      let thisScene = await getScene({sceneId: scene.id});
      thisScene = sanitizeSceneForCache(thisScene);
      const dbRef = sceneToDbRef({sceneId: scene.id});
      await storeData({ref: dbRef, data: thisScene});
    } catch (error) {
      console.error(`Error storing scene ${scene.id} in cache:`, error);
    }
  }
  return;
}

async function storeSceneInCacheFromMemory({sceneId, sceneData}) {
  const dbRef = sceneToDbRef({sceneId});
  await storeData({ref: dbRef, data: sanitizeSceneForCache(sceneData)});
}

async function getScenesFromCache({sceneId}) {
  const dbRef = sceneToDbRef({sceneId});
  const scenes = await getData({ref: dbRef});
  return scenes;
}

export {
  storeScenesInCache,
  getScenesFromCache,
  storeSceneInCacheFromMemory,
};
