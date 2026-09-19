"""
Renderiza el acto «Volumen frente a composicion» como MP4 vertical 1080x1920
(formato historia de Instagram / TikTok / Reels).

    python scripts/render_story.py

Salida: data/processed/siseve_volumen_vs_composicion.mp4

Reimplementa en Pillow la misma animacion de morphing del artefacto web: las
26 DRE son un solo conjunto de marcas que se reordenan y se transforman, nunca
graficos distintos — ese es justamente el argumento.
"""
import json
import math
import pathlib
import sys

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed" / "siseve_volumen_vs_composicion.mp4"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H, FPS = 1080, 1920, 30

# ---- paleta (tema oscuro, validado para daltonismo sobre superficie oscura) ----
BG      = (18, 19, 17)
PANEL   = (26, 26, 25)
INK     = (243, 243, 238)
INK2    = (180, 179, 169)
INK3    = (131, 130, 122)
RULE    = (46, 46, 43)
S1      = (57, 135, 229)     # azul  — resto del pais
S2      = (217, 89, 38)      # naranja — regiones que el relato nombra
GRID    = (42, 42, 39)

F = "C:/Windows/Fonts/"
def font(name, size):
    return ImageFont.truetype(F + name, size)

SERIF   = lambda s: font("georgia.ttf", s)
SERIF_B = lambda s: font("georgiab.ttf", s)
SANS    = lambda s: font("segoeui.ttf", s)
SANS_B  = lambda s: font("segoeuib.ttf", s)
MONO    = lambda s: font("consola.ttf", s)
MONO_B  = lambda s: font("consolab.ttf", s)

# ---- datos: [DRE, total reportes, % sexual, % personal IE] ----
DRE = [
    ["Lima Metropolitana",17030,14.8,28.2],["Arequipa",3522,16.2,37.4],
    ["Piura",2997,20.5,31.5],["Áncash",2264,18.7,34.7],
    ["La Libertad",2252,18.1,40.9],["Junín",2136,20.6,49.0],
    ["Lambayeque",1952,16.4,25.2],["Cusco",1927,18.6,41.6],
    ["Callao",1828,15.1,31.2],["Ica",1781,14.2,25.3],
    ["Lima Provincias",1567,19.6,39.4],["Tacna",1527,14.8,36.1],
    ["San Martín",1332,24.9,35.4],["Cajamarca",1260,22.4,41.3],
    ["Huánuco",1238,18.9,31.4],["Ucayali",999,27.2,41.1],
    ["Amazonas",845,47.3,63.0],["Ayacucho",745,22.6,55.8],
    ["Loreto",699,57.9,68.2],["Puno",531,24.3,64.4],
    ["Tumbes",404,20.3,30.4],["Apurímac",395,19.7,62.0],
    ["Moquegua",390,16.9,35.4],["Pasco",388,19.8,44.6],
    ["Huancavelica",376,23.7,63.3],["Madre de Dios",248,33.5,47.6],
]
# ---- maduracion: (meses desde el reporte, % con atencion finalizada) ----
MAT = [(0,0.0),(1,10.2),(2,34.3),(3,42.8),(4,47.4),(5,46.8),(6,47.9),(7,67.8),
       (8,71.2),(9,79.6),(10,83.3),(11,86.8),(12,88.5),(13,90.6),(14,90.1),
       (15,91.1),(16,92.8),(17,92.8),(18,88.7),(19,85.9),(20,96.3),(21,98.1)]

# ---- mapa distrital de Lima, construido por scripts/build_lima_map.py ----
_MAPA = pathlib.Path(__file__).resolve().parents[1] / "data" / "processed" / "lima_ugel_map.json"
LIMA = json.loads(_MAPA.read_text(encoding="utf-8"))


def ramp(t):
    """Rampa secuencial de un solo tono, apagado a brillante sobre fondo oscuro."""
    a, b = (29, 51, 80), (94, 170, 247)
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


HL = {"Loreto", "Puno", "Amazonas", "Huancavelica", "Apurímac", "Lima Metropolitana"}
SCATTER_LABEL = {"Loreto", "Lima Metropolitana"}

nf = lambda n: f"{n:,}".replace(",", ",")
pc = lambda v: f"{v:.1f}".replace(".", ",") + " %"

