import type { Prize } from "./types";

/**
 * A premiação vira dois campos simples no painel:
 *  - money: valores em dinheiro do 1º lugar em diante (ex.: [200, 150, 100]);
 *  - trophyUntil: quem não leva dinheiro ganha troféu até este lugar (ex.: 5).
 */
export interface PrizeForm {
  money: number[];
  trophyUntil: number;
}

export function toPrizeForm(prizes: Prize[]): PrizeForm {
  const sorted = [...prizes].sort((a, b) => a.place - b.place);
  const money: number[] = [];
  for (const p of sorted) {
    if (p.place !== money.length + 1 || p.amount == null || p.amount <= 0) break;
    money.push(p.amount);
  }
  const trophyUntil = Math.max(0, ...sorted.filter((p) => p.isTrophy && p.amount == null).map((p) => p.place));
  return { money, trophyUntil };
}

export function fromPrizeForm(form: PrizeForm): Omit<Prize, "categoryId">[] {
  const money = form.money.filter((v) => Number.isFinite(v) && v > 0).slice(0, 20);
  const out: Omit<Prize, "categoryId">[] = money.map((amount, i) => ({ place: i + 1, amount, isTrophy: false }));
  for (let place = money.length + 1; place <= Math.min(form.trophyUntil, 20); place++) out.push({ place, amount: null, isTrophy: true });
  return out;
}
