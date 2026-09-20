import { getBrowseIndex } from "@/lib/data/provider";

/**
 * El índice de navegación, como archivo estático.
 *
 * Se genera una vez en el build y Netlify lo sirve desde el CDN. El acceso a
 * disco sigue ocurriendo solo dentro de `provider.ts`: esta ruta no lee nada,
 * solo publica lo que el proveedor devuelve.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(getBrowseIndex(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
