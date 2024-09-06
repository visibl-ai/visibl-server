/* eslint-disable require-jsdoc */
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

import logger from "firebase-functions/logger";

import globalPrompts from "../prompts/globalPrompts.js";

import {GEMINI_API_KEY} from "../../config/config.js";

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
  // { // Not yet implemented on google side.
  //   category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
  //   threshold: HarmBlockThreshold.BLOCK_NONE,
  // },
];

function instructionReplacements({instruction, replacements}) {
  if (replacements) {
    for (const replacement of replacements) {
      instruction = instruction.replaceAll(`%${replacement.key}%`, replacement.value);
    }
  }
  return instruction;
}


async function geminiRequest(request) {
  const {prompt, message, replacements, history = [], retry = true, instructionOverride} = request;
  const globalPrompt = formatGlobalPrompt({globalPrompt: globalPrompts[prompt]});
  const type = globalPrompt.geminiGenerationConfig.responseMimeType;
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
  let instruction = instructionReplacements({instruction: globalPrompt.systemInstruction, replacements});
  if (instructionOverride) {
    instruction = instructionOverride;
  }

  const model = genAI.getGenerativeModel({
    model: globalPrompt.geminiModel,
    systemInstruction: instruction,
  });

  const generationConfig = globalPrompt.geminiGenerationConfig;

  const chatSession = model.startChat({
    generationConfig,
    safetySettings: safetySettings,
    history: history,
  });
  logger.debug(`Sending message to Gemini.`);
  logger.debug(`Instruction: ${instruction.substring(0, 300)}`);
  let result;

  try {
    result = await chatSession.sendMessage(message);
  } catch (error) {
    if (error.message.includes("model is overloaded")) {
      logger.warn("Gemini model is overloaded. Waiting 10 seconds before retrying.");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      request.retry = false;
      return await geminiRequest(request);
    } else if (error.message.includes("Resource has been exhausted")) {
      logger.error(`Gemini is asking us to chill. Retry in 60 seconds.`);
      await new Promise((resolve) => setTimeout(resolve, 60000));
      request.retry = false;
      return await geminiRequest(request);
    } else {
      logger.error("Error sending message to Gemini:", error);
      throw error;
    }
  }

  let tokensUsed = 0;
  try {
    logger.debug(`Gemini response received.`);
    logger.debug(result.response.text().substring(0, 150));
    if (result.response.usageMetadata) {
      const quota = result.response.usageMetadata.promptTokenCount;
      tokensUsed = quota;
      logger.debug(`Tokens used: ${quota}`);
    }
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
      return {result: geminiTextToJSON(result.response.text()), tokensUsed};
    } catch (e) {
      logger.error("Error trying to parse result to JSON.");
      return {result: result.response.text(), tokensUsed};
    }
  } else {
    return {result: result.response.text(), tokensUsed};
  }
}

function formatGlobalPrompt({globalPrompt}) {
  if (globalPrompt.geminiGenerationConfig.responseMimeType === "application/json") {
    globalPrompt.geminiGenerationConfig.responseSchema = globalPrompt.responseSchema;
  }
  return globalPrompt;
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

export {
  geminiRequest,
};

