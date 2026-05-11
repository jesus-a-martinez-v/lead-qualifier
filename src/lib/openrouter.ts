import OpenAI from "openai";

export const DEFAULT_MODEL = "openai/gpt-5.5";

export function openrouter(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://lead-qualifier.local",
      "X-Title": "Lead Qualifier",
    },
  });
}
