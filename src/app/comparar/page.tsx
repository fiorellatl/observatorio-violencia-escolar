import type { Metadata } from "next";
import { og } from "@/lib/og";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MethodologyNote } from "@/components/MethodologyNote";
import { getMeta } from "@/lib/data/provider";
import { nf } from "@/lib/format";
import { entradilla, panelPad, panelEnlace, h3 } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Comparar colegios",
  description:
    "Compara hasta tres colegios por reportes registrados, matrícula, tasa por 1,000 estudiantes y contexto institucional.",
  alternates: { canonical: "/comparar" },
  ...og({ title: "Comparar colegios", description: "Compara hasta tres colegios por reportes registrados, matrícula, tasa por 1,000 estudiantes y contexto institucional.", url: "/comparar" }),
};

/**
 * La comparación todavía no existe.
 *
 * Esta página está en la navegación porque el enlace ya se ofrece desde las
 * fichas, y un enlace que lleva a un 404 es peor que un enlace que explica en
 * qué punto está la cosa. No simula una interfaz ni muestra datos de ejemplo:
 * dice qué va a hacer, qué falta y a dónde ir mientras tanto.
 */
export default function CompararPage() {
  const meta = getMeta();

  return (
    <div className="mx-auto max-w-shell px-5 py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Comparar" }]} />

      <h1 className="mt-6 max-w-[22ch] font-display text-display-xl font-medium text-balance">
        Comparar colegios
      </h1>
      <p className="mt-5 max-w-prose text-[1.02rem] leading-relaxed text-ink-2">
        Poner dos o tres colegios uno al lado del otro y ver en qué se parecen y en qué no:
        cuántos reportes registran, cuántos estudiantes tienen, qué tasa resulta de esa
        división y qué características declara cada uno.
      </p>

      <section className="mt-10 border-t border-rule pt-9">
        <div className={`${panelPad} border-dashed`}>
          <p className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-3">
            En construcción
          </p>
          <p className="mt-2 font-display text-[1.15rem] font-medium">
            La comparación está a medio camino
          </p>
          <p className={entradilla}>
            Comparar exige algo que todavía no está terminado: un denominador para cada
            colegio. Sin el número de alumnos no hay tasa, y sin tasa comparar dos colegios de tamaños
            distintos por su número de reportes diría más sobre cuántos estudiantes tienen
            que sobre cualquier otra cosa.
          </p>
          <dl className="mt-5 grid gap-4 border-t border-rule-2 pt-4 sm:grid-cols-3">
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-3">
                Colegios con reportes
              </dt>
              <dd className="tabular mt-1 text-[1.05rem] font-medium">{nf(meta.colegios)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-3">
                Con # alumnos conocido
              </dt>
              <dd className="tabular mt-1 text-[1.05rem] font-medium">
                Lima Metropolitana
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-3">
                Fuente del denominador
              </dt>
              <dd className="tabular mt-1 text-[1.05rem] font-medium">
                ESCALE · {meta.fuentes.matricula?.anio ?? "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 max-w-prose">
          <MethodologyNote>
            Cuando exista, la comparación no señalará un ganador ni un perdedor. Mostrará
            las cifras de cada colegio con su año y su fuente, y dirá cuándo una diferencia
            es demasiado pequeña para significar algo.
          </MethodologyNote>
        </div>
      </section>

      <section className="mt-10 border-t border-rule pt-9">
        <h2 className={h3}>Mientras tanto</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link href="/colegios" className={panelEnlace}>
            <p className="font-display text-[1.05rem] font-medium">Busca un colegio</p>
            <p className="mt-1.5 text-[0.86rem] leading-relaxed text-ink-2">
              Filtra por región, distrito, gestión o nivel y abre su ficha.
            </p>
          </Link>
          <Link href="/datos" className={panelEnlace}>
            <p className="font-display text-[1.05rem] font-medium">Explora los datos</p>
            <p className="mt-1.5 text-[0.86rem] leading-relaxed text-ink-2">
              Qué está pasando, cómo ha cambiado y qué se registra en todo el país.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
