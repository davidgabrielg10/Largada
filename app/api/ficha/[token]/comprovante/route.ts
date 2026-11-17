import { allow, clientIp } from "@/lib/ratelimit";
import { err, fileFrom, handleError, ok } from "@/lib/http";
import { attachReceiptByToken } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// O atleta envia o comprovante pela própria ficha (quem pagou depois de se inscrever).
export async function POST(req: Request, { params }: RouteContext<"/api/ficha/[token]/comprovante">) {
  try {
    if (!allow(`ficha:${clientIp(req.headers)}`, 6, 10 * 60 * 1000)) return err("Muitas tentativas. Aguarde alguns minutos.", 429);
    const { token } = await params;
    if (!/^[\w-]{16,64}$/.test(token)) return err("Ficha não encontrada.", 404);
    const file = await fileFrom(await req.formData());
    if (!file) return err("Escolha o arquivo do comprovante.");
    const reg = await attachReceiptByToken(token, file);
    return ok({ paymentStatus: reg.paymentStatus });
  } catch (e) {
    return handleError(e);
  }
}
