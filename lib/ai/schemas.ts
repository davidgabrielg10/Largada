import { z } from "zod";
import type { ExtractedReceipt, RegistrationDraft } from "@/lib/types";
import { normalizePhone, toISODate } from "@/lib/text";

/** "R$ 1.080,50" -> 1080.5 ; 80 -> 80 ; "80.00" -> 80 */
export function parseMoney(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const optStr = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v == null ? null : String(v).trim() || null));

const receiptRaw = z.object({
  is_receipt: z.boolean().catch(false),
  amount: z.unknown().transform(parseMoney),
  payer_name: optStr,
  receiver_name: optStr,
  paid_at: optStr,
  transaction_id: optStr,
  bank: optStr,
  confidence: z.number().min(0).max(1).catch(0.5),
});

export function parseReceipt(raw: unknown): ExtractedReceipt {
  const r = receiptRaw.parse(raw);
  const t = r.paid_at ? Date.parse(r.paid_at) : NaN;
  return {
    isReceipt: r.is_receipt,
    amount: r.amount,
    payerName: r.payer_name,
    receiverName: r.receiver_name,
    paidAt: Number.isNaN(t) ? null : new Date(t).toISOString(),
    transactionId: r.transaction_id,
    bank: r.bank,
    confidence: r.confidence,
  };
}

const draftRaw = z.object({
  full_name: optStr,
  city: optStr,
  team: optStr,
  category_hint: optStr,
  whatsapp: optStr,
  birth_date: optStr,
  gender: z.unknown().transform((v) => {
    const s = String(v ?? "").trim().toUpperCase();
    return s.startsWith("F") ? ("F" as const) : s.startsWith("M") ? ("M" as const) : null;
  }),
  emergency_contact: optStr,
  weight_kg: z.unknown().transform(parseMoney),
  email: optStr,
});

export function parseDraft(raw: unknown): RegistrationDraft {
  const r = draftRaw.parse(raw);
  return {
    fullName: r.full_name,
    city: r.city,
    team: r.team,
    categoryHint: r.category_hint,
    whatsapp: r.whatsapp ? normalizePhone(r.whatsapp) : null,
    birthDate: toISODate(r.birth_date),
    gender: r.gender,
    emergencyContact: r.emergency_contact,
    weightKg: r.weight_kg,
    email: r.email && /^\S+@\S+\.\S+$/.test(r.email) ? r.email : null,
  };
}
