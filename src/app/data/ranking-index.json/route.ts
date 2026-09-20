import { getRankingIndex } from "@/lib/data/provider";

/**
 * El índice de rankings, como archivo estático.
 *
 * Pesa ~1,4 MB (unos 380 KB comprimidos) y solo lo descarga quien abre
 * /rankings. No viaja en el HTML ni en el bundle.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(getRankingIndex(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
