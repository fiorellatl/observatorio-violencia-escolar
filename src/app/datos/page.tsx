import type { Metadata } from "next";
import { og } from "@/lib/og";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ReportTrend } from "@/components/ReportTrend";
import { ScatterXY } from "@/components/ScatterXY";
import { CategoryBars, type SerieDef } from "@/components/CategoryBars";
import { TerritorioRanking } from "@/components/TerritorioRanking";
import { MapaLima } from "@/components/MapaLima";
import { CorrelacionActores } from "@/components/CorrelacionActores";
import { BarrasAgrupadas, PiezaNoche, ParesHorizontales } from "@/components/PiezaNoche";
import { distritosLima, pensiones, silencioPorTamano } from "@/lib/hallazgos";
import { DistritosLima } from "@/components/DistritosLima";
import { CompartirSilencio } from "@/components/CompartirSilencio";
import { CompartirPension } from "@/components/CompartirPension";

import {
  getAllInstitutions,
  getCross,
  getMeta,
  getNational,
  getTerritorio,
  getLimaMapa,
  getCorrelacion,
  getAnioPrincipal,
} from "@/lib/data/provider";
import { nf } from "@/lib/format";
import { COLOR_ACTOR, COLOR_VIOLENCIA, color } from "@/lib/viz/colors";
import { entradilla, meta as clsMeta, panelPad, panelEnlace, h3 } from "@/lib/ui";

/**
 * Por debajo de esta cobertura la pensión no se resume por tramos: la
 * descarga de Identicole llegó a estar sesgada hacia los colegios que
 * reportan (323 de 324 tenían reportes en 2026), y un tramo construido sobre
 * esa lista describe la lista, no Lima.
 */
const COBERTURA_PENSION_MINIMA = 80;

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
  ...og({ title: "Explora los datos", description: "Qué registra SíseVe en el Perú: cuántos reportes hay, cómo han cambiado por año, qué tipos de violencia aparecen y cómo se relacionan con el tamaño del colegio.", url: "/datos" }),
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
  { id: "distritos", texto: "¿Qué distrito de Lima registra más?" },
  { id: "tamano", texto: "¿Los colegios más grandes registran más reportes?" },
  { id: "correlacion", texto: "¿Van juntos los dos tipos?" },
  { id: "pension", texto: "¿Y con la pensión?" },
];

