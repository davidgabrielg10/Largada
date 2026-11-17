import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import type { ExtractedReceipt, RegistrationDraft } from "@/lib/types";
import { parseDraft, parseReceipt } from "./schemas";
import { RECEIPT_SYSTEM, RECEIPT_USER, REGISTRATION_SYSTEM } from "./prompts";
import { AiUnavailableError, type AIProvider, type AiFile } from "./types";

const TIMEOUT_MS = 25_000;
/** Erros em que vale tentar o próximo modelo da lista (cota, indisponível, timeout). */
const RETRYABLE_STATUS = new Set([404, 408, 429, 500, 502, 503, 504]);

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AiUnavailableError("A IA devolveu uma resposta que não é JSON.");
  }
}

function filePart(file: AiFile): Part {
  return { inlineData: { mimeType: file.mimeType, data: Buffer.from(file.bytes).toString("base64") } };
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  private ai: GoogleGenAI;

  /** `models` em ordem de preferência: se o primeiro estourar a cota, usa o próximo. */
  constructor(apiKey: string, private models: string[]) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async askJson(system: string, parts: Part[]): Promise<unknown> {
    let last: unknown = null;
    for (const model of this.models) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await this.ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: system,
            responseMimeType: "application/json",
            temperature: 0,
            abortSignal: ctrl.signal,
          },
        });
        return parseJson(res.text ?? "");
      } catch (e) {
        last = e;
        if (e instanceof AiUnavailableError) throw e;
        const aborted = e instanceof Error && e.name === "AbortError";
        const retryable = aborted || (e instanceof ApiError && RETRYABLE_STATUS.has(e.status));
        if (!retryable) break; // chave inválida, pedido malformado: outro modelo não ajuda
      } finally {
        clearTimeout(timer);
      }
    }
    const msg = last instanceof Error ? last.message : String(last);
    throw new AiUnavailableError(`Gemini indisponível: ${msg.slice(0, 200)}`);
  }

  async extractReceipt(file: AiFile): Promise<ExtractedReceipt> {
    const raw = await this.askJson(RECEIPT_SYSTEM, [{ text: RECEIPT_USER }, filePart(file)]);
    try {
      return parseReceipt(raw);
    } catch {
      throw new AiUnavailableError("A IA devolveu um JSON fora do formato esperado.");
    }
  }

  async extractRegistration(input: { text?: string; file?: AiFile }): Promise<RegistrationDraft> {
    const parts: Part[] = [{ text: input.text?.trim() || "Extraia os dados da ficha na imagem." }];
    if (input.file) parts.push(filePart(input.file));
    const raw = await this.askJson(REGISTRATION_SYSTEM, parts);
    try {
      return parseDraft(raw);
    } catch {
      throw new AiUnavailableError("A IA devolveu um JSON fora do formato esperado.");
    }
  }
}
