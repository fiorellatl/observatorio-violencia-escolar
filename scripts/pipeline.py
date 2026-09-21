# -*- coding: utf-8 -*-
"""
El pipeline de datos, en un solo sitio.

POR QUE EXISTE
Hasta ahora la cadena vivia en la cabeza de quien la habia corrido. Son seis
pasos con un orden que importa, repartidos en scripts que no se conocen entre
si, y con una trampa: `data/public/` es a la vez SALIDA del primer paso y
ENTRADA de los tres ultimos. Volver a ejecutar el ETL sobrescribe el
directorio y deshace, en silencio, el denominador del Censo 2024 y la capa
institucional. No falla; simplemente el sitio pasa a servir datos viejos.

El dia que llegue la tanda de SiseVe del ano que viene, eso hay que saberlo
sin reconstruirlo de memoria.

QUE HACE
  --check (por defecto)  No escribe nada. Dice que pasos estan al dia, cuales
                         quedaron obsoletos y que fuentes externas faltan.
  --run                  Ejecuta en orden y para en el primer fallo.
  --desde <paso>         Reanuda desde ahi, para no repetir lo caro.

LA COMPROBACION QUE IMPORTA
Un paso esta OBSOLETO cuando alguna de sus entradas es mas reciente que su
salida. Es una regla tonta y es justo la que faltaba: convierte en visible el
unico fallo que este pipeline produce de verdad, que es silencioso.

    python scripts/pipeline.py
    python scripts/pipeline.py --run --desde denominador
"""
import argparse
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"
PROC = ROOT / "data" / "processed"
RAW = ROOT / "data" / "raw"


class Paso:
    def __init__(self, nombre, descripcion, comando, entradas, salidas, externa=None, nota=None):
        self.nombre = nombre
        self.descripcion = descripcion
        self.comando = comando
        self.entradas = entradas
        self.salidas = salidas
        # Fichero que hay que conseguir a mano: no lo baja este pipeline.
        self.externa = externa
        self.nota = nota


# El orden de esta lista ES el orden del pipeline. No hay otro sitio donde
# esté escrito, y por eso cada paso declara lo que lee y lo que escribe: la
# comprobación de obsolescencia sale de ahí, no de una tabla aparte que
# habría que mantener en paralelo.
PASOS = [
    Paso(
        "etl",
        "Base privada -> capa publica agregada. La puerta de anonimizacion.",
        [sys.executable, "scripts/build_public_data.py", "--fuente", str(RAW / "EstadisticaExcel.xlsx")],
        entradas=[RAW / "EstadisticaExcel.xlsx"],
        salidas=[PUB / "schools_detail.json", PUB / "meta.json", PUB / "national.json"],
        externa=RAW / "EstadisticaExcel.xlsx",
        nota="Reescribe data/public entero: deshace los pasos 3 y 4, que hay que repetir despues.",
    ),
    Paso(
        "padron",
        "Numero de alumnos 2024 del Censo Educativo, por codigo modular.",
        [sys.executable, "scripts/padron_censo_2024.py"],
        entradas=[],
        salidas=[PROC / "padron_censo_2024.json"],
        externa=PROC / "padron_censo_2024.json",
        nota="Necesita 00_Padron.zip de ESCALE: python scripts/padron_censo_2024.py --zip <ruta>",
    ),
    Paso(
        "denominador",
        "Sustituye el denominador de la tasa por el del mismo anio y regenera cross.",
        [sys.executable, "scripts/aplicar_denominador_2024.py"],
        entradas=[PUB / "schools_detail.json", PROC / "padron_censo_2024.json"],
        salidas=[PUB / "cross_2024.json"],
        nota="Modifica schools_detail.json en el sitio; por eso su salida declarada es cross.",
    ),
    Paso(
        "instituciones",
        "Agrupa servicios en instituciones: institutions, redirecciones y facetas.",
        [sys.executable, "scripts/construir_instituciones.py"],
        entradas=[PUB / "schools_detail.json", PROC / "padron_censo_2024.json", PROC / "padron_nacional.json"],
        salidas=[PUB / "institutions.json", PUB / "service-redirects.json", PUB / "facetas.json"],
    ),
    Paso(
        "senales",
        "Detector de cambios en el registro de reportes.",
        [sys.executable, "scripts/build_signals.py"],
        entradas=[PUB / "schools_detail.json"],
        salidas=[PUB / "signals.json"],
    ),
    Paso(
        "portada",
        "Imagen 1200x627 para las previsualizaciones de enlace.",
        [sys.executable, "scripts/build_og_image.py"],
        entradas=[PUB / "meta.json", PUB / "national.json", PUB / "institutions.json"],
        salidas=[ROOT / "public" / "og.png"],
    ),
    Paso(
        "privacidad",
        "Ningun campo personal en lo que se publica. El build ya lo corre.",
        ["node", "scripts/validate-public.mjs"],
        entradas=[PUB / "schools_detail.json", PUB / "institutions.json"],
        salidas=[],
    ),
]


