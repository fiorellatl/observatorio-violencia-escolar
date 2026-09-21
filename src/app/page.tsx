import type { Metadata } from "next";
import Link from "next/link";
import { ReportTrend } from "@/components/ReportTrend";
import { SearchBox } from "@/components/SearchBox";
import { getInstitutionCount, getMeta, getNational } from "@/lib/data/provider";
import { fechaLegible, nf } from "@/lib/format";
import { h2, shell } from "@/lib/ui";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  const meta = getMeta();
  const nacional = getNational();
  // La unidad pública es la institución, no el servicio educativo: la portada
  // tiene que contar lo mismo que cuentan el buscador y el ranking.
  const colegios = getInstitutionCount();

  const comparables = nacional.filter((n) => !n.pandemia && n.anio !== meta.anio_parcial);
  const ultimo = comparables[comparables.length - 1];

  const serie = nacional.map((n) => ({
    anio: n.anio,
    total: n.total,
    pandemia: n.pandemia,
    parcial: n.anio === meta.anio_parcial,
  }));

  /** Solo métricas que ya existen. Ninguna cifra decorativa. */
  const cifras = [
    {
      valor: nf(ultimo?.total ?? 0),
      titulo: "reportes registrados",
      detalle: `en ${ultimo?.anio}, el último año completo`,
      fuente: "SíseVe",
      anio: ultimo?.anio,
    },
    {
      valor: nf(colegios),
      titulo: "colegios con al menos un reporte",
      detalle: `entre ${meta.anio_min} y ${meta.anio_max}`,
      fuente: "SíseVe",
      anio: `${meta.anio_min}–${meta.anio_max}`,
    },
    {
      valor: nf(meta.reportes),
      titulo: "reportes en todo el histórico",
      detalle: `desde ${meta.anio_min}`,
      fuente: "SíseVe",
      anio: `${meta.anio_min}–${meta.anio_max}`,
    },
  ];

  return (
    <>
      {/* ══ PORTADA, SOBRE LA NOCHE ═══════════════════════
          La pregunta ocupa la pantalla entera y el buscador va inmediatamente
          debajo: entrar aquí es buscar un colegio.
          Las tres cifras cierran el bloque como una franja divida por filetes,
          sin tarjetas. */}
      <section className="border-b border-rule">
        <div className={`${shell} pb-14 pt-16 sm:pb-16 sm:pt-24`}>
          <p className="meta surgir">
            Datos públicos SíseVe · {meta.anio_min}–{meta.anio_max}
          </p>

          <h1 className="titular surgir mt-6 max-w-[12ch] text-display-xxl text-ink">
            ¿Qué sabemos de cada colegio
            <span className="text-accent">?</span>
          </h1>

          <p className="surgir mt-8 max-w-[52ch] text-[1.08rem] leading-relaxed text-ink-2">
            {nf(meta.reportes)} reportes registrados en {nf(colegios)} colegios. Un
            reporte es una alerta registrada en SíseVe, no un caso confirmado.
          </p>

          <div className="surgir mt-12">
            <SearchBox
                placeholder="nombre del colegio, distrito o código modular"
            />
          </div>
        </div>

        {/* Tres cifras, sin tarjetas: las separan filetes. */}
        <dl className={`${shell} grid border-t border-rule sm:grid-cols-3`}>
          {cifras.map((c, i) => (
            <div
              key={c.titulo}
              className={`border-rule px-1 py-8 sm:px-7 sm:py-9 ${
                i < 2 ? "border-b sm:border-b-0 sm:border-r" : ""
              } ${i === 0 ? "sm:pl-0" : ""}`}
            >
              <dd className="cifra text-[clamp(2.6rem,5.5vw,3.6rem)] text-ink">
                {c.valor}
              </dd>
              <dt className="mt-3 text-[0.95rem] text-ink-2">{c.titulo}</dt>
              <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">
                {c.detalle}
              </p>
            </div>
          ))}
        </dl>

        {/* Las dos puertas de entrada, a sangre. */}
        <div className="grid border-t border-rule sm:grid-cols-2">
          {[
            {
              n: "01",
              href: "/colegios",
              t: "Quiero buscar un colegio",
              d: "Ficha completa: reportes, número de alumnos, evolución y contexto.",
            },
            {
              n: "02",
              href: "/datos",
              t: "Quiero explorar los datos",
              d: "Qué se registra, cómo ha cambiado y qué no puede leerse ahí.",
            },
          ].map((x, i) => (
            <Link
              key={x.href}
              href={x.href}
              className={`group flex flex-col gap-3 px-5 py-10 transition-colors duration-150 ease-suave hover:bg-accent-soft/50 sm:px-10 sm:py-14 ${
                i === 0 ? "border-b border-rule sm:border-b-0 sm:border-r" : ""
              }`}
            >
              <span className="meta">{x.n}</span>
              <span className="text-[clamp(1.5rem,3vw,2.15rem)] font-bold leading-tight tracking-[-0.04em] text-ink">
                {x.t}
              </span>
              <span className="max-w-[38ch] text-[0.92rem] leading-relaxed text-ink-3">
                {x.d}
              </span>
              <span
                aria-hidden
                className="mt-1 text-accent transition-transform duration-150 ease-suave group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Qué es un reporte ───────────────────────────────────── */}
      <section className="border-t border-rule bg-surface">
        <div className={`${shell} py-14 sm:py-20`}>
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="meta">Antes de mirar cualquier cifra</p>
              <h2 className="mt-4 max-w-[16ch] font-display text-display-l font-medium text-balance">
                Un reporte no es un caso probado
              </h2>
            </div>

            <div className="space-y-5 text-cuerpo leading-relaxed text-ink-2 lg:col-span-7 lg:col-start-6">
              <p>
                SíseVe es el portal del Ministerio de Educación donde cualquier persona
                —un estudiante, su familia, un docente— puede registrar un hecho de
                violencia escolar. Funciona desde 2013.
              </p>
              <p>
                Lo que se registra son alertas. El propio Ministerio advierte que puede
                existir más de un reporte sobre un mismo hecho, y que un reporte no
                equivale a un caso confirmado ni a una víctima única.
              </p>
              <p>
                Un colegio con muchos reportes puede ser, simplemente, un colegio donde
                denunciar funciona. Por eso aquí no hay rankings de colegios
                «peligrosos» ni «seguros».
              </p>
              <p>
                Pero nos da una luz de cómo se está gestionando el bullying y la
                violencia —física, psicológica, sexual— dentro de las instituciones
                educativas de nuestro país.
              </p>
              <p>
                Si bien son alertas, pasar por un proceso de denuncia no solo suele ser
                un proceso burocrático engorroso, sino que revictimiza y tiene barreras:
                de acceso, de jerarquía, de información. Por eso esta data podría y debe
                ser solo la punta del iceberg de un problema sistematizado y profundo.
              </p>
              <p className="border-l-2 border-accent pl-5 text-ink">
                Basta con ver un par de cifras para detenernos. ¿Podemos ver patrones?
                ¿Nos pueden dar herramientas de prevención? ¿Los colegios de zonas
                rurales son menos violentos o son lugares en donde denunciar no funciona?
              </p>
              <p>
                Este portal busca transparentar esa información pero, sobre todo, busca
                que nos hagamos más de esas preguntas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── El gráfico, como pieza principal ───────────────
          Catorce años de registro en una sola figura. Va sobre papel y a
          tamaño grande: es el resumen que la portada promete, y una cifra
          suelta no cuenta lo que cuenta la forma de la serie. */}
      <section className="border-t border-rule">
        <div className={`${shell} py-14 sm:py-20`}>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <h2 className="max-w-[18ch] font-display text-display-l font-bold text-balance">
              Catorce años de reportes registrados
            </h2>
            <p className="font-mono text-[0.66rem] uppercase leading-relaxed tracking-[0.1em] text-ink-3 sm:text-right">
              Reportes registrados por año
              <span className="block">
                Fuente SíseVe · corte {fechaLegible(meta.corte)}
              </span>
            </p>
          </div>

          <div className="mt-10">
            <ReportTrend data={serie} alto={420} />
          </div>

          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t border-rule pt-6">
            <p className="max-w-[40ch] text-[0.85rem] leading-relaxed text-ink-2">
              <span className="meta block">{meta.anios_pandemia.join("–")}</span>
              Escuelas cerradas: el canal de registro casi desaparece. No se compara con
              un año normal.
            </p>
            <p className="max-w-[40ch] text-[0.85rem] leading-relaxed text-ink-2">
              <span className="meta block">{meta.anio_parcial}</span>
              Año en curso, con datos hasta el corte. No es comparable con un año
              completo.
            </p>
          </div>
        </div>
      </section>

    </>
  );
}
