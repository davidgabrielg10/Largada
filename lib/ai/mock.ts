import type { ExtractedReceipt, RegistrationDraft } from "@/lib/types";
import { sha256Hex } from "@/lib/hash";
import { normalizePhone, toISODate } from "@/lib/text";
import type { AIProvider, AiFile, ReceiptContext } from "./types";

/**
 * Provedor SIMULADO, só para desenvolver sem chave. Não lê imagem nenhuma:
 * devolve o que a inscrição espera. O painel mostra um aviso quando ele está ativo.
 * O ID da transação sai do hash do arquivo, então enviar o mesmo arquivo duas
 * vezes dispara o alerta de comprovante repetido, como no real.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock" as const;

  async extractReceipt(file: AiFile, ctx?: ReceiptContext): Promise<ExtractedReceipt> {
    return {
      isReceipt: true,
      amount: ctx?.expectedAmount ?? null,
      payerName: ctx?.registrantName ?? null,
      receiverName: "Organização (simulado)",
      paidAt: new Date().toISOString(),
      transactionId: `SIM${sha256Hex(file.bytes).slice(0, 20).toUpperCase()}`,
      bank: "Simulado",
      confidence: 0.9,
    };
  }

  async extractRegistration(input: { text?: string }): Promise<RegistrationDraft> {
    const text = input.text ?? "";
    const field = (...labels: string[]) => {
      for (const l of labels) {
        const m = new RegExp(`${l}\\s*[:\\-]\\s*(.+)`, "i").exec(text);
        if (m) return m[1].trim();
      }
      return null;
    };
    const phone = field("whats(?:app)?", "telefone", "contato");
    const weight = field("peso");
    const sexo = field("sexo")?.toUpperCase() ?? "";
    return {
      fullName: field("nome"),
      city: field("cidade"),
      team: field("equipe", "time"),
      categoryHint: field("categoria", "modalidade"),
      whatsapp: phone ? normalizePhone(phone) : null,
      birthDate: toISODate(field("nascimento", "data de nascimento", "nasc")),
      gender: sexo.startsWith("F") ? "F" : sexo.startsWith("M") ? "M" : null,
      emergencyContact: field("emerg[eê]ncia"),
      weightKg: weight ? Number(weight.replace(/[^\d.,]/g, "").replace(",", ".")) || null : null,
      email: field("e-?mail"),
    };
  }
}
