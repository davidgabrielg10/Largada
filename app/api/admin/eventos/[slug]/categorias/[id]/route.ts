import { z } from "zod";
import { deleteCategory, moveCategory, updateCategory } from "@/lib/events";
import { categorySchema, handleError, ok, requireAdmin } from "@/lib/http";

export const dynamic = "force-dynamic";
type Ctx = RouteContext<"/api/admin/eventos/[slug]/categorias/[id]">;

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { slug, id } = await params;
    const body = await req.json();
    if (body?.move) await moveCategory(slug, id, z.enum(["up", "down"]).parse(body.move));
    else await updateCategory(slug, id, categorySchema.parse(body));
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { slug, id } = await params;
    await deleteCategory(slug, id);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}
