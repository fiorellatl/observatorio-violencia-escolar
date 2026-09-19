import Link from "next/link";

/**
 * Nota metodológica: visible pero no invasiva. Va pegada al dato que matiza,
 * nunca escondida al pie de la página.
 */
export function MethodologyNote({
  children,
  tono = "neutro",
  href,
}: {
  children: React.ReactNode;
  tono?: "neutro" | "aviso";
  href?: string;
}) {
  const borde = tono === "aviso" ? "border-l-warn" : "border-l-rule";
  return (
    <aside
      className={`border-l-2 ${borde} bg-surface/60 py-2.5 pl-4 pr-3 text-[0.82rem] leading-relaxed text-ink-2`}
    >
      {children}
      {href ? (
        <>
          {" "}
          <Link href={href} className="whitespace-nowrap text-accent underline-offset-2 hover:underline">
            Leer más
          </Link>
        </>
      ) : null}
    </aside>
  );
}
