"use client";

import { useEffect, useState } from "react";
import { boton, botonAcento } from "@/lib/ui";
import { nombreArchivo } from "@/lib/share/lienzo";
import { medir, type Evento } from "@/lib/analytics";

/**
 * "Compartir en Instagram": genera una pieza vertical de lo que se está
 * viendo y abre el camino que el dispositivo permita.
 *
 * UNA SOLA IMPLEMENTACIÓN PARA LAS DOS PIEZAS. El ranking y la radiografía se
 * dibujan distinto, pero el flujo —generar, previsualizar, compartir o
 * descargar— es el mismo, y tenerlo dos veces garantizaría que un arreglo se
 * aplicase solo a una. Por eso recibe `dibujar` en vez de saber qué pinta.
 *
 * LO QUE UNA WEB NO PUEDE HACER
 * Ningún sitio publica en Instagram por su cuenta: no hay API para eso y
 * fingirlo sería mentir al usuario. Lo que sí se puede es producir el archivo
 * con la medida exacta del formato y entregarlo a la hoja de compartir del
 * sistema, donde Instagram aparece como destino. En escritorio no existe esa
 * hoja, así que ahí el camino es descargar y subirla desde el teléfono; se
 * dice con todas sus letras en vez de dejar un botón que no lleva a ninguna
 * parte.
 *
 * `dibujar` se ejecuta al pulsar, no al montar: así la imagen refleja los
 * filtros vigentes en ese momento y no cuesta nada mientras nadie comparte.
 */
export function ShareImage({
  dibujar,
  archivo,
  titulo,
  microcopy,
  etiqueta = "Compartir en Instagram",
  alineacion = "derecha",
  eventoDescarga,
  contexto,
}: {
  dibujar: () => Promise<Blob>;
  archivo: () => string[];
  /** Encabezado del panel: qué es exactamente lo que se va a compartir. */
  titulo: string;
  /** Línea corta bajo el botón. Explica la acción antes de pulsarla. */
  microcopy?: string;
  etiqueta?: string;
  alineacion?: "derecha" | "izquierda";
  /** Qué pieza se está generando, para medir la descarga. */
  eventoDescarga: Extract<Evento, "download_radiografia" | "download_ranking">;
  /** Identificadores públicos de lo que se comparte. */
  contexto?: Record<string, string | number | boolean | undefined>;
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
      const b = await dibujar();
      if (url) URL.revokeObjectURL(url);
      setBlob(b);
      setUrl(URL.createObjectURL(b));
      setEstado("lista");
    } catch {
      setEstado("error");
    }
  };

  const descargar = (via: "boton" | "respaldo" = "boton") => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo(archivo());
    a.click();
    medir(eventoDescarga, { ...contexto, via });
  };

  const compartir = async () => {
    if (!blob) return;
    const f = new File([blob], nombreArchivo(archivo()), { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f] });
        // La hoja nativa no dice a dónde fue el archivo, así que el destino
        // no se inventa: se registra que se abrió y por qué camino.
        medir("share", { ...contexto, method: "web_share", content_type: eventoDescarga });
      } else {
        descargar("respaldo");
        medir("share", { ...contexto, method: "descarga", content_type: eventoDescarga });
      }
    } catch {
      // Cancelar la hoja nativa no es un fallo y no debe pintarse como tal.
    }
  };

  // Se comprueba después de montar: en el servidor no hay `navigator`, y
  // decidirlo durante el render daría una marca distinta a la del cliente.
  const [nativo, setNativo] = useState(false);
  useEffect(() => {
    setNativo(typeof navigator !== "undefined" && typeof navigator.canShare === "function");
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={generar}
        aria-label={`${etiqueta}: genera una imagen vertical para historias`}
        aria-expanded={abierto}
        className={botonAcento}
      >
        <IconoInstagram />
        {etiqueta}
      </button>

      {microcopy ? (
        <p className="mt-1.5 text-[0.78rem] leading-snug text-ink-3">{microcopy}</p>
      ) : null}

      {abierto ? (
        <div
          role="dialog"
          aria-label={titulo}
          className={`absolute top-full z-30 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-lg border border-rule bg-surface-2 p-4 shadow-lg shadow-black/10 ${
            alineacion === "derecha" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[0.92rem] font-medium text-ink">{titulo}</p>
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
              <p className="meta mt-3">Lista · 1080 × 1920 · historias</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Vista previa de la imagen: ${titulo}`}
                className="mt-2 w-full rounded border border-rule"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {nativo ? (
                  <button type="button" onClick={compartir} className={botonAcento}>
                    <IconoInstagram />
                    Compartir
                  </button>
                ) : null}
                <button type="button" onClick={() => descargar()} className={boton}>
                  Descargar
                </button>
              </div>
              <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-3">
                {nativo
                  ? "Elige Instagram en el menú del sistema para publicarla como historia."
                  : "Descárgala y súbela desde el teléfono como historia."}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** La cámara de Instagram, trazada a mano: el proyecto no carga librerías de
    iconos y una sola marca no justifica añadir una. */
function IconoInstagram() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.6" r="1.25" fill="currentColor" />
    </svg>
  );
}
