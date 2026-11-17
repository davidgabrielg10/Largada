import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { err, handleError, ok, requireAdmin } from "@/lib/http";

export const dynamic = "force-dynamic";

// Abre ou encerra as inscrições do link público.
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { slug, registrationOpen } = z.object({ slug: z.string(), registrationOpen: z.boolean() }).parse(await req.json());
    const repo = getRepo();
    const ev = await repo.getEventBySlug(slug);
    if (!ev) return err("Evento não encontrado.", 404);
    await repo.setRegistrationOpen(ev.id, registrationOpen);
    return ok({ registrationOpen });
  } catch (e) {
    return handleError(e);
  }
}
