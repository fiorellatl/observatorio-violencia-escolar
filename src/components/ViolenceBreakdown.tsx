import { nf, pct } from "@/lib/format";

export interface BreakdownItem {
  label: string;
  value: number;
  color: string;
  nota?: string;
}

/**
 * Distribución de tipos de reporte, como barra apilada + lista.
 *
 * No es un gráfico de torta a propósito: la lista con el número exacto al lado
 * se lee mejor en móvil y no obliga a comparar ángulos. Cada segmento lleva su
 * etiqueta visible, así que la identidad no depende solo del color.
 */
export function ViolenceBreakdown({
  items,
  total,
}: {
  items: BreakdownItem[];
  total: number;
}) {
  const conValor = items.filter((i) => i.value > 0);
  if (total === 0 || conValor.length === 0) {
    return <p className="text-[0.85rem] text-ink-3">Sin reportes registrados en este período.</p>;
  }

  return (
    <div>
      <div className="flex h-7 w-full gap-[3px] overflow-hidden rounded-md" role="img"
        aria-label={conValor.map((i) => `${i.label}: ${i.value}`).join(", ")}>
        {conValor.map((i) => (
          <div
            key={i.label}
            style={{ flex: i.value, background: i.color }}
            className="first:rounded-l-md last:rounded-r-md"
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {items.map((i) => (
          <li key={i.label} className="flex items-baseline gap-3 text-[0.88rem]">
            <span
              aria-hidden
              className="mt-[0.35rem] h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: i.color }}
            />
            <span className="text-ink-2">{i.label}</span>
            <span className="ml-auto flex items-baseline gap-2.5">
              <span className="tabular font-mono font-semibold text-ink">{nf(i.value)}</span>
              <span className="tabular w-14 text-right text-[0.78rem] text-ink-3">
                {pct(i.value, total)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
