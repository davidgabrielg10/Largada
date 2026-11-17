import { randomUUID } from "node:crypto";
import type { Category, EventRow, Prize, RaffleDraw, Receipt, Registration, RegistrationWithReceipts } from "@/lib/types";
import { formatBib } from "@/lib/text";
import { isPlausibleBirthDate } from "@/lib/rules";
import { demoCategories, demoEvent, demoPrizes, demoRegistrations } from "./demo-data";
import { RepoError, type CategoryPatch, type EventPatch, type NewCategory, type NewEvent, type NewReceipt, type NewRegistration, type ReceiptPatch, type Repo, type RegistrationPatch } from "./types";

const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Repositório em memória: desenvolvimento e testes. Perde tudo ao reiniciar. */
export class MemoryRepo implements Repo {
  readonly kind = "memory" as const;
  private events: EventRow[] = [];
  private categories: Category[] = [];
  private prizes: Prize[] = [];
  private regs: Registration[] = [];
  private receipts: Receipt[] = [];
  private draws: RaffleDraw[] = [];
  private files = new Map<string, { bytes: Uint8Array; mimeType: string }>();

  constructor(seedDemo = true) {
    if (!seedDemo) return;
    const ev = demoEvent();
    this.events = [ev];
    this.categories = demoCategories();
    this.prizes = demoPrizes();
    this.regs = demoRegistrations();
    ev.nextBib = this.regs.length + 1;
  }

  /** Para testes: começa com um evento e categorias dados. */
  seed(ev: EventRow, cats: Category[], prizes: Prize[] = []) {
    this.events.push({ ...ev });
    this.categories.push(...cats);
    this.prizes.push(...prizes);
  }

