import { randomInt } from "node:crypto";
import type { Registration } from "./types";

/** Concorre quem está ativo, com pagamento conferido e que ainda não foi sorteado. */
export function eligibleForRaffle(regs: Registration[], alreadyDrawn: Set<string>): Registration[] {
  return regs.filter(
    (r) => r.status === "active" && r.paymentStatus === "verified" && !alreadyDrawn.has(r.id),
  );
}

/** Sorteio com aleatoriedade criptográfica (não Math.random). */
export function pickWinner<T>(eligible: T[], rng: (max: number) => number = (n) => randomInt(n)): T | null {
  if (eligible.length === 0) return null;
  return eligible[rng(eligible.length)];
}
