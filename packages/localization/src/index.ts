import rubricVersionOneEnglish from "./rubric/v1.en.json" with { type: "json" };

import { RubricContentSchema } from "./rubric/rubric-schema.ts";

export const approvedEnglishRubric = RubricContentSchema.parse(rubricVersionOneEnglish);

export * from "./catalog.ts";
export * from "./formatters.ts";
export * from "./locales.ts";
export * from "./rubric/rubric-schema.ts";
