import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NewEventForm } from "@/components/EventConfig";
import { LoginForm, LogoutButton } from "@/components/LoginForm";
import { isAdmin } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Painel do organizador" };

export default async function AdminHome() {
  const authed = await isAdmin();
  const events = authed ? await getRepo().listEvents() : [];
  return (
    <main className="mx-auto max-w-3xl px-5 py-6">
      <div className="flex items-center justify-between">
        <Link href="/"><Logo /></Link>
        {authed && <LogoutButton />}
      </div>
      {!authed ? (
        <LoginForm />
      ) : (
        <>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
            <h1 className="display text-5xl">Seus eventos</h1>
          </div>
          <div className="mt-4"><NewEventForm events={events.map((e) => ({ slug: e.slug, name: e.name }))} /></div>
          <ul className="mt-5 space-y-3">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/${e.slug}`} className="card block p-5 hover:border-ink">
                  <p className="text-xl font-bold">{e.name}</p>
                  <p className="text-muted">{e.eventDate.split("-").reverse().join("/")}{e.city ? ` · ${e.city}` : ""}{e.registrationOpen ? "" : " · inscrições encerradas"}</p>
                </Link>
              </li>
            ))}
            {!events.length && <li className="card p-5 text-muted">Nenhum evento ainda.</li>}
          </ul>
        </>
      )}
    </main>
  );
}