def rel(p):
    try:
        return str(p.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        return str(p)


def estado(paso):
    """Al dia, obsoleto, sin salida o bloqueado por una fuente que falta."""
    faltan = [e for e in paso.entradas if not e.exists()]
    if paso.externa is not None and not paso.externa.exists():
        return "bloqueado", [rel(paso.externa)]
    if faltan:
        return "bloqueado", [rel(f) for f in faltan]
    if not paso.salidas:
        return "sin-salida", []
    ausentes = [s for s in paso.salidas if not s.exists()]
    if ausentes:
        return "pendiente", [rel(a) for a in ausentes]

    masReciente = max((s.stat().st_mtime for s in paso.salidas), default=0)
    viejas = [rel(e) for e in paso.entradas if e.stat().st_mtime > masReciente]
    return ("obsoleto", viejas) if viejas else ("al-dia", [])


SIMBOLO = {
    "al-dia": "OK ",
    "obsoleto": "!! ",
    "pendiente": ".. ",
    "bloqueado": "XX ",
    "sin-salida": "-- ",
}


def comprobar():
    print("PIPELINE DE DATOS\n")
    problemas = 0
    for i, paso in enumerate(PASOS, 1):
        est, detalle = estado(paso)
        print(f"{SIMBOLO[est]}{i}. {paso.nombre:<14} {est}")
        print(f"       {paso.descripcion}")
        if est == "obsoleto":
            problemas += 1
            print(f"       Su salida es mas vieja que: {', '.join(detalle)}")
            print(f"       Arreglo: python scripts/pipeline.py --run --desde {paso.nombre}")
        elif est == "bloqueado":
            print(f"       Falta: {', '.join(detalle)}")
            if paso.nota:
                print(f"       {paso.nota}")
        elif est == "pendiente":
            problemas += 1
            print(f"       Nunca se ha generado: {', '.join(detalle)}")
        print()

    if problemas:
        print(f"{problemas} paso(s) que revisar.")
    else:
        print("Todo al dia.")
    return 1 if problemas else 0


def ejecutar(desde):
    nombres = [p.nombre for p in PASOS]
    if desde and desde not in nombres:
        print(f"No existe el paso '{desde}'. Son: {', '.join(nombres)}")
        return 2
    arranque = nombres.index(desde) if desde else 0

    for paso in PASOS[arranque:]:
        est, detalle = estado(paso)
        if est == "bloqueado":
            print(f"\nXX {paso.nombre}: falta {', '.join(detalle)}")
            if paso.nota:
                print(f"   {paso.nota}")
            print("   Se para aqui: seguir daria datos a medias.")
            return 1

        print(f"\n>> {paso.nombre}  {paso.descripcion}")
        if paso.nota:
            print(f"   {paso.nota}")
        r = subprocess.run(paso.comando, cwd=ROOT)
        if r.returncode != 0:
            print(f"\nXX {paso.nombre} fallo con codigo {r.returncode}. Se para aqui.")
            return r.returncode

    print("\nPipeline completo.")
    return comprobar()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run", action="store_true", help="ejecuta el pipeline (por defecto solo comprueba)")
    ap.add_argument("--desde", metavar="PASO", help="reanuda desde este paso")
    a = ap.parse_args()
    sys.exit(ejecutar(a.desde) if a.run else comprobar())


if __name__ == "__main__":
    main()
