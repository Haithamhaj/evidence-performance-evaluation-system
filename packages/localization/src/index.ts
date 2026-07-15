import rubricVersionOneEnglish from "./rubric/v1.en.json" with { type: "json" };

import { RubricContentSchema } from "./rubric/rubric-schema.js";

export const approvedEnglishRubric = RubricContentSchema.parse(rubricVersionOneEnglish);

export * from "./rubric/rubric-schema.js";
export * from "./rubric/source-hash.js";
