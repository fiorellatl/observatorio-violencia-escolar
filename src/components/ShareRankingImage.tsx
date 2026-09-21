"use client";

import { useEffect, useState } from "react";
import { boton } from "@/lib/ui";
import { dibujarRanking, nombreArchivo, type DatosImagen } from "@/lib/share/rankingImage";

/**
 * "Compartir página": genera la pieza de la página que se está viendo.
 *
 * Consume los MISMOS datos que la tabla —se los pasa el explorador ya
 * filtrados, ordenados y paginados—, así que la imagen no puede decir algo
 * distinto de lo que hay en pantalla. Esa es la razón de que reciba un
 * `DatosImagen` en vez de recalcular el ranking por su cuenta.
 *
 * En un móvil, si el navegador trae la hoja de compartir nativa y acepta
 * archivos, se usa: es lo que la gente espera y lleva a WhatsApp de un toque.
 * La descarga existe siempre, porque la hoja nativa no está en escritorio.
 */
export function ShareRankingImage({
  datos,
  archivo,
}: {
  /** Se calcula en el momento de pulsar: así refleja los filtros vigentes. */
  datos: () => DatosImagen;
  archivo: () => string[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<"reposo" | "generando" | "lista" | "error">("reposo");
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  // La URL del objeto se revoca al cerrar: si no, el blob queda en memoria
  // toda la sesión cada vez que alguien genera una imagen.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const generar = async () => {
    setAbierto(true);
    setEstado("generando");
    try {
      const b = await dibujarRanking(datos());
      if (url) URL.revokeObjectURL(url);
      setBlob(b);
      setUrl(URL.createObjectURL(b));
      setEstado("lista");
    } catch {
      setEstado("error");
    }
  };

  const descargar = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo(archivo());
    a.click();
  };

  const compartir = async () => {
    if (!blob) return;
    const f = new File([blob], nombreArchivo(archivo()), { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f] });
      } else {
        descargar();
      }
    } catch {
      // Cancelar la hoja nativa no es un fallo y no debe pintarse como tal.
    }
  };

  const puedeCompartir =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  return (
    <div className="relative">
      {/* El rótulo se oculta en pantallas estrechas, así que el nombre
          accesible tiene que venir aparte: un botón sin texto no puede ser un
          botón sin nombre. */}
      <button
        type="button"
        onClick={generar}
        aria-label="Compartir página"
        aria-expanded={abierto}
        className={boton}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2.5 10.5v2a1 1 0 001 1h9a1 1 0 001-1v-2M8 2v8m0 0L5 7m3 3l3-3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="hidden sm:inline">Compartir página</span>
      </button>

      {abierto ? (
        <div
          role="dialog"
          aria-label="Compartir esta página del ranking"
          className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-rule bg-surface-2 p-4 shadow-lg shadow-black/10"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[0.92rem] font-medium text-ink">Compartir ranking</p>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="text-[0.82rem] text-ink-3 hover:text-ink"
            >
              Cerrar
            </button>
          </div>

          {estado === "generando" ? (
            <p className="mt-3 text-[0.85rem] text-ink-2">Preparando imagen…</p>
          ) : null}

          {estado === "error" ? (
            <div className="mt-3">
              <p className="text-[0.85rem] text-ink-2">
                No pudimos generar la imagen. Intenta nuevamente.
              </p>
              <button type="button" onClick={generar} className={`${boton} mt-3`}>
                Reintentar
              </button>
            </div>
          ) : null}

          {estado === "lista" && url ? (
            <>
              <p className="meta mt-3">Imagen lista · 1080 × 1920</p>
              <img
                src={url}
                alt="Vista previa de la imagen del ranking"
                className="mt-2 w-full rounded border border-rule"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={descargar} className={boton}>
                  Descargar imagen
                </button>
                {puedeCompartir ? (
                  <button type="button" onClick={compartir} className={boton}>
                    Compartir
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
