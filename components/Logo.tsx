// Marca provisória em SVG (bandeira de largada + nome). Troque por <img src="/logo.png"> quando o arquivo final estiver em /public.
export function Logo({ light = false, size = 28 }: { light?: boolean; size?: number }) {
  const ink = light ? "#fff" : "#0d0d0e";
  return (
    <span className="inline-flex items-center gap-2" aria-label="Largada">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#d4161c" />
        <path d="M9 24V8h3.2l11 5-11 5" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="display text-[1.55rem]" style={{ color: ink }}>Largada</span>
    </span>
  );
}
