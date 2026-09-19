import type { Metadata } from "next";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { MethodologyNote } from "@/components/MethodologyNote";
import { ReportTrend } from "@/components/ReportTrend";
import { ViolenceBreakdown } from "@/components/ViolenceBreakdown";
import { ScatterSizeRate } from "@/components/ScatterSizeRate";
import { getCross, getMeta, getNational } from "@/lib/data/provider";
import { nf } from "@/lib/format";

export const metadata: Metadata = {
  title: "Explorar los datos",
  description:
    "Patrones agregados de violencia escolar en el Perú: evolución de los reportes, composición por tipo y relación con el tamaño del colegio.",
};

/** Cabecera de cada visualización: qué se mira, con qué datos y de qué año. */
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
          <dt className="font-mono uppercase tracking-wider text-ink-3">{k}</dt>
          <dd className="tabular mt-0.5 text-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

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

  const comparables = nacional.filter((n) => !n.pandemia && n.anio !== meta.anio_parcial);
  const pico = comparables.reduce((a, b) => (b.total > a.total ? b : a), comparables[0]);

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

  return (
    <div className="mx-auto max-w-shell px-5 py-12">
      <h1 className="max-w-[20ch] font-display text-display-xl font-medium text-balance">
        Explora los datos
      </h1>
      <p className="mt-5 max-w-prose text-[1.02rem] leading-relaxed text-ink-2">
        Patrones en el conjunto del sistema educativo. Cada visualización dice con
        cuántos colegios trabaja, de qué año son los datos y qué se puede y qué no se
        puede concluir de ella.
      </p>

      {/* ── 1. Evolución ──────────────────────────────────────── */}
      <section className="mt-12 rounded-xl border border-rule bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-display-m font-medium">
            Evolución de los reportes registrados
          </h2>
          <DataSourceBadge fuente="SíseVe" anio={`${meta.anio_min}–${meta.anio_max}`} />
        </div>
        <p className="mt-2 max-w-prose text-[0.9rem] text-ink-2">
          Todos los reportes del país por año de registro.
        </p>

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
            {meta.anios_pandemia.join(" y ")} aparecen huecos: los colegios estuvieron
            cerrados y la caída refleja la ausencia del canal de reporte.{" "}
            {meta.anio_parcial} va rayado porque cubre solo hasta agosto.
          </MethodologyNote>
          <MethodologyNote>
            Entre los años comparables, el máximo de reportes registrados corresponde a{" "}
            <strong className="font-semibold text-ink">{pico?.anio}</strong> con{" "}
            {nf(pico?.total ?? 0)}. Un aumento de reportes puede reflejar más denuncia,
            más violencia, o ambas: estos datos no permiten separarlas.
          </MethodologyNote>
        </div>
      </section>

      {/* ── 2. Composición ────────────────────────────────────── */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-rule bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-display-m font-medium">Tipo de violencia</h2>
            <DataSourceBadge fuente="SíseVe" anio={t} />
          </div>
          <p className="mb-5 mt-2 text-[0.9rem] text-ink-2">
            Composición de los {nf(delAnio?.total ?? 0)} reportes de {t}.
          </p>
          <ViolenceBreakdown items={tipos} total={delAnio?.total ?? 0} />
        </div>

        <div className="rounded-xl border border-rule bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-display-m font-medium">Quién ejerce</h2>
            <DataSourceBadge fuente="SíseVe" anio={t} />
          </div>
          <p className="mb-5 mt-2 text-[0.9rem] text-ink-2">
            Entre estudiantes o desde un adulto de la institución.
          </p>
          <ViolenceBreakdown items={actores} total={delAnio?.total ?? 0} />
        </div>
      </section>

      {/* ── 3. Tamaño y tasa ──────────────────────────────────── */}
      <section className="mt-6 rounded-xl border border-rule bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-display-m font-medium">
            Reportes y tamaño del colegio
          </h2>
          <DataSourceBadge fuente="SíseVe / ESCALE" anio={t} />
        </div>
        <p className="mt-2 max-w-prose text-[0.9rem] text-ink-2">
          Cada punto es un colegio: matrícula en el eje horizontal, reportes por cada
          1,000 estudiantes en el vertical.
        </p>

        {cross.length > 0 ? (
          <>
            <div className="mt-6">
              <ScatterSizeRate data={cross} />
            </div>
            <FichaTecnica
              n={`${nf(cross.length)} colegios`}
              anio={t}
              variables="Matrícula, reportes"
              cobertura="Donde hay matrícula integrada"
            />
            <div className="mt-4">
              <MethodologyNote>
                Una asociación estadística entre dos variables no significa que una
                cause la otra. El tamaño, la ubicación, la gestión y la propensión a
                denunciar están relacionados entre sí y con el número de reportes.
              </MethodologyNote>
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-rule px-5 py-10 text-center">
            <p className="text-[0.92rem] font-medium text-ink">
              Falta el denominador
            </p>
            <p className="mx-auto mt-2 max-w-prose text-[0.86rem] leading-relaxed text-ink-3">
              Esta visualización necesita la matrícula por colegio, que se está
              descargando del padrón de ESCALE. Preferimos dejar el hueco visible antes
              que mostrar conteos brutos que harían parecer más violentos a los
              colegios grandes.
            </p>
          </div>
        )}
      </section>

      {/* ── 4. Pensión ────────────────────────────────────────── */}
      <section className="mt-6 rounded-xl border border-rule bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-display-m font-medium">Reportes y pensión</h2>
          <DataSourceBadge fuente="Identicole" anio={null} />
        </div>
        <p className="mt-2 max-w-prose text-[0.9rem] text-ink-2">
          Relación entre la pensión mensual declarada y la tasa de reportes.
        </p>
        <div className="mt-6 rounded-lg border border-dashed border-rule px-5 py-10 text-center">
          <p className="text-[0.92rem] font-medium text-ink">Pendiente de integrar</p>
          <p className="mx-auto mt-2 max-w-prose text-[0.86rem] leading-relaxed text-ink-3">
            Las pensiones 2024 y 2025 están disponibles en Identicole, ficha por ficha, y
            su extracción está auditada pero no ejecutada. Solo cubren colegios privados
            y son declarativas: las informa cada colegio al Ministerio.
          </p>
        </div>
      </section>

      <p className="mt-10 max-w-prose text-[0.82rem] leading-relaxed text-ink-3">
        Todos los números de esta página son agregados. Este sitio no publica ni expone
        información individual de estudiantes.
      </p>
    </div>
  );
}
