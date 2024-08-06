import {GoogleAuth} from "google-auth-library";
import {getFunctions} from "firebase-admin/functions";
import {logger} from "firebase-functions";

let auth;
/**
 * Get the URL of a given v2 cloud function.
 *
 * @param {string} name the function's name
 * @param {string} location the function's location
 * @return {Promise<string>} The URL of the function
 */
async function getFunctionUrl(name, location="us-central1") {
  if (!auth) {
    auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
  }
  const projectId = await auth.getProjectId();
  const url = "https://cloudfunctions.googleapis.com/v2/" +
    `projects/${projectId}/locations/${location}/functions/${name}`;

  const client = await auth.getClient();
  const res = await client.request({url});
  const uri = res.data?.serviceConfig?.uri;
  if (!uri) {
    throw new Error(`Unable to retreive uri for function at ${url}`);
  }
  return uri;
}

/**
 * Converts the data from a request object to a body format.
 *
 * @param {Object} req - The request object containing data.
 * @return {Object} An object with a 'body' property containing the request data.
 */
function dataToBody(req) {
  return {body: req.data};
}

/**
 * @return {Object} An object with a 'body' property containing the request data.
 */
function largeDispatchInstance() {
  return {
    retryConfig: {
      maxAttempts: 1,
      minBackoffSeconds: 1,
    },
    rateLimits: {
      maxConcurrentDispatches: 1,
    },
    region: "us-central1",
    memory: "32GiB",
    timeoutSeconds: 540,
  };
}

/**
 * @param {string} functionName
 * @param {Object} data
 * @param {number} deadline
 */
async function dispatchTask(functionName, data, deadline=60 * 5) {
  const queue = getFunctions().taskQueue(functionName);
  const targetUri = await getFunctionUrl(functionName);
  logger.debug(`Queuing ${functionName} with targetUri: ${targetUri}`);
  return queue.enqueue(data, {
    scheduleDelaySeconds: 1,
    dispatchDeadlineSeconds: deadline,
    uri: targetUri,
  });
}

export {
  getFunctionUrl,
  dataToBody,
  largeDispatchInstance,
  dispatchTask,
};
