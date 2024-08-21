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
import {URL} from "url";

const STABILITY_API_URL = "https://api.stability.ai/v2beta/stable-image";

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

const structure = async (request) => {
  const {
    inputPath,
    outputPath,
    prompt,
    control_strength=0.35,
    outputFormat="jpeg"} = request;
  const form = await stabilityForm({inputPath, formData: {
    prompt,
    control_strength,
    output_format: outputFormat,
  }});
  const stream = await stabilityRequestToStream({url: `${STABILITY_API_URL}/control/structure`, form});
  logger.debug(`Structuring image complete ${outputPath}`);
  return await uploadStreamAndGetPublicLink({stream, filename: outputPath});
};
export {
  outpaint,
  structure,
  outpaintTall,
  outpaintWideAndTall,
};
