import { z } from "zod";
import { handleError, ok, requireAdmin } from "@/lib/http";
import { adminAction, changeCategory, checkIn } from "@/lib/service";

export const dynamic = "force-dynamic";

const body = z.union([
  z.object({ action: z.enum(["approve", "reject", "exempt", "unexempt", "cancel", "reopen", "kit", "unkit", "checkin", "uncheckin"]) }),
  z.object({ categoryId: z.string().min(1) }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const b = body.parse(await req.json());
    let already = false;
    let reg;
    if ("action" in b) {
      if (b.action === "checkin") ({ registration: reg, already } = await checkIn(id));
      else reg = await adminAction(id, b.action);
    } else reg = await changeCategory(id, b.categoryId);
    return ok({
      paymentStatus: reg.paymentStatus, status: reg.status, flags: reg.flags, categoryId: reg.categoryId,
      kitDeliveredAt: reg.kitDeliveredAt, checkedInAt: reg.checkedInAt, already,
    });
  } catch (e) {
    return handleError(e);
  }
}
