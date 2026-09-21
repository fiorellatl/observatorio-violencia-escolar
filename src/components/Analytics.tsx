"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { GA_ID, medirPagina } from "@/lib/analytics";

/**
 * Google Analytics 4 en el App Router.
 *
 * POR QUÉ `send_page_view: false`
 * Es la línea que evita el fallo clásico de esta integración. Por defecto,
 * gtag envía una vista de página al cargar; pero en el App Router la
 * navegación no recarga nada, así que hay que enviarla a mano en cada cambio
 * de ruta. Con las dos cosas activas, la primera página se contaría DOS
 * veces y todas las demás una, lo que no se nota en el panel y corrompe
 * cualquier comparación entre páginas. Aquí gtag no envía ninguna, y este
 * componente envía todas: un solo camino, sin solapamiento.
 *
 * POR QUÉ ESTE COMPONENTE ES DE CLIENTE Y NINGÚN OTRO CAMBIA
 * Es una isla. La cáscara, las fichas y los rankings siguen siendo de
 * servidor; lo único que se manda al navegador es este archivo, que no pinta
 * nada. Medir no es motivo para convertir media aplicación en cliente.
 *
 * `afterInteractive` deja que la página se pinte primero: la medición no
 * compite con el contenido por el hilo principal.
 */
function Vistas() {
  const pathname = usePathname();
  const params = useSearchParams();
  // La ruta anterior, para no repetir el envío cuando React vuelve a montar
  // el efecto sin que la dirección haya cambiado.
  const anterior = useRef<string | null>(null);

  useEffect(() => {
    const qs = params.toString();
    const ruta = qs ? `${pathname}?${qs}` : pathname;
    if (anterior.current === ruta) return;
    anterior.current = ruta;
    medirPagina(ruta);
  }, [pathname, params]);

  return null;
}

export function Analytics() {
  // En desarrollo no se mide: ensuciaría la propiedad con las recargas del
  // servidor de desarrollo y con las pruebas.
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Vistas />
    </>
  );
}
