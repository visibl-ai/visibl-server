const prompts = {
  getCharacters: {
    model: "gemini-1.5-pro-exp-0801",
    systemInstruction: "You are being provided the text of a novel. Respond with a list of all unique characters in the text. Only include characters, do not include locations, or objects. Refer to the character by their most relevant name. Include all characters who speak or are meaningful to the story.",
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          characters: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
      },
    },
  },
};

export default prompts;
