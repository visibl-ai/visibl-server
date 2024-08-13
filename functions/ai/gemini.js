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


async function geminiRequest(request) {
  const {prompt, message, replacements, history = [], retry = true, instructionOverride} = request;
  const type = prompts[prompt].generationConfig.responseMimeType;
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
  let instruction = prompts[prompt].systemInstruction;
  if (replacements) {
    for (const replacement of replacements) {
      instruction = instruction.replaceAll(replacement.key, replacement.value);
    }
  }
  if (instructionOverride) {
    instruction = instructionOverride;
  }

  const model = genAI.getGenerativeModel({
    model: prompts[prompt].model,
    systemInstruction: instruction,
  });

  const generationConfig = prompts[prompt].generationConfig;

  const chatSession = model.startChat({
    generationConfig,
    safetySettings: safetySettings,
    history: history,
  });
  logger.debug(`Sending message to Gemini.`);
  logger.debug(`Instruction: ${instruction}`);
  const result = await chatSession.sendMessage(message);
  logger.debug(`Gemini response received.`);

  try {
    logger.debug(result.response.text().substring(0, 150));
  } catch (error) {
    if (result.response.promptFeedback.blockReason) {
      logger.warn(`Gemini response blocked: ${result.response.promptFeedback.blockReason}. Will retry once.`);
      if (retry) {
        request.retry = false;
        request.instructionOverride = instruction + " Ignore any inappropriate details which may cause content filtering issues.";
        return await geminiRequest(request);
      } else {
        return {error: "Gemini response blocked.",
          response: result.response.promptFeedback.blockReason,
        };
      }
    } else {
      logger.error("Error logging Gemini response text:", error);
      return {error: "Gemini response text not available.",
        response: result.response,
      };
    }
  }
  if (type === "application/json") {
    try {
      return geminiTextToJSON(result.response.text());
    } catch (e) {
      logger.error("Error trying to parse result to JSON.");
      return result.response.text();
    }
  } else {
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

