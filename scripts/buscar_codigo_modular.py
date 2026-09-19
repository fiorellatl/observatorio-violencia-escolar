# -*- coding: utf-8 -*-
"""
Busca codigos modulares y codigos de local en el Padron de IIEE de ESCALE (Minedu).

    python scripts/buscar_codigo_modular.py "SACO OLIVEROS"
    python scripts/buscar_codigo_modular.py "INMACULADA" --ubigeo 150140
    python scripts/buscar_codigo_modular.py "CHAMPAGNAT" --csv salida.csv

API publica que usa el propio buscador de escale.minedu.gob.pe/padron-de-iiee.
Sin autenticacion. Pagina de 50 en 50 mediante el parametro `start`.

Un colegio suele tener VARIOS codigos modulares (uno por nivel educativo) y un
solo codigo de local (el campus). Por eso el resumen cuenta ambos por separado.
"""
import argparse
import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict

BASE = "https://escale.minedu.gob.pe/padron/rest/instituciones"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0"
CAMPOS = ["codMod", "codlocal", "cenEdu", "dirCen", "gestion", "codgeo", "codooii"]


def val(v):
    """La API devuelve unas veces el valor y otras {'$': valor}."""
    if isinstance(v, dict):
        v = v.get("$", "")
    return (v or "").strip()


def buscar(nombre, ubigeo=None, pausa=0.4, limite=1000):
    filas, start = [], 0
    while start < limite:
        q = {"nombreIE": nombre, "start": start}
        if ubigeo:
            q["ubigeo"] = ubigeo
        url = BASE + "?" + urllib.parse.urlencode(q)
        req = urllib.request.Request(url, headers={"User-Agent": UA,
                                                   "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode("utf-8"))
        items = data.get("items", [])
        if isinstance(items, dict):
            items = [items]
        if not items:
            break
        for x in items:
            filas.append({c: val(x.get(c)) for c in CAMPOS})
        if len(items) < 50:
            break
        start += 50
        time.sleep(pausa)      # el padron es de todos: sin prisa
    return filas


def main():
    ap = argparse.ArgumentParser(description="Busca codigos modulares en ESCALE")
    ap.add_argument("nombre", help="nombre o parte del nombre de la IE")
    ap.add_argument("--ubigeo", help="ubigeo del distrito, p. ej. 150140 (Santiago de Surco)")
    ap.add_argument("--csv", help="guardar el resultado en este archivo")
    a = ap.parse_args()

    filas = buscar(a.nombre, a.ubigeo)
    if not filas:
        print("Sin resultados.")
        return

    # agrupa por local: es lo mas parecido a "un colegio"
    por_local = defaultdict(list)
    for f in filas:
        por_local[f["codlocal"]].append(f)

    print(f'"{a.nombre}" -> {len(filas)} codigos modulares en '
          f'{len(por_local)} locales escolares\n')
    for local, grupo in sorted(por_local.items(), key=lambda kv: -len(kv[1])):
        g = grupo[0]
        print(f'  local {local or "(sin dato)"} · {g["cenEdu"][:46]}')
        print(f'    {g["dirCen"][:64]}  [{g["gestion"]}]')
        print(f'    codigos modulares: {", ".join(sorted(x["codMod"] for x in grupo))}\n')

    if a.csv:
        with open(a.csv, "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.DictWriter(fh, fieldnames=CAMPOS)
            w.writeheader()
            w.writerows(filas)
        print(f"-> {a.csv}  ({len(filas)} filas)")


if __name__ == "__main__":
    main()
