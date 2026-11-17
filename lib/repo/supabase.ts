import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Category, EventRow, Flag, Prize, RaffleDraw, Receipt, Registration, RegistrationWithReceipts } from "@/lib/types";
import { RepoError, type CategoryPatch, type EventPatch, type NewCategory, type NewEvent, type NewReceipt, type NewRegistration, type ReceiptPatch, type Repo, type RegistrationPatch } from "./types";

const BUCKET = "comprovantes";
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const num = (v: unknown) => (v == null ? null : Number(v));

const toEvent = (r: Row): EventRow => ({
  id: r.id, slug: r.slug, name: r.name, eventDate: r.event_date, city: r.city, description: r.description,
  pixKey: r.pix_key, basePrice: Number(r.base_price), registrationOpen: r.registration_open,
  nextBib: r.next_bib, ageRule: r.age_rule ?? "event_date", hasKit: r.has_kit ?? false, exemptCode: r.exempt_code ?? null, isDemo: r.is_demo,
});
const toCategory = (r: Row): Category => ({
  id: r.id, eventId: r.event_id, name: r.name, price: Number(r.price), minAge: r.min_age, maxAge: r.max_age,
  minWeightKg: num(r.min_weight_kg), minAthletes: r.min_athletes, gender: r.gender ?? null, sortOrder: r.sort_order,
});
const toPrize = (r: Row): Prize => ({ categoryId: r.category_id, place: r.place, amount: num(r.amount), isTrophy: r.is_trophy });
const toReg = (r: Row): Registration => ({
  id: r.id, eventId: r.event_id, categoryId: r.category_id, bibNumber: r.bib_number, bibLabel: r.bib_label,
  fullName: r.full_name, email: r.email, city: r.city, team: r.team, whatsapp: r.whatsapp, birthDate: r.birth_date,
  gender: r.gender ?? null, accessToken: r.access_token, kitDeliveredAt: r.kit_delivered_at ?? null, checkedInAt: r.checked_in_at ?? null, weightKg: num(r.weight_kg), emergencyContact: r.emergency_contact, termsAcceptedAt: r.terms_accepted_at,
  source: r.source, status: r.status, paymentStatus: r.payment_status, exempt: !!r.exempt, flags: (r.flags ?? []) as Flag[],
  isDemo: r.is_demo, createdAt: r.created_at,
});
const toReceipt = (r: Row): Receipt => ({
  id: r.id, eventId: r.event_id, registrationId: r.registration_id, storagePath: r.storage_path, sha256: r.sha256,
  aiStatus: r.ai_status, amount: num(r.amount), payerName: r.payer_name, paidAt: r.paid_at,
  transactionId: r.transaction_id, createdAt: r.created_at,
});
const toDraw = (r: Row): RaffleDraw => ({
  id: r.id, eventId: r.event_id, registrationId: r.registration_id, prizeLabel: r.prize_label, drawnAt: r.drawn_at,
});

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.message.includes("data_nascimento_invalida")) throw new RepoError("invalid_birth_date", "data de nascimento inválida");
    if (res.error.code === "23505") throw new RepoError("conflict", "Já existe um registro com esse nome ou endereço.");
    if (res.error.code === "23503") throw new RepoError("conflict", "Há registros ligados a este item.");
    throw new RepoError("unknown", res.error.message);
  }
  return res.data as T;
}

