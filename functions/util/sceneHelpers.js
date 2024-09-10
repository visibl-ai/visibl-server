const PRECEDING_SCENES = 2;
const FOLLOWING_SCENES = 10;
/**
 * Finds the scene that is currently playing based on the current time.
 * @param {Object} fullScenes - The full scenes object.
 * @param {number} currentTime - The current time in seconds.
 * @return {Object|null} - The scene object if found, null otherwise.
 */
function sceneFromCurrentTime(fullScenes, currentTime) {
  let nearestScene = null;
  let minTimeDifference = Infinity;
  for (const [chapter, scenes] of Object.entries(fullScenes)) {
    for (const scene of scenes) {
      if (currentTime >= scene.startTime && currentTime < scene.endTime) {
        return {chapter: parseInt(chapter), sceneNumber: scene.scene_number};
      }
      // Calculate the time difference to the start of the scene
      const timeDifference = Math.abs(currentTime - scene.startTime);
      if (timeDifference < minTimeDifference) {
        minTimeDifference = timeDifference;
        nearestScene = {chapter: parseInt(chapter), sceneNumber: scene.scene_number};
      }
    }
  }

  return nearestScene; // Return the nearest scene if no exact match is found
}

/**
 * Generates a list of scenes to generate from the current scene.
 * @param {Object} fullScenes - The full scenes object.
 * @param {number} currentSceneNumber - The current scene number.
 * @param {number} currentChapter - The current chapter.
 * @return {Array} - The list of scenes to generate.
 */
function scenesToGenerateFromCurrentTime({
  currentSceneNumber,
  currentChapter,
  fullScenes,
  precedingScenes = PRECEDING_SCENES,
  followingScenes = FOLLOWING_SCENES,
}) {
  const result = [];
  const chapters = Object.keys(fullScenes).map(Number).sort((a, b) => a - b);
  const currentChapterIndex = chapters.indexOf(currentChapter);

  /**
   * Adds a scene to the result if it exists.
   * @param {number} chapter - The chapter number.
   * @param {number} sceneNumber - The scene number.
   */
  function addScene(chapter, sceneNumber) {
    if (fullScenes[chapter] && fullScenes[chapter][sceneNumber]) {
      result.push({chapter, scene_number: sceneNumber});
    }
  }

  // Add 2 scenes before
  for (let i = precedingScenes; i > 0; i--) {
    if (currentSceneNumber - i >= 0) {
      addScene(currentChapter, currentSceneNumber - i);
    } else if (currentChapterIndex > 0) {
      const prevChapter = chapters[currentChapterIndex - 1];
      const prevChapterLastScene = fullScenes[prevChapter].length - 1;
      addScene(prevChapter, prevChapterLastScene - (i - currentSceneNumber - 1));
    }
  }

  // Add current scene
  addScene(currentChapter, currentSceneNumber);

  // Add 10 scenes after
  let remainingScenes = followingScenes;
  let nextChapter = currentChapter;
  let nextScene = currentSceneNumber + 1;

  while (remainingScenes > 0 && nextChapter !== undefined) {
    if (fullScenes[nextChapter] && fullScenes[nextChapter][nextScene]) {
      addScene(nextChapter, nextScene);
      nextScene++;
      remainingScenes--;
    } else {
      const nextChapterIndex = chapters.indexOf(nextChapter) + 1;
      nextChapter = chapters[nextChapterIndex];
      nextScene = 0;
    }
  }

  return result;
}

/**
 * Generates a list of scenes to generate from the current scene.
 * @param {Object} fullScenes - The full scenes object.
 * @param {number} currentSceneNumber - The current scene number.
 * @param {number} currentChapter - The current chapter.
 * @return {Array} - The list of scenes to generate.
 */
function scenesFromCurrentTime({
  currentSceneNumber,
  currentChapter,
  fullScenes,
  precedingScenes = PRECEDING_SCENES,
  followingScenes = FOLLOWING_SCENES,
}) {
  const returnScenes = [];
  const scenesToPopulate = scenesToGenerateFromCurrentTime({
    currentSceneNumber,
    currentChapter,
    fullScenes,
    precedingScenes,
    followingScenes,
  });
  for (const sceneToPopulate of scenesToPopulate) {
    const chapterScenes = fullScenes[sceneToPopulate.chapter];
    if (chapterScenes) {
      const scene = chapterScenes.find((s) => s.scene_number === sceneToPopulate.scene_number);
      if (scene) {
        scene.chapter = sceneToPopulate.chapter;
        returnScenes.push(scene);
      }
    }
  }
  return returnScenes;
}

/**
 * Gets the adjacent scenes to the given sceneId.
 * @param {Array} scenesList - The list of scenes.
 * @param {string} sceneId - The id of the scene to get the adjacent scenes for.
 * @param {number} adjacentCount - The number of adjacent scenes to get.
 * @return {Array} - The list of adjacent scenes.
 */
function getAdjacentScenes({scenesList, sceneId, adjacentCount = 5}) {
  const index = scenesList.findIndex((scene) => scene.id === sceneId);
  if (index === -1) return [];

  const result = [];

  for (let i = index - adjacentCount; i < index + adjacentCount + 1; i++) {
    const wrappedIndex = (i + scenesList.length) % scenesList.length;
    result.push(scenesList[wrappedIndex]);
  }
  return result;
}

/**
 * Sanitizes the scenes for the cache.
 * @param {Object} scenes - The scenes object.
 * @return {Object} - The sanitized scenes object.
 */
function sanitizeSceneForCache(scenes) {
  const sanitizedScenes = {};
  for (const [chapter, chapterScenes] of Object.entries(scenes)) {
    sanitizedScenes[chapter] = chapterScenes.map((scene) => {
      const sanitizedScene = {};
      if (scene.startTime !== undefined) sanitizedScene.startTime = scene.startTime;
      if (scene.endTime !== undefined) sanitizedScene.endTime = scene.endTime;
      if (scene.scene_number !== undefined) sanitizedScene.scene_number = scene.scene_number;
      if (scene.image !== undefined) sanitizedScene.image = scene.image;
      if (scene.prompt !== undefined) sanitizedScene.prompt = scene.prompt;
      if (scene.sceneId !== undefined) sanitizedScene.sceneId = scene.sceneId;
      if (chapter !== undefined) sanitizedScene.chapter = parseInt(chapter);
      return sanitizedScene;
    });
  }
  return sanitizedScenes;
}

export {
  sceneFromCurrentTime,
  scenesToGenerateFromCurrentTime,
  getAdjacentScenes,
  scenesFromCurrentTime,
  sanitizeSceneForCache,
};
