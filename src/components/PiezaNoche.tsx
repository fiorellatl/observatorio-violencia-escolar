/**
 * Un hallazgo contado como pieza: pregunta, respuesta, gráfico y letra chica
 * sobre el material «noche».
 *
 * Es el mismo lenguaje de las piezas de redes —la cifra manda, la menta
 * marca lo que importa— dentro de /datos, para los hallazgos que se leen de
 * un golpe. Los paneles claros siguen siendo para la exploración.
 */
export function PiezaNoche({
  antetitulo,
  titulo,
  respuesta,
  children,
  nota,
}: {
  antetitulo: string;
  titulo: React.ReactNode;
  respuesta: React.ReactNode;
  children: React.ReactNode;
  nota: React.ReactNode;
}) {
  return (
    <figure className="noche overflow-hidden rounded-xl px-5 py-8 sm:px-10 sm:py-11">
      <p className="meta-noche">{antetitulo}</p>
      <h3 className="titular mt-4 max-w-[18ch] text-[clamp(2.1rem,6vw,3.6rem)] text-noche-ink">{titulo}</h3>
      <p className="mt-5 max-w-[34ch] text-[clamp(1.15rem,2.4vw,1.5rem)] font-semibold leading-snug text-noche-ink-2">
        {respuesta}
      </p>
      <div className="mt-8">{children}</div>
      <figcaption className="mt-8 max-w-prose border-t border-noche-rule pt-5 text-[0.8rem] leading-relaxed text-noche-ink-3">
        {nota}
      </figcaption>
    </figure>
  );
}

/**
 * Dos barras horizontales por fila —un grupo frente a otro— con el valor
 * escrito. Las filas cuya diferencia no es clara se atenúan: se muestran,
 * pero no piden atención.
 */
export function ParesHorizontales({
  series,
  bloques,
  formato,
}: {
  series: [SerieBarra, SerieBarra];
  bloques: { titulo: string; filas: { nombre: string; a: number; b: number; claro?: boolean }[] }[];
  formato: (v: number) => string;
}) {
  return (
    <div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-hidden>
        {series.map((s) => (
          <li key={s.nombre} className="flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-noche-ink-2">
            <span className={`inline-block h-2.5 w-6 rounded-sm ${s.clase}`} />
            {s.nombre}
          </li>
        ))}
      </ul>
      {bloques.map((b) => (
        <div key={b.titulo} className="mt-6">
          <p className="meta !text-noche-ink-3">{b.titulo}</p>
          <dl className="mt-3 space-y-3.5">
            {b.filas.map((f) => (
              <div key={f.nombre} className="grid grid-cols-[minmax(7.5rem,11rem)_1fr] items-center gap-4">
                <dt className={`text-[0.95rem] font-medium ${f.claro === false ? "text-noche-ink-3" : "text-noche-ink"}`}>
                  {f.nombre}
                </dt>
                <dd className="space-y-1.5">
                  {[f.a, f.b].map((v, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span
                        className={`block h-2.5 rounded-sm ${series[i].clase}`}
                        style={{ width: `${Math.max(1, v * 0.85)}%` }}
                        title={`${f.nombre} · ${series[i].nombre}: ${formato(v)}`}
                      />
                      <span className={`cifra text-[0.8rem] ${i ? "text-noche-ink" : "text-noche-ink-3"}`}>{formato(v)}</span>
                    </div>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export interface SerieBarra {
  nombre: string;
  /** Clase de fondo de Tailwind. */
  clase: string;
  /** La serie de referencia se dibuja como contorno, no como relleno. */
  referencia?: boolean;
}

export interface GrupoBarras {
  etiqueta: string;
  detalle?: string;
  /** Un valor por serie, en la misma unidad que `maximo`. */
  valores: number[];
}

/**
 * Barras agrupadas en HTML: se adaptan al ancho sin JavaScript y cada barra
 * lleva su valor escrito, así el color nunca va solo.
 */
export function BarrasAgrupadas({
  series,
  grupos,
  maximo,
  formato,
  pie,
}: {
  series: SerieBarra[];
  grupos: GrupoBarras[];
  maximo: number;
  formato: (v: number) => string;
  pie?: string;
}) {
  return (
    <div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-hidden>
        {series.map((s) => (
          <li key={s.nombre} className="flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-noche-ink-2">
            <span
              className={`inline-block h-2.5 w-6 rounded-sm ${s.referencia ? "border border-dashed border-noche-ink-3" : s.clase}`}
            />
            {s.nombre}
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-4 gap-3 sm:gap-6" role="list">
        {grupos.map((g) => (
          <div key={g.etiqueta} role="listitem" className="min-w-0">
            <div className="flex h-44 items-end justify-center gap-1.5 border-b border-noche-rule-2 sm:h-56 sm:gap-2">
              {g.valores.map((v, i) => {
                const s = series[i];
                return (
                  <div key={s.nombre} className="flex h-full w-full max-w-[3.25rem] flex-col justify-end">
                    <span
                      className={`cifra mb-1.5 whitespace-nowrap text-center ${
                        i === 0 ? "text-[clamp(1rem,2.6vw,1.45rem)] text-noche-ink" : "text-[0.8rem] text-noche-ink-3"
                      }`}
                    >
                      {formato(v)}
                    </span>
                    <span
                      className={`block rounded-t ${s.referencia ? "border border-b-0 border-dashed border-noche-ink-3" : s.clase}`}
                      // 80 % como techo: el resto de la columna es para la cifra.
                      style={{ height: `${Math.max(1.5, (v / maximo) * 80)}%` }}
                      title={`${g.etiqueta} · ${s.nombre}: ${formato(v)}`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[0.86rem] font-medium leading-tight text-noche-ink sm:text-[0.95rem]">
              {g.etiqueta}
            </p>
            {g.detalle ? (
              <p className="mt-1 text-center font-mono text-[0.62rem] text-noche-ink-3">{g.detalle}</p>
            ) : null}
          </div>
        ))}
      </div>
      {pie ? <p className="meta mt-4 !text-noche-ink-3">{pie}</p> : null}
    </div>
  );
}
