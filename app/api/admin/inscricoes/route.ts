import { z } from "zod";
import { fileFrom, formToObject, handleError, ok, registrationSchema, requireAdmin } from "@/lib/http";
import { register } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cadastro assistido, passo 2: o organizador confirma os dados e salva.
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const form = await req.formData();
    const data = registrationSchema.parse({ ...formToObject(form), termsAccepted: "true" });
    const { registration, category } = await register({
      ...data, eventSlug: String(form.get("eventSlug") ?? ""), source: "assisted", file: await fileFrom(form),
    });
    return ok({ id: registration.id, bibLabel: registration.bibLabel, paymentStatus: registration.paymentStatus, category: category.name });
  } catch (e) {
    if (e instanceof z.ZodError) return handleError(e);
    return handleError(e);
  }
}
