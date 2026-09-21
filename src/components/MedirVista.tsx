"use client";

import { useEffect, useRef } from "react";
import { medir, type Evento } from "@/lib/analytics";

/**
 * Dispara un evento de vista una sola vez, al montar.
 *
 * Existe para que una página de SERVIDOR pueda medirse sin volverse de
 * cliente: la página sigue renderizándose en el servidor y solo baja al
 * navegador este componente, que no pinta nada. Los parámetros los calcula
 * el servidor y viajan ya resueltos.
 *
 * El `ref` protege del montaje doble que React hace en desarrollo con el
 * modo estricto, y de un re-render que no cambie la vista.
 */
export function MedirVista({
  evento,
  params,
}: {
  evento: Evento;
  /** Solo identificadores públicos. Ver `@/lib/analytics`. */
  params?: Record<string, string | number | boolean | undefined>;
}) {
  const clave = JSON.stringify([evento, params]);
  const enviado = useRef<string | null>(null);

  useEffect(() => {
    if (enviado.current === clave) return;
    enviado.current = clave;
    medir(evento, params);
    // `clave` resume evento y parámetros; añadir los dos sería redundante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return null;
}
