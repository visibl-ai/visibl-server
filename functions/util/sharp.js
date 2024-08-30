import sharp from "sharp";
import logger from "firebase-functions/logger";
import {
  getFileStream,
  uploadStreamAndGetPublicLink,
} from "../storage/storage.js";

/**
 * Converts an image stream to WebP format and returns the transformed stream.
 *
 * @async
 * @function webpStream
 * @param {Object} params - The parameters for the conversion.
 * @param {ReadableStream} params.sourceStream - The source image stream.
 * @param {number} params.quality - The quality of the WebP image (0-100).
 * @return {Promise<ReadableStream>} A promise that resolves with the transformed stream.
 */
function webpStream({sourceStream, quality=90}) {
  return sourceStream.pipe(sharp({failOnError: true}).webp({quality}));
}

/**
 * Compresses an image and returns a public URL.
 * @async
 * @function compressImage
 * @param {Object} params - The parameters for the conversion.
 * @param {string} params.sourceFilePath - The source image file path.
 * @param {string} params.destinationFilePath - The destination image file path.
 * @param {number} params.quality - The quality of the WebP image (0-100).
 * @return {Promise<string>} A promise that resolves with the public URL of the compressed image.
 */
async function compressImage({sourceFilePath, destinationFilePath, quality=90}) {
  const sourceStream = await getFileStream({path: sourceFilePath});
  const publicUrl = await uploadStreamAndGetPublicLink({
    stream: webpStream({sourceStream, quality}),
    filename: destinationFilePath,
  });
  console.log(`Compressed image saved to ${publicUrl}`);
  return {publicUrl};
}


export {webpStream, compressImage};
