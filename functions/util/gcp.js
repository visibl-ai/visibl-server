import {Storage} from "@google-cloud/storage";
import logger from "../util/logger.js";

const gcpKey = JSON.parse(Buffer.from(process.env.GCP_AUTH_PUBLIC_BUCKET_B64, "base64").toString("ascii"));
const storage = new Storage({
  projectId: gcpKey.project_id,
  credentials: gcpKey,
});
const bucketName = "visibl-dev-public-images";

const uploadToGCP = async (stream, fileName) => {
  const bucket = storage.bucket(bucketName);
  const blob = bucket.file(fileName);
  const blobStream = blob.createWriteStream();
  stream.pipe(blobStream);
  return new Promise((resolve, reject) => {
    blobStream.on("error", (err) => {
      logger.error("Error uploading file to GCP: " + err);
      reject(err);
    });
    blobStream.on("finish", async () => {
      // Make the file public
      await blob.makePublic().catch((err) => {
        logger.error("Error making file public: " + err);
        reject(err);
      });

      // Now the file is public, construct the public URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      resolve(publicUrl);
    });
  });
};

export default uploadToGCP;
