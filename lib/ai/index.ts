import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import type { AIProvider } from "./types";

export * from "./types";

const DEFAULT_MODELS = "gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite";

let cached: { key: string; provider: AIProvider | null } | null = null;

/**
 * Escolhe o provedor de IA:
 *  - AI_MODE=gemini | mock | off força a escolha;
 *  - sem AI_MODE: usa o Gemini se houver GEMINI_API_KEY; em desenvolvimento
 *    sem chave usa o simulado; em produção sem chave fica desligado (null),
 *    e toda inscrição vai para conferência manual — nunca aprova sozinha.
 */
export function getAI(): AIProvider | null {
  const mode = (process.env.AI_MODE ?? "").toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const models = (process.env.GEMINI_MODELS ?? DEFAULT_MODELS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const key = `${mode}|${apiKey}|${models.join(",")}|${process.env.NODE_ENV}`;
  if (cached?.key === key) return cached.provider;

  let provider: AIProvider | null;
  if (mode === "off") provider = null;
  else if (mode === "mock") provider = new MockProvider();
  else if (mode === "gemini" || apiKey) provider = apiKey ? new GeminiProvider(apiKey, models) : null;
  else provider = process.env.NODE_ENV === "production" ? null : new MockProvider();

  cached = { key, provider };
  return provider;
}
