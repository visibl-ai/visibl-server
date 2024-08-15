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

async function outpaint(request) {
  const {
    inputPath,
    outputPath,
    left=0,
    right=0,
    down=0,
    up=0,
    outputFormat="jpeg"} = request;

  const imageStream = await getFileStream({path: inputPath});
  const inputFileName = inputPath.split("/").pop();
  const form = new FormData();
  form.append("image", imageStream,
      {
        filename: inputFileName, // Adjust as necessary
      },
  );
  form.append("left", left);
  form.append("down", down);
  form.append("up", up);
  form.append("right", right);
  form.append("output_format", outputFormat);
  const response = await axios.postForm(
      `https://api.stability.ai/v2beta/stable-image/edit/outpaint`,
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
    logger.debug(`Outpainting image compelete ${outputPath}`);
    const buffer = Buffer.from(response.data);
    const stream = Readable.from(buffer);
    return await uploadStreamAndGetPublicLink({stream, filename: outputPath});
  } else {
    throw new Error(`${response.status}: ${response.data.toString()}`);
  }
}

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

export {
  outpaint,
  outpaintWideAndTall,
};
