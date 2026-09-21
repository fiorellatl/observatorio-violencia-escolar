import type { Metadata } from "next";
import Link from "next/link";
import { og } from "@/lib/og";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getAllInstitutions, getInstitutionCount, getMeta } from "@/lib/data/provider";
import { fechaLegible, nf } from "@/lib/format";
import { enlace, shell } from "@/lib/ui";

const DESC =
  "Qué mide SíseVe y qué no mide, por qué usamos tasas, por qué 2020–2021 se tratan aparte y de dónde sale cada dato de este sitio.";

export const metadata: Metadata = {
  title: "Metodología y fuentes",
  description: DESC,
  alternates: { canonical: "/metodologia" },
  ...og({ title: "Metodología y fuentes", description: DESC, url: "/metodologia" }),
};

/**
 * Una pregunta con su respuesta.
 *
 * La página es una conversación, no un documento normativo: cada sección se
 * titula con la pregunta que alguien se hace de verdad. El número que la
 * acompaña no decora —da al lector una idea de cuánto falta— y va en la
 * versalita monoespaciada que el producto usa para todo lo que etiqueta.
 */
function Pregunta({
  n,
  titulo,
  id,
  children,
}: {
  n: number;
  titulo: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-rule py-10 sm:py-12">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="meta">{String(n).padStart(2, "0")}</p>
          <h2 className="titular mt-3 text-display-s text-ink">{titulo}</h2>
        </div>
        <div className="space-y-4 text-[1rem] leading-relaxed text-ink-2 lg:col-span-8">
          {children}
        </div>
      </div>
    </section>
  );
}

const fuerte = "font-semibold text-ink";

