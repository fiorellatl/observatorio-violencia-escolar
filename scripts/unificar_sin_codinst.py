# -*- coding: utf-8 -*-
"""
Une en un solo colegio los servicios sin `codinst` que son, sin duda, el
mismo colegio.

    python scripts/unificar_sin_codinst.py             # diff, no escribe
    python scripts/unificar_sin_codinst.py --aplicar   # escribe

EL PROBLEMA
La regla del modelo (docs/MODELO-INSTITUCIONAL.md) es agrupar por `codinst`
y por nada mas: un servicio sin `codinst` se queda solo. Hay 858 asi, y el
padron de ESCALE confirma que no tienen codigo tampoco en origen. En 183
casos eso partia un colegio en dos: la primaria y la secundaria de «Padre
Iluminato» o de «Jose Granda» salian en el ranking como dos colegios.

LA EXCEPCION, Y POR QUE ES CONSERVADORA
El modelo prohibe agrupar por `codlocal` solo (un local aloja a veces un
CEBA y un colegio regular distintos) y por nombre solo (hay cientos de
colegios homonimos). Esta regla exige las dos cosas a la vez, y mas:

  1. ninguno de los servicios tiene `codinst`, ni en la capa ni en ESCALE;
  2. mismo `codlocal` (mismo local);
  3. mismo nombre OFICIAL de ESCALE, normalizado (tildes, mayusculas, espacios);
  4. mismo distrito y misma gestion en la capa publica;
  5. solo niveles de la educacion basica regular (inicial, primaria,
     secundaria): nunca un CEBA, un CEBE ni un CETPRO, que son otras
     instituciones aunque compartan edificio;
  6. ningun nivel repetido: dos primarias en un grupo no son un colegio.

Si algo falla, no se une. Preferimos un colegio partido a dos colegios
fundidos.

QUE TOCA
  institutions.json       las instituciones del grupo pasan a ser una, con
                          la misma construccion que construir_instituciones.py
                          (cabecera, suma de conteos, matricula, tasa)
  service-redirects.json  cada servicio absorbido redirige a la nueva ficha
No toca servicios, reportes, matricula, pension ni ningun otro fichero; al
terminar comprueba que la suma de reportes y alumnos no cambio.

Entrada: data/processed/servicios_sin_codinst.json (bajar_codlocal_sin_codinst.py)
"""
import argparse
import collections
import copy
import json
import pathlib
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"
sys.path.insert(0, str(ROOT / "scripts"))
from construir_instituciones import CLAVES_CONTEO, ORDEN_NIVEL, PRIORIDAD_CABECERA  # noqa: E402

