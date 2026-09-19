import type { Metadata } from "next";
import { RegionBrowser } from "@/components/RegionBrowser";
import { SearchBox } from "@/components/SearchBox";
import { MethodologyNote } from "@/components/MethodologyNote";
import { getMeta, getSearchIndex } from "@/lib/data/provider";
import { nf } from "@/lib/format";

export const metadata: Metadata = {
  title: "Explorar colegios",
  description:
    "Busca cualquiera de los colegios del Perú con reportes registrados en SíseVe y mira qué información pública existe sobre su violencia escolar.",
};

export default function ColegiosPage() {
  const meta = getMeta();
  const filas = getSearchIndex();

  return (
    <div className="mx-auto max-w-shell px-5 py-12">
      <h1 className="max-w-[20ch] font-display text-display-xl font-medium text-balance">
        Explora un colegio
      </h1>
      <p className="mt-5 max-w-prose text-[1.02rem] leading-relaxed text-ink-2">
        Hay {nf(meta.colegios)} instituciones educativas con al menos un reporte
        registrado en SíseVe entre {meta.anio_min} y {meta.anio_max}. Busca por nombre,
        por distrito o por código modular.
      </p>

      <div className="mt-8 max-w-2xl">
        <SearchBox autoFocus />
      </div>

      <div className="mt-6 max-w-2xl">
        <MethodologyNote>
          Si un colegio no aparece, puede ser que no tenga ningún reporte registrado. Eso
          no significa que no ocurra violencia: significa que nadie la reportó en SíseVe.
        </MethodologyNote>
      </div>

      <section className="mt-14 border-t border-rule pt-10">
        <h2 className="font-display text-display-m font-medium">
          O busca por dónde queda
        </h2>
        <p className="mb-7 mt-2 max-w-prose text-[0.9rem] text-ink-2">
          Elige la región, luego el distrito, y llega al colegio. La cifra de cada fila
          es cuántas instituciones tienen reportes registrados, que depende sobre todo
          del tamaño del sistema educativo de la zona.
        </p>

        <RegionBrowser filas={filas} />
      </section>
    </div>
  );
}