export default function MetodologiaPage() {
  const meta = getMeta();
  const colegios = getInstitutionCount();
  // La cobertura del denominador se cuenta, no se afirma: la página dice
  // exactamente cuántas instituciones tienen su ficha del padrón cruzada.
  const conPadron = Object.values(getAllInstitutions()).filter((i) => i.matricula != null).length;

  return (
    <article className="pb-16">
      {/* ── Portada ──────────────────────────────────────────── */}
      <section className="border-b border-rule">
        <div className={`${shell} pb-12 pt-6 sm:pb-16`}>
          <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Metodología" }]} />

          <p className="meta mt-8">Metodología y fuentes</p>
          <h1 className="titular mt-5 max-w-[14ch] text-display-xl text-ink">
            Cómo leer estos <span className="text-accent">datos</span>
          </h1>
          <p className="mt-7 max-w-[54ch] text-[1.08rem] leading-relaxed text-ink-2">
            Información pública del Ministerio de Educación del Perú. Qué mide, qué no
            mide y qué decidimos nosotros al presentarla.
          </p>
        </div>
      </section>

      <div className={shell}>
        <Pregunta n={1} titulo="¿Qué es SíseVe?">
          <p>
            El Sistema Especializado en Reporte de Casos sobre Violencia Escolar, un portal
            del Ministerio de Educación creado en 2013 donde cualquier persona —un
            estudiante, su familia, un docente— puede registrar un hecho de violencia
            escolar. El reporte llega al colegio señalado, que está obligado a atenderlo
            bajo supervisión de su UGEL.
          </p>
          <p>
            Mide <strong className={fuerte}>denuncias registradas</strong>. No mide la
            violencia que ocurre y nadie reporta.
          </p>
        </Pregunta>

        <Pregunta n={2} titulo="¿Qué significa un reporte?">
          <p>
            Un reporte registrado no equivale necesariamente a un caso único, ni a un hecho
            probado, ni a una víctima única. El propio Ministerio advierte que puede existir
            más de un reporte sobre un mismo caso.
          </p>
          <p>
            La base incluye un identificador por reporte, pero ese identificador no permite
            agrupar reportes que describan el mismo hecho. Por eso{" "}
            <strong className={fuerte}>no deduplicamos</strong>: contamos reportes y los
            llamamos reportes.
          </p>
          <p>
            Cada reporte se registra con{" "}
            <strong className={fuerte}>un solo tipo de violencia</strong> y un solo presunto
            agresor. Lo comprobamos sobre los catorce años de la serie: las categorías suman
            exactamente el total de cada año, sin una sola excepción. Por eso los porcentajes
            de esos dos desgloses describen un reparto y no se solapan.
          </p>
        </Pregunta>

        <Pregunta n={3} titulo="¿Por qué usamos tasas?">
          <p>
            Un colegio de 2,000 estudiantes no se puede comparar con uno de 200 solo por la
            cantidad bruta de reportes. Cuando tenemos el número de alumnos del mismo año,
            calculamos:
          </p>
          <p className="tabular rounded-lg border border-rule bg-surface px-4 py-3.5 font-mono text-[0.88rem] text-ink">
            reportes de {meta.anio_transversal} ÷ alumnos de {meta.fuentes.matricula?.anio} ×
            1,000
          </p>
          <p>
            Donde no tenemos el número de alumnos mostramos el conteo y decimos que falta el
            denominador, en lugar de publicar una cifra que invita a una comparación injusta.
          </p>
          <p>
            Solo calculamos la tasa con al menos{" "}
            <strong className={fuerte}>{nf(meta.matricula_minima)} estudiantes</strong>. Por
            debajo, un único reporte dispara la tasa decenas de puntos: en la fuente hay
            códigos modulares con dos o tres alumnos registrados que producirían tasas de
            miles por cada 1,000. No son colegios violentos, son denominadores rotos.
          </p>
        </Pregunta>

        <Pregunta n={4} titulo={`¿Por qué ${meta.anios_pandemia.join(" y ")} van aparte?`}>
          <p>
            Durante esos años los colegios estuvieron cerrados por la pandemia. Los registros
            caen a una fracción de cualquier otro año, y esa caída refleja la ausencia de
            clases presenciales y del canal de reporte, no una reducción de la violencia.
          </p>
          <p>
            En los gráficos van atenuados y bajo una franja rotulada, y quedan fuera de
            rachas, récords y comparaciones entre años.
          </p>
        </Pregunta>

        <Pregunta n={5} titulo="¿Por qué cada dato tiene su propio año?">
          <p>
            Porque cada fuente se actualiza a su ritmo. Los reportes llegan hasta{" "}
            {meta.anio_max}; el número de alumnos del padrón corresponde a otro año; las
            pensiones a otro. Mezclarlos sin decirlo sería presentar como simultáneo lo que
            no lo es.
          </p>
          <p>
            Por eso cada cifra lleva una etiqueta con su fuente y su año. Es una
            característica del producto, no un detalle técnico.
          </p>
          <p>
            Para el análisis transversal usamos {meta.anio_transversal}: el año con mejor
            intersección entre reportes, número de alumnos y variables de contexto.
          </p>
        </Pregunta>

        <Pregunta n={6} titulo="¿El ranking no es una lista de los peores colegios?">
          <p>
            No, y la diferencia es la razón de ser de este sitio. El ranking ordena{" "}
            <strong className={fuerte}>reportes registrados</strong>, que es una medida de
            cuánto se denuncia, no de cuánta violencia ocurre. Un colegio con muchos reportes
            puede ser uno donde denunciar funciona: donde hay confianza, protocolo y personal
            que registra. Uno con cero reportes puede ser uno donde nadie se atreve.
          </p>
          <p>
            Por eso aquí no aparecen las palabras peligroso, seguro, peor ni mejor; el color
            de la escala va de claro a oscuro y no de verde a rojo; y junto a cada cifra hay
            un contexto que dice contra qué universo se compara. Una lista de «los peores»
            premiaría al colegio que mejor silencia.
          </p>
          <p>
            <Link href="/rankings" className={enlace}>
              Ver el ranking
            </Link>{" "}
            ·{" "}
            <Link href="/senales" className={enlace}>
              cómo se detectan los cambios
            </Link>
          </p>
        </Pregunta>

        <Pregunta n={7} titulo="¿Contra qué se compara un colegio?" id="distribucion">
          <p>
            Contra el reparto real de ese año, no contra un umbral elegido a mano. Decir que
            «20 reportes es mucho» sería inventarse el corte; en su lugar calculamos la
            distribución del universo y miramos dónde cae el colegio dentro de ella.
          </p>
          <p>
            El universo por defecto son los colegios que{" "}
            <strong className={fuerte}>registraron al menos un reporte</strong> ese año, y se
            nombra siempre en pantalla. Es la opción conservadora: incluir a los que no
            registraron nada bajaría la mediana a cero y cualquier colegio con tres reportes
            parecería excepcional.
          </p>
          <p>
            Si el universo es demasiado corto —menos de una veintena de colegios— no
            publicamos percentil: con tan pocos casos un cuantil no describe una
            distribución, describe a cuatro colegios concretos.
          </p>
        </Pregunta>

        <Pregunta n={8} titulo="¿Qué no publicamos?" id="privacidad">
          <p>
            La base original contiene datos personales de menores: edad, sexo, grado y turno
            del estudiante agredido, además de características del presunto agresor. Nada de
            eso sale de nuestra máquina.
          </p>
          <p>
            El sitio consume exclusivamente agregados por colegio, año y tipo de violencia.
            No existe ninguna página ni API que devuelva un reporte individual, y el build
            falla si alguno de esos campos aparece en los datos publicados.
          </p>
        </Pregunta>

        {/* ── Fuentes ────────────────────────────────────────── */}
        <section className="border-t border-rule py-10 sm:py-12">
          <div className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="meta">09</p>
              <h2 className="titular mt-3 text-display-s text-ink">Fuentes</h2>
            </div>

            <dl className="lg:col-span-8">
              {[
                {
                  nombre: "SíseVe — Ministerio de Educación",
                  detalle: `${nf(meta.reportes)} reportes de ${meta.anio_min} a ${meta.anio_max}, obtenidos mediante solicitud de acceso a la información pública. ${meta.anio_parcial} cubre hasta el ${fechaLegible(meta.corte)}.`,
                  url: "https://siseve.minedu.gob.pe/",
                  dominio: "siseve.minedu.gob.pe",
                },
                {
                  nombre: "ESCALE — Padrón de Instituciones Educativas",
                  detalle: `Número de alumnos, docentes, secciones, nivel educativo y ubicación, por código modular. Cruzado por código, nunca por nombre: ${nf(conPadron)} de las ${nf(colegios)} instituciones del sitio tienen su número de alumnos del padrón ${meta.fuentes.matricula?.anio ?? ""}.`,
                  url: "https://escale.minedu.gob.pe/",
                  dominio: "escale.minedu.gob.pe",
                },
                {
                  nombre: "Identicole — Ministerio de Educación",
                  detalle:
                    "Pensiones, área urbano/rural, infraestructura, conectividad y resultados educativos. Integración parcial: cada campo aparece con su propio año y solo en las fichas donde ya se consultó.",
                  url: "https://identicole.minedu.gob.pe/",
                  dominio: "identicole.minedu.gob.pe",
                },
              ].map((f) => (
                <div key={f.dominio} className="border-b border-rule-2 py-5 first:pt-0">
                  <dt className="text-[1.02rem] font-semibold text-ink">{f.nombre}</dt>
                  <dd className="mt-2 text-[0.94rem] leading-relaxed text-ink-2">
                    {f.detalle}
                    <a
                      href={f.url}
                      className="meta mt-2.5 block hover:text-accent"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {f.dominio} ↗
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <p className="meta border-t border-rule py-8">
          Datos generados el {meta.generado} · corte de la fuente {meta.corte}
        </p>
      </div>
    </article>
  );
}
