/* eslint-disable require-jsdoc */
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

import logger from "firebase-functions/logger";

import prompts from "./geminiPrompts.js";

import {GEMINI_API_KEY} from "../config/config.js";

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];


async function geminiRequest(prompt, message, temp = 0.1, history = []) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());

  const model = genAI.getGenerativeModel({
    model: prompts[prompt].model,
    systemInstruction: prompts[prompt].systemInstruction,
  });

  const generationConfig = prompts[prompt].generationConfig;

  const chatSession = model.startChat({
    generationConfig,
    safetySettings: safetySettings,
    history: history,
  });
  logger.debug(`Sending message to Gemini.`);
  const result = await chatSession.sendMessage(message);
  logger.debug(`Gemini response received.`);

  try {
    logger.debug(result.response.text());
  } catch (error) {
    logger.error("Error logging Gemini response text:", error);
    return {error: "Gemini response text not available.",
      response: result.response,
    };
  }
  try {
    return geminiTextToJSON(result.response.text());
  } catch (e) {
    logger.error("Error trying to parse result to JSON.");
    return result.response.text();
  }
}

function geminiTextToJSON(text) {
  try {
    text = text.replace(/\n/g, "");
    text = text.replace(/`/g, "");
    if (text.startsWith("json")) {
      text = text.slice(4);
    }
    return JSON.parse(text);
  } catch (e) {
    logger.error("Error trying to parse result to JSON.");
    return text;
  }
}

export {geminiRequest};

