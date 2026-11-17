import { updateEvent } from "@/lib/events";
import { eventSchema, handleError, ok, requireAdmin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: RouteContext<"/api/admin/eventos/[slug]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { slug } = await params;
    await updateEvent(slug, eventSchema.parse(await req.json()));
    return ok();
  } catch (e) {
    return handleError(e);
  }
}
