import { err, fileFrom, handleError, ok, requireAdmin } from "@/lib/http";
import { draftFromMessage } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cadastro assistido, passo 1: texto/imagem de WhatsApp -> rascunho para o organizador conferir.
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const form = await req.formData();
    const text = String(form.get("text") ?? "").slice(0, 4000);
    const file = await fileFrom(form);
    if (!text.trim() && !file) return err("Cole o texto da mensagem ou envie uma imagem.");
    const r = await draftFromMessage(String(form.get("eventSlug") ?? ""), { text, file: file ?? undefined });
    return ok({ draft: r.draft, categoryId: r.category?.id ?? null, aiAvailable: r.aiAvailable });
  } catch (e) {
    return handleError(e);
  }
}
