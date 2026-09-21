import type { Metadata } from "next";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { Proximamente } from "@/components/DataState";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ReportTrend } from "@/components/ReportTrend";
import { ScatterXY } from "@/components/ScatterXY";
import { CategoryBars, type SerieDef } from "@/components/CategoryBars";
import { getCross, getMeta, getNational } from "@/lib/data/provider";
import { nf } from "@/lib/format";
import { COLOR_ACTOR, COLOR_VIOLENCIA, color } from "@/lib/viz/colors";
import { entradilla, meta as clsMeta, panelPad, panelEnlace, h3 } from "@/lib/ui";

/**
 * Recharts son ~90 KB de JavaScript. La dispersión vive bien abajo de la
 * página, así que se carga cuando se llega, no al abrir.
 */
const ScatterPanel = dynamicImport(
  () => import("@/components/ScatterPanel").then((m) => m.ScatterPanel),
  {
    loading: () => (
      <div className="flex h-[380px] items-center justify-center rounded-lg border border-rule-2">
        <p className="text-[0.85rem] text-ink-3">Cargando el gráfico…</p>
      </div>
    ),
  }
);

export const metadata: Metadata = {
  title: "Explora los datos",
  description:
    "Qué registra SíseVe en el Perú: cuántos reportes hay, cómo han cambiado por año, qué tipos de violencia aparecen y cómo se relacionan con el tamaño del colegio.",
  alternates: { canonical: "/datos" },
};

