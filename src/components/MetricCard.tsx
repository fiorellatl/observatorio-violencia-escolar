import { DataSourceBadge } from "./DataSourceBadge";

/**
 * Cifra con su procedencia. Si el dato no existe todavía, la tarjeta lo dice en
 * lugar de desaparecer: saber qué información falta es parte de lo que este
 * sitio quiere mostrar.
 */
export function MetricCard({
  label,
  value,
  unit,
  fuente,
  anio,
  nota,
  ausente,
}: {
  label: string;
  value?: string | number | null;
  unit?: string;
  fuente: string;
  anio?: string | number | null;
  nota?: string;
  ausente?: string;
}) {
  const vacio = ausente != null || value == null || value === "—";

  return (
    <div className="flex flex-col rounded-lg border border-rule bg-surface p-4">
      <p className="text-[0.78rem] font-medium leading-snug text-ink-2">{label}</p>

      {vacio ? (
        <p className="mt-3 flex-1 text-[0.82rem] leading-snug text-ink-3">
          {ausente ?? "Sin dato público"}
        </p>
      ) : (
        <p className="tabular mt-2 flex-1 font-mono text-stat font-semibold text-ink">
          {value}
          {unit ? (
            <span className="ml-1 font-sans text-[0.8rem] font-normal text-ink-3">
              {unit}
            </span>
          ) : null}
        </p>
      )}

      {nota ? <p className="mt-2 text-[0.72rem] leading-snug text-ink-3">{nota}</p> : null}

      <div className="mt-3">
        <DataSourceBadge fuente={fuente} anio={vacio ? null : anio} />
      </div>
    </div>
  );
}
