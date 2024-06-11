/* eslint-disable no-unused-vars */
/* eslint-disable require-jsdoc */

import {logger} from "firebase-functions/v2";
import {
  createPipelineFirestore,
  updatePipelineFirestore,
} from "../storage/firestore.js";

/** PIPELINE
 * Lets have a db collection for the pipeline to keep things coherent.
 * something like:
 *  id, uid, refId (bookId), type (book), numberOfStages (4), currentStage ({num, name}), updatedAt
 *
 *  When a bucket upload is complete, kick off this pipeline.
 *
 * For book, the pipline is:
 * - 0. Upload to bucket from client
 * - 1. transcribe (use cloud function)
 * - 2. NER
 * - 3. properties
 * - 4. scenes
 * - 5. images
 */

class Pipeline {
  constructor(json) {
    this.id = json.id;
    this.uid = json.uid; // User ID
    this.refId = json.refId; // Reference ID, e.g., bookId
    this.type = json.Datetype; // Type of the pipeline, e.g., 'book'
    this.stages = json.stages; // Number of stages
    this.currentStageNumber = json.currentStageNumber; // Current active stage
    this.currentStageName = json.currentStageName; // Current active stage
    this.updatedAt = json.updatedAt;
  }

  toJSON() {
    return {
      id: this.id,
      uid: this.uid,
      refId: this.refId,
      type: this.type,
      stages: this.stages,
      currentStageNumber: this.currentStageNumber,
      currentStageName: this.currentStageName,
      updatedAt: this.updatedAt,
    };
  }
}

async function createBookPipeline(uid, refId, type) {
  let pipeline = new Pipeline({uid, refId, type, stages: 5, currentStageNumber: 0, currentStageName: "Upload", updatedAt: new Date()});
  pipeline = await createPipelineFirestore(pipeline.toJSON());
  return pipeline;
}


// return {transcriptions: publicUrl, metadata: bookData, splitAudio};

async function hookFromBucket(event) {
  const fileBucket = event.data.bucket; // Storage bucket containing the file.
  const filePath = event.data.name; // File path in the bucket.
  const contentType = event.data.contentType; // File content type.
  const extension = filePath.split(".").pop();
  if (extension === "m4a" || extension === "m4b") {
    // - does book exist in db?
  } else {
    logger.debug(`File extension not supported: ${extension} for ${filePath}. Ignoring.`);
    // update pipeline entry to set status to "error"
  }
}


async function preProcess(req, res) {
  res.send({pong: true});
}

export {
  preProcess,
  hookFromBucket,
  createBookPipeline,
};

