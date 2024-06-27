/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable max-len */

import dotenv from "dotenv";
import chai from "chai";
import chaiHttp from "chai-http";

chai.use(chaiHttp);
const expect = chai.expect;
import fs from "fs";
dotenv.config({path: ".env.visibl-dev-ali"}); // because firebase-functions-test doesn't work with conf.

const APP_URL = `https://visibl-dev-ali.web.app`;
describe("Customer creation via Firebase Auth", () => {
  let catalogueBook;
  it(`test v1catalogueAdd`, async () => {
    const metadataPath = "./test/bindings/metadata/Neuromancer_ Sprawl Trilogy, Book 1.json";
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

    // Prepare the data for the catalogue item
    const data = {
      type: "audiobook",
      title: metadata.title,
      author: [metadata.author],
      duration: metadata.length,
      metadata: metadata,
      language: "en", // Assuming English, adjust if needed
    };

    // Make a POST request to the v1catalogueAdd endpoint

    const response = await chai
        .request(APP_URL)
        .post("/v1/admin/catalogue/add")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send(data);

    expect(response).to.have.status(200);
    const result = response.body;

    console.log(result);
    expect(result).to.have.property("id");
    expect(result.title).to.equal(metadata.title);
    expect(result.author).to.deep.equal([metadata.author]);
    expect(result.duration).to.equal(metadata.length);
    expect(result.createdAt).to.exist;
    expect(result.updatedAt).to.exist;
    catalogueBook = result;
  });
});
