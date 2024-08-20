/**
 * Finds the scene that is currently playing based on the current time.
 * @param {Object} fullScenes - The full scenes object.
 * @param {number} currentTime - The current time in seconds.
 * @return {Object|null} - The scene object if found, null otherwise.
 */
function sceneFromCurrentTime(fullScenes, currentTime) {
  for (const [chapter, scenes] of Object.entries(fullScenes)) {
    for (const scene of scenes) {
      if (currentTime >= scene.startTime && currentTime < scene.endTime) {
        return {chapter: parseInt(chapter), sceneNumber: scene.scene_number};
      }
    }
  }
  return null; // If no matching scene is found
}

/**
 * Generates a list of scenes to generate from the current scene.
 * @param {Object} fullScenes - The full scenes object.
 * @param {number} currentSceneNumber - The current scene number.
 * @param {number} currentChapter - The current chapter.
 * @return {Array} - The list of scenes to generate.
 */
function scenesToGenerateFromCurrentTime({currentSceneNumber, currentChapter, fullScenes}) {
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
  for (let i = 2; i > 0; i--) {
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
  let remainingScenes = 10;
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

export {sceneFromCurrentTime, scenesToGenerateFromCurrentTime};
