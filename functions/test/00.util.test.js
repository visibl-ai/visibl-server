import {expect} from "chai";
import {sceneFromCurrentTime, scenesToGenerateFromCurrentTime} from "../util/sceneHelpers.js";
import dotenv from "dotenv";
dotenv.config({path: ".env.local"});
import fs from "fs";
const fullScenes = JSON.parse(fs.readFileSync(`./test/bindings/scenes/${process.env.PUBLIC_SKU1}-scenes-graph.json`, "utf8"));
// eslint-disable-next-line no-undef
describe("Scene Helpers", () => {
  // eslint-disable-next-line no-undef
  describe("sceneFromCurrentTime", () => {
    // eslint-disable-next-line no-undef
    it("should return the correct scene for a given time", () => {
      const result = sceneFromCurrentTime(fullScenes, 2.5);
      expect(result).to.deep.equal({chapter: 0, sceneNumber: 0});
    });

    // eslint-disable-next-line no-undef
    it("should return null if no scene is found", () => {
      const result = sceneFromCurrentTime(fullScenes, 100000);
      expect(result).to.deep.equal({chapter: 30, sceneNumber: 47});
    });
  });

  // eslint-disable-next-line no-undef
  describe("scenesToGenerateFromCurrentTime", () => {
    // eslint-disable-next-line no-undef
    it("should return correct scenes when in the middle of a chapter", () => {
      const result = scenesToGenerateFromCurrentTime({
        currentSceneNumber: 1,
        currentChapter: 4,
        fullScenes,
      });

      expect(result).to.have.lengthOf(13);
      expect(result[0]).to.deep.equal({chapter: 3, scene_number: 174});
      expect(result[1]).to.deep.equal({chapter: 4, scene_number: 0});
      expect(result[2]).to.deep.equal({chapter: 4, scene_number: 1});
      // Check the last scene in the result
      expect(result[12]).to.deep.equal({chapter: 4, scene_number: 11});
    });

    // eslint-disable-next-line no-undef
    it("should handle scenes at the beginning of a novel", () => {
      const result = scenesToGenerateFromCurrentTime({
        currentSceneNumber: 0,
        currentChapter: 0,
        fullScenes,
      });

      expect(result).to.have.lengthOf(11);
      expect(result[0]).to.deep.equal({chapter: 0, scene_number: 0});
      expect(result[1]).to.deep.equal({chapter: 1, scene_number: 0});
      expect(result[2]).to.deep.equal({chapter: 2, scene_number: 0});
    });

    // eslint-disable-next-line no-undef
    it("should handle scenes at the end of a chapter", () => {
      const lastChapter = Math.max(...Object.keys(fullScenes).map(Number)) - 1;
      const lastScene = fullScenes[lastChapter].length - 1;

      const result = scenesToGenerateFromCurrentTime({
        currentSceneNumber: lastScene,
        currentChapter: lastChapter,
        fullScenes,
      });

      expect(result.length).to.be.at.most(13);
      expect(result[0].chapter).to.equal(lastChapter);
      expect(result[0].scene_number).to.equal(lastScene - 2);
      expect(result[1]).to.deep.equal({chapter: lastChapter, scene_number: lastScene - 1});
      expect(result[2]).to.deep.equal({chapter: lastChapter, scene_number: lastScene});
      expect(result[3]).to.deep.equal({chapter: lastChapter+1, scene_number: 0});
    });
  });
});
