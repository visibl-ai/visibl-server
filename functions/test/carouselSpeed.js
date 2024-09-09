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
let APP_URL = `http://127.0.0.1:5002/v1/admin/scenes/carousel`;
if (TEST) {
  dotenv.config({path: ".env.local"}); // because firebase-functions-test doesn't work with conf.
} else {
  dotenv.config({path: ".env.visibl-dev-ali"}); // because firebase-functions-test doesn't work with conf.
  APP_URL = `https://v1admingetaicarousel-4f33egefga-ew.a.run.app`;
}
const DEFAULT_TIMEOUT = 15000;
const NUKE = false;
describe("Image Gen", () => {
  it("Get the carousel", async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai
        .request(APP_URL)
        .post("")// /v1/admin/ai/generateSceneImages")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          uid: "BBPx9JiRZZcdeBSc5RCMp5ue78w2",
          data: {
            libraryId: "U48SMO7B3zODgv5yOEOz",
            currentTime: 196.46900000000002,
          },
        });

    if (response.body) {
      console.log("response.body = " + JSON.stringify(response.body).substring(0, 200));
    }

    expect(response).to.have.status(200);
  });
});
