import { DataSourceBadge } from "@/components/DataSourceBadge";

export type Metrica = {
  label: string;
  valor?: string | null;
  unidad?: string;
  fuente: string;
  anio?: string | number | null;
  nota?: string;
  /** Texto cuando no hay valor. Debe decir POR QUÉ falta, no solo que falta. */
  ausente?: string;
};

/**
 * Franja de métricas principales.
 *
 * Sustituye a cuatro tarjetas con borde. El motivo no es estético: encerrar
 * cada cifra en su caja las iguala visualmente, y estas cuatro no valen lo
 * mismo. Sin cajas, el tamaño de la cifra hace la jerarquía y los filetes
 * separan sin encerrar.
 *
 * Una métrica ausente ocupa su sitio igual. Que falte la matrícula de un
 * colegio es información sobre este observatorio, y esconderla dejaría al
 * lector creyendo que vio todo lo que hay.
 */
export function MetricBand({ metricas }: { metricas: Metrica[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-8 lg:grid-cols-4">
      {metricas.map((m, i) => {
        const vacio = m.valor == null || m.valor === "—";
        return (
          <div
            key={m.label}
            className={
              // Filete vertical entre columnas en pantallas anchas; en móvil
              // solo el superior, que ya separa lo suficiente.
              i > 0
                ? "border-t border-rule pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
                : "border-t border-rule pt-4 lg:border-t-0 lg:pt-0"
            }
          >
            <dt className="meta">{m.label}</dt>

            {vacio ? (
              <dd className="mt-3 max-w-[26ch] text-[0.86rem] leading-snug text-ink-3">
                {m.ausente ?? "Sin datos disponibles"}
              </dd>
            ) : (
              <dd className="mt-3 flex items-baseline gap-1.5">
                <span className="cifra text-cifra-l font-medium">{m.valor}</span>
                {m.unidad ? (
                  <span className="text-[0.82rem] text-ink-3">{m.unidad}</span>
                ) : null}
              </dd>
            )}

            {m.nota && !vacio ? (
              <p className="mt-2 max-w-[28ch] text-[0.78rem] leading-snug text-ink-3">
                {m.nota}
              </p>
            ) : null}

            <div className="mt-3">
              <DataSourceBadge fuente={m.fuente} anio={vacio ? null : m.anio} />
            </div>
          </div>
        );
      })}
    </dl>
  );
}
