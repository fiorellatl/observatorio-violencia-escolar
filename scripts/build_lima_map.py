# -*- coding: utf-8 -*-
"""
Prepara el mapa distrital de Lima Metropolitana coloreado por UGEL.

Cruza tres fuentes:
  1. Geometria distrital del Peru (ubigeo IDDIST), repo publico peru-geojson.
  2. Jurisdiccion de cada UGEL de Lima, publicada por la DRELM.
  3. Reportes por UGEL, de la descarga publica de SiseVe.

IMPORTANTE: el dato es de la UGEL, no del distrito. Todos los distritos de una
misma UGEL se pintan igual porque comparten el mismo numero: SiseVe no publica
nada por debajo de la UGEL. El mapa hace visible esa resolucion, no la disimula.

Salida: data/processed/lima_ugel_map.json
"""
import itertools
import json
import pathlib
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[1]
GEO = ROOT / "data" / "raw" / "peru_distrital_simple.geojson"
OUT = ROOT / "data" / "processed" / "lima_ugel_map.json"

# --- jurisdiccion DRELM: los 43 distritos de Lima Metropolitana ---
# "MAGDALENA VIEJA" es el nombre registral de Pueblo Libre.
UGEL_DISTRITOS = {
    "UGEL 01 San Juan de Miraflores": [
        "LURIN", "PACHACAMAC", "PUCUSANA", "PUNTA HERMOSA", "PUNTA NEGRA",
        "SAN BARTOLO", "SAN JUAN DE MIRAFLORES", "SANTA MARIA DEL MAR",
        "VILLA EL SALVADOR", "VILLA MARIA DEL TRIUNFO"],
    "UGEL 02 Rímac": [
        "RIMAC", "INDEPENDENCIA", "LOS OLIVOS", "SAN MARTIN DE PORRES"],
    "UGEL 03 Cercado": [
        "BRENA", "LIMA", "JESUS MARIA", "LA VICTORIA", "LINCE",
        "MAGDALENA DEL MAR", "MAGDALENA VIEJA", "SAN ISIDRO", "SAN MIGUEL"],
    "UGEL 04 Comas": [
        "ANCON", "CARABAYLLO", "COMAS", "PUENTE PIEDRA", "SANTA ROSA"],
    "UGEL 05 San Juan de Lurigancho": [
        "SAN JUAN DE LURIGANCHO", "EL AGUSTINO"],
    "UGEL 06 Ate": [
        "ATE", "CHACLACAYO", "CIENEGUILLA", "LA MOLINA", "LURIGANCHO",
        "SANTA ANITA"],
    "UGEL 07 San Borja": [
        "BARRANCO", "CHORRILLOS", "MIRAFLORES", "SAN BORJA", "SAN LUIS",
        "SANTIAGO DE SURCO", "SURQUILLO"],
}

# nombre bonito para mostrar, cuando el registral despista
ALIAS = {"MAGDALENA VIEJA": "Pueblo Libre", "LIMA": "Cercado de Lima",
         "BRENA": "Breña", "RIMAC": "Rímac", "LURIGANCHO": "Lurigancho-Chosica"}


def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper().strip()


def titlecase(s):
    if s in ALIAS:
        return ALIAS[s]
    chico = {"DE", "DEL", "LA", "EL", "Y"}
    out = []
    for i, w in enumerate(s.split()):
        out.append(w.capitalize() if (i == 0 or w not in chico) else w.lower())
    return " ".join(out)


def rings(geom):
    if geom["type"] == "Polygon":
        return geom["coordinates"]
    return list(itertools.chain.from_iterable(geom["coordinates"]))


def main():
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    lima = [f for f in geo["features"]
            if str(f["properties"].get("IDDIST", "")).startswith("1501")]

    d2u = {norm(d): u for u, ds in UGEL_DISTRITOS.items() for d in ds}
    assert len(d2u) == 43, f"la jurisdiccion DRELM deberia cubrir 43 distritos, cubre {len(d2u)}"

    # reportes por UGEL, del scraper
    ug = json.loads((ROOT / "data" / "processed" / "ugeles.json").read_text(encoding="utf-8"))
    total = {r[0]: r[2] for r in ug}

    faltan_geo, feats = [], []
    for f in lima:
        nombre = f["properties"]["NOMBDIST"]
        u = d2u.get(norm(nombre))
        assert u, f"distrito sin UGEL asignada: {nombre}"
        if not f["geometry"]:
            faltan_geo.append(nombre)
            continue
        feats.append({"d": titlecase(norm(nombre)), "u": u,
                      "n": total[u], "rings": rings(f["geometry"])})

    # proyeccion equirectangular corregida por latitud, a una caja 0..1000
    pts = [p for f in feats for r in f["rings"] for p in r]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    import math
    k = math.cos(math.radians((y0 + y1) / 2))
    w, h = (x1 - x0) * k, (y1 - y0)
    scale = 1000.0 / max(w, h)
    VW, VH = round(w * scale, 1), round(h * scale, 1)

    def proj(p):
        return [round((p[0] - x0) * k * scale, 1),
                round(VH - (p[1] - y0) * scale, 1)]

    out = {"viewBox": [0, 0, VW, VH],
           "sinGeometria": [titlecase(norm(n)) for n in faltan_geo],
           "ugeles": sorted({f["u"] for f in feats}),
           "distritos": [{"d": f["d"], "u": f["u"], "n": f["n"],
                          "p": [[proj(p) for p in r] for r in f["rings"]]}
                         for f in feats]}

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(feats)} distritos con geometria, {len(faltan_geo)} sin ella: {faltan_geo}")
    print(f"viewBox {VW} x {VH} · {OUT.stat().st_size/1024:.1f} KB")
    for u in out["ugeles"]:
        print(f"  {u:34} {total[u]:>6} reportes")


if __name__ == "__main__":
    main()
