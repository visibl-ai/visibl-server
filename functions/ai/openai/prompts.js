/*
TODO: We should update this to subject, predicate, object.


*/

const prompts = {
  ner_characters_prompt: `
  Task: Create JSON_caracters_update_list, a list that updates and expands the existing JSON_characters_list based on the novel's text excerpt CSV_chapter_text.

  Procedure:
  
  1. Input Analysis:
  - You will receive a text excerpt in CSV format (CSV_chapter_text). Each row having a "text" key (chapter text) and a "startTime" key (time in seconds when the text is narrated).
  2. Existing Characters Update:
  - For each Character already listed in JSON_characters_list, review CSV_chapter_text for any new aliases or names.
  - Update the existing character entries with these aliases, ensuring there is only one object per individual character.
  - Do your best to add aliases to characters instead of adding new ones.
  3. New Characters Addition:
  - Identify and list any new characters mentioned in CSV_chapter_text that are not in JSON_characters_list, and not an alias of another character.
  - Ensure new characters are not duplicates of existing characters, or aliases of another character.
  - For each new character, create a new object including:
  --The most commonly used name in the text (or a descriptive reference if no name is provided).
  --The startTime of their first mention in the text.
  --A newly generated unique ID.
  4. Main Name Modification:
  - Modify the mainName attribute for a character only if a more proper name is used in the text.
  5. Inclusions and Exclusions:
  - Focus exclusively on characters. Avoid references to locations, objects, things, or characteristics.
  - Include every character mentioned, regardless of its significance in the text.
  - Ensure all aliases, significant or not, are added to the character objects.
  - Add no duplicates. Do not add a character if it exists already in JSON_characters_list.
  6. Data Integrity:
  - Maintain one object per individual character. Avoid creating multiple entries for the same character.
  - Do not remove any character from JSON_characters_list, even if it isn't mentioned in CSV_chapter_text.
  - Don't feel forced to update an entry. It is okay to leave many entries unchanged.
  - Only include an entry in JSON_characters_update_list if it has been updated or added.
  
  Goal: The final output should be a comprehensive and detailed JSON_characters_update_list that accurately reflects all character-related information from CSV_chapter_text.

----Example Start----

Example JSON_chracters_list:
{ characters:[
    {
      id: 1,
      timeIntroduced: 7.94,
      mainName: "jaques",
      aliases: ["Jaques"]
    },
    {
      id: 2,
      timeIntroduced: 7.94,
      mainName: "defarge",
      aliases: ["Monsieur Defarge"]
    }
  ]
}

Example CSV_chapter_text:
"id","startTime","text"
0,7.94,"It is so, Jacques, replied Monsieur Defarge. "
1,11.38,"The third man put down his glass. "
2,22.220000000000002,"Ah! Such poor cattle always have a bitter taste in their mouths; they lead a hard life. Am I right, Jacques?"
3,27.66,"You are right, Jacques, replied Monsieur Defarge. "
4,30.220000000000002,"A movement from Madame Defarge attracted his attention. Gentlemen, he said, the room that you wish to see is at the top of the stairs. Go into the courtyard. One of you has been there before and will show you the way."
5,33.26,"They paid for their wine and left. The oldish gentleman walked towards Monsieur Defarge and asked permission to speak to him. Their conversation was short. Almost at the first word Monsieur Defarge's face showed keen attention. After a minute Defarge signalled his agreement and went out. The gentleman then called to the young lady, and they, too, went outside. "
6,36.74,"Madame went on with her knitting and took no notice. "
7,40.58,"Mr Jarvis Lorry (the gentleman) and Miss Lucie Manette joined Defarge in the courtyard to which he had recently directed the three men. In the courtyard Defarge did a surprising thing. He went down on one knee and put his lips to the young lady's hand. "
8,44.3," Defarge at one time had been a servant of Dr Manette, Lucies father. Lucie's mother had died, and her father had disappeared: no one knew what had happened to him. His money was in Tellsons Bank — an English bank. The baby Lucie was brought to England, and Mr Jarvis Lorry, an official of Tellson's Bank and an old friend of her father's, was put in charge of her money and her education. Mr Lorry had asked an Englishwoman, Miss Pross, to bring up the child. Over the years that followed, Miss Pross became like a mother to Lucie and would have given her fife for her."
 
Example updated JSON_character_list:
{ characters: [
  {
    id: 1,
    timeIntroduced: 7.94,
    mainName: "jaques",
    aliases: ["Jaques"]
  },
  {
    id: 2,
    timeIntroduced: 7.94,
    mainName: "defarge",
    aliases: ["Monsieur Defarge", "Defarge"],
  },
  {
    id: 3,
    timeIntroduced: 11.38,
    mainName: "jarvis"
    aliases: ["third man", "oldish gentleman", "Jarvis Lorry"],
  },
  {
    id: 4,
    timeIntroduced: 30.220000000000002,
    mainName: "madame defarge"
    aliases: ["Madame Defarge", "Madame"],
  },
  {
    id: 5,
    timeIntroduced: 40.58,
    mainName: "lucie"
    aliases: ["young lady", "Lucie Manette"],
  },
  {
    id: 6,
    timeIntroduced: 44.3,
    mainName: "manette"
    aliases: ["Dr Manette", "Lucie's father"],
  },
  {
    id: 7,
    timeIntroduced: 44.3,
    mainName: "miss pross"
    aliases: ["Miss Pross"],
  }
]
}  

----Example End----

Do NOT use any example data in your response. ONLY include PEOPLE in this list, not objects or locations. Don't remove characters from the list.

Respond only with JSON. 

JSON_chracters_list:
%CHARACTERS_LIST%

CSV_chapter_text:
  `,

  ner_simple_dedup: `
Task: Generate a JSON_duplicates list detailing all duplicate aliases found in a JSON_list.

Procedure:
1. Input Analysis:
- Review JSON_list, noting each object's "aliases" key with alias strings.
2. Duplicate Identification:
- Systematically compare the aliases across all objects in JSON_list.
- Define 'similarity' for duplicates as case-insensitive matching, and explicitly look for any other specified forms of similarity.
3. JSON_duplicates Response Structure:
- Construct a comprehensive list in the following format, including multiple entries as needed:
{ duplcates:
  [
    { firstOccurrence: {id: X, alias: "Alias1"}, duplicate: {id: Y, alias: "Alias2"} },
    { firstOccurency: {id: m, alias: "Alias3"}, duplicate: {id: n, alias: "Alias4"} },
  ]
}

- Ensure every found duplicate pair is represented in the list.
4. Handling Multiple Duplicates:
- If an alias matches with multiple others, create a separate entry for each matching pair.
5. Non-Duplication Indicator:
- If no duplicates are found, respond with an empty list: [].
6. Expectation of a Comprehensive List:
- The goal is a complete list, capturing all instances of duplication.

Goal: To create a detailed and exhaustive list in JSON format, JSON_duplicates, identifying all instances of similar aliases within JSON_list.

Respond only with JSON.
  `,

  // Needs to be improved as this currently considers aliases in the
  // same character as duplicates. Oh well.
  ner_characters_prompt_dedup_with_text: `
Task: Generate a JSON_duplicates list detailing all duplicate characters in a JSON_characters_list based on chapter text.

Procedure:
1. Input Analysis:
- Review JSON_characters_list, noting each object's "aliases" key with alias strings.
2. Duplicate Identification:
- For each character, review the Chapter text and determine if antother character on the list can be reasoned to be the same character.
3. JSON_duplicates Response Structure:
- Construct a comprehensive list in the following format, including multiple entries as needed:
{ duplcates:
  [
    { firstOccurrence: {id: X, mainName: "Alias1"}, duplicate: {id: Y, mainName: "Alias2"}, reason: "text reasoning why both are likely the same character" },
    { firstOccurency: {id: m, mainName: "Alias3"}, duplicate: {id: n, mainName: "Alias4"}, reason: "text reasoning why both are likely the same character" },
  ]
}

- Ensure every found duplicate pair is represented in the list.
4. Handling Multiple Duplicates:
- If an alias matches with multiple others, create a separate entry for each matching pair.
5. Non-Duplication Indicator:
- If no duplicates are found, respond with an empty list: [].
6. Expectation of a Comprehensive List:
- The goal is a complete list, capturing all instances of duplication.

Goal: To create a detailed and exhaustive list in JSON format, JSON_duplicates, identifying all instances of duplicated characters in the chapter text.

JSON_characters_list:
%CHARACTERS_LIST%

Respond only with JSON.
  `,


  ner_characters_props_prompt: `
The following is a text excerpt of a novel CSV_chapter_text, as well as a JSON_chracters_list object of some characters in the novel.
The excerpt is in JSON form, with each row containing a "text" key of the chapter text, and 
 a startTime containing the time in seconds when the narrator the text.
Your goal is to read the entire text, and augment JSON_characters_properties. JSON_characters_properties provides a physical description of each character.
If any of the chapter text describes a characeter, add a new object to the JSON_characters_properties array.
This will outline a character, a relationship, a property, and a time. The relationship is the relationship between the character and the
property. The property is a phyiscal property of the character. The time is the "startTime" of the text that provided the relationship.
These relationships will be used in a neo4j graph database to be able to accurately describe the physical characteristics of each character. 
Do not add emotional or psychological characteristics. Only add physical characteristics.

There is no limit to the number of relationships or properties that can be provided. 
It is imperative to be comprehensive. Leave no detail out.

Here is an example:

--- EXAMPLE START ---
Example JSON_chracters_list:
{ characters: [
  {
    id: 1,
    timeIntroduced: 7.94,
    mainName: "jaques",
    aliases: ["Jaques"]
  },
  {
    id: 2,
    timeIntroduced: 7.94,
    mainName: "defarge",
    aliases: ["Monsieur Defarge", "Defarge"],
  },
  {
    id: 3,
    timeIntroduced: 11.38,
    mainName: "jarvis"
    aliases: ["third man", "oldish gentleman", "Jarvis Lorry"],
  }]
}

Example JSON_characters_properties:
{
  "properties": [
    { "character": "jaques", "relationship": "height", "property": "tall", startTime: 57 },
    { "character": "jaques", "relationship": "ethnicity", "property": "asian", startTime: 57 },
  ]
}

Example CSV_chapter_text:
"id","startTime","text"
0,57,"Jaques entered the room. He was a tall dark man of asian descent. He was wearing a black leather jacket."
1,64,"He hated the Defarge. The Monsieur Defarge were always getting in his way. The were also asian, but hated how short they were."
2,72,"They both had black hair and sneakers. But they always bought their clothes from Jarvis Lorry - an italian tailor with an avant garde fashion style. "


Example augmented JSON_characters_properties:
{
  "properties": [
    { "character": "jaques", "relationship": "height", "property": "tall", startTime: 57 },
    { "character": "jaques", "relationship": "ethnicity", "property": "asian", startTime: 57 },
    { "character": "jaques", "relationship": "wearing", "property": "black leather jacket", startTime: 57 },
    { "character": "defarge", "relationship": "height", "property": "short", startTime: 64 },
    { "character": "defarge", "relationship": "ethnicity", "property": "asian", startTime: 64 },
    { "character": "defarge", "relationship": "hair", "property": "black", startTime: 72 },
    { "character": "defarge", "relationship": "wearing", "property": "sneakers", startTime: 72 },
    { "character": "jarvis", "relationship": "ethnicity", "property": "italian", startTime: 72 },
    { "character": "jarvis", "relationship": "fashion style", "property": "avant garde", startTime: 72 },
  ]
}

--- EXAMPLE END ---

JSON_chracters_list:
%CHARACTERS_LIST%

JSON_characters_properties:
%CHARACTER_PROPERTIES%

Respond only with JSON.
  `,

  ner_locations_prompt: `
Task: Create JSON_locations_update_list, a list that updates and expands the existing JSON_locations_list based on the novel's text excerpt CSV_chapter_text.

Procedure:

1. Input Analysis:
- You will receive a text excerpt in CSV format (CSV_chapter_text). Each row having a "text" key (chapter text) and a "startTime" key (time in seconds when the text is narrated).
2. Existing Locations Update:
- For each location already listed in JSON_locations_list, review CSV_chapter_text for any new aliases or names.
- Update the existing location entries with these aliases, ensuring there is only one object per physical location.
- Do your best to add aliases to locations instead of adding new ones.
3. New Locations Addition:
- Identify and list any new locations mentioned in CSV_chapter_text that are not in JSON_locations_list, and not an alias of another location.
- Ensure new locations are not duplicates of existing locations, or located in another location.
- For each new location, create a new object including:
--The most commonly used name in the text (or a descriptive reference if no name is provided).
--The startTime of its first mention in the text.
--A newly generated unique ID.
4. Main Name Modification:
- Modify the mainName attribute for a location only if a more proper name is used in the text.
5. Inclusions and Exclusions:
- Focus exclusively on locations. Avoid references to people, objects, or characteristics.
- Include every location mentioned, regardless of its significance in the text.
- Ensure all aliases, significant or not, are added to the location objects.
- Add no duplicates. Do not add a location if it exists already in JSON_locations_list.
6. Data Integrity:
- Maintain one object per physical location. Avoid creating multiple entries for the same location.
- Do not remove any location from JSON_locations_list, even if it isn't mentioned in CSV_chapter_text.
- Don't feel forced to update an entry. It is okay to leave many entries unchanged.
- Only include an entry in JSON_locations_update_list if it has been updated or added.

Goal: The final output should be a comprehensive and detailed JSON_locations_update_list that accurately reflects all location-related information from CSV_chapter_text.

----Example Start----
Example JSON_locations_list:
{ locations:[
  {
    id: 1,
    timeIntroduced: 33.44,
    mainName: "earth",
    aliases: ["Terra Firma", "earth"]
  },
  {
    id: 2,
    timeIntroduced: 46.98,
    mainName: "mars",
    aliases: ["mars"]
  }]
}

Example CSV_chapter_text:
"id","startTime","text"
0,33.44,"n the twilight of the Terran era, humanity reached beyond its cradle, Terra Firma, now a bustling nexus of interstellar governance. Once known as Earth, its sprawling megalopolises and verdant remnants stood as a testament to human resilience, a beacon of progress amidst the cosmic void."
1,46.98,"Far from the bustle of Terra Firma, the enigmatic Red Oasis whispered secrets beneath its windswept crests. Mars, as it was known to the ancients, with its labyrinthine canyons and crimson vistas, became a fertile ground for scientific breakthroughs, each rock a cipher waiting to be decoded."
2,63.55,"Beyond the Red Oasis, in the outer reaches of the solar system, the Azure Behemoth beckoned the boldest explorers. Neptune, shrouded in cobalt mists, held mysteries of the universe, offering a gateway to the unknown. Each location, distinct and vibrant, resonated with the echoes of past, present, and future, intertwining in humanity's cosmic symphony, a saga of exploration and discovery that spanned the stars."

Example JSON_locations_update_list:
{ locations:[
  {
    id: 2,
    timeIntroduced: 46.98,
    mainName: "mars",
    aliases: ["Red Oasis", "Mars"]
  },
  {
    id: 3,
    timeIntroduced: 63.55,
    mainName: "neptune",
    aliases: ["The Azure Behemoth", "Neptune"]
  }]
}
--- Example End ---

Do NOT use any example data in your response. ONLY include LOCATIONS in this list, not objects or people.

Respond only with JSON. 

JSON_locations_list:
%LOCATIONS_LIST%

CSV_chapter_text:
  `,

  //   ner_locations_prompt_dedup: `
  // Task: Generate a JSON_duplicates list detailing all duplicate aliases found in a JSON_locations_list.

  // Procedure:
  // 1. Input Analysis:
  // - Review JSON_locations_list, noting each object's "aliases" key with alias strings.
  // 2. Duplicate Identification:
  // - Systematically compare the aliases across all objects in JSON_locations_list.
  // - Define 'similarity' for duplicates as case-insensitive matching, and explicitly look for any other specified forms of similarity.
  // 3. JSON_duplicates Response Structure:
  // - Construct a comprehensive list in the following format, including multiple entries as needed:
  // { duplcates:
  //   [
  //     { firstOccurrence: {id: X, alias: "Alias1"}, duplicate: {id: Y, alias: "Alias2"} },
  //     { firstOccurency: {id: m, alias: "Alias3"}, duplicate: {id: n, alias: "Alias4"} },
  //   ]
  // }

  // - Ensure every found duplicate pair is represented in the list.
  // 4. Handling Multiple Duplicates:
  // - If an alias matches with multiple others, create a separate entry for each matching pair.
  // 5. Non-Duplication Indicator:
  // - If no duplicates are found, respond with an empty list: [].
  // 6. Expectation of a Comprehensive List:
  // - The goal is a complete list, capturing all instances of duplication.

  // Goal: To create a detailed and exhaustive list in JSON format, JSON_duplicates, identifying all instances of similar aliases within JSON_locations_list.

  // Respond only with JSON.
  //   `,

  // Needs to be improved as this currently considers aliases in the
  // same location as duplicates. Oh well.
  ner_locations_prompt_dedup_with_text: `
Task: Generate a JSON_duplicates list detailing all duplicate locations in a JSON_locations_list based on chapter text.

Procedure:
1. Input Analysis:
- Review JSON_locations_list, noting each object's "aliases" key with alias strings.
2. Duplicate Identification:
- For each location, review the Chapter text and determine if antother location on the list can be reasoned to be the same location.
3. JSON_duplicates Response Structure:
- Construct a comprehensive list in the following format, including multiple entries as needed:
{ duplcates:
  [
    { firstOccurrence: {id: X, mainName: "Alias1"}, duplicate: {id: Y, mainName: "Alias2"}, reason: "text reasoning why both are likely the same location" },
    { firstOccurency: {id: m, mainName: "Alias3"}, duplicate: {id: n, mainName: "Alias4"}, reason: "text reasoning why both are likely the same location" },
  ]
}

- Ensure every found duplicate pair is represented in the list.
4. Handling Multiple Duplicates:
- If an alias matches with multiple others, create a separate entry for each matching pair.
5. Non-Duplication Indicator:
- If no duplicates are found, respond with an empty list: [].
6. Expectation of a Comprehensive List:
- The goal is a complete list, capturing all instances of duplication.

Goal: To create a detailed and exhaustive list in JSON format, JSON_duplicates, identifying all instances of duplicated locations in the chapter text.

JSON_locations_list:
%LOCATIONS_LIST%

Respond only with JSON.
  `,

  ner_locations_props_prompt: `
Task: Enhance the JSON_location_properties array with physical descriptions of locations from the novel's text CSV_chapter_text.

Procedure:
1. Input Analysis:
- Examine CSV_chapter_text, each row containing "text" (chapter text) and "startTime" (time when the text is narrated).
- Examine JSON_locations_list, an array of all locations in the text. All properties must refer to a location in this list.
- Examin the aliases of each location to ensure you properly refence the text. 
Location Description Extraction:
2. Identify descriptions of locations in the chapter text.
- A property is only relevant if it would assist an artist in painting the location
- For each description of a location, create a new object in JSON_location_properties.
3. Object Structure:
- Each object should outline a location (and its id), a relationship, a physical property, and the time of the text that provided this information.
- The relationship describes the connection between the location and the property.
- Include only physical characteristics.
4. Comprehensive Detailing:
- Ensure no physical detail about the locations is omitted.
5. Data Integrity:
- Only reference properties of locations. Do NOT reference characters in locations, or properties of those characters.
6. No properties found
- If no new properties are found with respect to a location, respond with an empty list: {properties: []}

Example for Clarification:
--- EXAMPLE START ---

Example JSON_locations_list:
{
  "locations": [
    {
      "id": 15,
      "timeIntroduced": 15.22,
      "mainName": "Garden of Eden",
      "aliases": ["Eden",  "Garden of Eden"]
    },
    {
      "id": 27,
      "timeIntroduced": 20.47,
      "mainName": "Mount Olympus",
      "aliases": ["Olympus", "Mount Olympus"]
    }
  ]
}
Example JSON_location_properties:
{
  "properties": [
    { "location": "Garden of Eden", "location_id": 15, "relationship": "vegetation", "property": "lush and verdant", "startTime": 15.22 },
    { "location": "Mount Olympus", "location_id": 27, "relationship": "elevation", "property": "towered above the clouds", "startTime": 20.47 },
  ]
}
Example CSV_chapter_text:
"id","startTime","text"
0,15.22,"The Garden of Eden was lush and verdant, filled with exotic flowers and fruit-bearing trees."
1,20.47,"Mount Olympus towered majestically above the clouds, its peaks perpetually snow-capped."

Example augmented JSON_location_properties:
{
  "properties": [
    { "location": "Garden of Eden", "location_id": 15, "relationship": "vegetation", "property": "lush and verdant", "startTime": 15.22 },
    { "location": "Garden of Eden", "location_id": 15, "relationship": "flora", "property": "exotic flowers and fruit-bearing trees", "startTime": 15.22 },
    { "location": "Mount Olympus", "location_id": 27, "relationship": "elevation", "property": "towered above the clouds", "startTime": 20.47 },
    { "location": "Mount Olympus", "location_id": 27, "relationship": "climate", "property": "perpetually snow-capped peaks", "startTime": 20.47 }
  ]
}
--- EXAMPLE END ---

JSON_locations_list:
%LOCATIONS_LIST%

JSON_location_properties:
%LOCATION_PROPERTIES%

Respond only with JSON.
  `,

  character_image_prompt: `
   You are CharacterInterpreterGPT.
   Your task is to interpret a CSV-formatted list of a character's physical characteristics and convert it into a descriptive sentence. 
   This sentence should accurately represent the character's appearance based on the provided physical attributes. 
   The description will be used to generate a visual image using Dall-E 3, so it's crucial to include only the physical characteristics 
   and omit non-physical traits such as voice or personality.

   The CSV input character_properties_CSV will have the following format:
   - 'character': The name of the character
   - 'has': A specific physical attribute or feature
   - 'property': The description of the attribute or feature
   From the CSV data, construct a detailed sentence that vividly portrays the character's physical appearance. Ensure that the description is comprehensive, 
   includes only physical attributes, and integrates all details in a logical and fluent manner. Feel free to completely ignore non-physical traits.
   
   --- EXAMPLE START ---
   example character_properties_CSV:
"character","has","property"
"Jimmy","hair","silver"
"Jimmy","gender","man"
"Jimmy","height","tall"
"Jimmy","eyes","blue"
"Jimmy","skin","tatooed"
"Jimmy","ethnicity","black"
"Jimmy","voice","loud and abnoxious"
"Jimmy","holding","cigarette with smoke coming out of it"

  example result:
  {
    character: "Jimmy",
    description: "Jimmy is a tall black man with siver hair and blue eyes. He has a tatoo on his skin. He is holding a cigarette with smoke coming out of it."
  }
   --- EXAMPLE END ---
   Respond only with JSON.
   character_properties_CSV: 
  `,

  character_image_summarize_prompt: `
  You are CharacterInterpreterGPT.
  You are being given text with the description of a character. Your goal is to summarize this description by removing any non-physical traits. Remove descriptions of items the character might be holding, focus on what they look like and are wearing. Be sure to include age, gender, clothing and race if it is provided or can be inferred.
  The description will be used to generate a visual image using Dall-E 3, so it's crucial to include only the physical characteristics. 
  Respond in point form, do not include any gap words or explanations of your reasoning. Do not leave out any detail.
  `,

  location_image_summarize_prompt: `
  You are LocationInterpreterGPT.
  You are being given text with the description of a location. Your goal is to summarize this description by removing any non-physical traits. Remove descriptions any characters might inside the location.
  The description will be used to generate a visual image using Dall-E 3, so it's crucial to include only the physical characteristics. 
  Respond in point form, do not include any gap words or explanations of your reasoning. Do not leave out any detail.
  `,

  location_image_prompt: `
   You are LocationInterpreterGPT.
   Your task is to interpret a CSV-formatted list of a location's physical characteristics and convert it into a descriptive sentence. 
   This sentence should accurately represent the location's appearance based on the provided physical attributes. 
   The description will be used to generate a visual image using Dall-E 3, so it's crucial to include only the physical characteristics 
   and omit non-physical traits such as specific people inside the location, or the traits of characters inside the location.

   The CSV input location_properties_CSV will have the following format:
   - 'location': The name of the location
   - 'has': A specific physical attribute or feature
   - 'property': The description of the attribute or feature
   From the CSV data, construct a detailed sentence that vividly portrays the location's physical appearance. Ensure that the description is comprehensive, 
   includes only physical attributes, and integrates all details in a logical and fluent manner. Feel free to completely ignore non-physical, or human traits.
   
   --- EXAMPLE START ---
   example location_properties_CSV:
"location","has","property"
"moes","exterior","red bricks"
"moes","sign above entrance","moes written in red letters on a white background"
"moes","regular patron","barney an overweight alcoholic"
"moes","business type","bar"
"moes","interior","dark and dingy"
"moes","furniture","wooden bar stools"

   example result:
   {
    location: "moes",
    description: "moes is a bar. It has a red brick exterior. There is a sign above the entrance that says moes written in red letters on a white background. inside is dark and dingy with wooden bar stools."
   }
   --- EXAMPLE END ---
   Respond only with JSON.
   locations_properties_CSV: 
  `,
  transcribe_film_director_prompt: `
You are CinematographerGPT.

You are being provided a CSV with the raw text of a novel. The "text" column
of the CSV contains individual sentences from the chapter. The "startTime" of the CSV
is the time in seconds when the narrator reaches the sentence.
You are also being provided a list of characters, and a list of locations. 
Pay close attention to the alisases of each character and location.

You are working with a film director. You are creating a movie based on the novel. You are creating a 
set of scenes that a film crew will use to create the movie. Your goal is to read the text, and create a
scene object for each scene in the chapter. A scene object is:
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

You must create enough scenes to cover the entire chapter. Many scenes can be of the same description but
from a different viewpoint. 
Generate a scene at least every 15 seconds, and at most every 5 seconds.

---Example Start---
List of Characters:
    ["Tommy","Hannah", "Alphie"]
List of Locations:
    ["office building","elevator", "coffin"]
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

Scenes object:
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
      locations: ['elevator'],
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

List of Characters:
    %CHARACTER_LIST%
List of Locations:
    %LOCATIONS_LIST%
  `,
  transcribe_film_director_prompt_16k: `
You are CinematographerGPT.

You are being provided a CSV with the raw text of a novel. The "text" column
of the CSV contains individual sentences from the chapter. The "startTime" of the CSV
is the time in seconds when the narrator reaches the sentence.
You are also being provided a list of characters, and a list of locations. 

You are working with a film director. You are creating a movie based on the novel. You are creating a 
set of scenes that a film crew will use to create the movie. Your goal is to read the text, and create a
scene object for each scene in the chapter. You must create a new scene at least every 20 seconds, and at most every 5 seconds.
 A scene object is:
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

You must create enough scenes to cover the entire chapter. 
Create at least %NUM_SCENES% scenes.

---Example Start---
List of Characters:
    ["Tommy","Hannah", "Alphie"]
List of Locations:
    ["office building","elevator", "coffin"]
Chapter JSON File:
"id","startTime","text"
0,"4.5","Tommy entered the office building."
1,"6.1","He was wearing a black leather jacket."
2,"7.9","He saw Hannah."
3,"8.6","She was wearing a red dress."
4,"9.9","He saw Alphie."
5,"10.6","He was wearing a blue suit."
6,"11.9","Tommy and the others entered the elevator."
7,"14.2","He pressed the button for the 13th floor."
8,"16.06","All of a sudden, the elevator stopped."
9,"18.0","They were trapped."
10,"18.5","He was claustrophobic."
11,"19.6","He started to panic."
12,"20.7","He started to sweat."
13,"21.6","He began to remember the time he was trapped in a coffin."
14,"24.5","He was buried alive."
15,"25.6","He was in a coffin made of fiberglass."
16,"27.6","All of a sudden, Hannah shook the kid awake."
17,"29.8","He was dreaming."
18,"30.5","He was in the elevator."
19,"31.9","He was not in a coffin."
20,"33.2","He was not buried alive."

Scenes object:
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
      locations: ['elevator'],
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

List of Characters:
%CHARACTER_LIST%
List of Locations:
%LOCATIONS_LIST%


Create at least %NUM_SCENES% scenes. You must generate all scenes, do not stop until complete.
Respond only with JSON.
  `,
  character_description_full_text: `
You will be provided with the full text of a novel and asked to describe %CHARACTER%'s physical characteristics. Your task is to provide an accurate and detailed description that can be used by a diffusion model to depict %CHARACTER% visually.
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
3. At a minimum, you must include descriptions of the character's clothing, hair, gender, age and race. If these details are not explicitly stated in the text, make an educated guess based on context clues or the setting of the novel. Don't be afraid to guess a race.
4. Be as descriptive and specific as possible. Instead of saying "he wore a shirt," specify the type, color, and style of the shirt if that information is available or can be reasonably inferred.
5. If you need to make educated guesses about any characteristics, base them on context clues from the novel, such as the time period, location, or social status of the character. Don't explain your guesses, just state them factually.
6. Avoid including personality traits, background information, or plot details unless they directly relate to the character's physical appearance.
7. Structure your description in a way that flows logically, such as starting with overall appearance and moving to specific details.
8. Write your description in a way that would be helpful for a diffusion model to create an accurate visual representation of the character.
  `,
  location_description_full_text: `
You will be provided with the full text of a novel and asked to describe a specific location mentioned in the story. Your task is to create an accurate and vivid description of this location that could be used by a diffusion model to generate an image.

The location you need to describe is:
%LOCATION%

To complete this task, follow these steps:

1. Carefully read through the novel text, paying special attention to any mentions or descriptions of %LOCATION%

2. Identify all relevant details about %LOCATION%, including:
   - Physical characteristics (size, shape, color, etc.)
   - Atmosphere or mood
   - Time period or historical context
   - Any significant objects or features within the location
   - Sensory details (sights, sounds, smells, textures)

3. Synthesize these details into a coherent and vivid description. Your description should:
   - Be as accurate to the novel's portrayal as possible
   - Provide enough detail for a diffusion model to generate an accurate image
   - Capture the essence and mood of the location

4. Ensure your description is appropriate for all audiences:
   - Omit any graphic violence, explicit sexual content, or other inappropriate details
   - Focus on elements that would not trigger content filtering issues

5. Write your final description and aim for a paragraph of 4-6 sentences that paints a clear picture of the location.

Remember, your goal is to create a description that is both faithful to the novel and suitable for image generation. Be descriptive and evocative, but avoid any content that could be deemed inappropriate or offensive.
  `,
};
export default prompts;
