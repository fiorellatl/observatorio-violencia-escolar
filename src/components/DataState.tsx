import { panelPad } from "@/lib/ui";

/**
 * Estados de dato.
 *
 * La distinción que este archivo defiende: **cero no es lo mismo que sin
 * dato**. Un colegio con cero reportes registrados es una afirmación sobre el
 * registro; un colegio sin matrícula conocida es una ausencia de información
 * nuestra. Pintar las dos cosas como "0" convierte una laguna en un hecho.
 *
 * Por eso ninguno de estos componentes acepta un número: si hay número, no es
 * un estado vacío.
 */

type Motivo = "sin-dato" | "sin-reportes" | "no-aplica" | "insuficiente" | "pendiente";

const TEXTOS: Record<Motivo, { titulo: string; detalle?: string }> = {
  "sin-dato": {
    titulo: "Sin datos disponibles",
    detalle: "Todavía no tenemos esta información para este colegio.",
  },
  "sin-reportes": {
    titulo: "Sin reportes registrados",
    detalle:
      "No hay reportes en SíseVe para este periodo. Eso no significa que no haya ocurrido violencia: significa que no se registró.",
  },
  "no-aplica": { titulo: "No aplica" },
  insuficiente: {
    titulo: "Datos insuficientes",
    detalle: "No hay suficientes casos para mostrar algo que signifique algo.",
  },
  pendiente: {
    titulo: "Necesita datos adicionales",
    detalle: "Esta sección está preparada, pero la fuente todavía no la cubre.",
  },
};

/** Bloque completo, para cuando una sección entera no tiene qué mostrar. */
export function SinDatos({
  motivo = "sin-dato",
  titulo,
  children,
}: {
  motivo?: Motivo;
  titulo?: string;
  children?: React.ReactNode;
}) {
  const t = TEXTOS[motivo];
  return (
    <div className={`${panelPad} border-dashed`}>
      <p className="text-[0.9rem] font-medium text-ink-2">{titulo ?? t.titulo}</p>
      {children ?? (t.detalle ? (
        <p className="mt-1.5 max-w-prose text-[0.84rem] leading-relaxed text-ink-3">{t.detalle}</p>
      ) : null)}
    </div>
  );
}

/** Marca en línea, para una celda o una cifra que falta. */
export function Vacio({ motivo = "sin-dato" }: { motivo?: Motivo }) {
  return (
    <span className="text-ink-3" title={TEXTOS[motivo].titulo}>
      <span aria-hidden>—</span>
      <span className="sr-only">{TEXTOS[motivo].titulo}</span>
    </span>
  );
}

/** Sección anunciada pero todavía sin datos. No simula contenido. */
export function Proximamente({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${panelPad} border-dashed`}>
      <p className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-3">
        Próximamente
      </p>
      <p className="mt-2 font-display text-[1.05rem] font-medium">{titulo}</p>
      <p className="mt-1.5 max-w-prose text-[0.84rem] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}
