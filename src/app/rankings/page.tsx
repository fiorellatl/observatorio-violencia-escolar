import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MethodologyNote } from "@/components/MethodologyNote";
import { RankingExplorer } from "@/components/RankingExplorer";
import { facetaValida, getAnioPrincipal, getMeta } from "@/lib/data/provider";
import { nf } from "@/lib/format";
import { shell } from "@/lib/ui";

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

const uno = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Metadatos según los filtros.
 *
 * Esta página se comparte como enlace y las vistas previas de WhatsApp, X o
 * Telegram no ejecutan JavaScript: si el título no se calcula en el servidor,
 * todo enlace compartido se anuncia igual, diga lo que diga la tabla. Por eso
 * la página se resuelve por petición en vez de servirse estática; el ranking
 * en sí sigue llegando desde un JSON que el CDN cachea.
 *
 * El título describe la consulta —métrica, año, territorio— y nunca califica
 * a un colegio.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Busqueda;
}): Promise<Metadata> {
  const p = await searchParams;
  const meta = getMeta();
  const tasa = uno(p.metrica) === "tasa";
  // La tasa solo existe en el año del censo, y la tabla se mueve sola a ese
  // año: el título tiene que anunciar el que se va a ver, no el que pedía la
  // URL.
  const anio = tasa ? meta.anio_transversal : uno(p.anio) || getAnioPrincipal();
  const tipo = uno(p.tipo);

  const TIPO: Record<string, string> = {
    fisica: " de violencia física",
    psicologica: " de violencia psicológica",
    sexual: " de violencia sexual",
  };

  // Solo se nombra lo que la tabla va a aplicar de verdad: un valor que no
  // existe en los datos no filtra nada, y anunciarlo en el título haría que
  // el enlace compartido prometiera un universo que nadie va a ver.
  const lugar =
    [
      facetaValida("d", uno(p.distrito)),
      facetaValida("p", uno(p.provincia)),
      facetaValida("r", uno(p.region)),
    ]
      .filter(Boolean)
      .join(", ") || "Perú";
  const rasgos = [facetaValida("g", uno(p.gestion)), facetaValida("n", uno(p.nivel))].filter(
    Boolean
  );

  const base = tasa
    ? `Colegios con mayor tasa de reportes${TIPO[tipo] ?? ""}`
    : `Colegios con más reportes${TIPO[tipo] ?? ""} registrados`;
  const titulo = [base, anio, lugar, ...rasgos].join(" · ");

  const desc =
    `Reportes registrados en SíseVe por colegio en ${lugar}, ${anio}. ` +
    `Un reporte es una alerta registrada, no un caso confirmado. ` +
    `Datos públicos del Ministerio de Educación, con el año de cada fuente.`;

  // Solo se indexa la vista sin filtros: las combinaciones son miles y todas
  // dirían casi lo mismo.
  const limpia = Object.keys(p).length === 0;

  return {
    title: titulo,
    description: desc,
    alternates: { canonical: "/rankings" },
    robots: limpia ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${titulo} — Observatorio Escolar`,
      description: desc,
      type: "website",
      locale: "es_PE",
    },
    twitter: { card: "summary_large_image", title: titulo, description: desc },
    other: { "data:corte": meta.corte },
  };
}

export default function RankingsPage() {
  const meta = getMeta();
  const principal = getAnioPrincipal();

  return (
    <div className={`${shell} py-6 sm:py-8`}>
      <Breadcrumbs
        items={[{ label: "Inicio", href: "/" }, { label: "Colegios con más reportes" }]}
      />

      {/* El titular vive dentro del explorador: cambia con el año, el tipo y
          el territorio, y tiene que quedar dentro de la captura. */}
      <div className="mt-5">
        <Suspense
          fallback={<div className="h-[36rem] animate-pulse rounded-xl border border-rule bg-surface" />}
        >
          <RankingExplorer />
        </Suspense>
      </div>

      {/* ── Cómo leer este ranking ─────────────────────────────────
          Todo lo explicativo vive aquí abajo. No desaparece: se aparta del
          camino de lo que la gente vino a ver. */}
      <section className="mt-16 border-t border-rule pt-10">
        <h2 className="font-display text-display-m font-medium">Cómo leer este ranking</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <MethodologyNote tono="aviso">
            Esta tabla no dice qué colegio es más violento: dice cuál registró más
            reportes, que es otra cosa. Un número alto puede reflejar que allí denunciar
            funciona mejor.
          </MethodologyNote>
          <MethodologyNote>
            Los reportes registrados no equivalen a casos únicos. SíseVe advierte que
            puede existir más de un reporte sobre un mismo caso, y un colegio sin reportes
            no significa que no haya ocurrido violencia.
          </MethodologyNote>
        </div>

        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="meta">Qué cuenta la métrica principal</p>
            <p className="mt-2 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              El número de reportes registrados en el año. Un colegio de 2.000 estudiantes
              tendrá casi siempre más que uno de 200, así que esta ordenación mide también
              el tamaño.
            </p>
          </div>
          <div>
            <p className="meta">Una fila es un colegio, no un nivel</p>
            <p className="mt-2 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              Los reportes de inicial, primaria y secundaria de una misma institución se
              suman en una sola fila. Al filtrar por un nivel, la fila pasa a mostrar los
              reportes de ese nivel.
            </p>
          </div>
          <div>
            <p className="meta">La tasa es secundaria</p>
            <p className="mt-2 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              Divide los reportes entre el número de alumnos y permite comparar colegios de
              distinto tamaño. Solo existe en {meta.anio_transversal} —el último Censo
              Educativo publicado— y a partir de {nf(meta.matricula_minima)} alumnos: por
              debajo, un solo reporte mueve la tasa decenas de puntos. No representa
              personas afectadas ni casos únicos.
            </p>
          </div>
          <div>
            <p className="meta">Qué año se muestra</p>
            <p className="mt-2 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              Por defecto {principal}, el último año completo. {meta.anio_parcial} está en
              curso —datos hasta el {meta.corte}— y no se compara con un año cerrado.
            </p>
          </div>
          <div>
            <p className="meta">Por qué faltan {meta.anios_pandemia.join(" y ")}</p>
            <p className="mt-2 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              Los colegios estuvieron cerrados. Ordenar esos años por número de reportes
              mediría el acceso al canal de denuncia, no lo que la tabla dice medir.
            </p>
          </div>
          <div>
            <p className="meta">El cambio se cuenta en reportes</p>
            <p className="mt-2 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              «+24 respecto a {principal}» y no «subió 1.062 posiciones»: lo segundo es
              cierto y no significa nada, porque depende de cuántos colegios empataban.
            </p>
          </div>
        </div>

        <div className="mt-9 flex flex-wrap gap-x-7 gap-y-2 border-t border-rule pt-6 text-[0.9rem]">
          <Link href="/metodologia" className="font-medium text-accent hover:underline">
            Metodología completa →
          </Link>
          <Link href="/senales" className="font-medium text-accent hover:underline">
            Dónde el registro cambió más de lo esperable →
          </Link>
          <Link href="/datos" className="font-medium text-accent hover:underline">
            Los datos del país →
          </Link>
        </div>
      </section>
    </div>
  );
}
