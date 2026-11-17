import type {
  AgeRule, AiStatus, Category, EventRow, Flag, Gender, PaymentStatus, Prize, RaffleDraw, Receipt,
  Registration, RegistrationSource, RegistrationStatus, RegistrationWithReceipts,
} from "@/lib/types";

export interface NewRegistration {
  eventId: string;
  categoryId: string;
  fullName: string;
  email: string | null;
  city: string | null;
  team: string | null;
  whatsapp: string;
  birthDate: string;
  gender: Gender | null;
  weightKg: number | null;
  emergencyContact: string | null;
  termsAccepted: boolean;
  accessToken: string;
  source: RegistrationSource;
  paymentStatus: PaymentStatus;
  exempt?: boolean;
  flags: Flag[];
}

export interface RegistrationPatch {
  categoryId?: string;
  paymentStatus?: PaymentStatus;
  flags?: Flag[];
  status?: RegistrationStatus;
  fullName?: string;
  city?: string | null;
  team?: string | null;
  whatsapp?: string;
  weightKg?: number | null;
  kitDeliveredAt?: string | null;
  checkedInAt?: string | null;
  exempt?: boolean;
}

export interface NewEvent {
  slug: string;
  name: string;
  eventDate: string;
  city: string | null;
  description: string | null;
  pixKey: string | null;
  basePrice: number;
  ageRule: AgeRule;
  hasKit: boolean;
  exemptCode?: string | null;
}
export type EventPatch = Partial<Omit<NewEvent, "slug">> & { registrationOpen?: boolean };

export interface NewCategory {
  eventId: string;
  name: string;
  price: number;
  minAge: number | null;
  maxAge: number | null;
  minWeightKg: number | null;
  minAthletes: number;
  gender: Gender | null;
  sortOrder: number;
}
export type CategoryPatch = Partial<Omit<NewCategory, "eventId">>;

export interface NewReceipt {
  eventId: string;
  registrationId: string;
  storagePath: string;
  sha256: string | null;
}

export interface ReceiptPatch {
  aiStatus?: AiStatus;
  amount?: number | null;
  payerName?: string | null;
  paidAt?: string | null;
  transactionId?: string | null;
  aiRaw?: unknown;
}

/** Erro de domínio que o banco levanta (ex.: data de nascimento inválida). */
export class RepoError extends Error {
  constructor(public code: "invalid_birth_date" | "not_found" | "conflict" | "unknown", message: string) {
    super(message);
    this.name = "RepoError";
  }
}

export interface Repo {
  readonly kind: "supabase" | "memory";
  listEvents(): Promise<EventRow[]>;
  getEventBySlug(slug: string): Promise<EventRow | null>;
  getEventById(id: string): Promise<EventRow | null>;
  createEvent(input: NewEvent): Promise<EventRow>;
  updateEvent(id: string, patch: EventPatch): Promise<EventRow>;
  setRegistrationOpen(eventId: string, open: boolean): Promise<void>;
  listCategories(eventId: string): Promise<Category[]>;
  createCategory(input: NewCategory): Promise<Category>;
  updateCategory(id: string, patch: CategoryPatch): Promise<Category>;
  /** Só remove se ninguém estiver inscrito nela (lança "conflict"). */
  deleteCategory(id: string): Promise<void>;
  listPrizes(eventId: string): Promise<Prize[]>;
  /** Troca toda a premiação de uma categoria. */
  setPrizes(categoryId: string, prizes: Omit<Prize, "categoryId">[]): Promise<void>;

  createRegistration(input: NewRegistration): Promise<Registration>;
  getRegistration(id: string): Promise<RegistrationWithReceipts | null>;
  getRegistrationByToken(token: string): Promise<RegistrationWithReceipts | null>;
  listRegistrations(eventId: string): Promise<RegistrationWithReceipts[]>;
  updateRegistration(id: string, patch: RegistrationPatch): Promise<Registration>;
  /** Registra a presença só se ainda não houver (atômico). `already` = já estava registrada; o horário original é mantido. */
  checkIn(id: string, at: string): Promise<{ registration: Registration; already: boolean }>;
  findActiveByWhatsapp(eventId: string, whatsapp: string, excludeId?: string): Promise<Registration | null>;

  addReceipt(input: NewReceipt): Promise<Receipt>;
  updateReceipt(id: string, patch: ReceiptPatch): Promise<void>;
  /** Comprovante igual (mesmo arquivo ou mesmo ID de transação) em OUTRA inscrição ativa. */
  isDuplicateReceipt(eventId: string, registrationId: string, sha256: string | null, transactionId: string | null): Promise<boolean>;

  saveFile(path: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  getFileUrl(path: string): Promise<string | null>;
  /** Para o provedor simulado e a rota de visualização local. */
  readFile?(path: string): Promise<{ bytes: Uint8Array; mimeType: string } | null>;

  listDraws(eventId: string): Promise<RaffleDraw[]>;
  addDraw(eventId: string, registrationId: string, prizeLabel: string | null): Promise<RaffleDraw>;
}
