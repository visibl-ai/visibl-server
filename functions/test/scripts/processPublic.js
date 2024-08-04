
/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
import dotenv from "dotenv";
import chai from "chai";
import chaiHttp from "chai-http";
chai.use(chaiHttp);
const expect = chai.expect;
dotenv.config({path: "../../.env.visibl-dev-ali"}); // because firebase-functions-test doesn't work with conf.
// eslint-disable-next-line no-undef
describe("Customer creation via Firebase Auth", () => {
  // eslint-disable-next-line no-undef
  // it(`test processM4B taskQueue`, async () => {
  //   const response = await chai
  //       .request("http://127.0.0.1:5001/visibl-dev-ali/europe-west1")
  //       .post("/processM4B")
  //       .set("Content-Type", "application/json")
  //       .send({
  //         data:
  //         {sku: process.env.PUBLIC_SKU1},
  //       });
  //   expect(response).to.have.status(204);
  // });

  // eslint-disable-next-line no-undef
  it(`test v1catalogueProcessRaw`, async () => {
    const response = await chai
        .request(process.env.HOSTING_DOMAIN)
        .post("/v1/admin/catalogue/process")
        .set("API-KEY", process.env.ADMIN_API_KEY)
        .send({sku: process.env.SKU});
    expect(response).to.have.status(200);
  });
});
