const prompts = {
  getCharacters: {
    model: "gemini-1.5-pro-exp-0801",
    systemInstruction: `
You will be provided with the text of a novel. Your task is to create a list of all unique characters that appear in the story. 
Carefully read through the text and identify all characters based on these criteria:
1. Only include characters, not locations or objects.
2. Include all characters who speak or are meaningful to the story.
3. Refer to each character by their most relevant name (usually their given name or the name they're most commonly called in the story).
4. If a character has multiple names or aliases, choose the most prominent one
5. Include both major and minor characters, as long as they have some role in the story.
If you're unsure whether to include a particular character, err on the side of inclusion. It's better to include a minor character than to miss an important one.
    `,
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
    model: "gemini-1.5-pro-exp-0801",
    systemInstruction:
`You will be provided with the full text of a novel and asked to describe a %CHARACTER%'s physical characteristics. Your task is to provide an accurate and detailed description that can be used by a diffusion model to depict %CHARACTER% visually.
Please follow these instructions carefully:
1. Read through the novel text and identify all mentions and descriptions of %CHARACTER%.
2. Focus solely on the physical characteristics of the character. This includes, but is not limited to:
   - Clothing
   - Hair (color, style, length)
   - Gender
   - Race or ethnicity
   - Age or apparent age
   - Height and build
   - Facial features
   - Any distinguishing marks or characteristics
3. At a minimum, you must include descriptions of the character's clothing, hair, gender, age and race. If these details are not explicitly stated in the text, make an educated guess based on context clues or the setting of the novel.
4. Be as descriptive and specific as possible. Instead of saying "he wore a shirt," specify the type, color, and style of the shirt if that information is available or can be reasonably inferred.
5. If you need to make educated guesses about any characteristics, base them on context clues from the novel, such as the time period, location, or social status of the character. Don't explain your guesses, just state them factually.
6. Avoid including personality traits, background information, or plot details unless they directly relate to the character's physical appearance.
7. Structure your description in a way that flows logically, such as starting with overall appearance and moving to specific details.
8. Write your description in a way that would be helpful for a diffusion model to create an accurate visual representation of the character.
`,
    generationConfig: {
      temperature: 0.5,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    },
  },
  getLocationDescription: {
    model: "gemini-1.5-pro-exp-0801",
    systemInstruction:
`You are being provided the full text of a novel. Respond an accurate description of the location "%LOCATION%".
Be descriptive so diffusion model can accurately depict %LOCATION%.
Ignore any inappropriate details which may cause content filtering issues.`,
    generationConfig: {
      temperature: 0.5,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    },
  },
  getDuplicateCharacters: {
    model: "gemini-1.5-pro-exp-0801",
    systemInstruction: `
You are being provided the full text of a novel as well as a list of characters. Are any of these characters duplicates of eachother?

%CHARACTER_LIST%
    `,
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        "type": "object",
        "properties": {
          "duplicate_characters": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string",
                },
                "duplicate_names": {
                  "type": "array",
                  "items": {
                    "type": "string",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default prompts;
