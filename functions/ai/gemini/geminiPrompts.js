const prompts = {
  augmentScenes: {
    model: "gemini-1.5-pro-exp-0801",
    systemInstruction: `
  You are tasked with improving draft scenes for a part of a novel. You will be provided with an entire chapter of the novel in CSV form and specific scenes in JSON format. Your goal is to enhance all the fields in the scenes to better illustrate exactly what is happening at that time based on the entire context of the chapter.

Here is the scene JSON data that needs improvement:
%SCENES_JSON%

To complete this task, follow these steps:

1. Analyze the chapter CSV data:
   - The CSV is formatted as "id","startTime","text"
   - Pay close attention to entries with startTime values between the scene's startTime and endTime
   - Also consider entries before and after the scene's time range for context

2. Improve each field in the scene JSON:
   - description: Expand this to provide a more vivid and detailed summary of the scene
   - characters: If a relevant character is missing, add them. If a character is incorrectly included, remove them. Add more depth to the characters description, including any new information from the chapter. 
   - locations: If the locations is incorrect, correct it. Enhance the description of the locations, adding sensory details and atmosphere. 
   - startTime and endTime: Do not edit the startTime or endTime under any circumstances.
   - scene_number: Do not edit the scene_number under any circumstances.
   - viewpoint: make minor changes as needed

3. Output the improved scene:
   - Maintain the JSON structure
   - Ensure all improvements are consistent with the original scene and the chapter context
   - Provide more detailed and vivid descriptions in each field
  `,
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        "type": "object",
        "properties": {
          "scenes": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "description": {
                  "type": "string",
                },
                "characters": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "name": {
                        "type": "string",
                      },
                      "description": {
                        "type": "string",
                      },
                    },
                  },
                },
                "locations": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "name": {
                        "type": "string",
                      },
                      "description": {
                        "type": "string",
                      },
                    },
                  },
                },
                "startTime": {
                  "type": "number",
                },
                "viewpoint": {
                  "type": "object",
                  "properties": {
                    "setting": {
                      "type": "string",
                    },
                    "placement": {
                      "type": "string",
                    },
                    "shot type": {
                      "type": "string",
                    },
                    "mood": {
                      "type": "string",
                    },
                    "technical": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "setting",
                    "placement",
                    "shot type",
                    "mood",
                    "technical",
                  ],
                },
                "endTime": {
                  "type": "number",
                },
                "scene_number": {
                  "type": "integer",
                },
              },
              "required": [
                "description",
                "characters",
                "locations",
                "startTime",
                "viewpoint",
                "endTime",
                "scene_number",
              ],
            },
          },
        },
      },
    },
  },
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
        "type": "object",
        "properties": {
          "characters": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string",
                },
                "aliases": {
                  "type": "array",
                  "items": {
                    "type": "string",
                  },
                },
              },
              "required": [
                "name",
              ],
            },
          },
        },
        "required": [
          "characters",
        ],
      },
    },
  },
  getLocations: {
    model: "gemini-1.5-pro-exp-0801",
    systemInstruction:
`You will be provided with the text of a novel. Your task is to create a list of all unique locations that appear in the story. 
Carefully read through the text and identify all locations based on these criteria:
1. Only include locations, not people, objects, or characteristics.
2. Include all locations which are visualized in the story. If the reader is drawn to visualize the location, include it.
3. A location can be as small as a room or an elevator, or as large as a country.
4. Refer to each location by their most relevant name.
5. If a location has multiple names or aliases, choose the most prominent one
6. Include both major and minor locations, as long as they have some role in the story.
If you're unsure whether to include a particular location, err on the side of inclusion. It's better to include a minor location than to miss an important one.
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
          "MainLocations": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string",
                },
                "type": {
                  "type": "string",
                },
                "SubLocations": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "name": {
                        "type": "string",
                      },
                      "type": {
                        "type": "string",
                      },
                      "MicroLocation": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "name": {
                              "type": "string",
                            },
                            "type": {
                              "type": "string",
                            },
                          },
                          "required": [
                            "name",
                            "type",
                          ],
                        },
                      },
                    },
                    "required": [
                      "name",
                      "type",
                    ],
                  },
                },
              },
              "required": [
                "name",
                "type",
              ],
            },
          },
        },
        "required": [
          "MainLocations",
        ],
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
  getCharactersInChapter: {
    model: "gemini-1.5-pro-exp-0801",
    systemInstruction: `
You will be provided with a chapter of text from a novel and a list of characters. Your task is to identify which characters from the provided list appear in the chapter.

Here is the list of characters to look for:
%CHARACTERS_LIST%
To complete this task, follow these steps:
1. Carefully read through the chapter text.
2. For each character in the character list, check if their name appears in the chapter text. Be sure to consider variations of names (e.g., "Jim" might also appear as "Jimmy" or "James").
3. Create a list of the characters that appear in the chapter.

If no characters from the list appear in the chapter, set no_characters_found = true.

Remember to only include characters from the provided list that actually appear in the chapter text.
    `,
    generationConfig: {
      temperature: 0.5,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        "type": "object",
        "properties": {
          "characters_in_chapter": {
            "type": "array",
            "items": {
              "type": "string",
            },
          },
          "no_characters_found": {
            "type": "boolean",
          },
        },
        "required": [
          "no_characters_found",
        ],
      },
    },
  },
  getLocationsInChapter: {
    model: "gemini-1.5-pro-exp-0801",
    systemInstruction: `
You will be provided with a chapter of text from a novel and a list of locations. Your task is to identify which locations from the provided list appear in the chapter.

Here is the list of locations to look for:
%LOCATIONS_LIST%
To complete this task, follow these steps:
1. Carefully read through the chapter text.
2. For each location in the location list, check if their name appears in the chapter text. Be sure to consider variations of names (e.g., "Jim" might also appear as "Jimmy" or "James").
3. Create a list of the locations that appear in the chapter.

If no locations from the list appear in the chapter, set no_locationss_found = true.

Remember to only include locations from the provided list that actually appear in the chapter text.
    `,
    generationConfig: {
      temperature: 0.5,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        "type": "object",
        "properties": {
          "locations_in_chapter": {
            "type": "array",
            "items": {
              "type": "string",
            },
          },
          "no_locations_found": {
            "type": "boolean",
          },
        },
        "required": [
          "no_locations_found",
        ],
      },
    },
  },
};

export default prompts;
