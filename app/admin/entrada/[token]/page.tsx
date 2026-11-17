import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryPanel } from "@/components/EntryPanel";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import { isAdmin } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrada", robots: { index: false, follow: false } };

// Aberta pelo QR da ficha (câmera comum do celular). Só o organizador logado vê e registra.
export default async function Entry({ params }: PageProps<"/admin/entrada/[token]">) {
  const { token } = await params;
  if (!(await isAdmin())) {
    return <main className="mx-auto max-w-md px-5 py-6"><Logo /><p className="mt-8 text-center">Entre com o PIN para validar a entrada do atleta.</p><LoginForm /></main>;
  }
  const repo = getRepo();
  const reg = /^[\w-]{16,64}$/.test(token) ? await repo.getRegistrationByToken(token) : null;
  if (!reg) notFound();
  const event = (await repo.getEventById(reg.eventId))!;
  const category = (await repo.listCategories(event.id)).find((c) => c.id === reg.categoryId);

  return (
    <main className="mx-auto max-w-md space-y-4 px-5 py-6">
      <div className="flex items-center justify-between"><Logo /><Link href={`/admin/${event.slug}/largada`} className="btn btn-line btn-sm">Lista de largada</Link></div>
      <div className="card p-6 text-center">
        <p className="hint">{event.name}</p>
        <p className="display text-[8rem] leading-none text-red">{reg.bibLabel}</p>
        <p className="text-2xl font-bold">{reg.fullName}</p>
        <p className="text-muted">{category?.name}{reg.city ? ` · ${reg.city}` : ""}{reg.team ? ` · ${reg.team}` : ""}</p>
      </div>
      <EntryPanel
        key={reg.id} id={reg.id} cancelled={reg.status === "cancelled"} paid={reg.paymentStatus === "verified"}
        hasKit={event.hasKit} initialCheckedInAt={reg.checkedInAt} initialKitAt={reg.kitDeliveredAt} flags={reg.flags}
      />
    </main>
  );
}