REGULARES = {"Inicial no escolarizado", "Inicial - Cuna", "Inicial - Cuna-Jardín",
             "Inicial - Jardín", "Primaria", "Secundaria"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode()
    return " ".join(s.upper().replace(".", " ").split())


def construir(partes: list[dict], meta: dict, codinst: str | None = None) -> dict:
    """Una institucion a partir de varias de un solo servicio, con las
    mismas reglas que construir_instituciones.py."""
    servicios = [s for p in partes for s in p["servicios"]]
    cab_s = min(servicios, key=lambda s: (PRIORIDAD_CABECERA.get(s["nivel"], 99), s["cm"]))
    cab = next(p for p in partes if any(s["cm"] == cab_s["cm"] for s in p["servicios"]))
    servicios.sort(key=lambda s: (ORDEN_NIVEL.get(s["nivel"], 99), s["cm"]))

    anios = collections.defaultdict(lambda: collections.defaultdict(int))
    for s in servicios:
        for anio, c in s["anios"].items():
            for k, v in c.items():
                if k in CLAVES_CONTEO:
                    anios[anio][k] += int(v or 0)
    mats = [s.get("matricula") for s in servicios]
    completa = all(m for m in mats)
    matricula = sum(mats) if completa else None
    tasa = None
    if matricula and matricula >= meta["matricula_minima"]:
        tasa = round(anios.get(meta["anio_transversal"], {}).get("total", 0) / matricula * 1000, 2)

    nueva = copy.deepcopy(cab)
    nueva.update({
        "codinst": codinst,
        "niveles": [s["nivel"] for s in servicios],
        "total": sum(s["total"] for s in servicios),
        "anios": {a: dict(c) for a, c in sorted(anios.items())},
        "matricula": matricula,
        "matricula_completa": completa,
        "tasa_2024": tasa,
        "servicios": servicios,
    })
    if not codinst:
        # Se dice como se agrupo: no fue por codigo oficial.
        nueva["agrupacion"] = "codlocal_y_nombre"
    else:
        nueva.pop("agrupacion", None)
    return nueva


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true")
    a = ap.parse_args()

    inst = json.loads((PUB / "institutions.json").read_text(encoding="utf-8"))
    redir = json.loads((PUB / "service-redirects.json").read_text(encoding="utf-8"))
    meta = json.loads((PUB / "meta.json").read_text(encoding="utf-8"))
    escale = json.loads((ROOT / "data" / "processed" / "servicios_sin_codinst.json").read_text(encoding="utf-8"))

    candidatas = collections.defaultdict(list)
    descartes = collections.Counter()
    # PRIMERO, LA REGLA DEL MODELO. Algunos servicios si tienen `codinst` en
    # el padron de hoy: la capa se construyo antes. Esos se agrupan por
    # codigo oficial, con su institucion si ya existe, sin excepcion alguna.
    por_codinst = {i["codinst"]: i for i in inst.values() if i.get("codinst")}
    oficiales = collections.defaultdict(list)
    for slug, i in inst.items():
        if i.get("codinst") or len(i["servicios"]) != 1:
            continue
        e = escale.get(i["servicios"][0]["cm"]) or {}
        if e.get("codinst"):
            oficiales[e["codinst"]].append(i)

    for slug, i in inst.items():
        if i.get("codinst") or len(i["servicios"]) != 1:
            continue
        s = i["servicios"][0]
        e = escale.get(s["cm"]) or {}
        if e.get("codinst"):
            continue
        if not e.get("codlocal") or not e.get("nombre"):
            descartes["sin codlocal o nombre en ESCALE"] += 1
            continue
        candidatas[(e["codlocal"], norm(e["nombre"]), i["distrito"], i["gestion"])].append(i)

    grupos = []
    for clave, partes in candidatas.items():
        if len(partes) < 2:
            continue
        niveles = [p["servicios"][0]["nivel"] for p in partes]
        if not all(n in REGULARES for n in niveles):
            descartes["incluye CEBA, CEBE o CETPRO"] += 1
            continue
        if len(set(niveles)) != len(niveles):
            descartes["nivel repetido"] += 1
            continue
        grupos.append(partes)

    nuevo = dict(inst)
    nuevo_redir = dict(redir)
    unidos_oficial = 0
    for ci, sueltas in oficiales.items():
        base = por_codinst.get(ci)
        partes = ([base] if base else []) + sueltas
        if len(partes) < 2:
            # Un solo servicio con codigo nuevo: se anota el codigo y nada mas.
            nuevo[sueltas[0]["slug"]] = {**sueltas[0], "codinst": ci}
            continue
        niveles = [s["nivel"] for p in partes for s in p["servicios"]]
        if len(set(niveles)) != len(niveles):
            descartes["codinst oficial con nivel repetido"] += 1
            continue
        i = construir(partes, meta, codinst=ci)
        for p in partes:
            del nuevo[p["slug"]]
        nuevo[i["slug"]] = i
        unidos_oficial += 1
        for s in i["servicios"]:
            if s["slug"] != i["slug"]:
                nuevo_redir[s["slug"]] = [i["slug"], s["nivel"]]

    for partes in grupos:
        i = construir(partes, meta)
        for p in partes:
            del nuevo[p["slug"]]
        nuevo[i["slug"]] = i
        for s in i["servicios"]:
            if s["slug"] != i["slug"]:
                nuevo_redir[s["slug"]] = [i["slug"], s["nivel"]]
    # Ninguna redireccion puede apuntar a una ficha que dejo de existir.
    for k, (destino, nivel) in list(nuevo_redir.items()):
        if destino not in nuevo:
            nuevo_redir[k] = nuevo_redir.get(destino, [destino, nivel])

    # ── Comprobaciones: nada se pierde ni se duplica ───────────────────
    def suma(d, anio):
        return sum((x["anios"].get(anio) or {}).get("total", 0) for x in d.values())
    for anio in ("2024", "2025", "2026"):
        assert suma(inst, anio) == suma(nuevo, anio), f"cambió el total de reportes de {anio}"
    cms = lambda d: sorted(s["cm"] for x in d.values() for s in x["servicios"])
    assert cms(inst) == cms(nuevo), "cambió el conjunto de servicios"
    assert all(dest in nuevo for dest, _ in nuevo_redir.values()), "redirección huérfana"

    print(f"por codinst oficial: {unidos_oficial} · por local y nombre: {len(grupos)} · instituciones {len(inst)} → {len(nuevo)} · "
          f"redirecciones {len(redir)} → {len(nuevo_redir)}")
    print("descartes:", dict(descartes))
    for partes in sorted(grupos, key=lambda g: -sum(p["total"] for p in g))[:12]:
        print(f"  {partes[0]['nombre'][:38]:38} {partes[0]['distrito'][:20]:20} "
              f"{' + '.join(p['servicios'][0]['nivel'] for p in partes)}  ({sum(p['total'] for p in partes)} reportes)")

    if not a.aplicar:
        print("\n(diff: no se escribió nada; usa --aplicar)")
        return
    (PUB / "institutions.json").write_text(json.dumps(nuevo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (PUB / "service-redirects.json").write_text(json.dumps(nuevo_redir, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("escrito: institutions.json, service-redirects.json")


if __name__ == "__main__":
    main()