/** Cabecera técnica de cada visualización: con qué datos trabaja y de qué año. */
function FichaTecnica({
  n,
  anio,
  variables,
  cobertura,
}: {
  n: string;
  anio: string;
  variables: string;
  cobertura: string;
}) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-rule-2 pt-4 text-[0.78rem] sm:grid-cols-4">
      {[
        ["n", n],
        ["Año", anio],
        ["Variables", variables],
        ["Cobertura", cobertura],
      ].map(([k, v]) => (
        <div key={k}>
          <dt className={clsMeta}>{k}</dt>
          <dd className="tabular mt-0.5 text-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Una pregunta y su respuesta. La unidad de la página. */
function Pregunta({
  id,
  pregunta,
  children,
}: {
  id: string;
  pregunta: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-rule pt-9 sm:pt-11">
      <h2 className="font-display text-display-l font-medium text-balance">{pregunta}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const PREGUNTAS = [
  { id: "que-pasa", texto: "¿Qué está pasando?" },
  { id: "como-cambio", texto: "¿Cómo ha cambiado?" },
  { id: "que-se-registra", texto: "¿Qué se registra?" },
  { id: "donde", texto: "¿Dónde se concentra?" },
  { id: "tamano", texto: "¿Los colegios más grandes registran más reportes?" },
  { id: "pension", texto: "¿Y con la pensión?" },
];

export default function DatosPage() {
  const meta = getMeta();
  const nacional = getNational();
  const cross = getCross();

  const serie = nacional.map((n) => ({
    anio: n.anio,
    total: n.total,
    pandemia: n.pandemia,
    parcial: n.anio === meta.anio_parcial,
  }));

  const conPension = cross.filter((c) => (c.pension ?? 0) > 0);
  const comparables = nacional.filter((n) => !n.pandemia && n.anio !== meta.anio_parcial);
  const pico = comparables.reduce((a, b) => (b.total > a.total ? b : a), comparables[0]);
  const ultimoCompleto = comparables[comparables.length - 1];

  const t = meta.anio_transversal;

  // Tipo y presunto agresor, AÑO A AÑO. Antes esta sección mostraba la
  // composición de un solo año: respondía "qué se registra" pero no "qué ha
  // cambiado", que en catorce años de serie es la mitad de la pregunta. Los
  // dos desgloses vienen completos desde 2013 en `national.json`, así que no
  // hacía falta ningún dato nuevo para enseñarlos.
  const puntos = (claves: string[]) =>
    nacional.map((n) => {
      const valores: Record<string, number> = {};
      for (const k of claves) valores[k] = Number(n[k as keyof typeof n]) || 0;
      return {
        anio: n.anio,
        total: n.total,
        pandemia: n.pandemia,
        parcial: n.anio === meta.anio_parcial,
        valores,
      };
    });

  const seriesTipo: SerieDef[] = [
    { clave: "psicologica", label: "Psicológica", color: color(COLOR_VIOLENCIA.psicologica) },
    { clave: "fisica", label: "Física", color: color(COLOR_VIOLENCIA.fisica) },
    { clave: "sexual", label: "Sexual", color: color(COLOR_VIOLENCIA.sexual) },
  ];
  const seriesActor: SerieDef[] = [
    { clave: "entre_escolares", label: "Entre estudiantes", color: color(COLOR_ACTOR.entre_escolares) },
    { clave: "personal_ie", label: "De un adulto del colegio", color: color(COLOR_ACTOR.personal_ie) },
  ];

  const privadosDelCorte = cross.filter((c) => c.gestion.startsWith("Priv")).length;

  return (
    <div className="mx-auto max-w-shell px-5 py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Explorar datos" }]} />

      <h1 className="mt-6 max-w-[20ch] font-display text-display-xl font-medium text-balance">
        Explora los datos
      </h1>
      <p className="mt-5 max-w-prose text-[1.02rem] leading-relaxed text-ink-2">
        Cada bloque responde una pregunta y dice con cuántos colegios trabaja, de qué año
        son los datos y qué no se puede concluir de ellos.
      </p>

      {/* Índice: en una página larga, saber qué hay abajo antes de bajar. */}
      <nav aria-label="Secciones" className="mt-7">
        <ul className="flex flex-wrap gap-2">
          {PREGUNTAS.map((p) => (
            <li key={p.id}>
              <a
                href={`#${p.id}`}
                className="inline-block rounded-lg border border-rule bg-surface px-3 py-1.5 text-[0.82rem] text-ink-2 transition-colors hover:border-accent hover:text-accent"
              >
                {p.texto}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 space-y-2">
        {/* ── ¿Qué está pasando? ─────────────────────────────── */}
        <Pregunta id="que-pasa" pregunta="¿Qué está pasando?">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                k: "Reportes registrados",
                v: nf(meta.reportes),
                d: `entre ${meta.anio_min} y ${meta.anio_max}`,
              },
              {
                k: "Colegios con al menos uno",
                v: nf(meta.colegios),
                d: "servicios educativos",
              },
              {
                k: `Reportes en ${ultimoCompleto?.anio ?? t}`,
                v: nf(ultimoCompleto?.total ?? 0),
                d: "último año completo",
              },
              {
                k: `Reportes en ${meta.anio_parcial}`,
                v: nf(nacional.find((n) => n.anio === meta.anio_parcial)?.total ?? 0),
                d: "año incompleto, corte a agosto",
              },
            ].map((c) => (
              <div key={c.k} className={panelPad}>
                <dt className={clsMeta}>{c.k}</dt>
                <dd className="cifra mt-2 text-stat">{c.v}</dd>
                <p className="mt-1.5 text-[0.8rem] text-ink-3">{c.d}</p>
              </div>
            ))}
          </dl>
          <div className="mt-5 max-w-prose">
            <MethodologyNote>
              Muchos hechos no llegan nunca al sistema: lo que se cuenta aquí es lo que
              alguien registró.
            </MethodologyNote>
          </div>
        </Pregunta>

        {/* ── ¿Cómo ha cambiado? ─────────────────────────────── */}
        <Pregunta id="como-cambio" pregunta="¿Cómo ha cambiado?">
          <div className={panelPad}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={h3}>Reportes registrados por año</h3>
              <DataSourceBadge fuente="SíseVe" anio={`${meta.anio_min}–${meta.anio_max}`} />
            </div>
            <p className={entradilla}>Todos los reportes del país según su año de registro.</p>

            <div className="mt-6">
              <ReportTrend data={serie} alto={300} />
            </div>

            <FichaTecnica
              n={`${nf(meta.colegios)} colegios`}
              anio={`${meta.anio_min}–${meta.anio_max}`}
              variables="Reportes por año"
              cobertura="Nacional"
            />

            <div className="mt-4 space-y-3">
              <MethodologyNote tono="aviso">
                La franja sombreada marca {meta.anios_pandemia.join(" y ")}: los colegios
                estuvieron cerrados y la caída refleja la ausencia del canal de reporte.{" "}
                {meta.anio_parcial} va rayado porque cubre solo hasta agosto.
              </MethodologyNote>
              <MethodologyNote>
                Entre los años comparables, el máximo corresponde a{" "}
                <strong className="font-semibold text-ink">{pico?.anio}</strong> con{" "}
                {nf(pico?.total ?? 0)} reportes. Un aumento puede reflejar más denuncia, más
                violencia, o ambas: estos datos no permiten separarlas.
              </MethodologyNote>
            </div>
          </div>
        </Pregunta>

        {/* ── ¿Qué se registra? ──────────────────────────────── */}
        <Pregunta id="que-se-registra" pregunta="¿Qué se registra?">
          <div className="grid gap-4">
            <div className={panelPad}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className={h3}>Tipo de violencia, año a año</h3>
                <DataSourceBadge fuente="SíseVe" anio={`${meta.anio_min}–${meta.anio_max}`} />
              </div>
              <p className={entradilla}>
                Cada categoría por año de registro, no el acumulado.
              </p>
              <div className="mt-6">
                <CategoryBars
                  series={seriesTipo}
                  puntos={puntos(["psicologica", "fisica", "sexual"])}
                  alto={320}
                  notaPorcentaje="Cada reporte se registra con un tipo de violencia, así que las tres categorías reparten el total del año."
                />
              </div>
            </div>

            <div className={panelPad}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className={h3}>Quién ejerce, año a año</h3>
                <DataSourceBadge fuente="SíseVe" anio={`${meta.anio_min}–${meta.anio_max}`} />
              </div>
              <p className={entradilla}>
                Entre estudiantes o desde un adulto de la institución.
              </p>
              <div className="mt-6">
                <CategoryBars
                  series={seriesActor}
                  puntos={puntos(["entre_escolares", "personal_ie"])}
                  alto={300}
                  notaPorcentaje="Cada reporte se clasifica en una de las dos categorías, así que el porcentaje describe el reparto del año."
                />
              </div>
            </div>
          </div>
          <div className="mt-5 max-w-prose">
            <MethodologyNote>
              Cada reporte se registra con un tipo de violencia y con un presunto
              agresor, así que cada desglose reparte el total del año.
            </MethodologyNote>
          </div>
        </Pregunta>

        {/* ── ¿Dónde se concentra? ───────────────────────────── */}
        <Pregunta id="donde" pregunta="¿Dónde se concentra?">
          <Proximamente titulo="La distribución territorial necesita un denominador">
            Podríamos sumar los reportes de cada región hoy mismo, pero ese mapa mostraría
            sobre todo dónde vive más gente: Lima tiene más reportes que Madre de Dios
            porque tiene muchísimos más estudiantes. Para decir algo sobre el territorio
            hace falta el número de alumnos de cada región, que se está descargando del padrón de
            ESCALE. Hasta entonces preferimos el hueco antes que un mapa que se lea al
            revés.
          </Proximamente>
        </Pregunta>

        {/* ── ¿Cambia con el tamaño? ─────────────────────────── */}
        <Pregunta id="tamano" pregunta="¿Los colegios más grandes registran más reportes?">
          <div className={panelPad}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={h3}>Número de alumnos y tasa de reportes</h3>
              <DataSourceBadge
                fuente="SíseVe / ESCALE"
                anio={`rep. ${t} · alum. ${meta.fuentes.matricula?.anio ?? "—"}`}
              />
            </div>
            <p className={entradilla}>
              Cada punto representa un colegio. Comparamos su número de alumnos con la cantidad de
              reportes registrados por cada 1.000 estudiantes durante {t}.
            </p>

            {cross.length > 0 ? (
              <>
                <div className="mt-6">
                  <ScatterPanel
                    anio={t}
                    anioPadron={meta.fuentes.matricula?.anio ?? "—"}
                    matriculaMinima={meta.matricula_minima}
                  />
                </div>
                <FichaTecnica
                  n={`${nf(cross.length)} colegios`}
                  anio={t}
                  variables={`reportes ${t} · alumnos ${meta.fuentes.matricula?.anio}`}
                  cobertura="Lima Metropolitana"
                />
                <div className="mt-4 space-y-3">
                  <MethodologyNote tono="aviso">
                    Datos {t}. Es el único año con censo de alumnos publicado, así que es
                    el único donde reportes y denominador son del mismo año. No es el año
                    principal del observatorio —ese es el último año completo—, sino el
                    único donde esta comparación es legítima.
                  </MethodologyNote>
                  <MethodologyNote tono="aviso">
                    Solo entran colegios con al menos {nf(meta.matricula_minima)}{" "}
                    estudiantes. Por debajo, un único reporte dispara la tasa decenas de
                    puntos y el número deja de significar algo.
                  </MethodologyNote>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-rule px-5 py-10 text-center">
                <p className="text-[0.92rem] font-medium text-ink">Falta el denominador</p>
                <p className="mx-auto mt-2 max-w-prose text-[0.86rem] leading-relaxed text-ink-3">
                  Esta visualización necesita el número de alumnos por colegio, que se está
                  descargando del padrón de ESCALE.
                </p>
              </div>
            )}
          </div>
        </Pregunta>

        {/* ── ¿Y con la pensión? ─────────────────────────────── */}
        <Pregunta id="pension" pregunta="¿Y con la pensión?">
          <div className={panelPad}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={h3}>Pensión mensual y tasa de reportes</h3>
              <DataSourceBadge fuente="Identicole" anio={conPension.length ? "2025" : null} />
            </div>
            <p className={entradilla}>
              Solo colegios privados: los públicos no cobran pensión.
            </p>

            {conPension.length >= 30 ? (
              <>
                <div className="mt-6">
                  <ScatterXY
                    data={conPension}
                    xKey="pension"
                    xLabel="PENSIÓN MENSUAL EN SOLES (ESCALA LOGARÍTMICA)"
                  />
                </div>
                <FichaTecnica
                  n={`${nf(conPension.length)} colegios privados`}
                  anio={`Reportes ${t} · Pensión 2025`}
                  variables="Pensión · # alumnos · reportes"
                  cobertura={`${nf(conPension.length)} de ${nf(privadosDelCorte)} privados`}
                />
                <div className="mt-4 space-y-3">
                  <MethodologyNote tono="aviso">
                    La pensión es{" "}
                    <strong className="font-semibold text-ink">declarativa</strong>: la
                    informa cada colegio al Ministerio y no está auditada. Además es de 2025
                    y los reportes son de {t}.
                  </MethodologyNote>
                  <MethodologyNote>
                    Aunque se observe una asociación, no significa que el precio cause o
                    evite la violencia. La pensión va junto con el tamaño del colegio, el
                    distrito, la composición socioeconómica de las familias y su capacidad
                    de escalar un caso hasta que quede registrado.
                  </MethodologyNote>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-rule px-5 py-10 text-center">
                <p className="text-[0.92rem] font-medium text-ink">Integración en curso</p>
                <p className="mx-auto mt-2 max-w-prose text-[0.86rem] leading-relaxed text-ink-3">
                  Las pensiones se leen de la ficha pública de Identicole, colegio por
                  colegio. Llevamos {nf(conPension.length)} de {nf(privadosDelCorte)}{" "}
                  privados del corte de {t}. El gráfico aparece cuando la cobertura alcanza
                  para que signifique algo.
                </p>
              </div>
            )}
          </div>
        </Pregunta>

        {/* ── Salidas ────────────────────────────────────────── */}
        <section className="border-t border-rule pt-9 sm:pt-11">
          <h2 className={h3}>Sigue explorando</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Link href="/colegios" className={panelEnlace}>
              <p className="font-display text-[1.05rem] font-medium">Busca un colegio</p>
              <p className="mt-1.5 text-[0.86rem] leading-relaxed text-ink-2">
                Filtra por región, distrito, gestión o nivel y abre su ficha.
              </p>
            </Link>
            <Link href="/metodologia" className={panelEnlace}>
              <p className="font-display text-[1.05rem] font-medium">Cómo se hizo esto</p>
              <p className="mt-1.5 text-[0.86rem] leading-relaxed text-ink-2">
                Las fuentes, los años, los límites y lo que decidimos no publicar.
              </p>
            </Link>
          </div>
        </section>
      </div>

      <p className="mt-12 max-w-prose text-[0.82rem] leading-relaxed text-ink-3">
        Todos los números de esta página son agregados. Este sitio no publica ni expone
        información individual de estudiantes.
      </p>
    </div>
  );
}
