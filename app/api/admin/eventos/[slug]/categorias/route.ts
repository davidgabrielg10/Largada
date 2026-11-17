import { createCategory } from "@/lib/events";
import { categorySchema, handleError, ok, requireAdmin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: RouteContext<"/api/admin/eventos/[slug]/categorias">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { slug } = await params;
    const cat = await createCategory(slug, categorySchema.parse(await req.json()));
    return ok({ id: cat.id });
  } catch (e) {
    return handleError(e);
  }
}
