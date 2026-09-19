/**
 * Etiqueta de procedencia.
 *
 * Es una característica del producto, no un detalle técnico: cada fuente tiene
 * su propia frecuencia de actualización y presentar todo como si fuera del año
 * en curso sería mentir. Ningún dato de esta web aparece sin su año al lado.
 */
export function DataSourceBadge({
  fuente,
  anio,
  className = "",
}: {
  fuente: string;
  anio: string | number | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-rule px-2 py-0.5 font-mono text-[0.66rem] uppercase tracking-wider text-ink-3 ${className}`}
    >
      {fuente}
      {anio ? (
        <>
          <span aria-hidden className="text-rule">
            ·
          </span>
          <span className="tabular text-ink-2">{anio}</span>
        </>
      ) : null}
    </span>
  );
}