# ---- geometria del area de grafico (dentro de la zona segura de historias) ----
CX0, CX1 = 74, W - 74           # margenes laterales
GY0, GY1 = 560, 1520            # area de marcas
BAR_L, BAR_R = CX0 + 300, CX1 - 128


def ease(t):
    return 4*t*t*t if t < .5 else 1 - (-2*t + 2)**3 / 2


def lerp(a, b, t):
    return a + (b - a) * t


def state_bars(key):
    """Barras horizontales ordenadas por `key` ('n' o 'staff')."""
    idx = 1 if key == "n" else 3
    order = sorted(range(len(DRE)), key=lambda i: -DRE[i][idx])
    rowH = (GY1 - GY0) / len(DRE)
    bh = rowH - 9
    mx = max(d[idx] for d in DRE)
    out = {}
    for rank, i in enumerate(order):
        d = DRE[i]
        w = max(4, d[idx] / mx * (BAR_R - BAR_L))
        y = GY0 + rank * rowH
        out[i] = dict(x=BAR_L, y=y, w=w, h=bh, r=4,
                      lx=BAR_L - 18, ly=y + bh/2, anchor="r",
                      vx=BAR_L + w + 16,
                      vtxt=nf(d[1]) if key == "n" else pc(d[3]),
                      lshow=1.0, vshow=1.0)
    return out


def state_scatter():
    """Dispersion: volumen (log) contra % personal IE."""
    px0, px1 = CX0 + 96, CX1 - 40
    py0, py1 = GY0 + 60, GY1 - 110
    lx = lambda v: math.log10(v)
    xmin, xmax = lx(200), lx(20000)
    X = lambda v: px0 + (lx(v) - xmin) / (xmax - xmin) * (px1 - px0)
    Y = lambda p: py0 + (1 - (p - 20) / 55) * (py1 - py0)
    out = {}
    for i, d in enumerate(DRE):
        s = 34 if d[0] in HL else 24
        cx, cy = X(d[1]), Y(d[3])
        right = cx < W * .58
        out[i] = dict(x=cx - s/2, y=cy - s/2, w=s, h=s, r=s/2,
                      lx=cx + (s/2 + 14 if right else -s/2 - 14), ly=cy,
                      anchor="l" if right else "r",
                      vx=-9999, vtxt="",
                      # en la dispersion el cluster andino se solapa: se rotula
                      # solo el par que sostiene el contraste del relato
                      lshow=1.0 if d[0] in SCATTER_LABEL else 0.0, vshow=0.0)
    return out


S_VOL, S_STAFF, S_SCAT = state_bars("n"), state_bars("staff"), state_scatter()


def txt(dr, xy, s, fnt, fill, anchor="la"):
    dr.text(xy, s, font=fnt, fill=fill, anchor=anchor)


def wrap(dr, s, fnt, maxw):
    words, lines, cur = s.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if dr.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            lines.append(cur); cur = w_
    if cur:
        lines.append(cur)
    return lines


def draw_header(dr, title, sub, accent=False):
    txt(dr, (CX0, 214), "SÍSEVE · MINEDU PERÚ · 2024 – AGO 2026", MONO_B(23), INK3)
    f = SERIF_B(60)
    y = 276
    for line in wrap(dr, title, f, CX1 - CX0)[:2]:
        txt(dr, (CX0, y), line, f, S2 if accent else INK); y += 70
    fs = SANS(29)
    for line in wrap(dr, sub, fs, CX1 - CX0)[:2]:
        txt(dr, (CX0, y + 12), line, fs, INK2); y += 40


def draw_footer(dr, s):
    dr.line([CX0, 1600, CX1, 1600], fill=RULE, width=2)
    f = SANS(25)
    y = 1628
    for line in wrap(dr, s, f, CX1 - CX0)[:3]:
        txt(dr, (CX0, y), line, f, INK3); y += 34


