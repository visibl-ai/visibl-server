/* eslint-disable require-jsdoc */
import OpenAI from "openai";
import prompts from "./prompts.js";
import logger from "firebase-functions/logger";
import tokenHelper from "./tokens.js";
import {OPENAI_API_KEY} from "../../config/config.js";


const DEFAULT_TEMP = 0.1;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MODEL = "gpt-4-1106-preview";


async function defaultCompletion(params) {
  const {messages,
    temperature = DEFAULT_TEMP,
    format = "json_object",
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = params;
  logger.debug(`OpenAI request with ${tokenHelper.countTokens(JSON.stringify(messages))} prompt tokens`);
  const openai = new OpenAI(OPENAI_API_KEY.value());
  const {data: completion, response: raw} = await openai.chat.completions.create({
    messages: messages,
    model: model,
    response_format: {type: format},
    temperature: temperature,
    max_tokens: maxTokens,
  }).withResponse();
  if (format === "json_object") {
    return parseJsonFromOpenAIResponse(completion, raw);
  } else {
    return completion.choices[0].message.content;
  }
}


function parseJsonFromOpenAIResponse(completion, raw) {
  let response;
  if (!completion) {
    logger.error(`Completion is null`);
    logger.error(JSON.stringify(completion, null, 2));
    throw new Error("Completion is null");
  }
  if (!completion.choices || !completion.choices[0]) {
    logger.error(`No choices in completion`);
    logger.error(JSON.stringify(completion, null, 2));
    throw new Error("No choices in completion");
  }
  if (completion.choices[0].finish_reason !== "stop") {
    logger.error(`Unexpected finish reason: ${completion.choices[0].finish_reason}`);
    logger.error(JSON.stringify(completion, null, 2));
    throw new Error(`Unexpected finish reason: ${completion.choices[0].finish_reason}`);
  }
  if (!completion.choices[0].message || !completion.choices[0].message.content) {
    logger.error(`No content in completion message`);
    logger.error(JSON.stringify(completion, null, 2));
    throw new Error("No content in completion message");
  }
  try {
    response = JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    logger.error(`Non JSON response received. Try again.`);
    logger.error(completion?.choices[0]?.message?.content);
    // throw new Error("Non JSON response received. Try again.");
    return completion.choices[0].message.content;
  }
  logger.debug(`OpenAI tokens used: ${completion.usage.total_tokens} remaining tokens: ${raw.headers.get("x-ratelimit-remaining-tokens")}`);
  return response;
}


const nerFunctions = {
  characters: async (characterList, text) => {
    const messages = [
      {
        role: "system",
        content: prompts.ner_characters_prompt.replace(
            "%CHARACTERS_LIST%",
            JSON.stringify(characterList, null, 2),
        ),
      },
      {role: "user", content: JSON.stringify(text)},
    ];
    return await defaultCompletion({messages});
  },
  locations: async (locationsList, text) => {
    const messages = [
      {
        role: "system",
        content: prompts.ner_locations_prompt.replace(
            "%LOCATIONS_LIST%",
            JSON.stringify(locationsList, null, 2),
        ),
      },
      {role: "user", content: JSON.stringify(text)},
    ];
    return await (messages);
  },
  characterProperties: async (characters, properties, text) => {
    const messages = [
      {
        role: "system",
        content: prompts.ner_characters_props_prompt.replace(
            "%CHARACTERS_LIST%",
            JSON.stringify(characters, null, 2),
        ).replace(
            "%CHARACTER_PROPERTIES%",
            JSON.stringify(properties, null, 2)),
      },
      {role: "user", content: JSON.stringify(text, null, 2)},
    ];
    return await defaultCompletion({messages});
  },
  dedupLocations: async (locations) => {
    const messages = [
      {
        role: "system",
        content: prompts.ner_locations_prompt_dedup,
      },
      {role: "user", content: JSON.stringify(locations, null, 2)},
    ];
    return await defaultCompletion({messages});
  },
  dedupLocationsWithText: async (locations, text) => {
    const messages = [
      {
        role: "system",
        content: prompts.ner_locations_prompt_dedup_with_text.replace(
            "%LOCATIONS_LIST%",
            JSON.stringify(locations, null, 2),
        ),
      },
      {role: "user", content: text},
    ];
    return await defaultCompletion({messages});
  },
  locationProperties: async (locations, properties, text) => {
    const messages = [
      {
        role: "system",
        content: prompts.ner_locations_props_prompt.replace(
            "%LOCATIONS_LIST%",
            JSON.stringify(locations, null, 2),
        ).replace(
            "%LOCATION_PROPERTIES%",
            JSON.stringify(properties, null, 2)),
      },
      {role: "user", content: JSON.stringify(text, null, 2)},
    ];
    return await defaultCompletion({messages});
  },
  characterDescriptions: async (character, characterGraphResponse) => {
    const messages = [
      {
        role: "system",
        content: prompts.character_image_prompt.replace(
            "%CHARACTER%",
            character,
        ).replace(
            "%GRAPH_RESPONSE%",
            JSON.stringify(characterGraphResponse, null, 2)),
      },
      {role: "user", content: JSON.stringify("", null, 2)},
    ];
    return await defaultCompletion({messages});
  },
  locationDescriptions: async (location, locationGraphResponse) => {
    const messages = [
      {
        role: "system",
        content: prompts.location_image_prompt.replace(
            "%CHARACTER%",
            location,
        ).replace(
            "%GRAPH_RESPONSE%",
            JSON.stringify(locationGraphResponse, null, 2)),
      },
      {role: "user", content: JSON.stringify("", null, 2)},
    ];
    return await defaultCompletion({messages});
  },
  filmDirector: async (charactersList, locationsList, jsonText) => {
    const messages = [
      {
        role: "system",
        content: prompts.transcribe_film_director_prompt.replace(
            "%CHARACTER_LIST%",
            JSON.stringify(charactersList, null, 2),
        ).replace(
            "%LOCATIONS_LIST%",
            JSON.stringify(locationsList, null, 2),
        ),
      },
      {role: "user", content: JSON.stringify(jsonText, null, 2)},
    ];
    // Higher temp - we want some creativity here
    return await defaultCompletion({messages, temperature: 0.8});
  },
  filmDirector16k: async (params) => {
    const {charactersList, locationsList, numScenes, csvText} = params;
    const messages = [
      {
        role: "system",
        content: prompts.transcribe_film_director_prompt_16k.replace(
            "%CHARACTER_LIST%",
            JSON.stringify(charactersList),
        ).replace(
            "%LOCATIONS_LIST%",
            JSON.stringify(locationsList),
        ).replace(
            "%NUM_SCENES%",
            JSON.stringify(numScenes),
        ),
      },
      {role: "user", content: csvText},
    ];
    return await defaultCompletion({
      messages,
      temperature: 1,
      model: "gpt-4o-2024-08-06", // "chatgpt-4o-latest",
      maxTokens: 16384,
      format: "json_object"});
  },

  singleRequest: async (prompt, paramsList, text, temp=DEFAULT_TEMP) => {
    let content = prompts[prompt];
    paramsList.forEach((params) => {
      content = content.replace(
          `%${params.name}%`,
        typeof params.value === "object" ? JSON.stringify(params.value, null, 2) : params.value,
      );
    });
    const messages = [
      {
        role: "system",
        content: content,
      },
      {role: "user", content: typeof text === "object" ? JSON.stringify(text, null, 2) : text},
    ];
    return await defaultCompletion({messages, temperature: temp});
  },

  // Make batch requests to openai with rate limiting based on tokens.
  batchRequest: async (params) => {
    const {prompt, paramsList, textList, tokensPerMinute, temp=DEFAULT_TEMP, maxTokens = DEFAULT_MAX_TOKENS, format="json_object"} = params;
    // Generate the content for the prompt so we can calcualte tokens.
    logger.debug(`Batch request for ${prompt} with ${textList.length} texts and tokensPerMinute=${tokensPerMinute}, format=${format}`);
    let content = prompts[prompt];
    paramsList.forEach((params) => {
      content = content.replace(
          `%${params.name}%`,
        typeof params.value === "object" ? JSON.stringify(params.value, null, 2) : params.value,
      );
    });

    let tokensUsed = 0;
    const promises = [];
    let startTime = Date.now();
    let results = [];
    // Loop through the textList.
    for (let i = 0; i < textList.length; i++) {
      const text = textList[i];
      const userContent = typeof text === "object" ? JSON.stringify(text, null, 2) : text;
      const messages = [
        {
          role: "system",
          content: content,
        },
        {role: "user", content: userContent},
      ];
      const tokens = tokenHelper.countTokens(JSON.stringify(messages));
      // This checks if the tokens in the current chunk takes us over the limit.
      if ( (tokensUsed + tokens + maxTokens) > tokensPerMinute) {
        // store results in a list.
        logger.debug(`Making ${promises.length} parallel requests with ${tokensUsed} max tokens`);
        results = results.concat(await Promise.all(promises));
        promises.length = 0; // clear old promises.
        tokensUsed = 0;
        const elapsedTime = Date.now() - startTime;
        // Make sure we wait 60 serconds between batches.
        if (elapsedTime < 60000) {
          logger.debug(`Waiting ${60000 - elapsedTime} milliseconds`);
          await new Promise((resolve) => setTimeout(resolve, 60000 - elapsedTime));
        }
        startTime = Date.now();
      }
      tokensUsed += (tokens + maxTokens);
      promises.push(defaultCompletion({messages, temperature: temp, format}));
    }
    // Run the final batch.
    logger.debug(`Making final ${promises.length} requests with ${tokensUsed} max tokens`);
    results = results.concat(await Promise.all(promises));
    return results;
  },
  // Make batch requests to openai with rate limiting based on tokens.
  batchRequestMultiPrompt: async (params) => {
    const {prompt, paramsList, textList, tokensPerMinute, temp=DEFAULT_TEMP, maxTokens = DEFAULT_MAX_TOKENS, format="json_object", model = DEFAULT_MODEL} = params;
    // Generate the content for the prompt so we can calcualte tokens.
    logger.debug(`Batch request for ${prompt} with ${textList.length} texts and tokensPerMinute=${tokensPerMinute}, format=${format}`);
    const promptList = [];
    paramsList.forEach((params) => {
      let content = prompts[prompt];
      params.forEach((param) => {
        logger.debug(`Generating prompt for ${param.name} with value ${param.value}`);
        content = content.replaceAll(`%${param.name}%`, param.value);
      });
      promptList.push(content);
      logger.debug(`Prompt: ${content}`);
    });

    let tokensUsed = 0;
    const promises = [];
    let startTime = Date.now();
    let results = [];
    // Loop through the textList.
    for (let i = 0; i < textList.length; i++) {
      const text = textList[i];
      const userContent = typeof text === "object" ? JSON.stringify(text, null, 2) : text;
      const messages = [
        {
          role: "system",
          content: promptList[i],
        },
        {role: "user", content: userContent},
      ];
      const tokens = tokenHelper.countTokens(JSON.stringify(messages));
      // This checks if the tokens in the current chunk takes us over the limit.
      if ( (tokensUsed + tokens + maxTokens) > tokensPerMinute) {
        // store results in a list.
        logger.debug(`Making ${promises.length} parallel requests with ${tokensUsed} max tokens`);
        results = results.concat(await Promise.all(promises));
        promises.length = 0; // clear old promises.
        tokensUsed = 0;
        const elapsedTime = Date.now() - startTime;
        // Make sure we wait 60 serconds between batches.
        if (elapsedTime < 60000) {
          logger.debug(`Waiting ${60000 - elapsedTime} milliseconds`);
          await new Promise((resolve) => setTimeout(resolve, 60000 - elapsedTime));
        }
        startTime = Date.now();
      }
      tokensUsed += (tokens + maxTokens);
      promises.push(defaultCompletion({messages, temperature: temp, format, model}));
    }
    // Run the final batch.
    logger.debug(`Making final ${promises.length} requests with ${tokensUsed} max tokens`);
    results = results.concat(await Promise.all(promises));
    return results;
  },
};

export default nerFunctions;
