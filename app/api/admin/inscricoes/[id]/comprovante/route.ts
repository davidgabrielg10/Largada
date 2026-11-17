import { err, fileFrom, handleError, ok, requireAdmin } from "@/lib/http";
import { attachReceipt } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const file = await fileFrom(await req.formData());
    if (!file) return err("Envie o arquivo do comprovante.");
    const reg = await attachReceipt(id, file);
    return ok({ paymentStatus: reg.paymentStatus, flags: reg.flags });
  } catch (e) {
    return handleError(e);
  }
}
