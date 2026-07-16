import OpenAI from "openai";

declare const client: { generate(input: unknown): unknown };

export const sdk = OpenAI;
export const result = client.generate({ protected: true });
