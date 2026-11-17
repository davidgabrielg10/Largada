import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/auth";
import { ServiceError } from "@/lib/service";
import type { AiFile } from "@/lib/ai";

export const err = (message: string, status = 400) => NextResponse.json({ ok: false, error: message }, { status });
export const ok = (data: object = {}) => NextResponse.json({ ok: true, ...data });

export async function requireAdmin(): Promise<NextResponse | null> {
  return (await isAdmin()) ? null : err("Não autorizado.", 401);
}

export async function fileFrom(form: FormData, name = "file"): Promise<AiFile | null> {
  const f = form.get(name);
  if (!(f instanceof File) || f.size === 0) return null;
  return { bytes: new Uint8Array(await f.arrayBuffer()), mimeType: f.type };
}

export function handleError(e: unknown): NextResponse {
  if (e instanceof ServiceError) return err(e.message, e.code === "not_found" || e.code === "event_not_found" || e.code === "category_not_found" ? 404 : 400);
  if (e instanceof z.ZodError) return err(e.issues[0]?.message ?? "Dados inválidos.");
  console.error("[largada] erro inesperado", e);
  return err("Algo deu errado. Tente novamente em instantes.", 500);
}

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).optional().transform((v) => v || null);

/** Campos do formulário de inscrição (vindos como texto de um multipart). */
export const registrationSchema = z.object({
  categoryId: z.string().min(1, "Escolha uma categoria."),
  fullName: text(120).min(5, "Informe o nome completo."),
  email: optText(120).refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "E-mail inválido."),
  city: optText(80),
  team: optText(80),
  whatsapp: text(30).refine((v) => v.replace(/\D/g, "").length >= 10, "WhatsApp inválido (com DDD)."),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento."),
  weightKg: z.string().optional().transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v > 20 && v < 300), "Peso inválido."),
  gender: z.enum(["M", "F"]).optional().or(z.literal("").transform(() => undefined)),
  emergencyContact: optText(150),
  exemptCode: optText(40),
  termsAccepted: z.string().optional().transform((v) => v === "true" || v === "on"),
});

export function formToObject(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

const nullableNum = (min: number, max: number, msg: string) =>
  z.union([z.number(), z.string(), z.null()]).optional()
    .transform((v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), msg);

export const eventSchema = z.object({
  name: text(100).min(4, "Dê um nome ao evento."),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do evento."),
  city: optText(80),
  description: optText(600),
  pixKey: optText(120),
  basePrice: z.coerce.number().min(0, "Valor inválido.").max(10000, "Valor inválido."),
  ageRule: z.enum(["event_date", "year_end"]).default("event_date"),
  hasKit: z.boolean().default(false),
  exemptCode: optText(40),
});

export const categorySchema = z.object({
  name: text(60).min(1, "Dê um nome à categoria."),
  price: z.coerce.number().min(0, "Valor inválido.").max(10000, "Valor inválido."),
  minAge: nullableNum(0, 120, "Idade mínima inválida."),
  maxAge: nullableNum(0, 120, "Idade máxima inválida."),
  minWeightKg: nullableNum(20, 300, "Peso mínimo inválido."),
  minAthletes: z.coerce.number().int().min(0).max(1000).default(0),
  gender: z.enum(["M", "F"]).nullable().optional().transform((v) => v ?? null),
  prizes: z.object({
    money: z.array(z.coerce.number().min(0).max(1_000_000)).max(20).default([]),
    trophyUntil: z.coerce.number().int().min(0).max(20).default(0),
  }).default({ money: [], trophyUntil: 0 }),
});
