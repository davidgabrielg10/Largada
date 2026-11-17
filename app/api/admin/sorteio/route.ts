import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { eligibleForRaffle, pickWinner } from "@/lib/raffle";
import { err, handleError, ok, requireAdmin } from "@/lib/http";

export const dynamic = "force-dynamic";

// Sorteia um inscrito entre os que pagaram (conferidos) e ainda não ganharam.
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { slug, prizeLabel } = z.object({ slug: z.string(), prizeLabel: z.string().trim().max(80).optional() }).parse(await req.json());
    const repo = getRepo();
    const ev = await repo.getEventBySlug(slug);
    if (!ev) return err("Evento não encontrado.", 404);
    const regs = await repo.listRegistrations(ev.id);
    const draws = await repo.listDraws(ev.id);
    const eligible = eligibleForRaffle(regs, new Set(draws.map((d) => d.registrationId)));
    const winner = pickWinner(eligible);
    if (!winner) return err("Não há inscritos elegíveis (pagamento conferido e ainda sem prêmio).");
    await repo.addDraw(ev.id, winner.id, prizeLabel || null);
    return ok({ winner: { id: winner.id, fullName: winner.fullName, bibLabel: winner.bibLabel, city: winner.city } });
  } catch (e) {
    return handleError(e);
  }
}