/** Acesso ao Supabase com a chave de serviço. Só roda no servidor. */
export class SupabaseRepo implements Repo {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listEvents() {
    return check(await this.db.from("events").select("*").order("event_date", { ascending: false })).map(toEvent);
  }
  async getEventBySlug(slug: string) {
    const d = check(await this.db.from("events").select("*").eq("slug", slug).maybeSingle());
    return d ? toEvent(d) : null;
  }
  async getEventById(id: string) {
    const d = check(await this.db.from("events").select("*").eq("id", id).maybeSingle());
    return d ? toEvent(d) : null;
  }
  async createEvent(i: NewEvent) {
    return toEvent(check(await this.db.from("events").insert({
      slug: i.slug, name: i.name, event_date: i.eventDate, city: i.city, description: i.description,
      pix_key: i.pixKey, base_price: i.basePrice, age_rule: i.ageRule, has_kit: i.hasKit, exempt_code: i.exemptCode ?? null,
    }).select("*").single()));
  }
  async updateEvent(id: string, p: EventPatch) {
    const m: Row = {};
    if (p.name !== undefined) m.name = p.name;
    if (p.eventDate !== undefined) m.event_date = p.eventDate;
    if (p.city !== undefined) m.city = p.city;
    if (p.description !== undefined) m.description = p.description;
    if (p.pixKey !== undefined) m.pix_key = p.pixKey;
    if (p.basePrice !== undefined) m.base_price = p.basePrice;
    if (p.ageRule !== undefined) m.age_rule = p.ageRule;
    if (p.hasKit !== undefined) m.has_kit = p.hasKit;
    if (p.exemptCode !== undefined) m.exempt_code = p.exemptCode;
    if (p.registrationOpen !== undefined) m.registration_open = p.registrationOpen;
    return toEvent(check(await this.db.from("events").update(m).eq("id", id).select("*").single()));
  }
  private catRow(p: CategoryPatch): Row {
    const m: Row = {};
    if (p.name !== undefined) m.name = p.name;
    if (p.price !== undefined) m.price = p.price;
    if (p.minAge !== undefined) m.min_age = p.minAge;
    if (p.maxAge !== undefined) m.max_age = p.maxAge;
    if (p.minWeightKg !== undefined) m.min_weight_kg = p.minWeightKg;
    if (p.minAthletes !== undefined) m.min_athletes = p.minAthletes;
    if (p.gender !== undefined) m.gender = p.gender;
    if (p.sortOrder !== undefined) m.sort_order = p.sortOrder;
    return m;
  }
  async createCategory(i: NewCategory) {
    return toCategory(check(await this.db.from("categories").insert({ event_id: i.eventId, ...this.catRow(i) }).select("*").single()));
  }
  async updateCategory(id: string, p: CategoryPatch) {
    return toCategory(check(await this.db.from("categories").update(this.catRow(p)).eq("id", id).select("*").single()));
  }
  async deleteCategory(id: string) {
    const { count } = await this.db.from("registrations").select("id", { count: "exact", head: true }).eq("category_id", id);
    if (count) throw new RepoError("conflict", "Há inscritos nesta categoria. Mude-os de categoria antes de excluir.");
    check(await this.db.from("categories").delete().eq("id", id));
  }
  async setPrizes(categoryId: string, prizes: Omit<Prize, "categoryId">[]) {
    check(await this.db.from("prizes").delete().eq("category_id", categoryId));
    if (prizes.length) check(await this.db.from("prizes").insert(prizes.map((p) => ({ category_id: categoryId, place: p.place, amount: p.amount, is_trophy: p.isTrophy }))));
  }
  async setRegistrationOpen(eventId: string, open: boolean) {
    check(await this.db.from("events").update({ registration_open: open }).eq("id", eventId));
  }
  async listCategories(eventId: string) {
    return check(await this.db.from("categories").select("*").eq("event_id", eventId).order("sort_order")).map(toCategory);
  }
  async listPrizes(eventId: string) {
    const cats = await this.listCategories(eventId);
    if (!cats.length) return [];
    return check(await this.db.from("prizes").select("*").in("category_id", cats.map((c) => c.id))).map(toPrize);
  }

