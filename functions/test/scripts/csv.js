import {Parser} from "@json2csv/plainjs";
import fs from "fs";

const jsonToCsv = (jsonArray, start = 0, end = jsonArray.length) => {
  const opts = {fields: Object.keys(jsonArray[0])};
  const parser = new Parser(opts);
  const csv = parser.parse(jsonArray.slice(start, end));
  return csv;
};

const text = fs.readFileSync("./test/bindings/graph/VISIBL_000001-transcriptions.json", "utf8");
const json = JSON.parse(text);
const chapter = json[3];
chapter.forEach((item) => {
  if (typeof item.startTime === "number") {
    item.startTime = item.startTime.toFixed(1);
  }
});

const csv = jsonToCsv(chapter);
fs.writeFileSync("./test/bindings/graph/VISIBL_000001-ch1.csv", csv);

const characters = JSON.parse(fs.readFileSync("./test/bindings/graph/VISIBL_000001-characters-graph.json", "utf8"));
const characterNames = characters.characters.map((character) => character.name);

fs.writeFileSync("./test/bindings/graph/VISIBL_000001-characters-list.txt", JSON.stringify(characterNames));

const locations = JSON.parse(fs.readFileSync("./test/bindings/graph/VISIBL_000001-locations-graph.json", "utf8"));
const locationNames = locations.locations.map((location) => location.name);

fs.writeFileSync("./test/bindings/graph/VISIBL_000001-locations-list.txt", JSON.stringify(locationNames));
