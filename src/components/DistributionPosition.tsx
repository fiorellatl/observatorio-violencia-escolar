import { dec, nf } from "@/lib/format";
import { ESCALA_SECUENCIAL, colorPorTramo } from "@/lib/viz/colors";
import type { ContextoDistribucion } from "@/lib/distribucion";

/**
 * Dónde cae este colegio dentro del reparto de reportes registrados.
 *
 * LA PREGUNTA QUE RESPONDE es "¿dónde está comparado con los demás?", no
 * "¿qué tan violento es?". Un número absoluto no se puede leer solo: 45 no
 * significa nada hasta saber que la mitad de los colegios que registran algo
 * se queda en 2. Eso es lo único que hace esta pieza.
 *
 * POR QUÉ EL EJE ES EL PERCENTIL Y NO EL CONTEO. El reparto es tan asimétrico
 * que un eje de 0 a 76 amontona a cinco mil colegios en el primer centímetro
 * y deja el resto vacío: la mediana caería pegada al borde izquierdo y dos
 * colegios muy distintos se verían en el mismo punto. Sobre el percentil, la
 * mediana está siempre en el centro y la posición se lee directamente, que es
 * justo lo que se quiere comunicar. Los conteos van escritos debajo, sin
 * intermediarios.
 *
 * NO ES UN RANKING. No hay puesto, no hay podio y no hay nadie con quien
 * compararse por nombre: hay un reparto y una posición dentro de él.
 */
export function DistributionPosition({ ctx }: { ctx: ContextoDistribucion }) {
  const pos = Math.min(99.4, Math.max(0.6, ctx.percentil));
  const tono = colorPorTramo(ctx.tramo);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="meta">Dónde cae en la distribución</p>
        <p className="text-[0.8rem] text-ink-3">
          {nf(ctx.n)} colegios {ctx.universo.replace(/^colegios /, "")}
        </p>
      </div>

      {/* La barra es un gráfico, no un adorno: lleva rótulos en los dos
          extremos porque «izquierda» y «derecha» no significan nada solas. */}
      <div className="mt-5">
        <div
          className="relative h-3 w-full rounded-sm"
          role="img"
          aria-label={`Este colegio registra ${nf(ctx.valor)} reportes en ${ctx.anio}. ${ctx.frase} La mediana del universo es ${dec(ctx.mediana, 1)}.`}
          style={{
            background: `linear-gradient(to right, ${ESCALA_SECUENCIAL.join(", ")})`,
          }}
        >
          {/* La mediana parte el eje por la mitad, por definición. */}
          <span
            aria-hidden
            className="absolute top-[-6px] h-[24px] w-px bg-ink-3"
            style={{ left: "50%" }}
          />
          <span
            aria-hidden
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-paper shadow-sm"
            style={{ left: `${pos}%`, background: tono }}
          />
        </div>

        <div className="mt-2.5 flex justify-between text-[0.76rem] text-ink-3">
          <span>menos reportes</span>
          <span>más reportes</span>
        </div>
      </div>

      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
        <div>
          <dt className="text-[0.8rem] text-ink-3">Este colegio</dt>
          <dd className="cifra mt-0.5 text-cifra-m text-ink">{nf(ctx.valor)}</dd>
        </div>
        <div>
          <dt className="text-[0.8rem] text-ink-3">Mediana del universo</dt>
          <dd className="cifra mt-0.5 text-cifra-m text-ink-2">{dec(ctx.mediana, 1)}</dd>
        </div>
      </dl>

      <p className="mt-4 max-w-prose text-[1rem] leading-snug text-ink">{ctx.frase}</p>

      <p className="mt-3 max-w-prose text-[0.78rem] leading-relaxed text-ink-3">
        Describe la distribución de reportes registrados en {ctx.anio}, no la violencia
        que ocurre: un colegio puede registrar más porque allí denunciar funciona mejor.
        {ctx.parcial ? ` ${ctx.anio} es un año en curso.` : ""}
      </p>
    </div>
  );
}
