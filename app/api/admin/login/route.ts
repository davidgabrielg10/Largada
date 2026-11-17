import { pinIsValid, startSession } from "@/lib/auth";
import { allow, clientIp } from "@/lib/ratelimit";
import { err, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!allow(`pin:${clientIp(req.headers)}`, 6, 15 * 60 * 1000)) return err("Muitas tentativas. Aguarde 15 minutos.", 429);
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!pin || !pinIsValid(String(pin))) return err("PIN incorreto.", 401);
  await startSession();
  return ok();
}
