import type { Metadata } from "next";
import Link from "next/link";
import { og } from "@/lib/og";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getAllInstitutions, getInstitutionCount, getMeta } from "@/lib/data/provider";
import { dec, nf } from "@/lib/format";
import { enlace, shell } from "@/lib/ui";

const DESC =
  "Compara hasta tres colegios por reportes registrados, matrícula, tasa por 1,000 estudiantes y contexto institucional.";

export const metadata: Metadata = {
  title: "Comparar colegios",
  description: DESC,
  alternates: { canonical: "/comparar" },
  ...og({ title: "Comparar colegios", description: DESC, url: "/comparar" }),
};

/**
 * La comparación todavía no existe.
 *
 * Esta página está en la navegación porque el enlace ya se ofrece desde cada
 * ficha, y un enlace que lleva a un 404 es peor que uno que explica en qué
 * punto está la cosa. No simula una interfaz ni enseña datos de ejemplo: dice
 * qué falta, con el número exacto, y a dónde ir mientras tanto.
 *
 * LAS CIFRAS SE CUENTAN, NO SE ESCRIBEN. Esta página decía que el
 * denominador solo existía para Lima Metropolitana; cuando el padrón se
 * integró, la frase se quedó ahí afirmando algo falso durante meses. Ahora la
 * cobertura se calcula en cada build, así que no puede volver a pasar.
 */
export default function CompararPage() {
  const meta = getMeta();
  const total = getInstitutionCount();
  const conAlumnos = Object.values(getAllInstitutions()).filter(
    (i) => i.matricula != null
  ).length;
  const cobertura = (conAlumnos / total) * 100;

  const falta = [
    {
      k: "El denominador",
      v: `${dec(cobertura, 1)} %`,
      d: `${nf(conAlumnos)} de ${nf(total)} instituciones ya tienen su número de alumnos del padrón ${meta.fuentes.matricula?.anio ?? ""}. Resuelto.`,
      listo: true,
    },
    {
      k: "La interfaz",
      v: "Pendiente",
      d: "Elegir dos o tres colegios, ponerlos uno al lado del otro y leer sus cifras con su año y su fuente.",
      listo: false,
    },
    {
      k: "El umbral de diferencia",
      v: "Pendiente",
      d: "Decir cuándo dos colegios se parecen demasiado como para que la diferencia signifique algo.",
      listo: false,
    },
  ];

  return (
    <article className="pb-16">
      {/* ── Portada ──────────────────────────────────────────── */}
      <section className="border-b border-rule">
        <div className={`${shell} pb-12 pt-6 sm:pb-16`}>
          <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Comparar" }]} />

          <p className="meta mt-8">En construcción</p>
          <h1 className="titular mt-5 max-w-[15ch] text-display-xl text-ink">
            Comparar <span className="text-accent">colegios</span>
          </h1>
          <p className="mt-7 max-w-[56ch] text-[1.08rem] leading-relaxed text-ink-2">
            Poner dos o tres colegios uno al lado del otro y ver en qué se parecen y en qué
            no: cuántos reportes registran, cuántos estudiantes tienen, qué tasa resulta de
            esa división y qué declara cada uno.
          </p>
        </div>
      </section>

      <div className={shell}>
        {/* ── Qué falta ──────────────────────────────────────── */}
        <section className="py-10 sm:py-14">
          <div className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="titular text-display-s text-ink">Qué falta</h2>
              <p className="mt-3 max-w-prose text-[0.9rem] leading-relaxed text-ink-2">
                El dato que bloqueaba la comparación ya está. Lo que queda es construirla.
              </p>
            </div>

            <dl className="lg:col-span-8">
              {falta.map((f) => (
                <div key={f.k} className="border-b border-rule-2 py-5 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <dt className="text-[1.02rem] font-semibold text-ink">{f.k}</dt>
                    <dd
                      className={`cifra text-cifra-s ${f.listo ? "text-accent" : "text-ink-3"}`}
                    >
                      {f.v}
                    </dd>
                  </div>
                  <dd className="mt-1.5 max-w-prose text-[0.92rem] leading-relaxed text-ink-2">
                    {f.d}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Qué no va a hacer ──────────────────────────────── */}
        <section className="border-t border-rule py-10 sm:py-14">
          <div className="grid gap-x-10 gap-y-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="titular text-display-s text-ink">Qué no va a hacer</h2>
            </div>
            <div className="space-y-4 text-[1rem] leading-relaxed text-ink-2 lg:col-span-8">
              <p>
                No señalará un ganador ni un perdedor. Mostrará las cifras de cada colegio
                con su año y su fuente, y dirá cuándo una diferencia es demasiado pequeña
                para significar algo.
              </p>
              <p>
                Más reportes no es peor colegio:{" "}
                <Link href="/metodologia" className={enlace}>
                  por qué
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* ── Mientras tanto ─────────────────────────────────── */}
        <section className="border-t border-rule py-10 sm:py-14">
          <h2 className="meta">Mientras tanto</h2>
          <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2">
            {[
              {
                href: "/colegios",
                t: "Busca un colegio",
                d: "Filtra por región, distrito, gestión o nivel y abre su ficha.",
              },
              {
                href: "/datos",
                t: "Explora los datos",
                d: "Qué se registra en todo el país y cómo ha cambiado año a año.",
              },
            ].map((x) => (
              <Link
                key={x.href}
                href={x.href}
                className="group bg-surface p-5 transition-colors duration-150 ease-suave hover:bg-accent-soft/50 sm:p-6"
              >
                <p className="font-display text-[1.1rem] font-medium text-ink group-hover:text-accent">
                  {x.t} <span aria-hidden>→</span>
                </p>
                <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-2">{x.d}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
