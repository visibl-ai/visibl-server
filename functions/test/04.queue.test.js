/* eslint-disable max-len */
/* eslint-disable no-invalid-this */
// import admin from "firebase-admin";
import "./_env.js";
import dotenv from "dotenv";
import chai from "chai";
import chaiHttp from "chai-http";
chai.use(chaiHttp);
const expect = chai.expect;
import {initializeApp} from "firebase-admin/app";
// import {getAuth} from "firebase-admin/auth";
import {getStorage} from "firebase-admin/storage";
import fs from "fs";


import test from "firebase-functions-test";
dotenv.config({path: ".env.local"}); // because firebase-functions-test doesn't work with conf.
// Start the Firebase Functions test environment
// eslint-disable-next-line no-unused-vars
const firebaseTest = test({
  databaseURL: "http://localhost:8080",
  storageBucket: "visibl-dev-ali.appspot.com",
  projectId: "visibl-dev-ali",
});
// to get the app
import {
  // eslint-disable-next-line no-unused-vars
  helloWorld,
} from "../index.js";
const APP_ID = process.env.APP_ID;
const app = initializeApp({
  projectId: APP_ID,
  storageBucket: `${APP_ID}.appspot.com`,
}, "2");
// Point to the local Auth and Firestore emulators
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const APP_URL = `http://127.0.0.1:5002`;
const DISPATCH_URL = `http://127.0.0.1:5001/`;

const SYM_PATH = "./test/bindings/queue/";
const bucketImagePath = `Images/`;
const bucketScenePath = `Scenes/`;

