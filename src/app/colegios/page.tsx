import type { Metadata } from "next";
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

  // Navegación por territorio, no por ranking: no queremos que la puerta de
  // entrada sea «los colegios con más reportes».
  const porRegion = new Map<string, { colegios: number; reportes: number }>();
  for (const [, , region, , total] of filas) {
    const r = porRegion.get(region) ?? { colegios: 0, reportes: 0 };
    r.colegios += 1;
    r.reportes += total;
    porRegion.set(region, r);
  }
  const regiones = [...porRegion.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "es")
  );

  return (
    <div className="mx-auto max-w-shell px-5 py-12">
      <h1 className="max-w-[20ch] font-display text-display-xl font-medium text-balance">
        Explora un colegio
      </h1>
      <p className="mt-5 max-w-prose text-[1.02rem] leading-relaxed text-ink-2">
        Hay {nf(meta.colegios)} instituciones educativas con al menos un reporte
        registrado en SíseVe entre {meta.anio_min} y {meta.anio_max}. Busca por
        nombre, por distrito o por código modular.
      </p>

      <div className="mt-8 max-w-2xl">
        <SearchBox autoFocus />
      </div>

      <div className="mt-6 max-w-2xl">
        <MethodologyNote>
          Si un colegio no aparece, puede ser que no tenga ningún reporte registrado.
          Eso no significa que no ocurra violencia: significa que nadie la reportó en
          SíseVe.
        </MethodologyNote>
      </div>

      <section className="mt-14">
        <h2 className="font-display text-display-m font-medium">Por región</h2>
        <p className="mt-2 max-w-prose text-[0.9rem] text-ink-2">
          Cuántas instituciones tienen reportes registrados en cada región del país.
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {regiones.map(([region, r]) => (
            <li
              key={region}
              className="flex items-baseline justify-between gap-3 border-b border-rule-2 py-3"
            >
              <span className="text-[0.9rem] text-ink">{region}</span>
              <span className="flex items-baseline gap-3 text-right">
                <span className="tabular font-mono text-[0.85rem] font-semibold text-ink">
                  {nf(r.colegios)}
                </span>
                <span className="w-20 text-[0.74rem] text-ink-3">colegios</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
