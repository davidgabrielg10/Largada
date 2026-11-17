import type { ExtractedReceipt, Flag, PaymentStatus } from "./types";
import { nameSimilarity } from "./text";

export interface EvaluateInput {
  /** Nome do inscrito. */
  fullName: string;
  /** Valor da categoria. */
  expectedAmount: number;
  /** Dados lidos pela IA; null quando a IA não respondeu. */
  extracted: ExtractedReceipt | null;
  /** O mesmo comprovante já foi usado por outra inscrição ativa. */
  isDuplicate: boolean;
  now?: Date;
}

export interface Evaluation {
  status: PaymentStatus;
  flags: Flag[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_THRESHOLD = 0.6;
const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Cruza o que a IA leu no comprovante com o que a inscrição pede.
 * Quem decide é o código, não a IA: a IA só lê.
 *  - mismatch: valor menor que o da categoria, ou comprovante repetido;
 *  - review:   qualquer outra dúvida (o organizador confere);
 *  - verified: nada de errado encontrado.
 */
export function evaluateReceipt(input: EvaluateInput): Evaluation {
  const flags: Flag[] = [];
  const ex = input.extracted;
  const now = (input.now ?? new Date()).getTime();

  if (!ex) {
    flags.push("ai_unavailable");
  } else if (!ex.isReceipt) {
    flags.push("not_a_receipt");
  } else {
    if (ex.confidence < CONFIDENCE_THRESHOLD) flags.push("low_confidence");

    if (ex.amount == null) flags.push("amount_unreadable");
    else if (ex.amount + 0.005 < input.expectedAmount) flags.push("amount_low");
    else if (ex.amount - 0.005 > input.expectedAmount) flags.push("amount_high");

    if (!ex.payerName) {
      if (!flags.includes("low_confidence")) flags.push("low_confidence");
    } else if (nameSimilarity(ex.payerName, input.fullName) < NAME_THRESHOLD) {
      flags.push("payer_name_mismatch");
    }

    if (ex.paidAt) {
      const t = Date.parse(ex.paidAt);
      if (!Number.isNaN(t) && t > now + DAY_MS) flags.push("future_date");
    }
  }

  if (input.isDuplicate) flags.push("duplicate_receipt");

  const status: PaymentStatus =
    flags.includes("amount_low") || flags.includes("duplicate_receipt")
      ? "mismatch"
      : flags.length > 0
        ? "review"
        : "verified";

  return { status, flags };
}

const PAYMENT_FLAGS: Flag[] = [
  "no_receipt",
  "amount_low",
  "amount_high",
  "amount_unreadable",
  "payer_name_mismatch",
  "duplicate_receipt",
  "not_a_receipt",
  "low_confidence",
  "future_date",
  "ai_unavailable",
];

/** Troca só os alertas de pagamento, preservando os de idade/peso/WhatsApp. */
export function replacePaymentFlags(current: Flag[], payment: Flag[]): Flag[] {
  const kept = current.filter((f) => !PAYMENT_FLAGS.includes(f));
  return [...new Set([...kept, ...payment])];
}

export const FLAG_LABELS: Record<Flag, string> = {
  age_out_of_range: "Idade fora da categoria",
  weight_missing: "Peso não informado",
  weight_below_min: "Peso abaixo do mínimo da categoria",
  no_receipt: "Sem comprovante",
  amount_low: "Valor pago menor que o da categoria",
  amount_high: "Valor pago maior que o da categoria",
  amount_unreadable: "Valor ilegível no comprovante",
  payer_name_mismatch: "Nome do pagador diferente do inscrito",
  duplicate_receipt: "Comprovante já usado em outra inscrição",
  duplicate_whatsapp: "WhatsApp já usado em outra inscrição",
  not_a_receipt: "A imagem não parece um comprovante Pix",
  low_confidence: "Leitura com baixa confiança",
  future_date: "Data do pagamento no futuro",
  ai_unavailable: "Leitura automática indisponível",
  gender_mismatch: "Sexo diferente do da categoria",
};
