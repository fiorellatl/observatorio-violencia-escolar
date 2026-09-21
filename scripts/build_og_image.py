"""
Portada de enlace (Open Graph): public/og.png, 1200x627.

POR QUE UN PNG ESTATICO Y NO UNA RUTA GENERADA
LinkedIn, WhatsApp y Facebook piden la imagen con un robot que no ejecuta
JavaScript, a veces desde una IP distinta y con timeouts cortos. Un archivo
en public/ responde siempre igual, en 200, sin depender del runtime ni de que
el build tenga red. La imagen cambia una vez al ano, cuando cambian las
cifras; no hay nada que ganar generandola en cada peticion.

POR QUE NO ES LA STORY VERTICAL
La pieza de Instagram es 1080x1920. Recortada a 1.91:1 pierde el titular o la
cifra, segun por donde corte cada plataforma. Son dos formatos con dos
trabajos distintos y se disenan por separado.

    python scripts/build_og_image.py
"""
import json
import pathlib
from PIL import Image, ImageDraw, ImageFont

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTES = RAIZ / "scripts" / "fonts"
SALIDA = RAIZ / "public" / "og.png"

ANCHO, ALTO = 1200, 627
M = 72

PAPEL = "#f4f5f2"
TINTA = "#15171a"
TINTA_2 = "#4a5157"
TINTA_3 = "#7c848a"
FILETE = "#d9dbd5"
MENTA = "#57e3ae"
ACENTO = "#0a6f55"


def archivo(tam, peso=700):
    f = ImageFont.truetype(str(FUENTES / "Archivo.ttf"), tam)
    # El orden de los ejes de Archivo es [Weight, Width], no al reves.
    f.set_variation_by_axes([peso, 100])
    return f


def mono(tam, peso=500):
    f = ImageFont.truetype(str(FUENTES / "JetBrainsMono.ttf"), tam)
    f.set_variation_by_axes([peso])
    return f


def con_tracking(d, xy, texto, fuente, color, tracking):
    """PIL no tiene letter-spacing: se dibuja caracter a caracter."""
    x, y = xy
    for c in texto:
        d.text((x, y), c, font=fuente, fill=color)
        x += d.textlength(c, font=fuente) + tracking
    return x


def main():
    meta = json.loads((RAIZ / "data" / "public" / "meta.json").read_text("utf-8"))
    nacional = json.loads((RAIZ / "data" / "public" / "national.json").read_text("utf-8"))
    instituciones = json.loads(
        (RAIZ / "data" / "public" / "institutions.json").read_text("utf-8")
    )
    n_colegios = len(instituciones if isinstance(instituciones, list) else instituciones)

    img = Image.new("RGB", (ANCHO, ALTO), PAPEL)
    d = ImageDraw.Draw(img)

    # Filete de menta: la firma, y el unico uso de color saturado.
    d.rectangle([0, 0, ANCHO, 7], fill=MENTA)

    # Marca
    d.rectangle([M, 74, M + 15, 89], fill=MENTA)
    con_tracking(d, (M + 29, 70), "OBSERVATORIO ESCOLAR", mono(20), TINTA, 3.2)

    # Titular. Dos lineas partidas a mano: el punto de corte es una decision
    # de composicion, no algo que deba decidir un algoritmo de ajuste.
    f = archivo(58, 700)
    d.text((M, 132), "¿Qué sabemos sobre la violencia", font=f, fill=TINTA)
    d.text((M, 198), "en los colegios del Perú?", font=f, fill=TINTA)

    d.rectangle([M, 300, ANCHO - M, 301], fill=FILETE)

    # Las dos cifras, y a su derecha la serie: la portada ensena el dato, no
    # lo describe. La miniatura es el mismo grafico que abre la home.
    cifra = archivo(62, 700)
    rotulo = archivo(21, 400)

    d.text((M, 344), f"{meta['reportes']:,}".replace(",", ","), font=cifra, fill=TINTA)
    d.text((M, 424), "reportes registrados", font=rotulo, fill=TINTA_2)

    x2 = M + 300
    d.text((x2, 344), f"{n_colegios:,}", font=cifra, fill=ACENTO)
    d.text((x2, 424), "colegios con reportes", font=rotulo, fill=TINTA_2)

    # Serie anual, a la derecha. Solo anos comparables: los de colegios
    # cerrados hundirian dos columnas sin explicacion posible en una portada.
    serie = [n for n in nacional if not n.get("pandemia") and n["anio"] != meta["anio_parcial"]]
    x0, x1 = 700, ANCHO - M
    base, alto = 452, 118
    tope = max(n["total"] for n in serie) or 1
    paso = (x1 - x0) / len(serie)
    grosor = min(26, paso - 10)
    for i, n in enumerate(serie):
        cx = x0 + paso * i + paso / 2
        h = max(2, n["total"] / tope * alto)
        d.rectangle([cx - grosor / 2, base - h, cx + grosor / 2, base], fill=ACENTO)
    d.rectangle([x0, base + 1, x1, base + 2], fill=FILETE)
    pie_serie = mono(17)
    d.text((x0, base + 14), serie[0]["anio"], font=pie_serie, fill=TINTA_3)
    ult = serie[-1]["anio"]
    d.text((x1 - d.textlength(ult, font=pie_serie), base + 14), ult, font=pie_serie, fill=TINTA_3)

    # Pie
    d.rectangle([M, ALTO - 96, ANCHO - M, ALTO - 95], fill=FILETE)
    fpie = mono(19)
    con_tracking(d, (M, ALTO - 72), "DATOS PÚBLICOS DE SÍSEVE · MINEDU", fpie, TINTA_3, 2)
    dominio = "observatorioescolar.netlify.app"
    ancho_dom = sum(d.textlength(c, font=fpie) + 2 for c in dominio) - 2
    con_tracking(d, (ANCHO - M - ancho_dom, ALTO - 72), dominio, fpie, TINTA_2, 2)

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    img.save(SALIDA, "PNG", optimize=True)
    print(f"{SALIDA.relative_to(RAIZ)}  {img.size[0]}x{img.size[1]}  {SALIDA.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
