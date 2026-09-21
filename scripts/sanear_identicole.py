# -*- coding: utf-8 -*-
"""
Quita los datos personales del cache de fichas de Identicole.

La ficha publica de Identicole incluye el nombre del director, a veces su
correo y un telefono de contacto dentro de un bloque de JavaScript. El parser
nunca lee esos campos —solo extrae la lista blanca de CAMPOS—, pero eso no
justifica conservarlos en disco: el cache existe para no volver a descargar,
no para almacenar a personas identificables.

El cache no se puede borrar sin perder la reanudabilidad de 798 fichas ya
descargadas, asi que se sanea en el sitio.

QUE SE REDACTA
  - el valor de "Nombre del director"
  - direcciones de correo, salvo las institucionales del propio Minedu que
    forman parte del pie de pagina de la web
  - secuencias de 9 digitos asignadas a #phone en el script de contacto

QUE NO SE TOCA
  Todo lo demas, byte a byte. El script comprueba que `parsear()` devuelve
  exactamente lo mismo antes y despues; si algo cambia, aborta sin escribir.

    python scripts/sanear_identicole.py --probar   # verifica, no escribe
    python scripts/sanear_identicole.py            # sanea el cache
"""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "raw" / "identicole"

sys.path.insert(0, str(ROOT / "scripts"))
from bajar_identicole import parsear  # noqa: E402  (se importa tras fijar la ruta)

# Correos del propio portal: son institucionales y forman parte del pie.
INSTITUCIONALES = ("identicole@minedu.gob.pe", "webmaster@minedu.gob.pe")

# El lookbehind no cambia QUE se considera un correo: cambia DONDE puede
# empezar a buscarlo. Sin el, `[A-Za-z0-9._%+-]+` arranca en cada posicion de
# cada secuencia larga del JavaScript embebido y recorre el resto buscando una
# arroba que no esta: coste cuadratico sobre ficheros de 400 KB, 146 segundos
# en el peor. Exigiendo que el tramo local empiece donde empieza de verdad,
# solo se prueba una vez por secuencia.
#
# La equivalencia no se supone: se comprobo la salida de `sanear()` con una y
# con otra sobre las 798 fichas del cache, byte a byte. 798/798 identicas,
# 2.218 redacciones con cada una.
RE_EMAIL = re.compile(r"(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
RE_TELEFONO = re.compile(r"""(\$\(["']#phone["']\)\.val\(["'])(\d{6,12})(["']\))""")
RE_DIRECTOR = re.compile(
    r"""(Nombre\s+del\s+director\s*:?\s*</div>.*?<strong[^>]*>)(.*?)(</strong>)""",
    re.S | re.I,
)


def sanear(html: str) -> tuple[str, int]:
    tocados = 0

    def _email(m):
        nonlocal tocados
        if m.group().lower() in INSTITUCIONALES:
            return m.group()
        tocados += 1
        return "[redactado]"

    out = RE_EMAIL.sub(_email, html)

    def _tel(m):
        nonlocal tocados
        tocados += 1
        return m.group(1) + "[redactado]" + m.group(3)

    out = RE_TELEFONO.sub(_tel, out)

    def _dir(m):
        nonlocal tocados
        if not m.group(2).strip():
            return m.group()
        tocados += 1
        return m.group(1) + "[redactado]" + m.group(3)

    out = RE_DIRECTOR.sub(_dir, out)
    return out, tocados


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probar", action="store_true", help="verifica sin escribir")
    a = ap.parse_args()

    fichas = sorted(CACHE.glob("*.html"))
    if not fichas:
        print("no hay cache de Identicole")
        return

    cambiadas = redacciones = 0
    rotas = []

    for f in fichas:
        html = f.read_text(encoding="utf-8", errors="replace")
        limpio, n = sanear(html)
        if n == 0:
            continue

        # La comprobacion que hace esto seguro: el parser debe devolver
        # exactamente lo mismo. Si no, no se toca el archivo.
        antes, despues = parsear(html), parsear(limpio)
        if antes != despues:
            rotas.append(f.name)
            continue

        cambiadas += 1
        redacciones += n
        if not a.probar:
            f.write_text(limpio, encoding="utf-8")

    print(f"fichas en cache      : {len(fichas):,}")
    print(f"con datos personales : {cambiadas:,}")
    print(f"redacciones          : {redacciones:,}")
    print(f"parseo alterado      : {len(rotas)}")
    if rotas:
        print("  NO SE TOCARON:", rotas[:10])
    print("modo prueba, nada escrito" if a.probar else "cache saneado")


if __name__ == "__main__":
    main()
