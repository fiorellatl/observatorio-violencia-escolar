import Link from "next/link";

export type Miga = { label: string; href?: string };

/**
 * Migas de pan.
 *
 * El último elemento nunca es enlace y lleva `aria-current="page"`: un enlace a
 * la página en la que ya estás es ruido para quien navega con teclado o lector
 * de pantalla.
 *
 * En móvil la tira puede desplazarse en horizontal, pero dentro de su propio
 * contenedor: `min-w-0` impide que empuje el ancho de la página y provoque el
 * desplazamiento lateral de todo el documento.
 */
export function Breadcrumbs({ items }: { items: Miga[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Ruta de navegación" className="min-w-0">
      <ol className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1 text-[0.78rem] text-ink-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((m, i) => {
          const ultimo = i === items.length - 1;
          return (
            <li key={`${m.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? (
                <span aria-hidden className="text-ink-3/60">
                  ›
                </span>
              ) : null}
              {m.href && !ultimo ? (
                <Link href={m.href} className="transition-colors hover:text-accent">
                  {m.label}
                </Link>
              ) : (
                <span className={ultimo ? "text-ink-2" : undefined} aria-current={ultimo ? "page" : undefined}>
                  {m.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
