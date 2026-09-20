import type { Metadata } from "next";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { Proximamente } from "@/components/DataState";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ReportTrend } from "@/components/ReportTrend";
import { ScatterXY } from "@/components/ScatterXY";
import { ViolenceBreakdown } from "@/components/ViolenceBreakdown";
import { getCross, getMeta, getNational } from "@/lib/data/provider";
import { nf } from "@/lib/format";
import { bajada, etiqueta, tarjeta, tarjetaEnlace, tituloSeccion } from "@/lib/ui";

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
          <dt className={etiqueta}>{k}</dt>
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
  { id: "tamano", texto: "¿Cambia con el tamaño del colegio?" },
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
  const delAnio = nacional.find((n) => n.anio === t);
  const tipos = delAnio
    ? [
        { label: "Psicológica", value: delAnio.psicologica ?? 0, color: "var(--data-1)" },
        { label: "Física", value: delAnio.fisica ?? 0, color: "var(--data-2)" },
        { label: "Sexual", value: delAnio.sexual ?? 0, color: "var(--data-3)" },
      ]
    : [];
  const actores = delAnio
    ? [
        { label: "Entre estudiantes", value: delAnio.entre_escolares ?? 0, color: "var(--data-1)" },
        { label: "De un adulto del colegio", value: delAnio.personal_ie ?? 0, color: "var(--data-2)" },
      ]
    : [];

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
              <div key={c.k} className={tarjeta}>
                <dt className={etiqueta}>{c.k}</dt>
                <dd className="tabular mt-2 font-display text-stat font-medium">{c.v}</dd>
                <p className="mt-1.5 text-[0.8rem] text-ink-3">{c.d}</p>
              </div>
            ))}
          </dl>
          <div className="mt-5 max-w-prose">
            <MethodologyNote>
              Un reporte es una alerta registrada en SíseVe, no un caso confirmado ni una
              víctima. Puede haber más de un reporte sobre un mismo hecho, y muchos hechos
              no llegan nunca al sistema.
            </MethodologyNote>
          </div>
        </Pregunta>

        {/* ── ¿Cómo ha cambiado? ─────────────────────────────── */}
        <Pregunta id="como-cambio" pregunta="¿Cómo ha cambiado?">
          <div className={tarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={tituloSeccion}>Reportes registrados por año</h3>
              <DataSourceBadge fuente="SíseVe" anio={`${meta.anio_min}–${meta.anio_max}`} />
            </div>
            <p className={bajada}>Todos los reportes del país según su año de registro.</p>

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
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={tarjeta}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className={tituloSeccion}>Tipo de violencia</h3>
                <DataSourceBadge fuente="SíseVe" anio={t} />
              </div>
              <p className={bajada}>
                Composición de los {nf(delAnio?.total ?? 0)} reportes de {t}.
              </p>
              <div className="mt-5">
                <ViolenceBreakdown items={tipos} total={delAnio?.total ?? 0} />
              </div>
            </div>

            <div className={tarjeta}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className={tituloSeccion}>Quién ejerce</h3>
                <DataSourceBadge fuente="SíseVe" anio={t} />
              </div>
              <p className={bajada}>
                Entre estudiantes o desde un adulto de la institución.
              </p>
              <div className="mt-5">
                <ViolenceBreakdown items={actores} total={delAnio?.total ?? 0} />
              </div>
            </div>
          </div>
          <div className="mt-5 max-w-prose">
            <MethodologyNote>
              Un mismo reporte puede clasificarse en más de un tipo, así que los
              porcentajes no suman 100.
            </MethodologyNote>
          </div>
        </Pregunta>

        {/* ── ¿Dónde se concentra? ───────────────────────────── */}
        <Pregunta id="donde" pregunta="¿Dónde se concentra?">
          <Proximamente titulo="La distribución territorial necesita un denominador">
            Podríamos sumar los reportes de cada región hoy mismo, pero ese mapa mostraría
            sobre todo dónde vive más gente: Lima tiene más reportes que Madre de Dios
            porque tiene muchísimos más estudiantes. Para decir algo sobre el territorio
            hace falta la matrícula de cada región, que se está descargando del padrón de
            ESCALE. Hasta entonces preferimos el hueco antes que un mapa que se lea al
            revés.
          </Proximamente>
        </Pregunta>

        {/* ── ¿Cambia con el tamaño? ─────────────────────────── */}
        <Pregunta id="tamano" pregunta="¿Cambia con el tamaño del colegio?">
          <div className={tarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={tituloSeccion}>Matrícula y tasa de reportes</h3>
              <DataSourceBadge fuente="SíseVe / ESCALE" anio={t} />
            </div>
            <p className={bajada}>
              Cada punto es un colegio: estudiantes matriculados en el eje horizontal,
              reportes por cada 1.000 estudiantes en el vertical.
            </p>

            {cross.length > 0 ? (
              <>
                <div className="mt-6">
                  <ScatterPanel anio={t} matriculaMinima={meta.matricula_minima} />
                </div>
                <FichaTecnica
                  n={`${nf(cross.length)} colegios`}
                  anio={t}
                  variables="Matrícula, reportes"
                  cobertura="Lima Metropolitana"
                />
                <div className="mt-4 space-y-3">
                  <MethodologyNote tono="aviso">
                    La matrícula solo está descargada para Lima Metropolitana, así que este
                    gráfico describe Lima y no el Perú.
                  </MethodologyNote>
                  <MethodologyNote>
                    Los colegios sin ningún reporte en {t} aparecen sobre la línea del cero
                    y están incluidos por defecto: son la situación más común y esconderlos
                    haría parecer que todo colegio registra algo.
                  </MethodologyNote>
                  <MethodologyNote tono="aviso">
                    Solo entran colegios con al menos {nf(meta.matricula_minima)}{" "}
                    estudiantes. Por debajo, un único reporte dispara la tasa decenas de
                    puntos y el número deja de significar algo.
                  </MethodologyNote>
                  <MethodologyNote>
                    Una asociación entre dos variables no significa que una cause la otra.
                    El tamaño, la ubicación, la gestión y la disposición a denunciar están
                    relacionados entre sí y con el número de reportes.
                  </MethodologyNote>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-rule px-5 py-10 text-center">
                <p className="text-[0.92rem] font-medium text-ink">Falta el denominador</p>
                <p className="mx-auto mt-2 max-w-prose text-[0.86rem] leading-relaxed text-ink-3">
                  Esta visualización necesita la matrícula por colegio, que se está
                  descargando del padrón de ESCALE.
                </p>
              </div>
            )}
          </div>
        </Pregunta>

        {/* ── ¿Y con la pensión? ─────────────────────────────── */}
        <Pregunta id="pension" pregunta="¿Y con la pensión?">
          <div className={tarjeta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={tituloSeccion}>Pensión mensual y tasa de reportes</h3>
              <DataSourceBadge fuente="Identicole" anio={conPension.length ? "2025" : null} />
            </div>
            <p className={bajada}>
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
                  variables="Pensión, matrícula, reportes"
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
          <h2 className={tituloSeccion}>Sigue explorando</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Link href="/colegios" className={tarjetaEnlace}>
              <p className="font-display text-[1.05rem] font-medium">Busca un colegio</p>
              <p className="mt-1.5 text-[0.86rem] leading-relaxed text-ink-2">
                Filtra por región, distrito, gestión o nivel y abre su ficha.
              </p>
            </Link>
            <Link href="/metodologia" className={tarjetaEnlace}>
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
