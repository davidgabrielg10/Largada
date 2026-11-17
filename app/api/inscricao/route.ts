import { clientIp, allow } from "@/lib/ratelimit";
import { err, fileFrom, formToObject, handleError, ok, registrationSchema } from "@/lib/http";
import { register } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Inscrição pública (sem login). Multipart: campos do formulário + "file" (comprovante, opcional).
export async function POST(req: Request) {
  try {
    if (!allow(`reg:${clientIp(req.headers)}`, 8, 10 * 60 * 1000)) return err("Muitas tentativas. Aguarde alguns minutos.", 429);
    const form = await req.formData();
    if (form.get("website")) return ok({ bibLabel: "000", paymentStatus: "pending" }); // honeypot: bot finge sucesso
    const slug = String(form.get("eventSlug") ?? "");
    const data = registrationSchema.parse(formToObject(form));
    if (!data.termsAccepted) return err("É preciso aceitar o termo de responsabilidade.");
    if (!data.gender) return err("Informe o sexo.");
    const { registration, category, event } = await register({ ...data, eventSlug: slug, file: await fileFrom(form) }); // data inclui exemptCode
    return ok({
      id: registration.id,
      accessToken: registration.accessToken,
      bibLabel: registration.bibLabel,
      paymentStatus: registration.paymentStatus,
      exempt: registration.exempt,
      flags: registration.flags.filter((f) => f === "no_receipt" || f === "amount_low" || f === "duplicate_receipt"),
      category: category.name,
      price: category.price,
      pixKey: event.pixKey,
    });
  } catch (e) {
    return handleError(e);
  }
}
