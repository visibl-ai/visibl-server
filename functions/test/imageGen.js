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
let NUKE_URL = `http://127.0.0.1:5002/v1/admin/queue/nuke`;
if (TEST) {
  dotenv.config({path: ".env.local"}); // because firebase-functions-test doesn't work with conf.
} else {
  dotenv.config({path: ".env.visibl-dev-ali"}); // because firebase-functions-test doesn't work with conf.
  APP_URL = `https://v1generatesceneimages-4f33egefga-ew.a.run.app`;
  NUKE_URL = `https://v1queuenuke-4f33egefga-ew.a.run.app`;
}
const DEFAULT_TIMEOUT = 10000;
const NUKE = false;
describe("Image Gen", () => {
  if (NUKE) {
  // eslint-disable-next-line no-undef
    it("clear the current queue", async function() {
    // eslint-disable-next-line no-invalid-this
      this.timeout(DEFAULT_TIMEOUT);
      const response = await chai.request(NUKE_URL)
          .post("")
          .set("API-KEY", process.env.ADMIN_API_KEY)
          .send({});
      expect(response).to.have.status(200);
      expect(response.body).to.have.property("success", true);
    });
  }
  it("should generate images for the chapter", async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const fullScenes = JSON.parse(fs.readFileSync(`./test/bindings/graph/scenes.json`, "utf8"));
    const sceneId = "NZjdActtkyARblfDU00l";
    const lastSceneGenerated = 0;
    const chapter = 4;
    const chapterKey = `${chapter}`;
    const totalScenes = fullScenes[chapterKey].length;
    console.log("totalScenes = " + totalScenes);
    chai
        .request(APP_URL)
        .post("")// /v1/admin/ai/generateSceneImages")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          sceneId, lastSceneGenerated, totalScenes, chapter,
        })
        .end((err, res) => {
          if (res.body) {
            console.log("res.body = " + JSON.stringify(res.body).substring(0, 200));
          }
        });
  });
});
