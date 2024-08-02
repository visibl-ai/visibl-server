/* eslint-disable require-jsdoc */

/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
import dotenv from "dotenv";
import chai from "chai";
import chaiHttp from "chai-http";
import fs from "fs";

chai.use(chaiHttp);
const expect = chai.expect;
dotenv.config({path: "../../.env.visibl-dev"}); // because firebase-functions-test doesn't work with conf.
// eslint-disable-next-line no-undef

function parseRawFFprobeOutput(ffprobeOutput) {
  const result = {
    title: "",
    author: "",
    length: 0,
    year: "",
    bitrate_kbs: 0,
    codec: "",
    chapters: {},
  };

  const lines = ffprobeOutput.split("\n");

  let isMetadataSection = false;
  let isChaptersSection = false;
  let isDurationSection = false;
  lines.forEach((line) => {
    if (line.includes("Metadata:") && !isChaptersSection) {
      isMetadataSection = true;
    } else if (line.includes("Duration:")) {
      isMetadataSection = false;
      isDurationSection = true;
    } else if (line.includes("Chapters:")) {
      isDurationSection = false;
      isChaptersSection = true;
    } else if (line.trim() === "") {
      isChaptersSection = false;
    }

    if (isMetadataSection) {
      const parts = line.trim().split(":");
      if ((parts[0].trim() === "title" || parts[0].trim() === "album") && result.title === "") {
        result.title = parts.slice(1).join(":").trim();
      } else if (parts[0].trim() === "artist") {
        result.author = [parts.slice(1).join(":").trim()];
      } else if (parts[0].trim() === "date") {
        result.year = parts.slice(1).join(":").trim();
      }
    }


    if (isDurationSection) {
      const durationParts = line.trim().split(",");
      if (durationParts.length > 2) {
        const bitratePart = durationParts[2].trim();
        const bitrateParts = bitratePart.split(" ");
        if (bitrateParts.length > 1 && bitrateParts[2] === "kb/s") {
          result.bitrate_kbs = parseInt(bitrateParts[1]);
        }
      }
    }

    if (isChaptersSection) {
      const chapterRegex = /Chapter #\d+:(\d+): start ([\d.]+), end ([\d.]+)/;
      const chapterMatch = line.match(chapterRegex);
      if (chapterMatch && chapterMatch.length === 4) {
        const chapterIndex = chapterMatch[1];
        const startTime = Math.round(parseFloat(chapterMatch[2]) * 100) / 100;
        const endTime = Math.round(parseFloat(chapterMatch[3]) * 100) / 100;

        result.chapters[chapterIndex] = {
          startTime: startTime,
          endTime: endTime,
        };

        // Update the length to be the endTime of the last chapter
        result.length = endTime;
      }
    }
  });
  // Remove empty or undefined keys from result
  Object.keys(result).forEach((key) => {
    if (result[key] === "" || result[key] === undefined) {
      delete result[key];
    }
  });

  return result;
}

// eslint-disable-next-line no-undef
describe("Generate metadata.json from m4b file", () => {
  // eslint-disable-next-line no-undef
  it(`test v1catalogueProcessRaw`, async () => {
    const rawFileContent = fs.readFileSync("../bindings/ffprobe/raw.txt", "utf8");
    const metadata = parseRawFFprobeOutput(rawFileContent);
    console.log(metadata);
  });
});
