import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MethodologyNote } from "@/components/MethodologyNote";
import { RankingExplorer } from "@/components/RankingExplorer";
import { getMeta } from "@/lib/data/provider";
import { nf } from "@/lib/format";
import { shell } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Colegios con más reportes registrados",
  description:
    "Explora qué colegios registraron más reportes en SíseVe por año, tipo de violencia, región, gestión y nivel. Ordena por número de reportes o por tasa por 1,000 estudiantes.",
  alternates: { canonical: "/rankings" },
};

export default function RankingsPage() {
  const meta = getMeta();

  return (
    <div className={`${shell} py-8 sm:py-10`}>
      <Breadcrumbs
        items={[{ label: "Inicio", href: "/" }, { label: "Colegios con más reportes" }]}
      />

      <h1 className="mt-6 max-w-[22ch] font-display text-display-xl font-medium text-balance">
        Colegios con más reportes registrados
      </h1>
      <p className="mt-5 max-w-prose text-cuerpo leading-relaxed text-ink-2">
        Es una pregunta razonable y aquí se puede responder. Lo que esta tabla{" "}
        <strong className="font-semibold text-ink">no</strong> dice es qué colegio es más
        violento: dice cuál registró más reportes, que es otra cosa.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <MethodologyNote tono="aviso">
          Los reportes registrados no equivalen necesariamente a casos únicos. SíseVe
          advierte que puede existir más de un reporte sobre un mismo caso.
        </MethodologyNote>
        <MethodologyNote>
          El número de reportes puede estar influido por el tamaño de la matrícula y por
          las prácticas de reporte de cada comunidad educativa. Un colegio donde denunciar
          funciona registrará más que uno donde nadie se atreve.
        </MethodologyNote>
      </div>

      <div className="mt-10">
        {/* `useSearchParams` necesita un límite de Suspense para que la página
            siga prerrenderizándose en vez de pasar entera a cliente. */}
        <Suspense
          fallback={<div className="h-64 animate-pulse rounded-lg border border-rule bg-surface" />}
        >
          <RankingExplorer />
        </Suspense>
      </div>

      <section className="mt-14 border-t border-rule pt-10">
        <h2 className="font-display text-display-m font-medium">Cómo leer esta tabla</h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="meta">Número de reportes</p>
            <p className="mt-2 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              Cuenta cuántos reportes se registraron. Un colegio de 2.000 estudiantes
              tendrá casi siempre más que uno de 200, así que esta ordenación mide
              también el tamaño.
            </p>
          </div>
          <div>
            <p className="meta">Tasa por 1.000 estudiantes</p>
            <p className="mt-2 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              Divide los reportes entre la matrícula. Permite comparar colegios de
              distinto tamaño, pero solo existe donde conocemos la matrícula y hay al
              menos {nf(meta.matricula_minima)} estudiantes: por debajo, un solo reporte
              mueve la tasa decenas de puntos.
            </p>
          </div>
          <div>
            <p className="meta">Por qué falta 2020 y 2021</p>
            <p className="mt-2 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              Los colegios estuvieron cerrados. Ordenar esos años por número de reportes
              mediría el acceso al canal de denuncia, no lo que la tabla dice medir.
            </p>
          </div>
          <div>
            <p className="meta">Por qué la tasa solo tiene un año</p>
            <p className="mt-2 max-w-prose text-[0.88rem] leading-relaxed text-ink-2">
              Solo disponemos de un padrón de matrícula ({meta.fuentes.matricula?.anio}).
              Usarlo como denominador de 2022 o 2025 produciría una serie de tasas que no
              corresponde a ninguna población real, así que no la calculamos.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
