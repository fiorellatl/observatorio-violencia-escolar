import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SchoolExplorer } from "@/components/SchoolExplorer";
import { getInstitutionCount, getMeta } from "@/lib/data/provider";
import { nf } from "@/lib/format";
import { shell } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Explora colegios",
  description:
    "Busca y filtra las instituciones educativas del Perú con reportes registrados en SíseVe, por región, provincia, distrito, gestión y nivel.",
  alternates: { canonical: "/colegios" },
};

export default function ColegiosPage() {
  const meta = getMeta();
  const colegios = getInstitutionCount();

  return (
    <>
      {/* ── Portada, sobre la noche ──────────────────────────────
          A sangre, no dentro de la cáscara: el bloque oscuro tiene que leerse
          como un cambio de material y no como una tarjeta grande. */}
      <section className="noche">
        <div className={`${shell} pb-14 pt-8 sm:pb-16 sm:pt-10`}>
          <Breadcrumbs
            items={[{ label: "Inicio", href: "/" }, { label: "Colegios" }]}
            tono="noche"
          />

          <p className="meta-noche mt-8">Explorador</p>
          <h1 className="titular mt-4 text-display-xl text-noche-ink">Colegios</h1>
          <p className="mt-7 max-w-[56ch] text-[1.05rem] leading-relaxed text-noche-ink-2">
            {nf(colegios)} instituciones con al menos un reporte registrado en SíseVe entre{" "}
            {meta.anio_min} y {meta.anio_max}. Busca por nombre o filtra por territorio,
            gestión y nivel.{" "}
            <strong className="font-semibold text-noche-ink">No es un ranking.</strong>
          </p>
        </div>
      </section>

      <div className={`${shell} py-10 sm:py-12`}>
        {/* `useSearchParams` obliga a un límite de Suspense: sin él, toda la
            página pasaría a renderizarse en cliente y perdería el prerenderizado. */}
        <Suspense
          fallback={
            <div className="h-40 animate-pulse rounded-xl border border-rule bg-surface" />
          }
        >
          <SchoolExplorer />
        </Suspense>

        <div className="mt-10 max-w-prose">
          <MethodologyNote>
            Cada colegio aparece una sola vez, con todos sus niveles sumados. Si un colegio
            no aparece, puede ser que no tenga ningún reporte registrado. Eso no significa
            que no ocurra violencia: significa que nadie la reportó en SíseVe.
          </MethodologyNote>
        </div>
      </div>
    </>
  );
}
