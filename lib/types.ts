// Tipos de domínio da Largada. Espelham o schema em supabase/schema.sql.

export type PaymentStatus = "pending" | "verified" | "review" | "mismatch";
export type RegistrationStatus = "active" | "cancelled";
export type RegistrationSource = "link" | "assisted" | "import";
export type AiStatus = "pending" | "done" | "failed";
export type Gender = "M" | "F";
/** Como a idade é calculada: na data da prova, ou a idade que a pessoa completa no ano (comum no ciclismo). */
export type AgeRule = "event_date" | "year_end";

/** Sinais que a conferência levanta sobre uma inscrição. */
export type Flag =
  | "age_out_of_range"
  | "weight_missing"
  | "weight_below_min"
  | "no_receipt"
  | "amount_low"
  | "amount_high"
  | "amount_unreadable"
  | "payer_name_mismatch"
  | "duplicate_receipt"
  | "duplicate_whatsapp"
  | "not_a_receipt"
  | "low_confidence"
  | "future_date"
  | "ai_unavailable"
  | "gender_mismatch";

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  eventDate: string; // YYYY-MM-DD
  city: string | null;
  description: string | null;
  pixKey: string | null;
  basePrice: number;
  registrationOpen: boolean;
  nextBib: number;
  ageRule: AgeRule;
  /** O evento entrega kit na retirada? (opcional: muitos não entregam) */
  hasKit: boolean;
  /** Código que a organização digita no formulário para se inscrever isenta. Nunca vai ao navegador do público. */
  exemptCode: string | null;
  isDemo: boolean;
}

export interface Category {
  id: string;
  eventId: string;
  name: string;
  price: number;
  minAge: number | null;
  maxAge: number | null;
  minWeightKg: number | null;
  minAthletes: number;
  /** Restrição de sexo (null = aberta a todos). */
  gender: Gender | null;
  sortOrder: number;
}

export interface Prize {
  categoryId: string;
  place: number;
  amount: number | null;
  isTrophy: boolean;
}

export interface Registration {
  id: string;
  eventId: string;
  categoryId: string;
  bibNumber: number;
  bibLabel: string;
  fullName: string;
  email: string | null;
  city: string | null;
  team: string | null;
  whatsapp: string;
  birthDate: string; // YYYY-MM-DD
  gender: Gender | null;
  weightKg: number | null;
  emergencyContact: string | null;
  termsAcceptedAt: string | null;
  source: RegistrationSource;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  /** Isento de pagamento (organização, convidados). Conta como inscrito e tem número, mas não entra no faturamento. */
  exempt: boolean;
  flags: Flag[];
  /** Chave secreta do link da ficha do atleta. */
  accessToken: string;
  kitDeliveredAt: string | null;
  /** Quando a presença foi registrada pelo QR ou pela lista (só o primeiro registro vale). */
  checkedInAt: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface Receipt {
  id: string;
  eventId: string;
  registrationId: string;
  storagePath: string;
  sha256: string | null;
  aiStatus: AiStatus;
  amount: number | null;
  payerName: string | null;
  paidAt: string | null;
  transactionId: string | null;
  createdAt: string;
}

export interface RegistrationWithReceipts extends Registration {
  receipts: Receipt[];
}

export interface CategoryStatusRow {
  categoryId: string;
  categoryName: string;
  minAthletes: number;
  athletes: number;
  athletesPaid: number;
  belowMinimum: boolean;
}

export interface RaffleDraw {
  id: string;
  eventId: string;
  registrationId: string;
  prizeLabel: string | null;
  drawnAt: string;
}

/** Dados que a IA extrai de um comprovante Pix. */
export interface ExtractedReceipt {
  isReceipt: boolean;
  amount: number | null;
  payerName: string | null;
  receiverName: string | null;
  paidAt: string | null; // ISO
  transactionId: string | null;
  bank: string | null;
  confidence: number; // 0..1
}

/** Rascunho de inscrição extraído de uma mensagem ou imagem de WhatsApp. */
export interface RegistrationDraft {
  fullName: string | null;
  city: string | null;
  team: string | null;
  categoryHint: string | null;
  whatsapp: string | null;
  birthDate: string | null; // YYYY-MM-DD
  gender: Gender | null;
  emergencyContact: string | null;
  weightKg: number | null;
  email: string | null;
}
