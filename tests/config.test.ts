import { beforeEach, describe, expect, it } from "vitest";
import { ageReference, categoryFlags, categoryRuleText, suggestCategory } from "@/lib/rules";
import { fromPrizeForm, toPrizeForm } from "@/lib/prizes";
import { createCategory, createEvent, deleteCategory, moveCategory, slugify, updateCategory, updateEvent } from "@/lib/events";
import { adminAction, attachReceiptByToken, checkIn, register } from "@/lib/service";
import { getRepo } from "@/lib/repo";
import { CATEGORIES, EVENT } from "./fixtures";

const g = globalThis as unknown as { __largadaRepo?: unknown };
beforeEach(() => { g.__largadaRepo = undefined; process.env.AI_MODE = "mock"; });
const byName = (n: string) => CATEGORIES.find((c) => c.name === n)!;
const cat = (o = {}) => ({ name: "Master A", price: 60, minAge: 30, maxAge: 44, minWeightKg: null, minAthletes: 5, gender: null, prizes: { money: [100, 50], trophyUntil: 4 }, ...o });

describe("regras configuráveis", () => {
  it("idade no ano (31/12) vs no dia da prova", () => {
    expect(ageReference({ eventDate: "2026-03-10", ageRule: "year_end" })).toBe("2026-12-31");
    expect(ageReference({ eventDate: "2026-03-10", ageRule: "event_date" })).toBe("2026-03-10");
    // faz 50 em novembro: no dia da prova (março) tem 49; na regra do ano conta 50
    expect(categoryFlags(byName("+50"), "1976-11-01", "2026-03-10", null)).toContain("age_out_of_range");
    expect(categoryFlags(byName("+50"), "1976-11-01", "2026-12-31", null)).toEqual([]);
  });
  it("restrição de sexo", () => {
    expect(categoryFlags(byName("Feminino"), "1990-01-01", EVENT.eventDate, null, "M")).toEqual(["gender_mismatch"]);
    expect(categoryFlags(byName("Feminino"), "1990-01-01", EVENT.eventDate, null, "F")).toEqual([]);
  });
  it("sugestão considera o sexo", () => {
    expect(suggestCategory(35, CATEGORIES, "F")?.name).toBe("Feminino");
    expect(suggestCategory(35, CATEGORIES, "M")?.name).toBe("+30");
  });
  it("texto das regras", () => {
    expect(categoryRuleText(byName("+50"))).toBe("50 a 59 anos");
    expect(categoryRuleText(byName("Feminino"))).toBe("só feminino");
    expect(categoryRuleText(byName("Peso Pesado 95+"))).toBe("95 kg ou mais");
    expect(categoryRuleText(byName("E-Bike"))).toBe("aberta a todos");
  });
  it("premiação vai e volta sem perder nada", () => {
    const form = { money: [200, 150, 100], trophyUntil: 5 };
    const prizes = fromPrizeForm(form).map((p) => ({ ...p, categoryId: "x" }));
    expect(prizes).toHaveLength(5);
    expect(prizes[3]).toMatchObject({ place: 4, amount: null, isTrophy: true });
    expect(toPrizeForm(prizes)).toEqual(form);
  });
  it("slug", () => expect(slugify("3º Pedal da Serra — 2027")).toBe("3-pedal-da-serra-2027"));
});