def draw_scatter_axes(dr, alpha):
    if alpha <= .02:
        return
    px0, px1 = CX0 + 96, CX1 - 40
    py0, py1 = GY0 + 60, GY1 - 110
    lx = lambda v: math.log10(v)
    xmin, xmax = lx(200), lx(20000)
    X = lambda v: px0 + (lx(v) - xmin) / (xmax - xmin) * (px1 - px0)
    Y = lambda p: py0 + (1 - (p - 20) / 55) * (py1 - py0)
    g = tuple(int(lerp(BG[k], GRID[k], alpha)) for k in range(3))
    ink3 = tuple(int(lerp(BG[k], INK3[k], alpha)) for k in range(3))
    for p in (20, 35, 50, 65, 75):
        dr.line([px0, Y(p), px1, Y(p)], fill=g, width=2)
        txt(dr, (px0 - 16, Y(p)), f"{p}%", MONO(23), ink3, anchor="rm")
    for v in (200, 1000, 5000, 20000):
        lab = f"{v//1000}k" if v >= 1000 else str(v)
        txt(dr, (X(v), py1 + 30), lab, MONO(23), ink3, anchor="ma")
    txt(dr, ((px0 + px1)/2, py1 + 72), "TOTAL DE REPORTES (ESCALA LOG)",
        MONO_B(22), ink3, anchor="ma")
    # promedio nacional
    for xseg in range(int(px0), int(px1), 18):
        dr.line([xseg, Y(35.3), xseg + 9, Y(35.3)], fill=ink3, width=2)
    txt(dr, (px0 + 8, Y(35.3) - 34), "promedio nacional 35,3 %", SANS(24), ink3)


def frame(a, b, t, header, footer, axes_alpha, badge=None, badge_at="tr"):
    """Interpola entre dos estados y dibuja un cuadro completo."""
    img = Image.new("RGB", (W, H), BG)
    dr = ImageDraw.Draw(img)
    e = ease(t)
    draw_header(dr, *header)
    draw_scatter_axes(dr, axes_alpha)

    for i, d in enumerate(DRE):
        A, B = a[i], b[i]
        x, y = lerp(A["x"], B["x"], e), lerp(A["y"], B["y"], e)
        w, h = lerp(A["w"], B["w"], e), lerp(A["h"], B["h"], e)
        r = lerp(A["r"], B["r"], e)
        hi = d[0] in HL
        col = S2 if hi else S1
        # opacidad simulada sobre fondo plano
        op = 1.0 if hi else .70
        col = tuple(int(lerp(BG[k], col[k], op)) for k in range(3))
        dr.rounded_rectangle([x, y, x + w, y + h], radius=max(1, r), fill=col)

        # etiqueta de la region — se apaga a mitad de la transicion para que
        # los rotulos no se atraviesen mientras las marcas viajan
        transit = 1 - 4 * e * (1 - e)
        # Corte en seco, no fundido: el rotulo viaja POR ENCIMA de las marcas, y
        # simular alfa mezclando hacia el fondo lo pintaria negro sobre naranja
        # — justo lo mas visible. O se dibuja entero, o no se dibuja.
        show = lerp(A["lshow"], B["lshow"], e) * transit
        if show > .62:
            lx, ly = lerp(A["lx"], B["lx"], e), lerp(A["ly"], B["ly"], e)
            anchor = (B if e > .5 else A)["anchor"]
            c = INK if hi else INK2
            fnt = SANS_B(26) if hi else SANS(25)
            txt(dr, (lx, ly), d[0], fnt, c, anchor=("rm" if anchor == "r" else "lm"))

        # valor numerico (solo en las vistas de barras)
        vshow = lerp(A["vshow"], B["vshow"], e) * transit
        if vshow > .62 and A["vx"] > -9000:
            vx = lerp(A["vx"], B["vx"] if B["vx"] > -9000 else A["vx"], e)
            vy = lerp(A["ly"], B["ly"], e)
            c = INK if hi else INK2
            label = (B if e > .5 and B["vtxt"] else A)["vtxt"]
            txt(dr, (vx, vy), label, MONO_B(25) if hi else MONO(24), c, anchor="lm")

    if badge:
        bf = MONO_B(34)
        tw = dr.textlength(badge, font=bf)
        by = GY0 + 6 if badge_at == "tr" else GY1 - 78
        bx = CX1 - tw - 30
        dr.rounded_rectangle([bx - 20, by - 12, CX1, by + 46], radius=8, fill=PANEL)
        txt(dr, (bx, by), badge, bf, S2)

    draw_footer(dr, footer)
    return img


