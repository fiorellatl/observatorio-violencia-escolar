"use client";

import { useState } from "react";
import { dec, nf } from "@/lib/format";
import { ESCALA_SECUENCIAL } from "@/lib/viz/colors";

export interface UgelMapa {
  nombre: string;
  reportes: number;
  alumnos: number;
  instituciones: number;
  tasa: number | null;
  aproximada: boolean;
  cobertura: number;
}

export interface DatosMapaLima {
  viewBox: number[];
  sinGeometria: string[];
  anio: string;
  distritos: { d: string; u: string; p: string }[];
  ugeles: UgelMapa[];
}

/**
 * Lima Metropolitana, por UGEL.
 *
 * EL DATO ES DE LA UGEL, NO DEL DISTRITO, y el mapa lo enseña en vez de
 * disimularlo: los distritos de una misma UGEL van del mismo color porque
 * comparten exactamente el mismo número. SíseVe no publica nada por debajo de
 * la UGEL, así que pintar cada distrito de un tono distinto sería inventar una
 * resolución que la fuente no tiene. Las siete manchas son siete datos.
 *
 * POR QUÉ SOLO LIMA. Un coroplético del Perú entero dedica la mayor parte de
 * su superficie a las regiones con menos estudiantes y comprime Lima —un
 * tercio del alumnado del país— en una mancha diminuta: la geometría no
 * guarda relación con el dato. Aquí dentro sí, porque todas las piezas son
 * urbanas y comparables entre sí.
 *
 * EL COLOR NO CALIFICA. Escala de un solo matiz, de claro a oscuro: dice
 * «más» y «menos», no «bien» y «mal». Un tono oscuro señala dónde más se
 * registra por alumno, que no es dónde más violencia hay.
 */
export function MapaLima({ datos }: { datos: DatosMapaLima }) {
  const [activa, setActiva] = useState<string | null>(null);

  const conTasa = datos.ugeles.filter((u) => u.tasa != null);
  const max = Math.max(...conTasa.map((u) => u.tasa!), 1);
  const min = Math.min(...conTasa.map((u) => u.tasa!), 0);

  const porNombre = new Map(datos.ugeles.map((u) => [u.nombre, u]));
  const tono = (n: string) => {
    const u = porNombre.get(n);
    if (!u || u.tasa == null) return "var(--rule-2)";
    const t = max > min ? (u.tasa - min) / (max - min) : 0;
    return ESCALA_SECUENCIAL[Math.min(4, Math.floor(t * 5))];
  };

  const sel = activa ? porNombre.get(activa) : null;
  const [, , w, h] = datos.viewBox;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-6">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-auto w-full max-w-[22rem] lg:max-w-none"
          role="img"
          aria-label={`Mapa de Lima Metropolitana por UGEL. ${conTasa
            .map((u) => `${u.nombre}: ${dec(u.tasa!, 1)} reportes por 1.000 alumnos`)
            .join(". ")}`}
        >
          {datos.distritos.map((d) => (
            <path
              key={d.d}
              d={d.p}
              fill={tono(d.u)}
              stroke="var(--paper)"
              strokeWidth={1.2}
              opacity={activa && activa !== d.u ? 0.35 : 1}
              onMouseEnter={() => setActiva(d.u)}
              onMouseLeave={() => setActiva(null)}
              className="cursor-pointer transition-opacity duration-150"
            >
              <title>{`${d.d} · ${d.u}`}</title>
            </path>
          ))}
        </svg>

        {datos.sinGeometria.length > 0 ? (
          <p className="mt-3 text-[0.74rem] leading-relaxed text-ink-3">
            {datos.sinGeometria.join(", ")} no aparece en el mapa: su geometría no está en la
            fuente cartográfica. Sus reportes sí están contados en su UGEL.
          </p>
        ) : null}
      </div>

      {/* La leyenda es la lista, y la lista es la leyenda: siete filas para
          siete datos, tocables con el dedo y legibles sin pasar el cursor. */}
      <ul className="lg:col-span-6">
        {[...datos.ugeles]
          .sort((a, b) => (b.tasa ?? -1) - (a.tasa ?? -1))
          .map((u) => (
            <li
              key={u.nombre}
              onMouseEnter={() => setActiva(u.nombre)}
              onMouseLeave={() => setActiva(null)}
              className={`flex items-baseline gap-3 border-b border-rule-2 py-2.5 transition-colors ${
                activa === u.nombre ? "bg-accent-soft/60" : ""
              }`}
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 translate-y-[2px] rounded-sm"
                style={{ background: tono(u.nombre) }}
              />
              <span className="min-w-0 flex-1 truncate text-[0.9rem] text-ink">
                {u.nombre.replace(/^UGEL /, "")}
              </span>
              <span className="tabular shrink-0 text-[0.78rem] text-ink-3">
                {nf(u.reportes)}
              </span>
              <span className="cifra w-14 shrink-0 text-right text-cifra-s text-ink">
                {u.tasa != null ? dec(u.tasa, 1) : "—"}
                {u.aproximada ? <span className="text-ink-3">*</span> : null}
              </span>
            </li>
          ))}
        <li className="pt-3 text-[0.74rem] leading-relaxed text-ink-3">
          Reportes de {datos.anio} y reportes por cada 1.000 alumnos.
          {datos.ugeles.some((u) => u.aproximada) ? (
            <>
              {" "}
              El asterisco marca las UGEL cuyo denominador no cubre todas sus instituciones: ahí
              la tasa es un techo, no una medida exacta.
            </>
          ) : null}
        </li>
      </ul>

      <p className="sr-only" aria-live="polite">
        {sel ? `${sel.nombre}: ${nf(sel.reportes)} reportes` : ""}
      </p>
    </div>
  );
}
