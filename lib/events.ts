import { getRepo, RepoError, type NewCategory } from "@/lib/repo";
import { fromPrizeForm, type PrizeForm } from "@/lib/prizes";
import { ageReference, categoryFlags } from "@/lib/rules";
import { CATEGORY_FLAGS, ServiceError } from "@/lib/service";
import { normalize } from "@/lib/text";
import type { AgeRule, EventRow, Gender } from "@/lib/types";

// Configuração feita pelo organizador: eventos, categorias e premiação.

export interface EventInput {
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

export interface CategoryInput {
  name: string;
  price: number;
  minAge: number | null;
  maxAge: number | null;
  minWeightKg: number | null;
  minAthletes: number;
  gender: Gender | null;
  prizes: PrizeForm;
}

export function slugify(name: string): string {
  return normalize(name).replace(/\s+/g, "-").slice(0, 48).replace(/-+$/g, "") || "evento";
}

async function getEventOr404(slug: string): Promise<EventRow> {
  const ev = await getRepo().getEventBySlug(slug);
  if (!ev) throw new ServiceError("event_not_found", "Evento não encontrado.");
  return ev;
}

function wrap(e: unknown): never {
  if (e instanceof RepoError && e.code === "conflict") throw new ServiceError("invalid_input", e.message);
  throw e;
}

/** Cria um evento. Com `copyFromSlug`, traz as categorias e a premiação de um evento anterior. */
export async function createEvent(input: EventInput, copyFromSlug?: string | null): Promise<EventRow> {
  const repo = getRepo();
  const taken = new Set((await repo.listEvents()).map((e) => e.slug));
  const base = slugify(`${input.name} ${input.eventDate.slice(0, 4)}`);
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  const source = copyFromSlug ? await getEventOr404(copyFromSlug) : null;

  const event = await repo.createEvent({ ...input, slug }).catch(wrap);
  if (source) {
    const [cats, prizes] = await Promise.all([repo.listCategories(source.id), repo.listPrizes(source.id)]);
    for (const c of cats) {
      const created = await repo.createCategory({
        eventId: event.id, name: c.name, price: c.price, minAge: c.minAge, maxAge: c.maxAge,
        minWeightKg: c.minWeightKg, minAthletes: c.minAthletes, gender: c.gender, sortOrder: c.sortOrder,
      });
      const own = prizes.filter((p) => p.categoryId === c.id).map(({ place, amount, isTrophy }) => ({ place, amount, isTrophy }));
      if (own.length) await repo.setPrizes(created.id, own);
    }
  }
  return event;
}

/** Recalcula os alertas de idade/peso/sexo depois que uma regra muda. Não mexe nos de pagamento. */
export async function recomputeCategoryFlags(eventId: string, categoryId?: string) {
  const repo = getRepo();
  const event = await repo.getEventById(eventId);
  if (!event) return;
  const cats = new Map((await repo.listCategories(eventId)).map((c) => [c.id, c]));
  const regs = (await repo.listRegistrations(eventId)).filter((r) => r.status === "active" && (!categoryId || r.categoryId === categoryId));
  const ref = ageReference(event);
  for (const r of regs) {
    const cat = cats.get(r.categoryId);
    if (!cat) continue;
    const flags = [...r.flags.filter((f) => !CATEGORY_FLAGS.includes(f)), ...categoryFlags(cat, r.birthDate, ref, r.weightKg, r.gender)];
    if (flags.join() !== r.flags.join()) await repo.updateRegistration(r.id, { flags });
  }
}

export async function updateEvent(slug: string, input: EventInput) {
  const repo = getRepo();
  const ev = await getEventOr404(slug);
  const updated = await repo.updateEvent(ev.id, input);
  if (ev.eventDate !== input.eventDate || ev.ageRule !== input.ageRule) await recomputeCategoryFlags(ev.id);
  return updated;
}

function checkCategory(c: CategoryInput) {
  if (c.minAge != null && c.maxAge != null && c.minAge > c.maxAge) throw new ServiceError("invalid_input", "A idade mínima não pode ser maior que a máxima.");
}

export async function createCategory(slug: string, input: CategoryInput) {
  checkCategory(input);
  const repo = getRepo();
  const ev = await getEventOr404(slug);
  const cats = await repo.listCategories(ev.id);
  const { prizes, ...data } = input;
  const row: NewCategory = { ...data, eventId: ev.id, sortOrder: Math.max(0, ...cats.map((c) => c.sortOrder)) + 1 };
  const cat = await repo.createCategory(row).catch(wrap);
  await repo.setPrizes(cat.id, fromPrizeForm(prizes));
  return cat;
}

async function categoryOf(slug: string, id: string) {
  const ev = await getEventOr404(slug);
  const cats = await getRepo().listCategories(ev.id);
  const cat = cats.find((c) => c.id === id);
  if (!cat) throw new ServiceError("category_not_found", "Categoria não encontrada.");
  return { ev, cats, cat };
}

export async function updateCategory(slug: string, id: string, input: CategoryInput) {
  checkCategory(input);
  const repo = getRepo();
  const { ev } = await categoryOf(slug, id);
  const { prizes, ...data } = input;
  const cat = await repo.updateCategory(id, data).catch(wrap);
  await repo.setPrizes(id, fromPrizeForm(prizes));
  await recomputeCategoryFlags(ev.id, id);
  return cat;
}

export async function deleteCategory(slug: string, id: string) {
  await categoryOf(slug, id);
  await getRepo().deleteCategory(id).catch(wrap);
}

/** Sobe ou desce a categoria na lista do formulário. */
export async function moveCategory(slug: string, id: string, dir: "up" | "down") {
  const repo = getRepo();
  const { cats } = await categoryOf(slug, id);
  const i = cats.findIndex((c) => c.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= cats.length) return;
  const ordered = [...cats];
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  await Promise.all(ordered.map((c, k) => (c.sortOrder !== k + 1 ? repo.updateCategory(c.id, { sortOrder: k + 1 }) : null)));
}
