# -*- coding: utf-8 -*-
"""
Cruza el ranking por NOMBRE de IE contra el Padron de ESCALE.

Responde una sola pregunta: cada fila de ese ranking, ¿es un colegio o es una red?

Un colegio tiene varios codigos modulares (uno por nivel) pero UN codigo de
local. Si un nombre devuelve muchos locales, esa fila esta sumando instituciones
distintas y no es comparable con las demas.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict

BASE = "https://escale.minedu.gob.pe/padron/rest/instituciones"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0"

# top 10 publicado por Victor Sausa (SiseVe Region Lima 2022-2026)
RANKING = [
    (1, "RICARDO BENTIN", 181, "Rímac"),
    (2, "NUESTRA SEÑORA DE LA MERCED", 180, "Ate / Huacho / Huaral"),
    (3, "NUESTRA SEÑORA DEL CARMEN", 167, "Huaral / Imperial"),
    (4, "SACO OLIVEROS", 148, "Ate / Cercado / Los Olivos"),
    (5, "SAN AGUSTIN", 147, "San Isidro / SJL / Barranca"),
    (6, "LICEO NAVAL ALMIRANTE GUISE", 136, "San Borja"),
    (7, "CHAMPAGNAT", 132, "Santiago de Surco"),
    (8, "SAN IGNACIO DE RECALDE", 108, "San Borja / Miraflores"),
    (9, "RICARDO PALMA", 98, "Surquillo"),
    (10, "MARIANO MELGAR", 98, "Breña / Independencia"),
]


def val(v):
    if isinstance(v, dict):
        v = v.get("$", "")
    return (v or "").strip()


def buscar(nombre, limite=2000):
    filas, start = [], 0
    while start < limite:
        url = BASE + "?" + urllib.parse.urlencode({"nombreIE": nombre, "start": start})
        req = urllib.request.Request(url, headers={"User-Agent": UA,
                                                   "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode("utf-8"))
        items = data.get("items", [])
        if isinstance(items, dict):
            items = [items]
        if not items:
            break
        filas += items
        if len(items) < 50:
            break
        start += 50
        time.sleep(0.35)
    return filas


def main():
    print(f'{"#":<3}{"nombre del ranking":<30}{"total":>6}{"cod.mod":>9}'
          f'{"locales":>9}   lectura')
    print("-" * 96)
    salida = []
    for pos, nombre, total, ambito in RANKING:
        filas = buscar(nombre)
        # solo los que empiezan por el nombre buscado: evita arrastrar
        # "MARIA INMACULADA" cuando se busca "INMACULADA"
        exactos = [f for f in filas if val(f.get("cenEdu")).upper().startswith(nombre[:14])]
        locales = {val(f.get("codlocal")) for f in exactos if val(f.get("codlocal"))}
        mods = {val(f.get("codMod")) for f in exactos if val(f.get("codMod"))}
        if len(locales) <= 1:
            lectura = "un colegio"
        elif len(locales) <= 3:
            lectura = f"{len(locales)} instituciones distintas"
        else:
            lectura = f"RED de {len(locales)} locales"
        print(f"{pos:<3}{nombre[:29]:<30}{total:>6}{len(mods):>9}{len(locales):>9}   {lectura}")
        salida.append({"pos": pos, "nombre": nombre, "total": total, "ambito": ambito,
                       "codmod": len(mods), "locales": len(locales), "lectura": lectura})

    out = (__import__("pathlib").Path(__file__).resolve().parents[1]
           / "data" / "processed" / "cruce_ranking_escale.json")
    out.write_text(json.dumps(salida, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n-> {out.name}")


if __name__ == "__main__":
    main()
