import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CopyLink, ReceiptUpload } from "@/components/Ficha";
import { Logo } from "@/components/Logo";
import { getOrigin } from "@/lib/origin";
import { getRepo } from "@/lib/repo";
import { formatBRL } from "@/lib/text";
import type { PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha inscrição", robots: { index: false, follow: false }, referrer: "no-referrer" };

const STATUS: Record<PaymentStatus, { label: string; tone: string; text: string }> = {
  verified: { label: "Pagamento conferido", tone: "pill-ok", text: "Tudo certo. Sua vaga está garantida." },
  review: { label: "Em conferência", tone: "pill-warn", text: "Recebemos o comprovante. A organização vai conferir e esta página atualiza sozinha." },
  mismatch: { label: "Pagamento com problema", tone: "pill-bad", text: "Algo no comprovante não bateu. Envie o comprovante certo abaixo ou fale com a organização." },
  pending: { label: "Falta o pagamento", tone: "pill-idle", text: "Faça o Pix e envie o comprovante aqui mesmo para garantir a vaga." },
};
const ATHLETE_FLAGS: Record<string, string> = {
  amount_low: "O valor pago está abaixo do valor da categoria.",
  duplicate_receipt: "Esse comprovante já aparece em outra inscrição.",
  not_a_receipt: "O arquivo enviado não parece um comprovante de pagamento.",
};

export default async function Ficha({ params, searchParams }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const { nova } = await searchParams;
  if (!/^[\w-]{16,64}$/.test(token)) notFound();
  const repo = getRepo();
  const reg = await repo.getRegistrationByToken(token);
  if (!reg) notFound();
  const event = (await repo.getEventById(reg.eventId))!;
  const category = (await repo.listCategories(event.id)).find((c) => c.id === reg.categoryId);
  const origin = await getOrigin();
  const qr = await QRCode.toString(`${origin}/admin/entrada/${token}`, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0d0d0e", light: "#ffffff" } });
  const st = reg.exempt ? { label: "Inscrição isenta", tone: "pill-ok", text: "Tudo certo. Sua vaga está garantida, sem pagamento." } : STATUS[reg.paymentStatus];
  const cancelled = reg.status === "cancelled";
  const canUpload = !cancelled && reg.paymentStatus !== "verified" && reg.receipts.length < 5;

  return (
    <main>
      <header className="hero">
        <div className="mx-auto max-w-xl px-5 pt-5 pb-14">
          <Logo light />
          <p className="mt-8 font-semibold text-red-300">{event.eventDate.split("-").reverse().join("/")}{event.city ? ` · ${event.city}` : ""}</p>
          <h1 className="display mt-1 text-4xl sm:text-5xl">{event.name}</h1>
        </div>
      </header>
      <section className="mx-auto -mt-8 max-w-xl space-y-4 px-4 pb-16">
        {nova && !cancelled && <p className="card border-ok bg-green-50 p-4 font-semibold text-green-900" role="status">Inscrição feita! Guarde o link desta página: ela é a sua ficha.</p>}
        <div className="card p-6 text-center">
          <p className="hint">Número de atleta</p>
          <p className="display text-[7.5rem] leading-none text-red sm:text-[9rem]">{reg.bibLabel}</p>
          <p className="mt-2 text-xl font-bold">{reg.fullName}</p>
          <p className="text-muted">{category?.name ?? "—"}{reg.team ? ` · ${reg.team}` : ""}</p>
          {cancelled ? <p className="pill pill-bad mt-4">Inscrição cancelada</p> : (
            <>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className={`pill ${st.tone}`}>{st.label}</span>
                {reg.checkedInAt && <span className="pill pill-ok">Presença registrada</span>}
                {event.hasKit && reg.kitDeliveredAt && <span className="pill pill-ok">Kit retirado</span>}
              </div>
              <p className="mt-3">{st.text}</p>
              {reg.paymentStatus !== "verified" && reg.flags.filter((f) => ATHLETE_FLAGS[f]).map((f) => <p key={f} className="hint mt-1">{ATHLETE_FLAGS[f]}</p>)}
            </>
          )}
        </div>

        {canUpload && (
          <div className="card space-y-3 p-5">
            {category && <p className="font-semibold">Pix de {formatBRL(category.price)}</p>}
            {event.pixKey && <p>Chave: <code className="break-all rounded bg-paper px-2 py-0.5 border border-line">{event.pixKey}</code></p>}
            <ReceiptUpload token={token} />
          </div>
        )}

        {!cancelled && (
          <div className="card flex flex-col items-center gap-3 p-5 text-center">
            <p className="font-semibold">{event.hasKit ? "Entrada e retirada do kit" : "Entrada no evento"}</p>
            <div className="w-56 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="QR code da inscrição" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="hint">Mostre este código para a organização{event.hasKit ? " na entrada e na retirada do kit" : " na entrada"}. Só ela consegue validar. Se o sinal falhar, basta dizer seu número ({reg.bibLabel}).</p>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 text-center">
          <CopyLink url={`${origin}/i/${token}`} />
          <p className="hint">Quem tem este link vê esta página. Não publique em grupos.</p>
          <p className="hint">Feito com <Link className="underline" href="/">Largada</Link></p>
        </div>
      </section>
    </main>
  );
}
