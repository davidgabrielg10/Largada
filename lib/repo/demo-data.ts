import type { Category, EventRow, Prize, Registration } from "@/lib/types";
import { formatBib } from "@/lib/text";

// DADOS 100% FICTÍCIOS, só para demonstração e desenvolvimento.
export const DEMO_EVENT_ID = "ev-demo";

export const demoEvent = (): EventRow => ({
  id: DEMO_EVENT_ID, slug: "rachao-nazare", name: "2º Rachão Ritmo & Giro — Etapa Nazaré da Mata",
  eventDate: "2026-12-20", city: "Nazaré da Mata – PE",
  description: "Prova de ciclismo de estrada com várias categorias. Inscrição pelo link, sem aplicativo.",
  pixKey: "chave-pix-demo@exemplo.com", basePrice: 80, registrationOpen: true, nextBib: 1, ageRule: "event_date", hasKit: false, isDemo: true,
});

const CATS: [string, number, number | null, number | null, number | null, number][] = [
  ["+20", 80, 20, 29, null, 10],
  ["+30", 80, 30, 39, null, 10],
  ["+40", 80, 40, 49, null, 10],
  ["+50", 80, 50, 59, null, 10],
  ["+60", 80, 60, null, null, 10],
  ["Peso Pesado 95+", 80, null, null, 95, 10],
  ["Feminino", 80, null, null, null, 10],
  ["E-Bike", 80, null, null, null, 10],
  ["Iniciante", 50, null, null, null, 10],
];

export const demoCategories = (): Category[] =>
  CATS.map(([name, price, minAge, maxAge, minWeightKg, minAthletes], i) => ({
    id: `cat-${i + 1}`, eventId: DEMO_EVENT_ID, name, price, minAge, maxAge, minWeightKg, minAthletes,
    gender: name === "Feminino" ? "F" : null, sortOrder: i + 1,
  }));

// Mesma premiação do flyer: 200/150/100 e troféu para 4º e 5º (Iniciante: 150/100/50).
export const demoPrizes = (): Prize[] =>
  demoCategories().flatMap((c) => {
    const money = c.name === "Iniciante" ? [150, 100, 50] : [200, 150, 100];
    const p: Prize[] = money.map((amount, i) => ({ categoryId: c.id, place: i + 1, amount, isTrophy: false }));
    if (c.name !== "Iniciante") p.push({ categoryId: c.id, place: 4, amount: null, isTrophy: true }, { categoryId: c.id, place: 5, amount: null, isTrophy: true });
    return p;
  });

const PEOPLE: [string, string, string, string, number, string][] = [
  ["Carlos Henrique Silva", "Nazaré da Mata", "Pedal do Canavial", "1976-03-14", 3, "verified"],
  ["José Ailton Souza", "Tracunhaém", "Ritmo & Giro", "1969-07-02", 4, "verified"],
  ["Marcos Antônio Lima", "Carpina", "Bike Clube Carpina", "1982-11-21", 2, "review"],
  ["Roberto Carlos Pereira", "Timbaúba", "Timbaúba Bikers", "1963-01-30", 5, "verified"],
  ["Paulo Sérgio Barbosa", "Nazaré da Mata", "Pedal do Canavial", "1990-05-09", 0, "pending"],
  ["Fernando Gomes Neto", "Lagoa de Itaenga", "Ritmo & Giro", "1974-09-18", 3, "mismatch"],
  ["Ana Paula Ferreira", "Carpina", "Bike Clube Carpina", "1988-04-12", 6, "verified"],
  ["Edvaldo Santos Filho", "Vitória de Santo Antão", "Vitória Cycling", "1998-02-25", 1, "verified"],
];

export const demoRegistrations = (): Registration[] =>
  PEOPLE.map(([fullName, city, team, birthDate, cat, paymentStatus], i) => ({
    id: `reg-${i + 1}`, eventId: DEMO_EVENT_ID, categoryId: `cat-${cat + 1}`,
    bibNumber: i + 1, bibLabel: formatBib(i + 1), fullName, email: null, city, team,
    whatsapp: `819${String(90000000 + i * 1111111).slice(0, 8)}`, birthDate,
    gender: fullName.startsWith("Ana ") ? "F" : "M", weightKg: null, accessToken: `demo${String(i + 1).padStart(3, "0")}ficha`, kitDeliveredAt: null, checkedInAt: null,
    emergencyContact: null, termsAcceptedAt: "2026-11-10T12:00:00.000Z", source: "link", status: "active",
    paymentStatus: paymentStatus as Registration["paymentStatus"],
    flags: paymentStatus === "review" ? ["low_confidence"] : paymentStatus === "mismatch" ? ["amount_low"] : [],
    isDemo: true, createdAt: `2026-11-1${i % 9}T12:00:00.000Z`,
  }));
