import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SchoolExplorer } from "@/components/SchoolExplorer";
import { getMeta } from "@/lib/data/provider";
import { nf } from "@/lib/format";

export const metadata: Metadata = {
  title: "Explora colegios",
  description:
    "Busca y filtra las instituciones educativas del Perú con reportes registrados en SíseVe, por región, provincia, distrito, gestión y nivel.",
  alternates: { canonical: "/colegios" },
};

export default function ColegiosPage() {
  const meta = getMeta();

  return (
    <div className="mx-auto max-w-shell px-5 py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Colegios" }]} />

      <h1 className="mt-6 max-w-[20ch] font-display text-display-xl font-medium text-balance">
        Explora colegios
      </h1>
      <p className="mt-5 max-w-prose text-[1.02rem] leading-relaxed text-ink-2">
        Hay {nf(meta.colegios)} servicios educativos con al menos un reporte registrado en
        SíseVe entre {meta.anio_min} y {meta.anio_max}. Filtra por dónde queda, por gestión
        o por nivel, o escribe el nombre.
      </p>

      <div className="mt-8">
        {/* `useSearchParams` obliga a un límite de Suspense: sin él, toda la
            página pasaría a renderizarse en cliente y perdería el prerenderizado. */}
        <Suspense
          fallback={
            <div className="h-40 animate-pulse rounded-xl border border-rule bg-surface" />
          }
        >
          <SchoolExplorer />
        </Suspense>
      </div>

      <div className="mt-8 max-w-prose">
        <MethodologyNote>
          Un mismo colegio puede aparecer varias veces: el Estado asigna un código modular a
          cada nivel, así que la primaria y la secundaria son registros distintos. Si un
          colegio no aparece, puede ser que no tenga ningún reporte registrado. Eso no
          significa que no ocurra violencia: significa que nadie la reportó en SíseVe.
        </MethodologyNote>
      </div>
    </div>
  );
}
