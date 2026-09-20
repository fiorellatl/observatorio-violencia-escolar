import { getSignals } from "@/lib/data/provider";

/** Las señales, como archivo estático. Solo las descarga quien abre /senales. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(getSignals() ?? { pares: [], meta: null }, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