const DEFAULT_TIMEOUT = 5000;
// eslint-disable-next-line no-undef
describe("Queue Tests", () => {
  // eslint-disable-next-line no-undef
  it(`Upload bindings to bucket.`, async () => {
    const fileList = [
      {fileName: `jardethe.png`, path: `${bucketImagePath}`},
      {fileName: `linda.jpg`, path: `${bucketImagePath}`},
      {fileName: `scenes.json`, path: `${bucketScenePath}01/`},
      {fileName: `scenes.json`, path: `${bucketScenePath}02/`},
    ];
    const bucket = getStorage(app).bucket();
    for (const thisFile of fileList) {
      console.log(`Uploading file: ${thisFile.fileName}`);
      const filePath = `${thisFile.path}${thisFile.fileName}`;
      const file = bucket.file(filePath);
      try {
        const stream = fs.createReadStream(`${SYM_PATH}${thisFile.fileName}`);
        await new Promise((resolve, reject) => {
          stream.pipe(file.createWriteStream({}))
              .on("error", (error) => {
                console.error(`Upload failed for ${thisFile.fileName}:`, error);
                reject(error);
              })
              .on("finish", () => {
                console.log(`File ${thisFile.fileName} uploaded successfully`);
                resolve();
              });
        });
      } catch (error) {
        console.error(`Failed to upload file ${thisFile.fileName}:`, error);
      }
    }
  });
  // eslint-disable-next-line no-undef
  it("clear the current queue", async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);

    const response = await chai.request(APP_URL)
        .post("/v1/admin/queue/nuke")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({});
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
  });
  // eslint-disable-next-line no-undef
  it("add two items to the queue collection", async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const types = ["stability", "stability"];
    const entryTypes = ["outpaint", "structure"];
    const uniques = ["stability_outpaint_01_1_2", "stability_structure_01_1_2"];
    const entryParams = [
      {
        inputPath: `${bucketImagePath}jardethe.png`,
        outputPathWithoutExtension: `${bucketImagePath}jardethe`,
      },
      {
        inputPath: `${bucketImagePath}linda.jpg`,
        outputPathWithoutExtension: `${bucketImagePath}linda`,
      },
    ];


    const response = await chai.request(APP_URL)
        .post("/v1/admin/queue/add")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          types,
          entryTypes,
          entryParams,
          uniques,
        });
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
  });
  let entries;
  // eslint-disable-next-line no-undef
  it("get two items from the queue", async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai.request(APP_URL)
        .post("/v1/admin/queue/get")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          type: "stability",
          status: "pending",
          limit: 200,
        });
    expect(response).to.have.status(200);
    console.log(response.body);
    expect(response.body).to.have.lengthOf(2);
    for (const entry of response.body) {
      expect(entry).to.have.property("type", "stability");
      expect(entry).to.have.property("status", "pending");
      expect(entry).to.have.property("timeRequested");
      expect(entry).to.have.property("timeUpdated");
      expect(entry).to.have.property("params");
      expect(entry).to.have.property("trace");
    }
    entries = response.body;
  });

  // eslint-disable-next-line no-undef
  it("update two items in the queue collection", async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const ids = entries.map((entry) => entry.id);
    const statuses = ["completed", "failed"];

    let response = await chai.request(APP_URL)
        .post("/v1/admin/queue/update")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          ids,
          statuses,
          results: [
            {path: "a path"},
            {path: "another path"},
          ],
        });
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
    response = await chai.request(APP_URL)
        .post("/v1/admin/queue/get")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          type: "stability",
          limit: 200,
        });
    expect(response).to.have.status(200);
    console.log(response.body);
    expect(response.body).to.have.lengthOf(2);
    entries = response.body;
    // Find the entry with id matching ids[0]
    const updatedEntry = response.body.find((entry) => entry.id === ids[0]);
    // Check that the status has been updated correctly
    expect(updatedEntry).to.exist;
    expect(updatedEntry.status).to.equal(statuses[0]);
    // Check that the result has been added
    expect(updatedEntry.result).to.deep.equal({path: "a path"});
    // Check that the timeUpdated has been changed
    expect(updatedEntry.timeUpdated).to.be.above(updatedEntry.timeRequested);
    const secondEntry = response.body.find((entry) => entry.id === ids[1]);
    expect(secondEntry).to.exist;
    expect(secondEntry.status).to.equal(statuses[1]);
    expect(secondEntry.result).to.deep.equal({path: "another path"});
    expect(secondEntry.timeUpdated).to.be.above(secondEntry.timeRequested);
  });
  // eslint-disable-next-line no-undef
  it("clear the queue again", async function() {
    this.timeout(DEFAULT_TIMEOUT);

    const response = await chai.request(APP_URL)
        .post("/v1/admin/queue/nuke")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({});
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
  });
  // eslint-disable-next-line no-undef
  it("add two identical items to the queue in same request, make sure duplicates are rejected.", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const types = ["dalle", "stability", "dalle", "stability"];
    const entryTypes = ["dalle3", "structure", "dalle3", "structure"];
    const uniques = ["dalle_dalle3_01_1_2", "stability_structure_01_1_2", "dalle_dalle3_01_1_2", "stability_structure_01_1_2"];
    const scene = JSON.parse(fs.readFileSync(`${SYM_PATH}scenes.json`, "utf8"));
    scene["1"][0].chapter = 1;
    const entryParams = [
      {
        scene: scene["1"][0],
        sceneId: "01",
        retry: true,
      },
      {
        inputPath: `${bucketImagePath}linda.jpg`,
        outputPathWithoutExtension: `${bucketImagePath}linda02`,
        sceneId: "02",
        chapter: 3,
        scene_number: 4,
        prompt: `Neon punk style`,
      },
      {
        scene: scene["1"][0],
        sceneId: "01",
        retry: true,
      },
      {
        inputPath: `${bucketImagePath}linda.jpg`,
        outputPathWithoutExtension: `${bucketImagePath}linda02`,
        sceneId: "02",
        chapter: 3,
        scene_number: 4,
        prompt: `Neon punk style`,
      },
    ];
    let response = await chai.request(APP_URL)
        .post("/v1/admin/queue/add")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          types,
          entryTypes,
          entryParams,
          uniques,
        });
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
    response = await chai.request(APP_URL)
        .post("/v1/admin/queue/get")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          type: "stability",
          status: "pending",
          limit: 200,
        });
    expect(response).to.have.status(200);
    console.log(response.body);
    expect(response.body).to.have.lengthOf(1);
    response = await chai.request(APP_URL)
        .post("/v1/admin/queue/get")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          type: "dalle",
          status: "pending",
          limit: 200,
        });
    expect(response).to.have.status(200);
    console.log(response.body);
    expect(response.body).to.have.lengthOf(1);
  });

  // eslint-disable-next-line no-undef
  it("add two identical items to the queue in new request, make sure duplicates are rejected.", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const types = ["dalle", "stability", "dalle", "stability"];
    const entryTypes = ["dalle3", "structure", "dalle3", "structure"];
    const uniques = ["dalle_dalle3_01_1_2", "stability_structure_01_1_2", "dalle_dalle3_04_1_2", "stability_structure_04_1_2"];
    const scene = JSON.parse(fs.readFileSync(`${SYM_PATH}scenes.json`, "utf8"));
    scene["1"][0].chapter = 1;
    const entryParams = [
      {
        scene: scene["1"][0],
        sceneId: "01",
        retry: true,
      },
      {
        inputPath: `${bucketImagePath}linda.jpg`,
        outputPathWithoutExtension: `${bucketImagePath}linda02`,
        sceneId: "02",
        chapter: 3,
        scene_number: 4,
        prompt: `Neon punk style`,
      },
      {
        scene: scene["1"][0],
        sceneId: "04",
        retry: true,
      },
      {
        inputPath: `${bucketImagePath}linda.jpg`,
        outputPathWithoutExtension: `${bucketImagePath}linda02`,
        sceneId: "04",
        chapter: 3,
        scene_number: 4,
        prompt: `Neon punk style`,
      },
    ];
    let response = await chai.request(APP_URL)
        .post("/v1/admin/queue/add")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          types,
          entryTypes,
          entryParams,
          uniques,
        });
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
    response = await chai.request(APP_URL)
        .post("/v1/admin/queue/get")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          type: "stability",
          status: "pending",
          limit: 200,
        });
    expect(response).to.have.status(200);
    console.log(response.body);
    expect(response.body).to.have.lengthOf(2);
    response = await chai.request(APP_URL)
        .post("/v1/admin/queue/get")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          type: "dalle",
          status: "pending",
          limit: 200,
        });
    expect(response).to.have.status(200);
    console.log(response.body);
    expect(response.body).to.have.lengthOf(2);
  });
  // eslint-disable-next-line no-undef
  it("add only items already in the queue, make sure nothing bad happens.", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const types = ["dalle", "stability"];
    const entryTypes = ["dalle3", "structure"];
    const uniques = ["dalle_dalle3_01_1_2", "stability_structure_01_1_2"];
    const scene = JSON.parse(fs.readFileSync(`${SYM_PATH}scenes.json`, "utf8"));
    scene["1"][0].chapter = 1;
    const entryParams = [
      {
        scene: scene["1"][0],
        sceneId: "01",
        retry: true,
      },
      {
        inputPath: `${bucketImagePath}linda.jpg`,
        outputPathWithoutExtension: `${bucketImagePath}linda02`,
        sceneId: "02",
        chapter: 3,
        scene_number: 4,
        prompt: `Neon punk style`,
      },
    ];
    let response = await chai.request(APP_URL)
        .post("/v1/admin/queue/add")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          types,
          entryTypes,
          entryParams,
          uniques,
        });
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
    response = await chai.request(APP_URL)
        .post("/v1/admin/queue/get")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          type: "stability",
          status: "pending",
          limit: 200,
        });
    expect(response).to.have.status(200);
    console.log(response.body);
    expect(response.body).to.have.lengthOf(2);
    response = await chai.request(APP_URL)
        .post("/v1/admin/queue/get")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          type: "dalle",
          status: "pending",
          limit: 200,
        });
    expect(response).to.have.status(200);
    console.log(response.body);
    expect(response.body).to.have.lengthOf(2);
  });
  // eslint-disable-next-line no-undef
  it("clear the queue again", async function() {
    this.timeout(DEFAULT_TIMEOUT);

    const response = await chai.request(APP_URL)
        .post("/v1/admin/queue/nuke")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({});
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
  });
  // eslint-disable-next-line no-undef
  it("add two items to the dalle queue", async function() {
    this.timeout(DEFAULT_TIMEOUT);
    const types = ["dalle", "dalle"];
    const entryTypes = ["dalle3", "dalle3"];
    const uniques = ["dalle_dalle3_01_1_2", "dalle_dalle3_02_3_0"];
    const scene = JSON.parse(fs.readFileSync(`${SYM_PATH}scenes.json`, "utf8"));
    scene["1"][0].chapter = 1;
    scene["3"][0].chapter = 3;
    const entryParams = [
      {
        scene: scene["1"][0],
        sceneId: "01",
        retry: true,
      },
      {
        scene: scene["3"][0],
        sceneId: "02",
        retry: true,
      },
    ];
    const response = await chai.request(APP_URL)
        .post("/v1/admin/queue/add")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          types,
          entryTypes,
          entryParams,
          uniques,
        });
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
  });
  // eslint-disable-next-line no-undef
  it(`test launchDalleQueue`, async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(90000);
    // eslint-disable-next-line no-unused-vars
    let response = await chai
        .request(`${DISPATCH_URL}${APP_ID}/us-central1`)
        .post("/launchDalleQueue")
        .set("Content-Type", "application/json")
        .send({data: {}}); // nest object as this is a dispatch.
    // expect(response).to.have.status(204); // Dispatch at end will fail, so not 204.
    response = await chai.request(APP_URL)
        .post("/v1/admin/queue/get")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          type: "stability",
          status: "pending",
          limit: 200,
        });
    expect(response).to.have.status(200);
    console.log(response.body);
    expect(response.body).to.have.lengthOf(2);
    // These items were addded by the backed and should have a retry in the ID.
    expect(response.body[0].id).to.match(/retry/);
    expect(response.body[1].id).to.match(/retry/);
  });
  // eslint-disable-next-line no-undef
  it("add four (1 duplicate, 1 failing) items to the queue collection again", async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const types = ["stability", "stability", "stability", "stability"];
    const entryTypes = ["outpaintTall", "structure", "outpaintTall", "failure"];
    const uniques = ["stability_outpaintTall_01_1_2_retry", "stability_structure_01_3_4", "stability_outpaintTall_02_1_2", "stability_failure_02_3_4_retry"];
    const entryParams = [
      {
        inputPath: `${bucketImagePath}jardethe.png`,
        outputPathWithoutExtension: `${bucketImagePath}jardethe01`,
        sceneId: "01",
        chapter: 1,
        scene_number: 2,

      },
      {
        inputPath: `${bucketImagePath}linda.jpg`,
        outputPathWithoutExtension: `${bucketImagePath}linda01`,
        sceneId: "01",
        chapter: 3,
        scene_number: 4,
        prompt: `Neon punk style`,
      },
      {
        inputPath: `${bucketImagePath}jardethe.png`,
        outputPathWithoutExtension: `${bucketImagePath}jardethe02`,
        sceneId: "02",
        chapter: 1,
        scene_number: 2,

      },
      {
        inputPath: `${bucketImagePath}linda.jpg`,
        outputPathWithoutExtension: `${bucketImagePath}linda02`,
        sceneId: "02",
        chapter: 3,
        scene_number: 4,
        prompt: `Neon punk style`,
        retry: true,
      },
    ];
    const response = await chai.request(APP_URL)
        .post("/v1/admin/queue/add")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          types,
          entryTypes,
          entryParams,
          uniques,
        });
    expect(response).to.have.status(200);
    expect(response.body).to.have.property("success", true);
  });
  // eslint-disable-next-line no-undef
  it(`test launchStabilityQueue`, async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(90000);
    // eslint-disable-next-line no-unused-vars
    const response = await chai
        .request(`${DISPATCH_URL}${APP_ID}/us-central1`)
        .post("/launchStabilityQueue")
        .set("Content-Type", "application/json")
        .send({data: {}}); // nest object as this is a dispatch.
    // expect(response).to.have.status(204); // Dispatch at end will fail, so not 204.
  });
  // eslint-disable-next-line no-undef
  it("get the items from the queue and make sure they're completed.", async function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(DEFAULT_TIMEOUT);
    const response = await chai.request(APP_URL)
        .post("/v1/admin/queue/get")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({
          type: "stability",
          status: "complete",
          limit: 200,
        });
    expect(response).to.have.status(200);
    console.log(response.body);
    expect(response.body).to.have.lengthOf(6);
    for (const entry of response.body) {
      expect(entry).to.have.property("type", "stability");
      expect(entry).to.have.property("status", "complete");
      expect(entry).to.have.property("timeRequested");
      expect(entry).to.have.property("timeUpdated");
      expect(entry).to.have.property("params");
      expect(entry).to.have.property("trace");
    }
    // Check if at least one item has the specific id
    const hasSpecificId = response.body.some((entry) => entry.id === "stability_failure_02_3_4");
    expect(hasSpecificId).to.be.true;
  });
});
