import type { AgeRule, Category, Flag, Gender } from "./types";
import { normalize } from "./text";

/** Idade completa em `refISO` de quem nasceu em `birthISO` (datas YYYY-MM-DD). */
export function ageOn(birthISO: string, refISO: string): number {
  const [by, bm, bd] = birthISO.split("-").map(Number);
  const [ry, rm, rd] = refISO.split("-").map(Number);
  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) age--;
  return age;
}

/** Barra datas absurdas (ex.: nascimento em 2026) — mesma regra do banco. */
export function isPlausibleBirthDate(birthISO: string, todayISO: string): boolean {
  return birthISO >= "1920-01-01" && ageOn(birthISO, todayISO) >= 5;
}

/** Data em que a idade é medida: dia da prova, ou 31/12 do ano da prova. */
export function ageReference(event: { eventDate: string; ageRule?: AgeRule }): string {
  return event.ageRule === "year_end" ? `${event.eventDate.slice(0, 4)}-12-31` : event.eventDate;
}

/** Alertas de idade, peso e sexo da inscrição em relação à categoria. */
export function categoryFlags(
  category: Category,
  birthISO: string,
  ageRefISO: string,
  weightKg: number | null,
  gender: Gender | null = null,
): Flag[] {
  const flags: Flag[] = [];
  const age = ageOn(birthISO, ageRefISO);
  if (
    (category.minAge != null && age < category.minAge) ||
    (category.maxAge != null && age > category.maxAge)
  ) {
    flags.push("age_out_of_range");
  }
  if (category.minWeightKg != null) {
    if (weightKg == null) flags.push("weight_missing");
    else if (weightKg < category.minWeightKg) flags.push("weight_below_min");
  }
  if (category.gender && gender && category.gender !== gender) flags.push("gender_mismatch");
  return flags;
}

/**
 * Categoria sugerida: primeiro as exclusivas do sexo informado que aceitam a idade
 * (ex.: "Feminino"); depois as abertas com faixa de idade. Peso e modalidade
 * (E-Bike, Iniciante) ficam por conta do atleta.
 */
export function suggestCategory(age: number, categories: Category[], gender: Gender | null = null): Category | null {
  const fits = (c: Category) => (c.minAge == null || age >= c.minAge) && (c.maxAge == null || age <= c.maxAge);
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  if (gender) {
    const own = sorted.find((c) => c.gender === gender && c.minWeightKg == null && fits(c));
    if (own) return own;
  }
  return sorted.find((c) => !c.gender && (c.minAge != null || c.maxAge != null) && fits(c)) ?? null;
}

const alphaTokens = (name: string) =>
  normalize(name)
    .split(" ")
    .filter((t) => t.length >= 2 && /[a-z]/.test(t));
const numberTokens = (name: string) =>
  normalize(name)
    .split(" ")
    .filter((t) => /^\d+$/.test(t));

/**
 * Descobre a categoria a partir de um texto solto ("50+", "+50", "50 mais",
 * "e-bike", "iniciante / 1º competição (R$ 50,00)"). Devolve null se não
 * houver um vencedor claro — nesse caso o organizador escolhe.
 */
export function matchCategory(hint: string | null | undefined, categories: Category[]): Category | null {
  if (!hint) return null;
  const h = normalize(hint);
  if (!h) return null;

  const exact = categories.filter((c) => normalize(c.name) === h);
  if (exact.length === 1) return exact[0];

  const hTokens = new Set(h.split(" "));
  const hCompact = h.replace(/ /g, "");
  const scored: { cat: Category; score: number }[] = [];

  for (const cat of categories) {
    const alpha = alphaTokens(cat.name);
    const nums = numberTokens(cat.name);
    if (alpha.length > 0) {
      if (!alpha.every((t) => hCompact.includes(t))) continue;
      scored.push({
        cat,
        score: alpha.length * 2 + (nums.length && nums.every((n) => hTokens.has(n)) ? nums.length : 0),
      });
    } else if (nums.length > 0) {
      if (!nums.every((n) => hTokens.has(n))) continue;
      scored.push({ cat, score: nums.length });
    }
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].cat;
}

/** Regras da categoria em uma linha legível ("50 a 59 anos · só feminino · 95 kg ou mais"). */
export function categoryRuleText(c: Pick<Category, "minAge" | "maxAge" | "gender" | "minWeightKg">): string {
  const parts: string[] = [];
  if (c.minAge != null && c.maxAge != null) parts.push(`${c.minAge} a ${c.maxAge} anos`);
  else if (c.minAge != null) parts.push(`${c.minAge} anos ou mais`);
  else if (c.maxAge != null) parts.push(`até ${c.maxAge} anos`);
  if (c.gender === "F") parts.push("só feminino");
  if (c.gender === "M") parts.push("só masculino");
  if (c.minWeightKg != null) parts.push(`${c.minWeightKg} kg ou mais`);
  return parts.join(" · ") || "aberta a todos";
}
