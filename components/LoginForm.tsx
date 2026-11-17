"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const pin = String(new FormData(e.currentTarget).get("pin") ?? "");
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Não foi possível entrar.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-10 max-w-sm space-y-4 p-6">
      <div>
        <label className="label" htmlFor="pin">PIN do organizador</label>
        <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" className="field" required autoFocus />
      </div>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      <button className="btn btn-red w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button className="btn btn-line btn-sm" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); router.refresh(); }}>
      Sair
    </button>
  );
}
