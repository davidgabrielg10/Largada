import type { Category, EventRow, Prize, Registration } from "./types";
import { ageOn } from "./rules";
import { normalize } from "./text";

export interface CountRow {
  name: string;
  count: number;
}

export interface SponsorReport {
  eventName: string;
  eventDate: string;
  city: string | null;
  athletes: number;
  athletesPaid: number;
  revenueVerified: number;
  revenueExpected: number;
  citiesCount: number;
  teamsCount: number;
  byCity: CountRow[];
  byTeam: CountRow[];
  byCategory: CountRow[];
  ageBuckets: CountRow[];
  prizePool: number;
  trophies: number;
}

function tally(values: (string | null)[]): CountRow[] {
  const map = new Map<string, CountRow>();
  for (const v of values) {
    const display = v?.trim();
    if (!display) continue;
    const key = normalize(display);
    if (!key) continue;
    const row = map.get(key);
    if (row) row.count++;
    else map.set(key, { name: display, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "Até 19 anos", min: 0, max: 19 },
  { label: "20 a 29", min: 20, max: 29 },
  { label: "30 a 39", min: 30, max: 39 },
  { label: "40 a 49", min: 40, max: 49 },
  { label: "50 a 59", min: 50, max: 59 },
  { label: "60 ou mais", min: 60, max: 200 },
];

/** Números do evento no formato que um patrocinador quer ver. */
export function buildSponsorReport(
  event: EventRow,
  categories: Category[],
  registrations: Registration[],
  prizes: Prize[],
): SponsorReport {
  const active = registrations.filter((r) => r.status === "active");
  const priceOf = new Map(categories.map((c) => [c.id, c.price]));
  const nameOf = new Map(categories.map((c) => [c.id, c.name]));
  const verified = active.filter((r) => r.paymentStatus === "verified");

  const byCity = tally(active.map((r) => r.city));
  const byTeam = tally(active.map((r) => r.team));
  const byCategory = tally(active.map((r) => nameOf.get(r.categoryId) ?? null));

  const ages = active.map((r) => ageOn(r.birthDate, event.eventDate));
  const ageBuckets = BUCKETS.map((b) => ({
    name: b.label,
    count: ages.filter((a) => a >= b.min && a <= b.max).length,
  }));

  return {
    eventName: event.name,
    eventDate: event.eventDate,
    city: event.city,
    athletes: active.length,
    athletesPaid: verified.length,
    revenueVerified: verified.reduce((s, r) => s + (priceOf.get(r.categoryId) ?? 0), 0),
    revenueExpected: active.reduce((s, r) => s + (priceOf.get(r.categoryId) ?? 0), 0),
    citiesCount: byCity.length,
    teamsCount: byTeam.length,
    byCity,
    byTeam,
    byCategory,
    ageBuckets,
    prizePool: prizes.reduce((s, p) => s + (p.amount ?? 0), 0),
    trophies: prizes.filter((p) => p.isTrophy).length,
  };
}
