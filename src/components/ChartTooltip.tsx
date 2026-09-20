"use client";

import { dec, nf } from "@/lib/format";

/**
 * Tooltip común a todos los gráficos.
 *
 * Mismo orden siempre: año arriba, filas de indicador, fuente abajo. Que el
 * ojo sepa dónde mirar vale más que adaptar cada tooltip a su gráfico.
 *
 * Una fila con `valor === null` se muestra igual, diciendo que no hay dato. No
 * se omite: si la tasa falta, el lector tiene que enterarse de que falta, no
 * quedarse esperando una línea que nunca aparece.
 */
export type FilaTooltip = {
  label: string;
  valor: number | string | null | undefined;
  sufijo?: string;
  decimales?: number;
  color?: string;
};

export function ChartTooltip({
  titulo,
  filas,
  fuente,
  nota,
}: {
  titulo: string;
  filas: FilaTooltip[];
  fuente?: string;
  nota?: string;
}) {
  return (
    <div className="pointer-events-none min-w-[10.5rem] max-w-[15rem] rounded-lg border border-rule bg-surface px-3 py-2.5 shadow-lg shadow-black/10">
      <p className="tabular font-mono text-[0.72rem] uppercase tracking-wider text-ink-3">
        {titulo}
      </p>

      <dl className="mt-1.5 space-y-1">
        {filas.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-[0.78rem] text-ink-2">
              {f.color ? (
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: f.color }}
                />
              ) : null}
              {f.label}
            </dt>
            <dd className="tabular shrink-0 text-[0.86rem] font-medium text-ink">
              {f.valor == null ? (
                <span className="text-[0.78rem] font-normal text-ink-3">sin dato</span>
              ) : typeof f.valor === "string" ? (
                f.valor
              ) : (
                <>
                  {f.decimales != null ? dec(f.valor, f.decimales) : nf(f.valor)}
                  {f.sufijo ? (
                    <span className="ml-0.5 text-[0.72rem] font-normal text-ink-3">{f.sufijo}</span>
                  ) : null}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {nota ? <p className="mt-2 text-[0.72rem] leading-snug text-ink-3">{nota}</p> : null}
      {fuente ? (
        <p className="mt-2 border-t border-rule-2 pt-1.5 font-mono text-[0.66rem] uppercase tracking-wider text-ink-3">
          {fuente}
        </p>
      ) : null}
    </div>
  );
}