  async listEvents() { return this.events.map((e) => ({ ...e })); }
  async getEventBySlug(slug: string) { const e = this.events.find((x) => x.slug === slug); return e ? { ...e } : null; }
  async getEventById(id: string) { const e = this.events.find((x) => x.id === id); return e ? { ...e } : null; }
  async createEvent(i: NewEvent) {
    if (this.events.some((e) => e.slug === i.slug)) throw new RepoError("conflict", "Já existe um evento com esse endereço.");
    const ev: EventRow = { ...i, exemptCode: i.exemptCode ?? null, id: randomUUID(), registrationOpen: true, nextBib: 1, isDemo: false };
    this.events.push(ev);
    return { ...ev };
  }
  async updateEvent(id: string, p: EventPatch) {
    const e = this.events.find((x) => x.id === id);
    if (!e) throw new RepoError("not_found", "evento não encontrado");
    Object.assign(e, defined(p));
    return { ...e };
  }
  async createCategory(i: NewCategory) {
    if (this.categories.some((c) => c.eventId === i.eventId && c.name.toLowerCase() === i.name.toLowerCase())) throw new RepoError("conflict", "Já existe uma categoria com esse nome.");
    const c: Category = { ...i, id: randomUUID() };
    this.categories.push(c);
    return { ...c };
  }
  async updateCategory(id: string, p: CategoryPatch) {
    const c = this.categories.find((x) => x.id === id);
    if (!c) throw new RepoError("not_found", "categoria não encontrada");
    if (p.name && this.categories.some((x) => x.id !== id && x.eventId === c.eventId && x.name.toLowerCase() === p.name!.toLowerCase())) throw new RepoError("conflict", "Já existe uma categoria com esse nome.");
    Object.assign(c, defined(p));
    return { ...c };
  }
  async deleteCategory(id: string) {
    if (this.regs.some((r) => r.categoryId === id)) throw new RepoError("conflict", "Há inscritos nesta categoria. Mude-os de categoria antes de excluir.");
    this.categories = this.categories.filter((c) => c.id !== id);
    this.prizes = this.prizes.filter((p) => p.categoryId !== id);
  }
  async setPrizes(categoryId: string, prizes: Omit<Prize, "categoryId">[]) {
    this.prizes = this.prizes.filter((p) => p.categoryId !== categoryId).concat(prizes.map((p) => ({ ...p, categoryId })));
  }
  async setRegistrationOpen(eventId: string, open: boolean) {
    const e = this.events.find((x) => x.id === eventId);
    if (e) e.registrationOpen = open;
  }
  async listCategories(eventId: string) {
    return this.categories.filter((c) => c.eventId === eventId).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  async listPrizes(eventId: string) {
    const ids = new Set(this.categories.filter((c) => c.eventId === eventId).map((c) => c.id));
    return this.prizes.filter((p) => ids.has(p.categoryId));
  }

  async createRegistration(i: NewRegistration): Promise<Registration> {
    const ev = this.events.find((e) => e.id === i.eventId);
    if (!ev) throw new RepoError("not_found", "evento não encontrado");
    if (!isPlausibleBirthDate(i.birthDate, new Date().toISOString().slice(0, 10))) throw new RepoError("invalid_birth_date", "data de nascimento inválida");
    const bib = ev.nextBib++;
    const reg: Registration = {
      id: randomUUID(), eventId: i.eventId, categoryId: i.categoryId, bibNumber: bib, bibLabel: formatBib(bib),
      fullName: i.fullName, email: i.email, city: i.city, team: i.team, whatsapp: i.whatsapp,
      birthDate: i.birthDate, gender: i.gender, weightKg: i.weightKg, emergencyContact: i.emergencyContact,
      accessToken: i.accessToken, kitDeliveredAt: null, checkedInAt: null, exempt: i.exempt ?? false,
      termsAcceptedAt: i.termsAccepted ? new Date().toISOString() : null, source: i.source,
      status: "active", paymentStatus: i.paymentStatus, flags: [...i.flags], isDemo: ev.isDemo,
      createdAt: new Date().toISOString(),
    };
    this.regs.push(reg);
    return { ...reg };
  }

  private withReceipts(r: Registration): RegistrationWithReceipts {
    return { ...r, flags: [...r.flags], receipts: this.receipts.filter((x) => x.registrationId === r.id).map((x) => ({ ...x })) };
  }
  async getRegistration(id: string) { const r = this.regs.find((x) => x.id === id); return r ? this.withReceipts(r) : null; }
  async getRegistrationByToken(token: string) { const r = this.regs.find((x) => x.accessToken === token); return r ? this.withReceipts(r) : null; }
  async listRegistrations(eventId: string) {
    return this.regs.filter((r) => r.eventId === eventId).sort((a, b) => a.bibNumber - b.bibNumber).map((r) => this.withReceipts(r));
  }
  async updateRegistration(id: string, p: RegistrationPatch) {
    const r = this.regs.find((x) => x.id === id);
    if (!r) throw new RepoError("not_found", "inscrição não encontrada");
    Object.assign(r, defined(p));
    return { ...r, flags: [...r.flags] };
  }
  async checkIn(id: string, at: string) {
    const r = this.regs.find((x) => x.id === id);
    if (!r) throw new RepoError("not_found", "inscrição não encontrada");
    const already = r.checkedInAt != null;
    if (!already) r.checkedInAt = at;
    return { registration: { ...r, flags: [...r.flags] }, already };
  }
  async findActiveByWhatsapp(eventId: string, whatsapp: string, excludeId?: string) {
    const r = this.regs.find((x) => x.eventId === eventId && x.status === "active" && x.whatsapp === whatsapp && x.id !== excludeId);
    return r ? { ...r } : null;
  }

  async addReceipt(i: NewReceipt): Promise<Receipt> {
    const rc: Receipt = {
      id: randomUUID(), eventId: i.eventId, registrationId: i.registrationId, storagePath: i.storagePath,
      sha256: i.sha256, aiStatus: "pending", amount: null, payerName: null, paidAt: null, transactionId: null,
      createdAt: new Date().toISOString(),
    };
    this.receipts.push(rc);
    return { ...rc };
  }
  async updateReceipt(id: string, p: ReceiptPatch) {
    const rc = this.receipts.find((x) => x.id === id);
    if (!rc) return;
    const rest = { ...p };
    delete rest.aiRaw;
    Object.assign(rc, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
  }
  async isDuplicateReceipt(eventId: string, registrationId: string, sha: string | null, tx: string | null) {
    const active = new Set(this.regs.filter((r) => r.eventId === eventId && r.status === "active" && r.id !== registrationId).map((r) => r.id));
    return this.receipts.some((x) => active.has(x.registrationId) && ((sha && x.sha256 === sha) || (tx && x.transactionId === tx)));
  }

  async saveFile(path: string, bytes: Uint8Array, mimeType: string) { this.files.set(path, { bytes, mimeType }); }
  async getFileUrl(path: string) { return this.files.has(path) ? `/api/admin/arquivo?path=${encodeURIComponent(path)}` : null; }
  async readFile(path: string) { return this.files.get(path) ?? null; }

  async listDraws(eventId: string) { return this.draws.filter((d) => d.eventId === eventId); }
  async addDraw(eventId: string, registrationId: string, prizeLabel: string | null) {
    const d: RaffleDraw = { id: randomUUID(), eventId, registrationId, prizeLabel, drawnAt: new Date().toISOString() };
    this.draws.push(d);
    return d;
  }
}
