import type { ExtractedReceipt, RegistrationDraft } from "@/lib/types";

export interface AiFile {
  bytes: Uint8Array;
  mimeType: string;
}

/** Só usado pelo provedor simulado; o Gemini nunca recebe isso (evita viés). */
export interface ReceiptContext {
  expectedAmount: number;
  registrantName: string;
}

export interface AIProvider {
  readonly name: "gemini" | "mock";
  extractReceipt(file: AiFile, ctx?: ReceiptContext): Promise<ExtractedReceipt>;
  extractRegistration(input: { text?: string; file?: AiFile }): Promise<RegistrationDraft>;
}

/** A IA não respondeu (cota, rede, chave, resposta inválida). O app segue sem ela. */
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}
