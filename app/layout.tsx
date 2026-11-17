import type { Metadata, Viewport } from "next";
import "@fontsource/barlow-condensed/800-italic.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Largada — inscrição de eventos esportivos", template: "%s · Largada" },
  description: "Inscrição simples para eventos esportivos de comunidade: um link, sem app, comprovante conferido por IA.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0d0d0e" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
