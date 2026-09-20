"use client";

import { useCallback, useEffect, useState } from "react";
import type { BrowseIndex } from "@/lib/types";

/**
 * Descarga el índice de navegación una sola vez por sesión.
 *
 * El caché vive a nivel de módulo y no dentro del componente: el buscador
 * global y el explorador de /colegios son componentes distintos que necesitan
 * los mismos datos, y sin esto cada uno se bajaría su copia. La promesa
 * también se guarda, para que dos montajes simultáneos compartan una petición
 * en vez de lanzar dos.
 */
let cache: BrowseIndex | null = null;
let enVuelo: Promise<BrowseIndex> | null = null;

async function cargar(): Promise<BrowseIndex> {
  if (cache) return cache;
  if (!enVuelo) {
    enVuelo = fetch("/data/browse-index.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BrowseIndex>;
      })
      .then((d) => {
        cache = d;
        return d;
      })
      .finally(() => {
        enVuelo = null;
      });
  }
  return enVuelo;
}

export type EstadoIndice = {
  datos: BrowseIndex | null;
  cargando: boolean;
  error: boolean;
  pedir: () => void;
};

export function useBrowseIndex(inmediato = false): EstadoIndice {
  const [datos, setDatos] = useState<BrowseIndex | null>(cache);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  const pedir = useCallback(() => {
    if (cache || cargando) return;
    setCargando(true);
    setError(false);
    cargar()
      .then(setDatos)
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [cargando]);

  useEffect(() => {
    if (inmediato) pedir();
    // `pedir` cambia con `cargando`; incluirlo relanzaría el efecto a mitad de
    // la descarga. La condición de entrada ya es idempotente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inmediato]);

  return { datos, cargando, error, pedir };
}
