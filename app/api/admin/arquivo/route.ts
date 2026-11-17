import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { err, requireAdmin } from "@/lib/http";

export const dynamic = "force-dynamic";

// Abre um comprovante. Só o organizador, por link temporário (Supabase) ou direto (memória).
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!path || path.includes("..")) return err("Caminho inválido.");
  const repo = getRepo();
  if (repo.readFile) {
    const f = await repo.readFile(path);
    if (!f) return err("Arquivo não encontrado.", 404);
    return new NextResponse(Buffer.from(f.bytes), { headers: { "content-type": f.mimeType, "cache-control": "private, no-store" } });
  }
  const url = await repo.getFileUrl(path);
  return url ? NextResponse.redirect(url) : err("Arquivo não encontrado.", 404);
}
