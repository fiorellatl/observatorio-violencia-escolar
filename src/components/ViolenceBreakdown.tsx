import { dec, nf } from "@/lib/format";

export interface BreakdownItem {
  label: string;
  value: number;
  color: string;
  nota?: string;
}

/**
 * Composición de reportes por categoría.
 *
 * Dos formas, porque dos secciones del perfil muestran cosas distintas y
 * repetir el mismo gráfico las hace parecer el mismo dato:
 *
 *   "lista"  — varias categorías (tipo de violencia). El número manda; la
 *              barra de proporción va debajo, fina, como apoyo.
 *   "duo"    — dos categorías (quién ejerce). Cada una es una cifra grande;
 *              la proporción se lee de un vistazo sin comparar ángulos.
 *
 * Nunca es un gráfico de sectores: la lista con la cifra exacta se lee mejor
 * en móvil y no obliga a estimar ángulos. El color identifica la categoría y
 * no la valora — ninguna de estas categorías es "peor" que otra.
 */
export function ViolenceBreakdown({
  items,
  total,
  variante = "lista",
}: {
  items: BreakdownItem[];
  total: number;
  variante?: "lista" | "duo";
}) {
  const conValor = items.filter((i) => i.value > 0);

  if (total === 0 || conValor.length === 0) {
    return (
      <p className="text-[0.86rem] text-ink-3">
        Sin reportes registrados en este periodo.
      </p>
    );
  }

  const porcentaje = (v: number) => (total === 0 ? 0 : (v / total) * 100);

  if (variante === "duo") {
    return (
      <div>
        <dl className="grid gap-px overflow-hidden rounded border border-rule bg-rule sm:grid-cols-2">
          {items.map((i) => (
            <div key={i.label} className="bg-surface p-5">
              <dd className="cifra text-cifra-l font-medium" style={{ color: i.color }}>
                {nf(i.value)}
              </dd>
              <dt className="mt-2.5 text-[0.92rem] font-medium leading-snug text-ink">
                {i.label}
              </dt>
              <p className="tabular mt-1 text-[0.82rem] text-ink-3">
                {dec(porcentaje(i.value), 1)} % de los reportes
              </p>
            </div>
          ))}
        </dl>

        <div
          className="mt-3 flex h-1.5 w-full overflow-hidden rounded-sm"
          role="img"
          aria-label={items
            .map((i) => `${i.label}: ${nf(i.value)}, ${dec(porcentaje(i.value), 1)} por ciento`)
            .join("; ")}
        >
          {conValor.map((i) => (
            <div key={i.label} style={{ flex: i.value, background: i.color }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <ul
      className="divide-y divide-rule-3"
      aria-label={items
        .map((i) => `${i.label}: ${nf(i.value)}, ${dec(porcentaje(i.value), 1)} por ciento`)
        .join("; ")}
    >
      {items.map((i) => (
        <li key={i.label} className="py-3.5 first:pt-0 last:pb-0">
          <div className="flex items-baseline gap-3">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-sm"
              style={{ background: i.color }}
            />
            <span className="text-[0.92rem] text-ink-2">{i.label}</span>
            <span className="ml-auto flex items-baseline gap-3">
              <span className="cifra text-cifra-m font-medium text-ink">{nf(i.value)}</span>
              <span className="tabular w-[3.6rem] text-right text-[0.82rem] text-ink-3">
                {dec(porcentaje(i.value), 1)} %
              </span>
            </span>
          </div>

          {/* Apoyo, no protagonista: 3 px y sin borde. */}
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-sm bg-rule-2" aria-hidden>
            <div
              className="h-full rounded-sm"
              style={{ width: `${porcentaje(i.value)}%`, background: i.color }}
            />
          </div>

          {i.nota ? <p className="mt-1.5 text-[0.78rem] text-ink-3">{i.nota}</p> : null}
        </li>
      ))}
    </ul>
  );
}