  async createRegistration(i: NewRegistration) {
    const row = {
      event_id: i.eventId, category_id: i.categoryId, full_name: i.fullName, email: i.email, city: i.city,
      team: i.team, whatsapp: i.whatsapp, birth_date: i.birthDate, gender: i.gender, access_token: i.accessToken, weight_kg: i.weightKg,
      emergency_contact: i.emergencyContact, terms_accepted: i.termsAccepted,
      terms_accepted_at: i.termsAccepted ? new Date().toISOString() : null, source: i.source,
      payment_status: i.paymentStatus, exempt: i.exempt ?? false, flags: i.flags,
    };
    return toReg(check(await this.db.from("registrations").insert(row).select("*").single()));
  }
  async getRegistration(id: string) {
    const d = check(await this.db.from("registrations").select("*, receipts(*)").eq("id", id).maybeSingle()) as Row | null;
    return d ? { ...toReg(d), receipts: (d.receipts ?? []).map(toReceipt) } : null;
  }
  async getRegistrationByToken(token: string) {
    const d = check(await this.db.from("registrations").select("*, receipts(*)").eq("access_token", token).maybeSingle()) as Row | null;
    return d ? { ...toReg(d), receipts: (d.receipts ?? []).map(toReceipt) } : null;
  }
  async listRegistrations(eventId: string): Promise<RegistrationWithReceipts[]> {
    const d = check(await this.db.from("registrations").select("*, receipts(*)").eq("event_id", eventId).order("bib_number"));
    return d.map((r: Row) => ({ ...toReg(r), receipts: (r.receipts ?? []).map(toReceipt) }));
  }
  async updateRegistration(id: string, p: RegistrationPatch) {
    const m: Row = {};
    if (p.categoryId !== undefined) m.category_id = p.categoryId;
    if (p.paymentStatus !== undefined) m.payment_status = p.paymentStatus;
    if (p.flags !== undefined) m.flags = p.flags;
    if (p.status !== undefined) m.status = p.status;
    if (p.fullName !== undefined) m.full_name = p.fullName;
    if (p.city !== undefined) m.city = p.city;
    if (p.team !== undefined) m.team = p.team;
    if (p.whatsapp !== undefined) m.whatsapp = p.whatsapp;
    if (p.weightKg !== undefined) m.weight_kg = p.weightKg;
    if (p.kitDeliveredAt !== undefined) m.kit_delivered_at = p.kitDeliveredAt;
    if (p.checkedInAt !== undefined) m.checked_in_at = p.checkedInAt;
    if (p.exempt !== undefined) m.exempt = p.exempt;
    return toReg(check(await this.db.from("registrations").update(m).eq("id", id).select("*").single()));
  }
  async checkIn(id: string, at: string) {
    // UPDATE ... WHERE checked_in_at IS NULL: dois celulares lendo o mesmo QR nunca sobrescrevem o primeiro horário.
    const first = check(await this.db.from("registrations").update({ checked_in_at: at }).eq("id", id).is("checked_in_at", null).select("*"));
    if (first.length) return { registration: toReg(first[0]), already: false };
    const cur = check(await this.db.from("registrations").select("*").eq("id", id).maybeSingle());
    if (!cur) throw new RepoError("not_found", "inscrição não encontrada");
    return { registration: toReg(cur), already: true };
  }
  async findActiveByWhatsapp(eventId: string, whatsapp: string, excludeId?: string) {
    let q = this.db.from("registrations").select("*").eq("event_id", eventId).eq("status", "active").eq("whatsapp", whatsapp);
    if (excludeId) q = q.neq("id", excludeId);
    const d = check(await q.limit(1));
    return d.length ? toReg(d[0]) : null;
  }

  async addReceipt(i: NewReceipt) {
    return toReceipt(check(await this.db.from("receipts").insert({
      event_id: i.eventId, registration_id: i.registrationId, storage_path: i.storagePath, sha256: i.sha256,
    }).select("*").single()));
  }
  async updateReceipt(id: string, p: ReceiptPatch) {
    const m: Row = {};
    if (p.aiStatus !== undefined) m.ai_status = p.aiStatus;
    if (p.amount !== undefined) m.amount = p.amount;
    if (p.payerName !== undefined) m.payer_name = p.payerName;
    if (p.paidAt !== undefined) m.paid_at = p.paidAt;
    if (p.transactionId !== undefined) m.transaction_id = p.transactionId;
    if (p.aiRaw !== undefined) m.ai_raw = p.aiRaw;
    check(await this.db.from("receipts").update(m).eq("id", id));
  }
  async isDuplicateReceipt(eventId: string, registrationId: string, sha: string | null, tx: string | null) {
    const ors: string[] = [];
    if (sha) ors.push(`sha256.eq.${sha}`);
    if (tx) ors.push(`transaction_id.eq.${tx.replace(/[,()]/g, "")}`);
    if (!ors.length) return false;
    const d = check(await this.db.from("receipts").select("registration_id, registrations!inner(status)")
      .eq("event_id", eventId).neq("registration_id", registrationId)
      .eq("registrations.status", "active").or(ors.join(",")).limit(1));
    return d.length > 0;
  }

  async saveFile(path: string, bytes: Uint8Array, mimeType: string) {
    const { error } = await this.db.storage.from(BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
    if (error) throw new RepoError("unknown", error.message);
  }
  async getFileUrl(path: string) {
    const { data, error } = await this.db.storage.from(BUCKET).createSignedUrl(path, 600);
    return error ? null : data.signedUrl;
  }

  async listDraws(eventId: string) {
    return check(await this.db.from("raffles").select("*").eq("event_id", eventId).order("drawn_at")).map(toDraw);
  }
  async addDraw(eventId: string, registrationId: string, prizeLabel: string | null) {
    return toDraw(check(await this.db.from("raffles").insert({ event_id: eventId, registration_id: registrationId, prize_label: prizeLabel }).select("*").single()));
  }
}
