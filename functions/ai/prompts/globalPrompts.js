const globalPrompts = {
  augmentScenes: {
    geminiModel: "gemini-1.5-pro-exp-0801",
    openAIModel: "gpt-4o-2024-08-06",
    systemInstruction: `
    You are tasked with improving draft scenes for a part of a novel. You will be provided with an entire chapter of the novel in CSV form and specific scenes in JSON format. Your goal is to enhance all the fields in the scenes to better illustrate exactly what is happening at that time based on the entire context of the chapter.
  
  Here is the scene JSON data that needs improvement:
  %SCENES_JSON%

  Here is the characters list in CSV format:
  %CHARACTERS_CSV%

  Here is the locations list in CSV format:
  %LOCATIONS_CSV%

  To complete this task, follow these steps:
  
  1. Analyze the chapter CSV data:
     - The CSV is formatted as "id","startTime","text"
     - Pay close attention to entries with startTime values between the scene's startTime and endTime
     - Also consider entries before and after the scene's time range for context
  
  2. Improve each field in the scene JSON:
     - description: Expand this to provide a more accurate summary of the scene
     - characters: You must only reference a character by name from the characters list. If a relevant character is missing, add them. If a character is incorrectly included, remove them. Do not edit a character's description 
     - locations: You must only reference a location by name from the locations list. If the locations is incorrect, correct it. Do not edit a location's description. 
     - startTime and endTime: Do not edit the startTime or endTime under any circumstances.
     - scene_number: Do not edit the scene_number under any circumstances.
     - viewpoint: make minor changes as needed
  
  3. Output the improved scene:
     - Maintain the JSON structure
     - Ensure all improvements are consistent with the original scene and the chapter context
     - Provide more detailed and vivid descriptions in each field
    `,
    geminiGenerationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
    openAIGenerationConfig: {
      temperature: 1,
      max_tokens: 8192,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scenes",
          strict: true,
        },
      },
    },
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
                  "required": [
                    "name",
                    "description",
                  ],
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
                  "required": [
                    "name",
                    "description",
                  ],
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
  moderateScene: {
    geminiModel: "gemini-1.5-flash-exp-0827",
    systemInstruction: `
You are tasked with moderating a draft scene from a novel to ensure it will not trigger content filters in an image diffusion model. Your goal is to modify the scene as minimally as possible while removing or altering any content that might be flagged by such filters.

When moderating the scene, keep in mind that image diffusion models often have filters for the following types of content:

1. Explicit sexual content or nudity
2. Graphic violence or gore
3. Hate speech or extreme political content
4. Illegal activities
5. Personal information or real individuals' names
6. Copyrighted characters or properties

Analyze the provided scene for any content that might fall into these categories or otherwise be potentially problematic for an image diffusion model. If specific words are offensive, use a less offensive word for the same subject.

After your analysis, provide a moderated version of the scene. Make only the changes necessary to avoid triggering content filters. Preserve the overall narrative and tone of the scene as much as possible.

Remember, your goal is to make the minimum necessary changes to ensure the scene won't trigger content filters in an image diffusion model while preserving the original narrative as much as possible.
  `,
    geminiGenerationConfig: {
      temperature: 0.5,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
    responseSchema: {
      "type": "object",
      "properties": {
        "scene": {
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
          },
          "required": [
            "description",
            "characters",
            "locations",
            "viewpoint",
          ],
        },
      },
    },
  },
  getCharacters: {
    geminiModel: "gemini-1.5-pro-exp-0801",
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
    geminiGenerationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
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
  getLocations: {
    geminiModel: "gemini-1.5-pro-exp-0827",
    systemInstruction:
`You will be provided with the text of a novel. Your task is to create a comprehensive list of all unique locations that appear in the story.

Carefully read through the text and identify all locations based on these criteria:

1. Only include locations, not people, objects, or characteristics.
2. Include all locations which are visualized in the story. If the reader is drawn to visualize the location, include it.
3. A location can be as small as a room or an elevator, or as large as a country.
4. Refer to each location by their most relevant name. Some locations may be given a nickname which sounds like an object or name.
5. If a location has multiple names or aliases, choose the most prominent one.
6. Include both major and minor locations, as long as they have some role in the story.

Locations should be classified according to the following hierarchy:
- MainLocations: Very large locations.
- SubLocations: Settings within MainLocations, no larger than a neighborhood or town.
- MinorLocations: Settings within a SubLocation, no larger than a building.
- MicroLocations: Small, specific areas within MinorLocations. No Larger than a room.

As you read through the novel, compile a list of all unique locations that meet these criteria. Be thorough and attentive to details, as locations may be mentioned briefly or indirectly.

If you're unsure whether to include a particular location or how to classify it, err on the side of inclusion and place it in the most appropriate category based on its significance in the story.

Before finalizing your list, review the novel text one more time to ensure you haven't missed any locations. Pay special attention to the opening and closing chapters, as well as any major plot points, as these often introduce important locations.

Here is the text of the novel:
`,
    geminiGenerationConfig: {
      temperature: 0.65,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
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
                    "MinorLocations": {
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
                          "MicroLocations": {
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
  getCharacterDescription: {
    geminiModel: "gemini-1.5-pro", // "gemini-1.5-pro-exp-0827",
    openAIModel: "gpt-4o-2024-08-06",
    systemInstruction:
`You will be provided with the full text of a novel and asked to describe a %CHARACTER%'s physical characteristics. Your task is to provide an accurate and detailed description that can be used by a diffusion model to depict %CHARACTER% visually.
%ALIASES_PHRASE%
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
    geminiGenerationConfig: {
      temperature: 0.5,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    },
    openAIGenerationConfig: {
      temperature: 0.5,
      max_tokens: 8192,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: {
        "type": "text",
      },
    },
  },
  getLocationDescription: {
    geminiModel: "gemini-1.5-pro-exp-0801",
    openAIModel: "gpt-4o-2024-08-06",
    systemInstruction:
`You are an AI assistant tasked with providing a detailed description of a specific location within a novel. You will be provided with the full text of a novel.
Your goal is to create an accurate and vivid depiction that can be used by a diffusion model to generate an image. Follow these instructions carefully:

1. The specific location you need to describe is:
%LOCATION_OBJECT%

3. Carefully read through the novel text and identify all passages that describe or mention %LOCATION_NAME%. Pay close attention to details about its appearance, atmosphere, and any notable features.

4. Based on the information gathered, create a detailed description of the location. Focus on visual elements that would be important for a diffusion model to accurately depict the scene. Include details such as:
   - Physical characteristics (size, shape, layout)
   - Colors and lighting
   - Textures and materials
   - Atmosphere and mood
   - Notable objects or features
   - Any other relevant sensory details (sounds, smells, etc.)

5. Important considerations:
%LOCATION_LIST%
   - Omit any inappropriate or explicit details that might cause content filtering issues.

Remember to base your description solely on the information provided in the novel text, and focus on creating a clear, visual representation of the location.

Here is the chapter text:`,
    geminiGenerationConfig: {
      temperature: 0.5,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    },
    openAIGenerationConfig: {
      temperature: 0.5,
      max_tokens: 8192,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: {
        "type": "text",
      },
    },
  },
  getDuplicateCharacters: {
    geminiModel: "gemini-1.5-pro-exp-0801",
    systemInstruction: `
You are being provided the full text of a novel as well as a list of characters. Are any of these characters duplicates of eachother?

%CHARACTER_LIST%
    `,
    geminiGenerationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
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
  getCharactersInChapter: {
    geminiModel: "gemini-1.5-pro-exp-0801",
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
    geminiGenerationConfig: {
      temperature: 0.5,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
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
  getLocationsInChapter: {
    geminiModel: "gemini-1.5-pro-exp-0801",
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
    geminiGenerationConfig: {
      temperature: 0.5,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
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
  convertThemeToPrompt: {
    geminiModel: "gemini-1.5-pro-exp-0801",
    systemInstruction: `
You will be given a description of a theme for an image. Your task is to summarize this theme into two parts:
1. A 1-2 word title
2. A 1-3 word description which will precede the word "style" (This will be given to a diffusion model to structure an image)

To create the title:
- Capture the essence of the theme in 1-2 words
- Make it concise and memorable
- If possible, use words from the original description

To create the prompt:
- Summarize the key elements of the theme in 1-3 words
- These words should precede "style" in the final prompt
- Choose words that best represent the visual elements or artistic style described
- It is perfectly okay for the title and the prompt to be identical

Example:
Noir Style, make it black and white. Scenes must be dark and mysterious

Title: Mysterious Noir
Prompt: Mysterious Noir style

Example:
Create images in the style of Andy Warhol's paintings, featuring bright colors, bold linework, references to people and products in popular culture, and repetitive compositions

Title: Andy Warhol
Prompt: Warhol Bright Linework Style

Example:
Miami Retro 80s Vibe, vibrant colors and nostalgia

Title: Miami Vice
Prompt: 80s Miami vice style

Example:
Steampunk and Medieval-Inspired Style

Title: Steampunk
Prompt: Medieval Steampunk Style 
    `,
    geminiGenerationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
    responseSchema: {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
        },
        "prompt": {
          "type": "string",
        },
      },
      "required": [
        "title",
        "prompt",
      ],
    },
  },
  transcribeFilmDirectorPrompt: {
    openAIModel: "gpt-4o-2024-08-06",
    systemInstruction: `
You are CinematographerGPT.

You are being provided a CSV with the raw text of a novel. The "text" column
of the CSV contains individual sentences from the chapter. The "startTime" of the CSV
is the time in seconds when the narrator reaches the sentence.
You are also being provided a list of characters, and a list of locations also in CSV format. 
Pay close attention to the alisases of each character and location.

You are collaborating with a film director to adapt this novel into a movie. 
Your task is to create a storyboard that the film crew will use to craft the movie scenes.

Read the text and generate a storyboard object for each key frame of the scene in the chapter.
Each storyboard object should provide a clear and structured snapshot of what will be captured in that specific key frame, 
rather than describing a continuous moving scene.
 A storyboard object is:
  a "scene_number" increasing one by one
  a "description" of the scene, which is very detailed and outlines exactly what is happening. Take a lot of the text from the chapter and insert it here.
  a "startTime" of the scene, based on the start_time of the sentences in the csv file the scene captures
  a "character" array of characters in the scene
  a "locations" array of locations in the scene
  a "viewpoint" {
  "setting": "time of day and lightning of the scene",
  "placement": "Placement of characters or other points of focus",
  "shot type: "wide, medium or close-up shot, camera angle",
  "mood": "mood of the scene",
  "technical": "lens choices and aperture settings"
  }

Only refer to characters by their name from the Character List.
Only refer to locations by their name from the Locations List.

If the text introduces a new character, or location, or other object, the storyboard can simply include a closeup of that subject.
You must create enough key frames to cover the entire chapter. Avoid creating key frames that are too similar to each other. 
Generate a key frames at least every 15 seconds, and at most every 5 seconds.

---Example Start---
List of Characters in CSV:
name, aliases
"Tommy","the kid"
"Hannah",""
"Alphie",""

List of Locations in CSV:
name, type, path
"office building", "building", "office building"
"13th floor elevator", "elevator", "office building > 13th floor elevator"
"toms dream", "dream", "toms dream"
"fiberglass coffin", "coffin", "toms dream > fiberglass coffin"

Chapter JSON File:
"id","startTime","text"
0,"4.5","Tommy entered the office building."
1,"6.126506024096385","He was wearing a black leather jacket."
2,"7.933734939759036","He saw Hannah."
3,"8.656626506024097","She was wearing a red dress."
4,"9.921686746987952","He saw Alphie."
5,"10.644578313253012","He was wearing a blue suit."
6,"11.909638554216867","Tommy and the others entered the elevator."
7,"14.259036144578314","He pressed the button for the 13th floor."
8,"16.066265060240966","All of a sudden, the elevator stopped."
9,"18.054216867469883","They were trapped."
10,"18.59638554216868","He was claustrophobic."
11,"19.68072289156627","He started to panic."
12,"20.76506024096386","He started to sweat."
13,"21.668674698795183","He began to remember the time he was trapped in a coffin."
14,"24.560240963855424","He was buried alive."
15,"25.644578313253014","He was in a coffin made of fiberglass."
16,"27.63253012048193","All of a sudden, Hannah shook the kid awake."
17,"29.80120481927711","He was dreaming."
18,"30.52409638554217","He was in the elevator."
19,"31.96987951807229","He was not in a coffin."
20,"33.234939759036145","He was not buried alive."

Storyboard object:
{scenes: 
    [{scene_number: 1, 
      description: 'Tommy walking towards the office building in the evening.', 
      characters: ['Tommy'], 
      locations: ['office building'],
      startTime: 4.5,
      viewpoint: {
        "setting": "evening, with glowing lights from the surrounding city",
        "placement": "Tommy in the centre of the image walking towards the office buiding",
        "shot type: "wide angle view of the building with a view of the street and surrounding area",
        "mood": "rainy and gloomy",
        "technical": "35mm f16"
        }
    }, 
    {scene_number: 2, 
      description: 'Tommy enters the office building, walking through the front doors.', 
      characters: ['Tommy'], 
      locations: ['office building'],
      startTime: 6,
      viewpoint: {
        "setting": "evening, with glowing lights from the surrounding city",
        "placement": "View of Tommy's face with the city in the background",
        "shot type: "close-up",
        "mood": "rainy and gloomy",
        "technical": "50mm f2.8"
        }
    }, 
    {scene_number: 3, 
      description: 'Tommy exits the doorway of the office building is looking at Hannah and Alphie inside the office building', 
      characters: ['Tommy', 'Hannah', "Alphie"], 
      locations: ['office building'],
      startTime: 8,
      viewpoint: {
        "setting": "inside building with flourescent lighting",
        "placement": "A view of Tommy's back as he walks towards Hallah and Alphie",
        "shot type: "close-up",
        "mood": "sombre and boring",
        "technical": "50mm f2.8"
        }
    },
    {scene_number: 4, 
      description: 'Tommy exits the doorway of the office building is looking at Hannah and Alphie inside the office building', 
      characters: ['Tommy', 'Hannah', "Alphie"], 
      locations: ['office building'],
      startTime: 10,
      viewpoint: {
        "setting": "inside building with flourescent lighting",
        "placement": "A view of Tommy Alphie and Hannah together",
        "shot type: "medium shot",
        "mood": "sombre and boring",
        "technical": "35mm f6"
        }
    },
    {scene_number: 5, 
      description: 'Tommy enters the elevator with Hannah to his left and Alphie to his right', 
      characters: ['Tommy', 'Hannah', "Alphie"], 
      locations: ['elevator'],
      startTime: 12,
      viewpoint: {
        "setting": "inside building with flourescent lighting",
        "placement": "A view of Tommy, Hannah and Alphie's back walking towards th elevator",
        "shot type: "medium shot",
        "mood": "sombre and boring",
        "technical": "50mm f1.4"
        }
    },
    {scene_number: 6, 
      description: 'Tommy enters the elevator with Hannah and Alphie', 
      characters: ['Tommy', 'Hannah', "Alphie"], 
      locations: ['fibreglass elevator'],
      startTime: 14,
      viewpoint: {
        "setting": "inside building with flourescent lighting",
        "placement": "Tommy Hannah and Alphie in the elevator looking in through the open elevator door",
        "shot type: "medium shot",
        "mood": "sombre and boring",
        "technical": "50mm f1.4"
        }
    },
    ...
]}

---Example End---
Generate a scene at least every 15 seconds, and at most every 5 seconds.
Respond only with JSON

List of Characters in CSV:
    %CHARACTER_LIST%
List of Locations in CSV:
    %LOCATIONS_LIST%
    `,
    openAIGenerationConfig: {
      temperature: 0.8,
      max_tokens: 16383,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scenes",
          strict: false,
        },
      },
    },
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
                  "type": "string",
                },
              },
              "locations": {
                "type": "array",
                "items": {
                  "type": "string",
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
};

export default globalPrompts;
