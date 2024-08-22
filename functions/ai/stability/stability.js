/* eslint-disable camelcase */
/* eslint-disable require-jsdoc */
import axios from "axios";
import FormData from "form-data";
import {Readable} from "stream";
import logger from "firebase-functions/logger";
import {
  STABILITY_API_KEY,
} from "../../config/config.js";

import {
  getFileStream,
  uploadStreamAndGetPublicLink,
} from "../../storage/storage.js";
// import {URL} from "url";

const STABILITY_API_URL = "https://api.stability.ai/v2beta/stable-image";
const STABILITY_API_REQUESTS_PER_10_SECONDS = 150;
const STABILITY_DEFAULT_CONTROL_STRENGTH = 0.85; // 0.35 is way too low. We might need to increase this.

async function stabilityForm({inputPath, formData}) {
  const imageStream = await getFileStream({path: inputPath});
  const inputFileName = inputPath.split("/").pop();
  const form = new FormData();
  form.append("image", imageStream,
      {
        filename: inputFileName, // Adjust as necessary
      },
  );
  Object.entries(formData).forEach(([key, value]) => {
    form.append(key, value);
  });
  return form;
}

async function stabilityRequestToStream({url, form}) {
  const response = await axios.postForm(
      url,
      form,
      {
        validateStatus: undefined,
        responseType: "arraybuffer",
        headers: {
          Authorization: `Bearer ${STABILITY_API_KEY.value()}`,
          Accept: "image/*",
          ...form.getHeaders(),
        },
      },
  );
  if (response.status === 200) {
    const buffer = Buffer.from(response.data);
    const stream = Readable.from(buffer);
    return stream;
  } else {
    throw new Error(`${response.status}: ${response.data.toString()}`);
  }
}


async function outpaint(request) {
  const {
    inputPath,
    outputPath,
    left=0,
    right=0,
    down=0,
    up=0,
    outputFormat="jpeg"} = request;

  const form = await stabilityForm({inputPath, formData: {
    left,
    right,
    down,
    up,
    output_format: outputFormat,
  }});
  const stream = await stabilityRequestToStream({url: `${STABILITY_API_URL}/edit/outpaint`, form});
  logger.debug(`Outpainting image complete ${outputPath}`);
  return await uploadStreamAndGetPublicLink({stream, filename: outputPath});
}

const outpaintTall = async (request) => {
  const {inputPath, outputPathWithoutExtension, pixels=384} = request;
  return await outpaint({
    inputPath,
    outputPath: `${outputPathWithoutExtension}.9.16.jpg`,
    up: pixels,
    down: pixels,
  });
};

const outpaintWideAndTall = async (request) => {
  const {inputPath, outputPathWithoutExtension, pixels=384} = request;
  logger.debug(`Outpainting image ${inputPath} to ${outputPathWithoutExtension}`);
  const tallPromise = outpaint({
    inputPath,
    outputPath: `${outputPathWithoutExtension}.9.16.jpg`,
    up: pixels,
    down: pixels,
  });

  const widePromise = outpaint({
    inputPath,
    outputPath: `${outputPathWithoutExtension}.16.9.jpg`,
    left: pixels,
    right: pixels,
  });

  const [upDownResult, leftRightResult] = await Promise.all([tallPromise, widePromise]);

  return {
    tall: upDownResult,
    wide: leftRightResult,
  };
};

// Recursively generates images for a chapter.
// will return a array of results with the resultKeys in each object,
// and the result in successKeys[i]
const batchStabilityRequest = async (params) => {
  const {
    functionsToCall,
    paramsForFunctions,
    resultKeys = [],
    successKeys = [],
    requestsPer10Seconds = STABILITY_API_REQUESTS_PER_10_SECONDS,
  } = params;
  let startTime = Date.now();
  let promises = [];
  let results = [];

  for (let i = 0; i < functionsToCall.length; i++) {
    resultKeys[i] = resultKeys[i] || {}; // check for empty list.
    successKeys[i] = successKeys[i] || "result";

    promises.push((async () => {
      try {
        const result = await functionsToCall[i](paramsForFunctions[i]);
        return {
          ...resultKeys[i],
          [successKeys[i]]: result,
        };
      } catch (error) {
        logger.error(`Error in function call: ${error.message}`);
        return {
          ...resultKeys[i],
          result: false,
          [successKeys[i]]: {error: error.message},
        };
      }
    })());

    if (promises.length >= requestsPer10Seconds) {
      logger.debug(`STABILITY: Making ${promises.length} requests`);
      results = results.concat(await Promise.all(promises));
      promises = []; // clear old promises.
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < 10000) {
        logger.debug(`Waiting ${10000 - elapsedTime} milliseconds`);
        await new Promise((resolve) => setTimeout(resolve, 10000 - elapsedTime));
      }
      startTime = Date.now();
    }
  }

  logger.debug(`STABILITY: Making final ${promises.length} requests`);
  results = results.concat(await Promise.all(promises));
  return results;
};

const structure = async (request) => {
  const {
    inputPath,
    outputPathWithoutExtension,
    prompt,
    control_strength=STABILITY_DEFAULT_CONTROL_STRENGTH,
    outputFormat="jpeg"} = request;
  const form = await stabilityForm({inputPath, formData: {
    prompt,
    control_strength,
    output_format: outputFormat,
  }});
  const stream = await stabilityRequestToStream({url: `${STABILITY_API_URL}/control/structure`, form});
  logger.debug(`Structuring image complete ${outputPathWithoutExtension}`);
  return await uploadStreamAndGetPublicLink({stream, filename: `${outputPathWithoutExtension}.structured.${outputFormat}`});
};

const testStabilityBatch = async (request) => {
  const {
    paramsForFunctions,
    resultKeys,
    requestsPer10Seconds,
    successKeys,
  } = request;
  logger.debug(JSON.stringify(paramsForFunctions));
  logger.debug(`Testing stability batch with ${paramsForFunctions.length} requests, ${JSON.stringify(paramsForFunctions)}`);
  return await batchStabilityRequest({
    functionsToCall: [
      outpaintWideAndTall,
      structure,
      structure,
      () => {
        throw Error("This is a test error");
      },
    ],
    paramsForFunctions,
    resultKeys,
    requestsPer10Seconds,
    successKeys,
  });
};

export {
  outpaint,
  structure,
  outpaintTall,
  outpaintWideAndTall,
  batchStabilityRequest,
  testStabilityBatch,
};
