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
  getLocations: {
    model: "gemini-1.5-pro-exp-0801",
    systemInstruction:
`You are being provided the text of a novel. Respond with a list of all unique locations in the text. 
Only include locations, do not include characters, or objects. Refer to the location by its most relevant name.
Ignore any inappropriate locations which may cause content filtering issues.`,
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          locations: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
      },
    },
  },
  getCharacterDescription: {
    model: "gemini-1.5-flash", // "gemini-1.5-pro-exp-0801",
    systemInstruction:
`You are being provided the full text of a novel. Respond an accurate description of the character "%CHARACTER%".
Be descriptive so diffusion model can accurately depict the %CHARACTER%.`,
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    },
  },
  getLocationDescription: {
    model: "gemini-1.5-flash",
    systemInstruction:
`You are being provided the full text of a novel. Respond an accurate physical description of the location "%LOCATION%".
Be descriptive so diffusion model can accurately depict %LOCATION%.`,
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    },
  },
};

export default prompts;
