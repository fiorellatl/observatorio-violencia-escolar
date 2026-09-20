"use client";

import { useEffect, useState } from "react";
import { boton, botonAcento } from "@/lib/ui";

/**
 * Copiar el enlace de la página actual.
 *
 * Usa la URL tal cual: nada de enlaces cortos ni identificadores temporales,
 * que caducan y dejan muerta una cita en un reportaje.
 *
 * `navigator.clipboard` no existe fuera de contextos seguros ni en algunos
 * navegadores antiguos, así que hay un camino de respaldo y, si tampoco
 * funciona, se muestra la URL para copiarla a mano en vez de fingir que se
 * copió.
 */
export function ShareButton({
  etiqueta = "Compartir",
  titulo,
  acento = false,
  soloIconoEnMovil = false,
}: {
  etiqueta?: string;
  /** Si se pasa y el navegador trae la hoja de compartir nativa, se usa esa:
      en un móvil es lo que la gente espera, y lleva a WhatsApp en un toque. */
  titulo?: string;
  acento?: boolean;
  /** En barras estrechas, el rótulo se oculta y queda el icono. El nombre
      accesible se mantiene: un botón sin texto no es un botón sin nombre. */
  soloIconoEnMovil?: boolean;
}) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "fallo">("listo");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (estado === "listo") return;
    const t = setTimeout(() => setEstado("listo"), 2600);
    return () => clearTimeout(t);
  }, [estado]);

  const copiar = async () => {
    const actual = window.location.href;
    setUrl(actual);
    try {
      if (titulo && navigator.share) {
        // Cancelar la hoja nativa lanza AbortError: no es un fallo y no debe
        // pintarse como tal, así que se sale sin cambiar de estado.
        try {
          await navigator.share({ title: titulo, url: actual });
          return;
        } catch {
          return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(actual);
      } else {
        const ta = document.createElement("textarea");
        ta.value = actual;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand");
      }
      setEstado("copiado");
    } catch {
      setEstado("fallo");
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={copiar}
        aria-label={etiqueta}
        className={acento ? botonAcento : boton}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M6.5 9.5L9.5 6.5M6 4.5L7.5 3a2.8 2.8 0 014 4L10 8.5M10 11.5L8.5 13a2.8 2.8 0 01-4-4L6 7.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <span className={soloIconoEnMovil ? "hidden sm:inline" : undefined}>
          {estado === "copiado" ? "Enlace copiado" : etiqueta}
        </span>
      </button>

      {/* Se anuncia a lectores de pantalla sin robar el foco. */}
      <span role="status" aria-live="polite" className="sr-only">
        {estado === "copiado" ? "Enlace copiado al portapapeles" : ""}
      </span>

      {estado === "fallo" ? (
        <p className="max-w-xs text-[0.76rem] leading-snug text-ink-3">
          Tu navegador no dejó copiar. Esta es la dirección:{" "}
          <span className="break-all text-ink-2">{url}</span>
        </p>
      ) : null}
    </div>
  );
}