describe("eventos e categorias", () => {
  const input = { name: "Pedal da Serra", eventDate: "2027-03-07", city: "Gravatá", description: null, pixKey: "pix@serra", basePrice: 70, ageRule: "year_end" as const, hasKit: false };

  it("cria evento copiando categorias e premiação, sem inscritos", async () => {
    const ev = await createEvent(input, "rachao-nazare");
    expect(ev.slug).toBe("pedal-da-serra-2027");
    const repo = getRepo();
    const cats = await repo.listCategories(ev.id);
    expect(cats.map((c) => c.name)).toContain("Feminino");
    expect(cats.find((c) => c.name === "Feminino")?.gender).toBe("F");
    expect((await repo.listPrizes(ev.id)).length).toBeGreaterThan(0);
    expect(await repo.listRegistrations(ev.id)).toHaveLength(0);
    const again = await createEvent(input);
    expect(again.slug).toBe("pedal-da-serra-2027-2");
  });

  it("CRUD de categoria com validação e ordem", async () => {
    const ev = await createEvent(input);
    const a = await createCategory(ev.slug, cat());
    const b = await createCategory(ev.slug, cat({ name: "Master B", minAge: 45, maxAge: null }));
    await expect(createCategory(ev.slug, cat())).rejects.toThrow(/Já existe/);
    await expect(createCategory(ev.slug, cat({ name: "X", minAge: 50, maxAge: 40 }))).rejects.toThrow(/mínima/);
    await moveCategory(ev.slug, b.id, "up");
    expect((await getRepo().listCategories(ev.id)).map((c) => c.name)).toEqual(["Master B", "Master A"]);
    await deleteCategory(ev.slug, a.id);
    expect(await getRepo().listCategories(ev.id)).toHaveLength(1);
  });

  it("mudar a regra recalcula alertas, sem mexer nos de pagamento", async () => {
    const ev = await createEvent(input);
    const c = await createCategory(ev.slug, cat({ minAge: 30, maxAge: 44 }));
    const { registration } = await register({ eventSlug: ev.slug, categoryId: c.id, fullName: "Atleta de Teste", whatsapp: "81988880000", birthDate: "1975-06-01", gender: "M", termsAccepted: true });
    expect(registration.flags).toEqual(expect.arrayContaining(["age_out_of_range", "no_receipt"]));
    await updateCategory(ev.slug, c.id, cat({ minAge: 30, maxAge: 60 }));
    const after = await getRepo().getRegistration(registration.id);
    expect(after?.flags).toEqual(["no_receipt"]);
    await expect(deleteCategory(ev.slug, c.id)).rejects.toThrow(/inscritos/);
    await updateEvent(ev.slug, { ...input, eventDate: "2027-03-07" });
  });
});

describe("ficha, presença e kit opcional", () => {
  const novo = (o = {}) => register({ eventSlug: "rachao-nazare", categoryId: "cat-4", fullName: "Fulano da Ficha", whatsapp: "81977770000", birthDate: "1972-01-01", gender: "M", termsAccepted: true, ...o });
  const png = (n = 9) => ({ bytes: new Uint8Array([n, n, n]), mimeType: "image/png" });

  it("token secreto e comprovante enviado pela ficha", async () => {
    const { registration } = await novo();
    expect(registration.accessToken).toMatch(/^[\w-]{22}$/);
    expect(registration.paymentStatus).toBe("pending");
    const after = await attachReceiptByToken(registration.accessToken, png());
    expect(after.paymentStatus).toBe("verified");
    expect(after.flags).not.toContain("no_receipt");
    await expect(attachReceiptByToken(registration.accessToken, png(1))).rejects.toThrow(/já foi conferido/);
    await expect(attachReceiptByToken("token-que-nao-existe-123", png(1))).rejects.toThrow(/não encontrada/);
  });

  it("presença: o primeiro horário vale e o QR repetido avisa", async () => {
    const { registration } = await novo();
    const first = await checkIn(registration.id);
    expect(first.already).toBe(false);
    expect(first.registration.checkedInAt).toBeTruthy();
    const second = await checkIn(registration.id);
    expect(second.already).toBe(true);
    expect(second.registration.checkedInAt).toBe(first.registration.checkedInAt);
    expect((await adminAction(registration.id, "uncheckin")).checkedInAt).toBeNull();
    expect((await checkIn(registration.id)).already).toBe(false);
  });

  it("não registra presença de inscrição cancelada", async () => {
    const { registration } = await novo();
    await adminAction(registration.id, "cancel");
    await expect(checkIn(registration.id)).rejects.toThrow(/cancelada/);
  });

  it("kit só existe nos eventos que entregam", async () => {
    const { registration } = await novo();
    await expect(adminAction(registration.id, "kit")).rejects.toThrow(/não entrega kit/);
    const repo = getRepo();
    const ev = (await repo.getEventBySlug("rachao-nazare"))!;
    await repo.updateEvent(ev.id, { hasKit: true });
    const kit = await adminAction(registration.id, "kit");
    expect(kit.kitDeliveredAt).toBeTruthy();
    expect((await adminAction(registration.id, "unkit")).kitDeliveredAt).toBeNull();
  });

  it("criar evento respeita a opção de kit", async () => {
    const ev = await createEvent({ name: "Corrida da Praça", eventDate: "2027-05-01", city: null, description: null, pixKey: null, basePrice: 40, ageRule: "event_date", hasKit: true });
    expect(ev.hasKit).toBe(true);
  });
});
