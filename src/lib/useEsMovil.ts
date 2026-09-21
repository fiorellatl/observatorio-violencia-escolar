"use client";

import { useEffect, useState } from "react";

/**
 * ¿Estamos en una pantalla estrecha?
 *
 * Existe porque hay decisiones que CSS no puede tomar. Cambiar el tamaño de
 * una letra o esconder una columna se hace con una media query y no necesita
 * JavaScript; pero girar un gráfico de columnas a barras horizontales es un
 * cambio de estructura dentro de un componente de Recharts, y eso hay que
 * decidirlo en el render.
 *
 * Se usa SOLO para eso. Todo lo que se pueda resolver con una clase de
 * Tailwind se resuelve con una clase: duplicar el árbol en dos versiones
 * garantizaría que una de las dos se quedara atrás.
 *
 * Arranca en `false` y se corrige tras montar, a propósito: en el servidor no
 * hay ventana, y decidirlo durante el primer render daría una marca distinta
 * a la del cliente. El primer pintado es el de escritorio y se ajusta en el
 * mismo frame.
 */
export function useEsMovil(maximo = 640): boolean {
  const [es, setEs] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maximo}px)`);
    const ver = () => setEs(mq.matches);
    ver();
    mq.addEventListener("change", ver);
    return () => mq.removeEventListener("change", ver);
  }, [maximo]);

  return es;
}
