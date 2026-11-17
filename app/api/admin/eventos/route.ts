import { z } from "zod";
import { createEvent } from "@/lib/events";
import { eventSchema, handleError, ok, requireAdmin } from "@/lib/http";

export const dynamic = "force-dynamic";

// Cria um evento (em branco ou copiando categorias e premiação de outro).
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const data = eventSchema.parse(body);
    const copyFrom = z.string().max(80).nullish().parse(body.copyFrom);
    const ev = await createEvent(data, copyFrom || null);
    return ok({ slug: ev.slug });
  } catch (e) {
    return handleError(e);
  }
}