def intro_card():
    """Que es SiseVe, para que sirve y de donde salen estos numeros."""
    img = Image.new("RGB", (W, H), BG)
    dr = ImageDraw.Draw(img)

    txt(dr, (CX0, 468), "¿SABÍAN QUE...?", MONO_B(26), S2)

    y = 544
    f = SERIF_B(58)
    for line in wrap(dr, "¿El Estado publica, uno por uno, todos los "
                         "reportes de violencia escolar del país?", f, CX1 - CX0):
        txt(dr, (CX0, y), line, f, INK); y += 70

    y += 24
    fb = SANS(31)
    for line in wrap(dr, "Se llama SíseVe y lo hizo el Ministerio de Educación "
                         "en 2013. Reporta quien quiera: un alumno, su mamá, un "
                         "profesor. El caso le cae al colegio, que está obligado "
                         "a atenderlo.",
                     fb, CX1 - CX0):
        txt(dr, (CX0, y), line, fb, INK2); y += 44

    # cifras de escala, en dos columnas
    y += 46
    dr.line([CX0, y, CX1, y], fill=RULE, width=2)
    y += 34
    col2 = CX0 + 470
    facts = [("+66,000", "colegios afiliados"), ("227", "UGEL en el pa\u00eds"),
             ("50,633", "reportes analizados"), ("ene 2024", "a agosto de 2026")]
    for i, (big, small) in enumerate(facts):
        cx = CX0 if i % 2 == 0 else col2
        cy = y + (i // 2) * 138
        txt(dr, (cx, cy), big, MONO_B(48), INK)
        txt(dr, (cx, cy + 62), small, SANS(27), INK3)

    draw_footer(dr, "Yo solo le di clic a un bot\u00f3n: se descarga sin contrase\u00f1a ni "
                    "tr\u00e1mite. Eso s\u00ed, el portal solo publica desde 2024, aunque "
                    "funciona desde 2013.")
    return img


def card(lines, kicker=None, foot=None, top=520):
    img = Image.new("RGB", (W, H), BG)
    dr = ImageDraw.Draw(img)
    if kicker:
        txt(dr, (CX0, top), kicker, MONO_B(26), S2)
    y = top + 78
    for s, size, col, fam in lines:
        f = {"serif": SERIF_B, "sans": SANS, "mono": MONO_B}[fam](size)
        for line in wrap(dr, s, f, CX1 - CX0):
            txt(dr, (CX0, y), line, f, col)
            y += int(size * 1.22)
        y += 26
    if foot:
        draw_footer(dr, foot)
    return img


H_VOL = ("La respuesta salta a la vista",
         "Reportes por región. Es lo que te muestra el portal.")
H_STF = ("Hasta que le hice otra pregunta",
         "¿Qué parte de esos reportes señala a un adulto del colegio?")
H_SCT = ("Y puse las dos juntas",
         "Volumen abajo, composición arriba. Un punto por región.")

F_VOL = "Lima, 17,030 reportes: más de un tercio del país. Listo, pensé. Ahí estaba mi respuesta."
F_STF = "Mismo archivo, misma base, solo otra pregunta. Y todo se dio vuelta: Loreto pasó de último a primero."
F_SCT = "Mientras menos se denuncia en una región, más grave es lo que alcanza a llegar."


def number_card(t):
    """Numero grande animado: cuanto tarda el Estado en cerrar un expediente."""
    img = Image.new("RGB", (W, H), BG)
    dr = ImageDraw.Draw(img)

    pos = t * (len(MAT) - 1)
    k = min(int(pos), len(MAT) - 1)
    mes = MAT[k][0]
    pct = MAT[k][1] if k >= len(MAT) - 1 else lerp(MAT[k][1], MAT[k + 1][1], pos - k)

    txt(dr, (CX0, 214), "LA PREGUNTA QUE NADIE RESPONDE", MONO_B(23), S2)
    f = SERIF_B(58)
    y = 272
    for line in wrap(dr, "\u00bfCu\u00e1nto tarda el Estado en cerrar un caso "
                         "de violencia escolar?", f, CX1 - CX0):
        txt(dr, (CX0, y), line, f, INK); y += 68

    # el numero
    txt(dr, (W // 2, 560), str(mes), MONO_B(300), INK, anchor="ma")
    txt(dr, (W // 2, 900), "MESES DESDE EL REPORTE", MONO_B(28), INK3, anchor="ma")

    # cien expedientes que se van cerrando
    cerrados = int(round(pct))
    CELL, R, GX, GY = 82, 30, W // 2 - 5 * 82, 1010
    for i in range(100):
        cx = GX + (i % 10) * CELL + CELL / 2
        cy = GY + (i // 10) * CELL + CELL / 2
        if i < cerrados:
            dr.ellipse([cx - R, cy - R, cx + R, cy + R], fill=S1)
        else:
            dr.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(70, 70, 66), width=3)

    txt(dr, (W // 2, 1855), f"{cerrados} de cada 100 expedientes ya est\u00e1n cerrados",
        SANS(31), INK2, anchor="md")
    return img


def lima_card(reveal=1.0):
    """Mapa distrital de Lima. El color es de la UGEL, no del distrito."""
    img = Image.new("RGB", (W, H), BG)
    dr = ImageDraw.Draw(img)

    txt(dr, (CX0, 214), "\u00bfY EN LIMA?", MONO_B(23), S2)
    f = SERIF_B(58)
    y = 272
    for line in wrap(dr, "Los 43 distritos, pintados por su UGEL.", f, CX1 - CX0):
        txt(dr, (CX0, y), line, f, INK); y += 68
    fs = SANS(29)
    for line in wrap(dr, "Un mismo color = una misma UGEL. Es todo el detalle que existe.",
                     fs, CX1 - CX0)[:2]:
        txt(dr, (CX0, y + 10), line, fs, INK2); y += 40

    vw, vh = LIMA["viewBox"][2], LIMA["viewBox"][3]
    MH = 960
    k = MH / vh
    MX, MY = CX0 - 4, 452

    tot = [d["n"] for d in LIMA["distritos"]]
    lo, hi = min(tot), max(tot)

    for d in LIMA["distritos"]:
        col = ramp(((d["n"] - lo) / (hi - lo)) ** 0.85 * reveal)
        for ring in d["p"]:
            pts = [(MX + px * k, MY + py * k) for px, py in ring]
            if len(pts) >= 3:
                dr.polygon(pts, fill=col, outline=BG)

    # leyenda ordenada: es tambien el ranking
    lx, ly = MX + vw * k + 40, 512
    txt(dr, (lx, ly - 46), "REPORTES POR UGEL", MONO_B(22), INK3)
    for d in sorted({d["u"]: d["n"] for d in LIMA["distritos"]}.items(),
                    key=lambda kv: -kv[1]):
        nombre, n = d
        col = ramp(((n - lo) / (hi - lo)) ** 0.85)
        dr.rounded_rectangle([lx, ly, lx + 26, ly + 26], radius=4, fill=col)
        corto = nombre.replace("UGEL ", "").split()[0]
        resto = " ".join(nombre.replace("UGEL ", "").split()[1:])
        txt(dr, (lx + 40, ly + 1), corto, MONO_B(28), INK)
        txt(dr, (lx + 40, ly + 34), resto, SANS(22), INK3)
        txt(dr, (CX1, ly + 6), nf(n), MONO_B(28), INK, anchor="ra")
        ly += 96

    fa = SANS(30)
    ya = 1452
    for line in wrap(dr, "San Juan de Lurigancho, el distrito m\u00e1s poblado del Per\u00fa, "
                         "est\u00e1 en la UGEL que menos reportes registra de Lima.",
                     fa, CX1 - CX0)[:3]:
        txt(dr, (CX0, ya), line, fa, S2); ya += 40

    draw_footer(dr, "El color es de la UGEL, no del distrito: S\u00edseVe no publica nada "
                    "por debajo de ese nivel. Son conteos, no tasas: el portal no entrega "
                    "matr\u00edcula. Santa Anita falta en la fuente geogr\u00e1fica.")
    return img


def build(emit):
    """Genera el guion cuadro a cuadro y se los pasa a `emit`."""
    S = lambda n: int(n * FPS)

    def hold(img, secs):
        """Escena fija: se dibuja una sola vez y se repite."""
        for _ in range(S(secs)):
            emit(img)

    # 0 - gancho: quien habla y que hizo
    hold(card(
        [("Me met\u00ed al portal del Estado y me baj\u00e9 50,633 reportes "
          "de violencia escolar.", 68, INK, "serif"),
         ("Esto es lo que encontr\u00e9.", 36, S2, "sans")],
        kicker="EL BULLYING EN N\u00daMEROS",
        foot="S\u00edseVe \u00b7 Ministerio de Educaci\u00f3n del Per\u00fa \u00b7 enero 2024 a agosto 2026.",
        top=540), 3.2)

    # 1 - que es el portal
    hold(intro_card(), 5.2)

    # 2 - el primer hallazgo, que corrige el propio gancho
    hold(card(
        [("El bullying es solo una parte. Hay mucho m\u00e1s.", 68, INK, "serif"),
         ("11,008 de los 50,633 reportes son acoso escolar: uno de cada cinco. "
          "Los otros cuatro son golpes con y sin lesiones, castigo f\u00edsico, trato "
          "humillante, tocamientos, ciberacoso, discriminaci\u00f3n. Diecisiete "
          "categor\u00edas m\u00e1s que casi nunca se nombran.", 32, INK2, "sans"),
         ("Vine por el bullying y me encontr\u00e9 con todo lo dem\u00e1s.", 37, S2, "sans")],
        kicker="LO PRIMERO QUE APREND\u00cd",
        foot="El portal clasifica el acoso escolar como una casilla entre 18 subtipos de violencia.",
        top=450), 5.0)

    # 3 - cuanto tarda: numero grande que cuenta
    n = S(4.0)
    for k in range(n):
        emit(number_card(k / (n - 1)))
    hold(number_card(1.0), 2.4)

    # 4 - la pregunta que abre el bloque de graficos
    hold(card(
        [("\u00bfEn qu\u00e9 regi\u00f3n del Per\u00fa hay m\u00e1s violencia escolar?",
          76, INK, "serif"),
         ("Pens\u00e9 que el dato me lo iba a decir de frente.", 34, INK2, "sans")],
        kicker="MI PREGUNTA ERA SIMPLE",
        foot="Todos los reportes registrados entre enero de 2024 y agosto de 2026.",
        top=505), 3.2)

    # 4 - barras por volumen
    hold(frame(S_VOL, S_VOL, 1, H_VOL, F_VOL, 0), 3.8)

    # 5 - morph a composicion
    n = S(1.5)
    for k in range(n):
        emit(frame(S_VOL, S_STAFF, k / (n - 1), H_STF, F_STF, 0))

    # 6 - sostener composicion
    hold(frame(S_STAFF, S_STAFF, 1, H_STF, F_STF, 0), 4.2)

    # 7 - morph a dispersion
    n = S(1.6)
    for k in range(n):
        t = k / (n - 1)
        emit(frame(S_STAFF, S_SCAT, t, H_SCT, F_SCT, ease(t)))

    # 8 - sostener dispersion
    hold(frame(S_SCAT, S_SCAT, 1, H_SCT, F_SCT, 1, badge="r = \u22120,54"), 3.8)

    # 9 - el mapa de Lima
    n = S(1.2)
    for k in range(n):
        emit(lima_card(0.25 + 0.75 * (k / (n - 1))))
    hold(lima_card(1.0), 4.4)

    # 10 - la respuesta, que deshace la pregunta
    hold(card(
        [("Mi pregunta no ten\u00eda respuesta.", 72, INK, "serif"),
         ("Estos n\u00fameros no miden violencia escolar. Miden denuncia. Donde "
          "denunciar cuesta caro, el conteo baja y la gravedad sube.", 33, INK2, "sans"),
         ("Loreto no tiene pocos casos. Tiene poca denuncia.", 37, S2, "sans")],
        kicker="Y AS\u00cd ME QUED\u00c9 SIN PREGUNTA",
        foot="Fuente: descarga p\u00fablica de S\u00edseVe, Minedu. Son alertas registradas, "
             "no casos confirmados: puede existir m\u00e1s de un reporte sobre un mismo caso.",
        top=470), 4.6)


def main():
    total = 0
    with imageio.get_writer(OUT, fps=FPS, codec="libx264", quality=8,
                            macro_block_size=1,
                            ffmpeg_params=["-pix_fmt", "yuv420p"]) as wr:
        def emit(img):
            nonlocal total
            wr.append_data(np.asarray(img))
            total += 1
        build(emit)
    print(f"{total} cuadros \u00b7 {total/FPS:.1f} s \u00b7 {W}x{H} @ {FPS}fps")
    print(f"-> {OUT}  ({OUT.stat().st_size/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
