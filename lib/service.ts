import { randomBytes, randomUUID } from "node:crypto";
import { getAI, AiUnavailableError, type AiFile } from "@/lib/ai";
import { getRepo, RepoError } from "@/lib/repo";
import { evaluateReceipt, replacePaymentFlags } from "@/lib/receipt";
import { ageReference, categoryFlags, matchCategory } from "@/lib/rules";
import { sha256Hex } from "@/lib/hash";
import { normalizePhone } from "@/lib/text";
import type { Category, EventRow, ExtractedReceipt, Flag, Gender, Registration, RegistrationDraft, RegistrationSource } from "@/lib/types";

export const CATEGORY_FLAGS: Flag[] = ["age_out_of_range", "weight_missing", "weight_below_min", "gender_mismatch"];

export const MAX_FILE_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export class ServiceError extends Error {
  constructor(public code: "event_not_found" | "closed" | "category_not_found" | "invalid_birth_date" | "invalid_file" | "invalid_input" | "not_found", message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export interface RegistrationInput {
  eventSlug: string;
  categoryId: string;
  fullName: string;
  email?: string | null;
  city?: string | null;
  team?: string | null;
  whatsapp: string;
  birthDate: string;
  gender?: Gender | null;
  weightKg?: number | null;
  emergencyContact?: string | null;
  termsAccepted: boolean;
  source?: RegistrationSource;
  file?: AiFile | null;
}

export function validateFile(file: AiFile) {
  if (!ALLOWED_MIME.includes(file.mimeType)) throw new ServiceError("invalid_file", "Envie uma imagem (JPG, PNG, WebP) ou PDF.");
  if (file.bytes.byteLength > MAX_FILE_BYTES) throw new ServiceError("invalid_file", "Arquivo grande demais (máximo 6 MB).");
  if (file.bytes.byteLength === 0) throw new ServiceError("invalid_file", "Arquivo vazio.");
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/**
 * Lê o comprovante com a IA e deixa o CÓDIGO decidir o status.
 * Se a IA falhar, a inscrição fica "em conferência" com o alerta ai_unavailable:
 * nunca é aprovada sem leitura.
 */
async function reviewReceipt(
  reg: Registration, category: Category, event: EventRow, file: AiFile, receiptId: string, sha: string,
): Promise<Registration> {
  const repo = getRepo();
  const ai = getAI();
  let extracted: ExtractedReceipt | null = null;
  if (ai) {
    try {
      extracted = await ai.extractReceipt(file, { expectedAmount: category.price, registrantName: reg.fullName });
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) console.error("[largada] falha inesperada na IA", e);
    }
  }
  const isDuplicate = await repo.isDuplicateReceipt(event.id, reg.id, sha, extracted?.transactionId ?? null);
  const ev = evaluateReceipt({ fullName: reg.fullName, expectedAmount: category.price, extracted, isDuplicate, now: new Date() });
  await repo.updateReceipt(receiptId, {
    aiStatus: extracted ? "done" : "failed",
    amount: extracted?.amount ?? null,
    payerName: extracted?.payerName ?? null,
    paidAt: extracted?.paidAt ?? null,
    transactionId: extracted?.transactionId ?? null,
    aiRaw: extracted,
  });
  return repo.updateRegistration(reg.id, { paymentStatus: ev.status, flags: replacePaymentFlags(reg.flags, ev.flags) });
}

async function storeReceipt(event: EventRow, reg: Registration, category: Category, file: AiFile) {
  validateFile(file);
  const repo = getRepo();
  const sha = sha256Hex(file.bytes);
  const path = `${event.id}/${reg.id}/${randomUUID()}.${EXT[file.mimeType]}`;
  await repo.saveFile(path, file.bytes, file.mimeType);
  const receipt = await repo.addReceipt({ eventId: event.id, registrationId: reg.id, storagePath: path, sha256: sha });
  return reviewReceipt(reg, category, event, file, receipt.id, sha);
}

/** 128 bits aleatórios: o link da ficha não dá para adivinhar. */
export const newAccessToken = () => randomBytes(16).toString("base64url");

/** Pipeline único: usado pelo formulário público, pelo cadastro assistido e pela importação. */
export async function register(input: RegistrationInput): Promise<{ registration: Registration; event: EventRow; category: Category }> {
  const repo = getRepo();
  const event = await repo.getEventBySlug(input.eventSlug);
  if (!event) throw new ServiceError("event_not_found", "Evento não encontrado.");
  const source = input.source ?? "link";
  if (!event.registrationOpen && source === "link") throw new ServiceError("closed", "As inscrições deste evento estão encerradas.");
  const categories = await repo.listCategories(event.id);
  const category = categories.find((c) => c.id === input.categoryId);
  if (!category) throw new ServiceError("category_not_found", "Categoria não encontrada.");
  if (input.file) validateFile(input.file);

  const whatsapp = normalizePhone(input.whatsapp) ?? input.whatsapp;
  const flags: Flag[] = categoryFlags(category, input.birthDate, ageReference(event), input.weightKg ?? null, input.gender ?? null);
  if (await repo.findActiveByWhatsapp(event.id, whatsapp)) flags.push("duplicate_whatsapp");
  if (!input.file) flags.push("no_receipt");

  let registration: Registration;
  try {
    registration = await repo.createRegistration({
      eventId: event.id, categoryId: category.id, fullName: input.fullName.trim(), email: input.email ?? null,
      city: input.city?.trim() || null, team: input.team?.trim() || null, whatsapp, birthDate: input.birthDate,
      gender: input.gender ?? null, accessToken: newAccessToken(),
      weightKg: input.weightKg ?? null, emergencyContact: input.emergencyContact?.trim() || null,
      termsAccepted: input.termsAccepted, source, paymentStatus: "pending", flags,
    });
  } catch (e) {
    if (e instanceof RepoError && e.code === "invalid_birth_date") throw new ServiceError("invalid_birth_date", "Data de nascimento inválida.");
    throw e;
  }
  if (input.file) registration = await storeReceipt(event, registration, category, input.file);
  return { registration, event, category };
}

/** Envio de comprovante depois da inscrição (atleta que pagou mais tarde, ou organizador). */
export async function attachReceipt(registrationId: string, file: AiFile) {
  const repo = getRepo();
  const reg = await repo.getRegistration(registrationId);
  if (!reg) throw new ServiceError("not_found", "Inscrição não encontrada.");
  const event = (await repo.getEventById(reg.eventId))!;
  const category = (await repo.listCategories(event.id)).find((c) => c.id === reg.categoryId)!;
  const base = { ...reg, flags: reg.flags.filter((f) => f !== "no_receipt") };
  return storeReceipt(event, base, category, file);
}

/** Cadastro assistido: transforma texto/imagem solta de WhatsApp em rascunho + categoria sugerida. */
export async function draftFromMessage(eventSlug: string, input: { text?: string; file?: AiFile }) {
  const repo = getRepo();
  const event = await repo.getEventBySlug(eventSlug);
  if (!event) throw new ServiceError("event_not_found", "Evento não encontrado.");
  if (input.file) validateFile(input.file);
  const ai = getAI();
  if (!ai) return { draft: null as RegistrationDraft | null, category: null as Category | null, aiAvailable: false };
  try {
    const draft = await ai.extractRegistration(input);
    const category = matchCategory(draft.categoryHint, await repo.listCategories(event.id));
    return { draft, category, aiAvailable: true };
  } catch {
    return { draft: null, category: null, aiAvailable: false };
  }
}

/** O próprio atleta envia o comprovante pela ficha (quem pagou depois). */
export async function attachReceiptByToken(token: string, file: AiFile) {
  const reg = await getRepo().getRegistrationByToken(token);
  if (!reg || reg.status !== "active") throw new ServiceError("not_found", "Inscrição não encontrada.");
  if (reg.paymentStatus === "verified") throw new ServiceError("invalid_file", "O pagamento desta inscrição já foi conferido.");
  if (reg.receipts.length >= 5) throw new ServiceError("invalid_file", "Limite de comprovantes atingido. Fale com a organização.");
  return attachReceipt(reg.id, file);
}

export type AdminAction = "approve" | "reject" | "cancel" | "reopen" | "kit" | "unkit" | "uncheckin";

/** Decisões do organizador. Aprovar limpa só os alertas de pagamento. */
export async function adminAction(registrationId: string, action: AdminAction) {
  const repo = getRepo();
  const reg = await repo.getRegistration(registrationId);
  if (!reg) throw new ServiceError("not_found", "Inscrição não encontrada.");
  switch (action) {
    case "approve": return repo.updateRegistration(reg.id, { paymentStatus: "verified", flags: replacePaymentFlags(reg.flags, []) });
    case "reject": return repo.updateRegistration(reg.id, { paymentStatus: "mismatch" });
    case "cancel": return repo.updateRegistration(reg.id, { status: "cancelled" });
    case "reopen": return repo.updateRegistration(reg.id, { status: "active" });
    case "kit": {
      const event = await repo.getEventById(reg.eventId);
      if (!event?.hasKit) throw new ServiceError("invalid_input", "Este evento não entrega kit.");
      if (reg.status !== "active") throw new ServiceError("invalid_input", "Inscrição cancelada.");
      return repo.updateRegistration(reg.id, { kitDeliveredAt: new Date().toISOString() });
    }
    case "unkit": return repo.updateRegistration(reg.id, { kitDeliveredAt: null });
    case "uncheckin": return repo.updateRegistration(reg.id, { checkedInAt: null });
  }
}

/** Trocar a categoria recalcula os alertas de idade/peso. */
export async function changeCategory(registrationId: string, categoryId: string) {
  const repo = getRepo();
  const reg = await repo.getRegistration(registrationId);
  if (!reg) throw new ServiceError("not_found", "Inscrição não encontrada.");
  const event = (await repo.getEventById(reg.eventId))!;
  const category = (await repo.listCategories(event.id)).find((c) => c.id === categoryId);
  if (!category) throw new ServiceError("category_not_found", "Categoria não encontrada.");
  const flags = [...reg.flags.filter((f) => !CATEGORY_FLAGS.includes(f)), ...categoryFlags(category, reg.birthDate, ageReference(event), reg.weightKg, reg.gender)];
  return repo.updateRegistration(reg.id, { categoryId, flags });
}

/** Registra a presença (QR ou lista). Mantém o primeiro horário; `already` avisa que o QR já foi usado. */
export async function checkIn(registrationId: string) {
  const repo = getRepo();
  const reg = await repo.getRegistration(registrationId);
  if (!reg) throw new ServiceError("not_found", "Inscrição não encontrada.");
  if (reg.status !== "active") throw new ServiceError("invalid_input", "Inscrição cancelada.");
  return repo.checkIn(registrationId, new Date().toISOString());
}
