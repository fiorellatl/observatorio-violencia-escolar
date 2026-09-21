import { dec, nf } from "@/lib/format";
import { ESCALA_SECUENCIAL, colorPorTramo } from "@/lib/viz/colors";
import type { ContextoDistribucion } from "@/lib/distribucion";

/** La interpolación da decimales; cuando no los hay, no se inventan. */
const medianaLegible = (v: number) => (Number.isInteger(v) ? nf(v) : dec(v, 1));

/**
 * Dónde cae este colegio dentro del reparto de reportes registrados.
 *
 * LA PREGUNTA QUE RESPONDE es "¿dónde está comparado con los demás?", no
 * "¿qué tan violento es?". Un número absoluto no se puede leer solo: 76 no
 * significa nada hasta saber que la mitad de los colegios que registran algo
 * se queda en 2.
 *
 * POR QUÉ EL EJE ES EL PERCENTIL Y NO EL CONTEO. El reparto es tan asimétrico
 * que un eje de 0 a 76 amontona a cinco mil colegios en el primer centímetro
 * y deja el resto vacío: la mediana caería pegada al borde izquierdo y dos
 * colegios muy distintos se verían en el mismo punto. Sobre el percentil, la
 * mediana está siempre en el centro y la posición se lee directamente.
 *
 * QUÉ NO SE ENSEÑA. Los cuantiles que deciden el tramo —p75, p90, p95, p99—
 * se quedan dentro del motor. Nadie necesita leer "p95" para entender "está
 * entre el 5 % que más registra", y enseñarlos convertiría una frase clara en
 * una tabla estadística.
 *
 * NO ES UN RANKING. No hay puesto, no hay podio y no hay nadie con quien
 * compararse por nombre: hay un reparto y una posición dentro de él.
 */
export function DistributionPosition({ ctx }: { ctx: ContextoDistribucion }) {
  const pos = Math.min(99.4, Math.max(0.6, ctx.percentil));
  const tono = colorPorTramo(ctx.tramo);

  return (
    <div>
      <p className="meta">Dónde cae en la distribución</p>

      {/* La barra es un gráfico, no un adorno: lleva rótulos en los dos
          extremos porque «izquierda» y «derecha» no significan nada solas. */}
      <div className="mt-5">
        <div
          className="relative h-3 w-full rounded-sm"
          role="img"
          aria-label={`Este colegio registra ${nf(ctx.valor)} reportes en ${ctx.anio}. ${ctx.frase} La mediana es ${medianaLegible(ctx.mediana)}.`}
          style={{ background: `linear-gradient(to right, ${ESCALA_SECUENCIAL.join(", ")})` }}
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

      <p className="mt-6 flex items-baseline gap-2.5">
        <span className="text-[0.95rem] text-ink-2">Mediana:</span>
        <span className="cifra text-cifra-m text-ink">{medianaLegible(ctx.mediana)}</span>
        <span className="text-[0.95rem] text-ink-2">reportes</span>
      </p>
      <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-3">
        Entre {ctx.universo}.
        {ctx.parcial ? " Es un año en curso." : ""}
      </p>

      <p className="mt-5 max-w-prose text-[1.05rem] leading-snug text-ink">{ctx.frase}</p>
    </div>
  );
}