export default function DatosPage() {
  const meta = getMeta();
  const nacional = getNational();
  const cross = getCross();
  const territorio = getTerritorio();
  const limaMapa = getLimaMapa();
  const correlacion = getCorrelacion();

  const serie = nacional.map((n) => ({
    anio: n.anio,
    total: n.total,
    pandemia: n.pandemia,
    parcial: n.anio === meta.anio_parcial,
  }));

  const conPension = cross.filter((c) => (c.pension ?? 0) > 0);

  /*
   * De dónde sale realmente esta sección.
   *
   * Identicole se consultó colegio por colegio y esa consulta solo cubrió
   * Lima: el resto del país no tiene una sola ficha. Presentar el gráfico sin
   * decirlo lo convertiría en un hallazgo nacional construido sobre una
   * fracción de una región. El alcance se calcula aquí a partir de los datos
   * —no se escribe a mano— para que deje de ser cierto el día que la
   * cobertura cambie.
   */
  let conMatricula = 0;
  let totalInstituciones = 0;
  const conPensionSlugs = new Set(conPension.map((c) => c.slug));
  const regionesPension = new Set<string>();
  let privadosTotal = 0;
  for (const i of Object.values(getAllInstitutions())) {
    totalInstituciones++;
    if (i.matricula != null) conMatricula++;
    for (const sv of i.servicios) {
      if (i.gestion?.startsWith("Priv")) privadosTotal++;
      if (conPensionSlugs.has(sv.slug)) regionesPension.add(i.departamento);
    }
  }
  const ambitoPension =
    regionesPension.size === 1 ? [...regionesPension][0] : `${regionesPension.size} regiones`;
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
  const silencio = silencioPorTamano(t);
  const grandes = silencio.tramos[silencio.tramos.length - 1];
  // Espacio duro: en un teléfono «68 %» se partía en dos líneas.
  const pct = (v: number) => `${Math.round(v)} %`;
  const pen = pensiones(t);
  const dec1 = (v: number) => v.toFixed(1).replace(".", ",");
  // Los tres años con reportes y denominador: 2024 (censo), el último
  // completo y el año en curso. Se calcula aquí; el filtro solo elige.
  const aniosDistritos = [...new Set([t, getAnioPrincipal(), meta.anio_parcial])].sort();
  const distritos = distritosLima(aniosDistritos);

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
        <Pregunta id="correlacion" pregunta="¿Van juntos los dos tipos de violencia?">
          <div className={panelPad}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={h3}>Entre alumnos y de un adulto, colegio por colegio</h3>
              <DataSourceBadge fuente="SíseVe" anio={correlacion.anios.join("–")} />
            </div>
            <p className={entradilla}>
              Si un colegio registra mucha violencia entre alumnos, ¿registra también más
              violencia ejercida por un adulto del colegio?
            </p>

            <div className="mt-6">
              <CorrelacionActores datos={correlacion} />
            </div>

            <FichaTecnica
              n={`${nf(correlacion.datos[correlacion.anios[correlacion.anios.length - 2]].colegios)} colegios`}
              anio={correlacion.anios.join("–")}
              variables="Reportes entre alumnos · de un adulto"
              cobertura="Colegios con al menos un reporte en el año"
            />

            <div className="mt-4 max-w-prose">
              <MethodologyNote>
                Cada reporte se clasifica en una de las dos categorías, así que un colegio puede
                registrar mucho de una y nada de la otra. Tres de cada cuatro registran solo un
                tipo, y eso —no un error de medición— es lo que mantiene la correlación cerca de
                cero.
              </MethodologyNote>
            </div>
          </div>
        </Pregunta>

        <Pregunta id="donde" pregunta="¿Dónde se registra más?">
          <div className={panelPad}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={h3}>Reportes por cada 1.000 alumnos</h3>
              <DataSourceBadge
                fuente="SíseVe / Censo"
                anio={`rep. ${territorio.anio} · alum. ${meta.fuentes.matricula?.anio ?? "—"}`}
              />
            </div>
            <p className={entradilla}>
              Esta sección decía que faltaba un denominador. Ya no falta: el Censo Educativo
              cubre {nf(conMatricula)} de {nf(totalInstituciones)} instituciones, y con eso se
              puede dividir por territorio sin que el mapa muestre dónde vive más gente.
            </p>

            <div className="mt-6">
              <TerritorioRanking
                regiones={territorio.regiones}
                ugeles={territorio.ugeles}
                anio={territorio.anio}
                minimoReportes={territorio.cobertura.reportes_minimos}
              />
            </div>

            <FichaTecnica
              n={`${nf(territorio.regiones.length)} regiones · ${nf(territorio.ugeles.length)} UGEL`}
              anio={territorio.anio}
              variables="Reportes · # alumnos"
              cobertura={`${nf(territorio.cobertura.ugeles_con_tasa)} UGEL con denominador suficiente`}
            />

            {/* El mapa va DESPUÉS de las barras, no en su lugar: cubre una
                región de las veinticinco y sirve para ver la forma urbana de
                un dato que ya se comparó en la lista. */}
            <div className="mt-10 border-t border-rule-2 pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-display text-[1.1rem] font-medium text-ink">
                  Lima Metropolitana, por UGEL
                </h4>
                <DataSourceBadge fuente="SíseVe / Censo · DRELM" anio={limaMapa.anio} />
              </div>
              <p className="mt-2 max-w-prose text-[0.86rem] leading-relaxed text-ink-2">
                Los distritos de una misma UGEL van del mismo color porque comparten el mismo
                número: SíseVe no publica nada por debajo de la UGEL. Son siete datos, no
                cuarenta y dos.
              </p>
              <div className="mt-6">
                <MapaLima datos={limaMapa} />
              </div>
            </div>

            <div className="mt-6 max-w-prose">
              <MethodologyNote tono="aviso">
                Registrar más no es sufrir más. Una tasa alta describe un sistema de reporte
                que funciona —confianza en el canal, personal que registra, protocolo
                aplicado—, no un territorio más violento. La diferencia entre el primero y el
                último de esta lista dice mucho más sobre quién denuncia que sobre dónde
                ocurre.
              </MethodologyNote>
            </div>
          </div>
        </Pregunta>

        {/* ── ¿Qué distrito de Lima registra más? ─────────────────
            La misma pregunta de las piezas de redes, con su respuesta y un
            filtro de año. Cada gráfico se descarga como historia. */}
        <Pregunta id="distritos" pregunta="¿Qué distrito de Lima registra más?">
          <DistritosLima
            datos={distritos}
            anioInicial={getAnioPrincipal()}
            anioParcial={meta.anio_parcial}
          />
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
                  // Decía «Lima Metropolitana», pero el corte trae colegios de
                  // todo el país; Lima es menos de un tercio.
                  cobertura={`${silencio.regiones} regiones`}
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

          {/* El hallazgo del tamaño no está en la tasa sino en el silencio. */}
          {silencio.tramos.every((x) => x.colegios > 0) ? (
            <div className="mt-6">
              <PiezaNoche
                antetitulo={`Tamaño del colegio · ${silencio.regiones} regiones · ${t}`}
                titulo={
                  <>
                    <span className="text-menta">1 de cada {Math.round(100 / grandes.sinReportes)}</span>{" "}
                    colegios grandes no registró nada
                  </>
                }
                respuesta={
                  <>
                    Ni un reporte en todo {t} en {pct(grandes.sinReportes)} de los colegios con{" "}
                    {grandes.etiqueta} alumnos. Si registraran al ritmo del resto, serían apenas el{" "}
                    <span className="text-noche-ink">{pct(grandes.esperado)}</span>.
                  </>
                }
                nota={
                  <>
                    Por alumno, colegios chicos y grandes registran casi lo mismo (entre{" "}
                    {Math.min(...silencio.tramos.map((x) => x.tasa)).toFixed(1).replace(".", ",")} y{" "}
                    {Math.max(...silencio.tramos.map((x) => x.tasa)).toFixed(1).replace(".", ",")} por
                    cada 1.000). «Esperable»: la parte de colegios que quedaría en cero solo por azar si
                    cada uno registrara al ritmo promedio de su tamaño. Que no haya reportes no significa
                    que no haya violencia. {nf(silencio.tramos.reduce((a, x) => a + x.colegios, 0))}{" "}
                    colegios con al menos {nf(meta.matricula_minima)} alumnos · reportes y alumnos {t}.
                  </>
                }
              >
                <BarrasAgrupadas
                  series={[
                    { nombre: "Sin ningún reporte", clase: "bg-menta" },
                    { nombre: "Lo esperable por azar", clase: "", referencia: true },
                  ]}
                  grupos={silencio.tramos.map((x) => ({
                    etiqueta: x.etiqueta,
                    detalle: `${nf(x.colegios)} colegios`,
                    valores: [x.sinReportes, x.esperado],
                  }))}
                  maximo={100}
                  formato={pct}
                  pie="Alumnos por colegio"
                />
                <div className="mt-6">
                  <CompartirSilencio anio={t} regiones={silencio.regiones} tramos={silencio.tramos} />
                </div>
              </PiezaNoche>
            </div>
          ) : null}
        </Pregunta>

        {/* ── ¿Y con la pensión? ─────────────────────────────── */}
        <Pregunta id="pension" pregunta="¿Y con la pensión?">
          <div className={panelPad}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className={h3}>Pensiones publicadas en Identicole</h3>
              <DataSourceBadge fuente="Identicole" anio={conPension.length ? "2025" : null} />
            </div>
            <p className={entradilla}>
              {ambitoPension} · colegios privados con ficha en Identicole:{" "}
              <strong className="font-semibold text-ink">{nf(conPension.length)}</strong> de{" "}
              {nf(privadosTotal)} privados del país. Los públicos no cobran pensión y quedan
              fuera por definición.
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
                  {pen.cobertura < COBERTURA_PENSION_MINIMA ? (
                    <MethodologyNote tono="aviso">
                      Hoy conocemos la pensión de {nf(pen.conPension)} de {nf(pen.privadosLima)}{" "}
                      colegios privados de Lima ({Math.round(pen.cobertura)} %), y esa lista no se
                      eligió al azar: casi todos registraron reportes. Por eso no resumimos la
                      pensión por tramos hasta completar la descarga.
                    </MethodologyNote>
                  ) : null}
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

          {pen.cobertura >= COBERTURA_PENSION_MINIMA ? (
            <div className="mt-6 space-y-6">
              <PiezaNoche
                antetitulo={`Pensiones y reportes · Lima · ${t}`}
                titulo={
                  <>
                    ¿Los colegios más caros registran más{" "}
                    <span className="text-menta">reportes de violencia</span>?
                  </>
                }
                respuesta={
                  <>
                    {dec1(pen.tramos[3].tasa)} reportes por cada 1.000 alumnos en el tramo de
                    pensión más alta, {dec1(pen.tramos[0].tasa)} en el más bajo. Los públicos de los
                    mismos distritos: {dec1(pen.publicos.tasa)}.
                  </>
                }
                nota={
                  <>
                    {nf(pen.conPension)} de {nf(pen.privadosLima)} colegios privados de Lima con al menos{" "}
                    {nf(meta.matricula_minima)} alumnos, en cuatro tramos con el mismo número de colegios.
                    La pensión es la más reciente que declara cada colegio en Identicole: cambia poco de
                    un año a otro y se usa como referencia. Más reportes no prueba más violencia; la
                    pensión va junto con el distrito y las familias.
                  </>
                }
              >
                <BarrasAgrupadas
                  series={[{ nombre: "Reportes por cada 1.000 alumnos", clase: "bg-menta" }]}
                  grupos={pen.tramos.map((x) => ({
                    etiqueta: x.etiqueta,
                    detalle: `${nf(x.reportes)} rep. · ${nf(x.alumnos)} alum.`,
                    valores: [x.tasa],
                  }))}
                  maximo={Math.max(...pen.tramos.map((x) => x.tasa))}
                  formato={dec1}
                  pie="Pensión mensual"
                />
                <div className="mt-6">
                  <CompartirPension anio={t} datos={pen} pieza="tramos" />
                </div>
              </PiezaNoche>

              <PiezaNoche
                antetitulo={`Pensiones y reportes · Lima · ${t}`}
                titulo={
                  <>
                    ¿Qué se reporta en los colegios de <span className="text-menta">pensión más alta</span>?
                  </>
                }
                respuesta="Lo que más cambia es quién ejerce la violencia reportada: más entre estudiantes, menos de adultos del colegio."
                nota={
                  <>
                    {pen.alto.colegios} colegios con pensión de S/ 1.500 o más ({nf(pen.alto.reportes)}{" "}
                    reportes) frente a {pen.bajo.colegios} con menos de S/ 1.000 ({nf(pen.bajo.reportes)}{" "}
                    reportes). En gris claro, las diferencias que no superan una prueba de proporciones:
                    pueden ser azar. Un reporte puede tener más de un tipo.
                  </>
                }
              >
                <ParesHorizontales
                  series={[
                    { nombre: "Menos de S/ 1.000", clase: "bg-noche-ink-4" },
                    { nombre: "S/ 1.500 o más", clase: "bg-menta" },
                  ]}
                  bloques={[
                    { titulo: "Quién la ejerce", filas: pen.composicion.slice(0, 2).map((c) => ({ nombre: c.nombre, a: c.bajo, b: c.alto, claro: c.claro })) },
                    { titulo: "Qué tipo", filas: pen.composicion.slice(2).map((c) => ({ nombre: c.nombre, a: c.bajo, b: c.alto, claro: c.claro })) },
                  ]}
                  formato={pct}
                />
                <div className="mt-6">
                  <CompartirPension anio={t} datos={pen} pieza="composicion" />
                </div>
              </PiezaNoche>
            </div>
          ) : null}
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
