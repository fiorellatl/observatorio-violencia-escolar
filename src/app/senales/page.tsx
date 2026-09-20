import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MethodologyNote } from "@/components/MethodologyNote";
import { SignalsExplorer } from "@/components/SignalsExplorer";
import { getSignals } from "@/lib/data/provider";
import { nf } from "@/lib/format";
import { shell } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Cambios que merecen contexto",
  description:
    "Colegios donde el registro de reportes cambió más de lo esperable entre dos años: aumentos, disminuciones, reapariciones y persistencia, con el método estadístico explicado.",
  alternates: { canonical: "/senales" },
};

export default function SenalesPage() {
  const s = getSignals();
  const ultimo = s?.pares[s.pares.length - 1];

  return (
    <div className={`${shell} py-8 sm:py-10`}>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Señales" }]} />

      <h1 className="mt-6 max-w-[20ch] font-display text-display-xl font-medium text-balance">
        Cambios que merecen contexto
      </h1>
      <p className="mt-5 max-w-prose text-cuerpo leading-relaxed text-ink-2">
        Esta página no responde qué colegios registran más reportes —eso está en{" "}
        <a href="/rankings" className="text-accent hover:underline">
          los rankings
        </a>
        —, sino dónde el registro <strong className="font-semibold text-ink">cambió</strong>{" "}
        más de lo que cabría esperar si nada hubiera cambiado.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <MethodologyNote tono="aviso">
          Un cambio en el registro puede ser un cambio en lo que ocurre o un cambio en la
          disposición a reportarlo. Estos datos no permiten separarlos. Un colegio que
          estrena psicólogo y empieza a registrar aparece igual que uno donde algo empeoró.
        </MethodologyNote>
        <MethodologyNote>
          Aquí no hay puntuaciones ni posiciones. El cálculo que ordena las señales por
          dentro no se muestra como cifra del colegio: un número junto a un nombre se lee
          como nota, diga lo que diga la etiqueta.
        </MethodologyNote>
      </div>

      <div className="mt-10">
        <Suspense
          fallback={<div className="h-72 animate-pulse rounded-lg border border-rule bg-surface" />}
        >
          <SignalsExplorer />
        </Suspense>
      </div>

      {/* ── El método ──────────────────────────────────────────── */}
      <section className="mt-16 border-t border-rule pt-10">
        <h2 className="font-display text-display-m font-medium">
          ¿Cómo detectamos un cambio que merece contexto?
        </h2>

        <div className="mt-6 grid gap-7 lg:grid-cols-2">
          <div>
            <p className="meta">La prueba</p>
            <p className="mt-2 max-w-prose text-[0.9rem] leading-relaxed text-ink-2">
              Si un colegio registró <em>a</em> reportes un año y <em>b</em> al siguiente,
              preguntamos qué probabilidad había de ver un reparto así de desigual entre los
              dos años por puro azar. Formalmente es una prueba binomial condicional: entre
              los <em>a + b</em> reportes, cada uno podía caer en cualquiera de los dos años.
            </p>
          </div>

          <div>
            <p className="meta">Por qué no usamos el porcentaje</p>
            <p className="mt-2 max-w-prose text-[0.9rem] leading-relaxed text-ink-2">
              Pasar de 1 a 5 reportes es un +400 %, y pasar de 100 a 180 es solo un +80 %.
              Pero con seis reportes repartidos al azar, un reparto 1-5 ocurre una de cada
              cinco veces; el segundo caso no ocurre casi nunca. La prueba lo resuelve sola:
              el primero no es señal y el segundo sí.
            </p>
          </div>

          <div>
            <p className="meta">Descontamos el cambio del país</p>
            <p className="mt-2 max-w-prose text-[0.9rem] leading-relaxed text-ink-2">
              Si los reportes suben en todo el Perú, un colegio que sube lo mismo no ha
              cambiado nada relativo. La comparación se hace contra la variación nacional de
              ese par de años, no contra «no cambió».
            </p>
          </div>

          <div>
            <p className="meta">Corregimos por hacer miles de pruebas</p>
            <p className="mt-2 max-w-prose text-[0.9rem] leading-relaxed text-ink-2">
              Probando miles de colegios a la vez, uno de cada veinte saldría marcado por
              azar aunque no hubiera cambiado nada — y esos falsos positivos tendrían nombre
              y dirección. Aplicamos la corrección de Benjamini-Hochberg: de las señales
              publicadas, se espera que como mucho un 5 % sean ruido.
            </p>
          </div>

          <div>
            <p className="meta">Reaparición y persistencia no llevan prueba</p>
            <p className="mt-2 max-w-prose text-[0.9rem] leading-relaxed text-ink-2">
              No son contrastes estadísticos sino definiciones: «no registró nada en los dos
              años previos y ahora sí», «registró en 5 de los últimos 6 años». Se publican
              como patrones, con su regla escrita, y nunca mezcladas en el mismo orden que
              las anteriores.
            </p>
          </div>

          <div>
            <p className="meta">Lo que no calculamos</p>
            <p className="mt-2 max-w-prose text-[0.9rem] leading-relaxed text-ink-2">
              Cambios de <strong className="font-semibold text-ink">tasa</strong> entre años.
              Solo existe un padrón de matrícula, y dividir dos años por el mismo denominador
              produce una serie cuyas variaciones son idénticas a las de los conteos: no
              añade información y aparenta una precisión que no tenemos.
            </p>
          </div>
        </div>

        {s ? (
          <dl className="mt-9 grid gap-x-8 gap-y-6 border-t border-rule pt-6 sm:grid-cols-4">
            {[
              ["Tasa de falso descubrimiento", `${s.meta.q_fdr * 100} %`],
              ["Mínimo de reportes por contraste", nf(s.meta.min_n)],
              ["Mínimo para composición", `${nf(s.meta.min_composicion)} por año`],
              [
                "Última comparación",
                ultimo ? `${ultimo.anio_anterior} → ${ultimo.anio}` : "—",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="meta">{k}</dt>
                <dd className="tabular mt-1.5 text-[1.05rem] font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>
    </div>
  );
}
