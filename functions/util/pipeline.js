/* eslint-disable no-unused-vars */
/* eslint-disable require-jsdoc */

import {logger} from "firebase-functions/v2";

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

class PipelineStage {
  constructor(number, name, estimatedDuration, status = "pending", data = {}) {
    this.number = number; // Stage number
    this.name = name; // Name of the stage
    this.estimatedDuration = estimatedDuration; // Estimated time to complete this stage in minutes
    this.status = status; // Status: pending, in_progress, completed, error
    this.data = data; // Any relevant data for the stage
    this.completionPercentage = 0; // Completion percentage of this stage
  }

  updateCompletion(percentage) {
    this.completionPercentage = percentage;
    if (percentage === 100) {
      this.status = "completed";
    }
  }
}

class Pipeline {
  constructor(uid, refId, type, stages = []) {
    this.uid = uid; // User ID
    this.refId = refId; // Reference ID, e.g., bookId
    this.type = type; // Type of the pipeline, e.g., 'book'
    this.stages = stages; // Array of PipelineStage
    this.currentStage = null; // Current active stage
    this.updatedAt = new Date(); // Last update timestamp
    this.totalEstimatedDuration = this.calculateTotalDuration();
  }

  addStage(stage) {
    this.stages.push(stage);
    this.updateCurrentStage();
    this.totalEstimatedDuration = this.calculateTotalDuration();
  }

  calculateTotalDuration() {
    return this.stages.reduce((total, stage) => total + stage.estimatedDuration, 0);
  }

  updateCurrentStage() {
    this.currentStage = this.stages.find((s) => s.status === "in_progress" || s.status === "pending");
    this.updatedAt = new Date();
  }
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

export {preProcess, hookFromBucket};

