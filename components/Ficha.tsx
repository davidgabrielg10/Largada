"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { downscaleImage } from "@/lib/client/image";

export function ReceiptUpload({ token }: { token: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="space-y-2" onSubmit={async (e) => {
      e.preventDefault();
      const f = ref.current?.files?.[0];
      if (!f) return setError("Escolha o arquivo do comprovante.");
      setBusy(true); setError(null);
      const body = new FormData();
      body.set("file", await downscaleImage(f));
      const res = await fetch(`/api/ficha/${token}/comprovante`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) return setError(data.error ?? "Não foi possível enviar.");
      router.refresh();
    }}>
      <label className="label" htmlFor="file">Enviar comprovante (foto, print ou PDF)</label>
      <input id="file" ref={ref} type="file" accept="image/*,application/pdf" className="field" />
      {error && <p role="alert" className="text-red-800">{error}</p>}
      <button className="btn btn-red w-full" disabled={busy}>{busy ? "Enviando e conferindo…" : "Enviar comprovante"}</button>
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className="btn btn-line btn-sm" onClick={async () => {
      if (navigator.share) { try { await navigator.share({ title: "Minha inscrição", url }); return; } catch { /* cancelado */ } }
      await navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
    }}>{copied ? "Link copiado ✓" : "Guardar / compartilhar link"}</button>
  );
}
