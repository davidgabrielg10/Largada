import type { Category, EventRow, Registration } from "@/lib/types";

export const EVENT: EventRow = {
  id: "ev1",
  slug: "rachao-nazare",
  name: "2º Rachão Ritmo & Giro — Etapa Nazaré da Mata",
  eventDate: "2026-12-20",
  city: "Nazaré da Mata - PE",
  description: null,
  pixKey: null,
  basePrice: 80,
  registrationOpen: true,
  nextBib: 1,
  ageRule: "event_date",
  hasKit: false,
  exemptCode: null,
  isDemo: true,
};

const cat = (
  id: string,
  name: string,
  price: number,
  sortOrder: number,
  minAge: number | null = null,
  maxAge: number | null = null,
  minWeightKg: number | null = null,
  gender: Category["gender"] = null,
): Category => ({ id, eventId: "ev1", name, price, minAge, maxAge, minWeightKg, minAthletes: 10, gender, sortOrder });

export const CATEGORIES: Category[] = [
  cat("c20", "+20", 80, 1, 20, 29),
  cat("c30", "+30", 80, 2, 30, 39),
  cat("c40", "+40", 80, 3, 40, 49),
  cat("c50", "+50", 80, 4, 50, 59),
  cat("c60", "+60", 80, 5, 60, null),
  cat("cpp", "Peso Pesado 95+", 80, 6, null, null, 95),
  cat("cfe", "Feminino", 80, 7, null, null, null, "F"),
  cat("ceb", "E-Bike", 80, 8),
  cat("cin", "Iniciante", 50, 9),
];

export function reg(over: Partial<Registration> & { id: string; bibNumber: number }): Registration {
  return {
    eventId: "ev1",
    categoryId: "c40",
    bibLabel: String(over.bibNumber).padStart(3, "0"),
    fullName: "Fulano Fictício",
    email: null,
    city: "Carpina",
    team: "Equipe X",
    whatsapp: "81900000000",
    birthDate: "1980-01-01",
    gender: "M",
    weightKg: null,
    emergencyContact: null,
    termsAcceptedAt: null,
    source: "link",
    status: "active",
    paymentStatus: "verified",
    exempt: false,
    flags: [],
    accessToken: `tok-${over.id}`,
    kitDeliveredAt: null,
    checkedInAt: null,
    isDemo: true,
    createdAt: "2026-11-01T10:00:00Z",
    ...over,
  };
}
