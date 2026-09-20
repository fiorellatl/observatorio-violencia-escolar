import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getMeta } from "@/lib/data/provider";
import { nf } from "@/lib/format";

export const metadata: Metadata = {
  title: "Metodología y fuentes",
  description:
    "Qué mide SíseVe y qué no mide, por qué usamos tasas, por qué 2020–2021 se tratan aparte y de dónde sale cada dato de este sitio.",
  alternates: { canonical: "/metodologia" },
};

function Seccion({
  titulo,
  id,
  children,
}: {
  titulo: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-rule py-9">
      <h2 className="font-display text-display-m font-medium text-balance">{titulo}</h2>
      <div className="mt-4 space-y-4 text-[0.96rem] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function MetodologiaPage() {
  const meta = getMeta();

  return (
    <div className="mx-auto max-w-read px-5 py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Metodología" }]} />

      <h1 className="mt-6 font-display text-display-xl font-medium text-balance">
        Cómo leer estos datos
      </h1>
      <p className="mt-5 text-[1.05rem] leading-relaxed text-ink-2">
        Este sitio trabaja con información pública del Ministerio de Educación del
        Perú. Aquí explicamos qué mide, qué no mide y qué decisiones tomamos al
        presentarla.
      </p>

      <Seccion titulo="¿Qué es SíseVe?">
        <p>
          Es el Sistema Especializado en Reporte de Casos sobre Violencia Escolar, un
          portal del Ministerio de Educación creado en 2013 donde cualquier persona
          —un estudiante, su familia, un docente— puede registrar un hecho de
          violencia escolar. El reporte llega al colegio señalado, que está obligado a
          atenderlo bajo supervisión de su UGEL.
        </p>
        <p>
          Mide <strong className="font-semibold text-ink">denuncias registradas</strong>.
          No mide la violencia que ocurre y nadie reporta.
        </p>
      </Seccion>

      <Seccion titulo="¿Qué significa un reporte?">
        <p>
          Un reporte registrado no equivale necesariamente a un caso único, ni a un
          hecho probado, ni a una víctima única. El propio Ministerio advierte que
          puede existir más de un reporte sobre un mismo caso.
        </p>
        <p>
          La base incluye un identificador por reporte, pero ese identificador no
          permite agrupar reportes que describan el mismo hecho. Por eso{" "}
          <strong className="font-semibold text-ink">no deduplicamos</strong>: contamos
          reportes y los llamamos reportes.
        </p>
      </Seccion>

      <Seccion titulo="¿Por qué usamos tasas?">
        <p>
          Un colegio de 2,000 estudiantes no se puede comparar con uno de 200
          únicamente por la cantidad bruta de reportes. Cuando tenemos matrícula,
          calculamos:
        </p>
        <p className="tabular rounded-lg border border-rule bg-surface px-4 py-3 font-mono text-[0.9rem] text-ink">
          reportes de {meta.anio_transversal} ÷ alumnos de {meta.fuentes.matricula?.anio} × 1,000
        </p>
        <p>
          Donde todavía no tenemos el número de alumnos, mostramos el conteo y decimos que falta
          el denominador, en lugar de presentar una cifra que invita a una comparación
          injusta.
        </p>
        <p>
          Solo calculamos la tasa cuando el colegio tiene al menos{" "}
          <strong className="font-semibold text-ink">
            {nf(meta.matricula_minima)} estudiantes
          </strong>
          . Por debajo de ese umbral un único reporte dispara la tasa decenas de puntos:
          en la fuente hay códigos modulares con dos o tres alumnos registrados que
          producirían tasas de miles por cada 1,000. No son colegios violentos, son
          denominadores rotos.
        </p>
      </Seccion>

      <Seccion titulo={`¿Por qué ${meta.anios_pandemia.join(" y ")} se tratan distinto?`}>
        <p>
          Durante esos años los colegios estuvieron cerrados por la pandemia. Los
          registros caen a una fracción de cualquier otro año, y esa caída refleja la
          ausencia de clases presenciales y del canal de reporte, no una reducción de
          la violencia.
        </p>
        <p>
          En los gráficos aparecen como barras huecas y quedan fuera de cualquier
          comparación longitudinal.
        </p>
      </Seccion>

      <Seccion titulo="¿Por qué cada dato tiene un año distinto?">
        <p>
          Porque cada fuente tiene su propia frecuencia de actualización. Los reportes
          llegan hasta {meta.anio_max}; el número de alumnos del padrón corresponde a otro año;
          las pensiones a otro. Mezclarlas sin decirlo sería presentar como simultáneo
          lo que no lo es.
        </p>
        <p>
          Por eso cada cifra de este sitio lleva una etiqueta con su fuente y su año.
          Es una característica del producto, no un detalle técnico.
        </p>
        <p>
          Para el análisis transversal usamos {meta.anio_transversal}: es el año con
          mejor intersección entre reportes, # alumnos y variables de contexto.
        </p>
      </Seccion>

      <Seccion titulo="¿Por qué no hay un ranking de colegios?">
        <p>
          Porque el número de reportes no es una etiqueta del colegio. Un colegio con
          muchos reportes puede ser un colegio donde denunciar funciona: donde hay
          confianza, protocolo y personal que registra. Un colegio con cero reportes
          puede ser un colegio donde nadie se atreve.
        </p>
        <p>
          Publicar una lista de «los peores colegios» premiaría al que mejor silencia.
          Aquí no usamos las palabras peligroso, seguro, peor ni mejor.
        </p>
      </Seccion>

      <Seccion titulo="¿Qué no publicamos?" id="privacidad">
        <p>
          La base original contiene datos personales de menores: edad, sexo, grado y
          turno del estudiante agredido, además de características del presunto
          agresor. Nada de eso sale de nuestra máquina.
        </p>
        <p>
          El sitio consume exclusivamente agregados por colegio, año y tipo de
          violencia. No existe ninguna página ni API que devuelva un reporte
          individual.
        </p>
      </Seccion>

      <Seccion titulo="Fuentes">
        <ul className="space-y-4">
          <li>
            <p className="font-semibold text-ink">SíseVe — Ministerio de Educación</p>
            <p className="text-[0.92rem]">
              {nf(meta.reportes)} reportes de {meta.anio_min} a {meta.anio_max}, obtenidos
              mediante solicitud de acceso a la información pública. {meta.anio_parcial}{" "}
              cubre hasta agosto.
            </p>
            <a
              href="https://siseve.minedu.gob.pe/"
              className="text-[0.88rem] text-accent underline-offset-2 hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              siseve.minedu.gob.pe
            </a>
          </li>
          <li>
            <p className="font-semibold text-ink">ESCALE — Padrón de Instituciones Educativas</p>
            <p className="text-[0.92rem]">
              Matrícula, docentes, secciones, nivel educativo y ubicación, por código
              modular. Integración en curso.
            </p>
            <a
              href="https://escale.minedu.gob.pe/"
              className="text-[0.88rem] text-accent underline-offset-2 hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              escale.minedu.gob.pe
            </a>
          </li>
          <li>
            <p className="font-semibold text-ink">Identicole — Ministerio de Educación</p>
            <p className="text-[0.92rem]">
              Pensiones, área urbano/rural, infraestructura, conectividad y resultados
              educativos. Auditada, pendiente de integrar.
            </p>
            <a
              href="https://identicole.minedu.gob.pe/"
              className="text-[0.88rem] text-accent underline-offset-2 hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              identicole.minedu.gob.pe
            </a>
          </li>
        </ul>
      </Seccion>

      <section className="border-t border-rule py-9">
        <p className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-3">
          Datos generados el {meta.generado} · corte de la fuente {meta.corte}
        </p>
      </section>
    </div>
  );
}
