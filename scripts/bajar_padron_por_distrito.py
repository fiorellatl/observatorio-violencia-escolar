# -*- coding: utf-8 -*-
"""
Padron de IIEE de Lima Metropolitana, distrito por distrito.

La API REST de ESCALE devuelve vacios los campos `distrito`, `codgeo`,
`nivelModalidad` y `talumno`. La vuelta es consultar por ubigeo de distrito:
asi el distrito se conoce por construccion, no por el campo.

Reanudable. Pausa deliberada: es un servidor del Estado.
"""
import itertools
import json
import pathlib
import time
import unicodedata
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "raw" / "padron_dist"
CACHE.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "data" / "processed" / "padron_lima_dist.json"
GEO = ROOT / "data" / "raw" / "peru_distrital_simple.geojson"

BASE = "https://escale.minedu.gob.pe/padron/rest/instituciones"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0"
PAUSA = 0.4

ALIAS = {"MAGDALENA VIEJA": "Pueblo Libre", "LIMA": "Cercado de Lima"}


def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper().strip()


def bonito(s):
    if s in ALIAS:
        return ALIAS[s]
    chico = {"DE", "DEL", "LA", "EL", "Y"}
    return " ".join(w.capitalize() if (i == 0 or w not in chico) else w.lower()
                    for i, w in enumerate(s.split()))


def val(v):
    if isinstance(v, dict):
        v = v.get("$", "")
    return (v or "").strip()


def distritos_lima():
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    out = []
    for f in geo["features"]:
        idd = str(f["properties"].get("IDDIST", ""))
        if idd.startswith("1501"):
            out.append((idd, bonito(norm(f["properties"]["NOMBDIST"]))))
    return sorted(set(out))


def pagina(ubigeo, start):
    f = CACHE / f"{ubigeo}_{start:05d}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    u = BASE + "?" + urllib.parse.urlencode({"ubigeo": ubigeo, "start": start})
    r = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "application/json"})
    d = json.loads(urllib.request.urlopen(r, timeout=90).read().decode("utf-8"))
    items = d.get("items", [])
    if isinstance(items, dict):
        items = [items]
    f.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    time.sleep(PAUSA)
    return items


def main():
    dist = distritos_lima()
    print(f"{len(dist)} distritos de Lima", flush=True)
    filas = []
    for ubigeo, nombre in dist:
        start, n = 0, 0
        while True:
            try:
                items = pagina(ubigeo, start)
            except Exception as e:
                print(f"  {nombre} start={start} fallo: {e}", flush=True)
                time.sleep(4)
                try:
                    items = pagina(ubigeo, start)
                except Exception:
                    break
            if not items:
                break
            for x in items:
                filas.append({"cm": val(x.get("codMod")), "cl": val(x.get("codlocal")),
                              "ci": val(x.get("codinst")), "n": val(x.get("cenEdu")),
                              "g": val(x.get("gestion")), "dir": val(x.get("dirCen")),
                              "dist": nombre})
            n += len(items)
            if len(items) < 50:
                break
            start += 50
        print(f"  {nombre:26} {n:>5}", flush=True)

    OUT.write_text(json.dumps(filas, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    print(f"LISTO: {len(filas)} codigos modulares en "
          f"{len({f['cl'] for f in filas if f['cl']})} locales -> {OUT.name} "
          f"({OUT.stat().st_size/1e6:.1f} MB)", flush=True)


if __name__ == "__main__":
    main()
