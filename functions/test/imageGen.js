/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable max-len */

import dotenv from "dotenv";
import chai from "chai";
import chaiHttp from "chai-http";

chai.use(chaiHttp);
const expect = chai.expect;
import fs from "fs";

const TEST = false;
let APP_URL = `http://127.0.0.1:5002/v1/admin/ai/generateSceneImages`;
if (TEST) {
  dotenv.config({path: ".env.local"}); // because firebase-functions-test doesn't work with conf.
} else {
  dotenv.config({path: ".env.visibl-dev-ali"}); // because firebase-functions-test doesn't work with conf.
  // APP_URL = `https://visibl-dev-ali.firebaseapp.com`;
  APP_URL = `https://v1generatesceneimages-4f33egefga-ew.a.run.app`;
}

describe("Image Gen", () => {
  it("should generate images for the chapter", async () => {
    const metadataPath = "./test/bindings/metadata/Neuromancer_ Sprawl Trilogy, Book 1.json";
    const bookData = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const scenesPath = "./test/bindings/scenes/transcript_ch1_scenes_images.json";
    let scenes = JSON.parse(fs.readFileSync(scenesPath, "utf8"));
    const CHAPTER_TO_GENERATE = 1; // Assuming we're generating for the first chapter
    const catalogueId = "riw7PiKBeKZF70WUMoSw";
    const sceneId = "1";
    // Load scenes data (assuming it's available)
    // const scenes = []; // You might need to load this from somewhere
    const totalScenes = scenes.length;
    const scenesPerRequest = 15;
    const startingScene = 0;
    const timeout = 60000;
    for (let i = startingScene; i < totalScenes; i += scenesPerRequest) {
      const scenesToGenerate = [];
      for (let j = i; j < i + scenesPerRequest && j < totalScenes; j++) {
        scenesToGenerate.push(j);
      }
      const startTime = Date.now();
      await new Promise((resolve) => {
        scenes = JSON.parse(fs.readFileSync(scenesPath, "utf8"));
        chai
            .request(APP_URL)
            .post("")// /v1/admin/ai/generateSceneImages")
            .set("API-KEY", process.env.ADMIN_API_KEY)
            .send({
              bookTitle: bookData.title,
              chapterNumber: CHAPTER_TO_GENERATE,
              imageTheme: "Sci-fi",
              scenesToGenerate: scenesToGenerate,
              fullScenes: scenes,
              catalogueId: catalogueId,
              sceneId: sceneId,
            })
            .end((err, res) => {
              // expect(err).to.be.null;
              // expect(res).to.have.status(200);
              // expect(res.body).to.be.an("object");
              // expect(res.body.scenes).to.be.an("array");

              // Save res.body to a JSON file
              if (res.body) {
                console.log(
                    "res.body = " + JSON.stringify(res.body).substring(0, 200),
                );
                const outputPath = "./test/bindings/scenes/transcript_ch1_scenes_images.json";
                fs.writeFileSync(outputPath, JSON.stringify(res.body, null, 2));
                if (
                  res.body.scenes &&
                res.body.scenes[i] &&
                res.body.scenes[i].image
                ) {
                  expect(res.body.scenes[i].image).to.be.an("string");
                } else {
                  console.log("no image generated for scene " + i);
                }
              }
              resolve();
            });
      });
      const endTime = Date.now();
      const elapsedTime = endTime - startTime;
      const remainingTime = Math.max(timeout - elapsedTime, 0);
      console.log(`remainingTime = ${remainingTime}`);
      await new Promise((resolve) => setTimeout(resolve, timeout)); // wait 60 seconds before next request
    }
  });
});
