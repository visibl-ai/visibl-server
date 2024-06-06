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
 * - 1. transcribe (use cloud function)
 * - 2. NER
 * - 3. properties
 * - 4. scenes
 * - 5. images
 */


// return {transcriptions: publicUrl, metadata: bookData, splitAudio};

async function hookFromBucket() {
  // - is m4a or m4b?
  // - does book exist in db?
  //
}


async function preProcess(req, res) {
  res.send({pong: true});
}

export {preProcess};

