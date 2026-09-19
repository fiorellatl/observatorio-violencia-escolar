# -*- coding: utf-8 -*-
"""
Baja matricula, docentes, secciones y nivel del padron de ESCALE.

El bloque `estadistica` solo aparece si se pide con `campos=estadistica`; sin ese
parametro la API devuelve el campo vacio. Cubre Lima Metropolitana (ubigeo 1501).
Reanudable, con pausa: es un servidor del Estado.

Salida: data/processed/escale_estadistica.json  {codMod(7): {...}}
"""
import json
import pathlib
import time
import unicodedata
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "raw" / "escale_est"
OUT = ROOT / "data" / "processed" / "escale_estadistica.json"
GEO = ROOT / "data" / "raw" / "peru_distrital_simple.geojson"
CACHE.mkdir(parents=True, exist_ok=True)

BASE = "https://escale.minedu.gob.pe/padron/rest/instituciones"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0"
ANIO_PADRON = "2026"
PAUSA = 0.4


def val(v):
    if isinstance(v, dict):
        v = v.get("$", "")
    return (v or "").strip()


def entero(v):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def distritos():
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    out = set()
    for f in geo["features"]:
        idd = str(f["properties"].get("IDDIST", ""))
        if idd.startswith("1501"):
            n = unicodedata.normalize("NFD", f["properties"]["NOMBDIST"])
            out.add((idd, "".join(c for c in n if unicodedata.category(c) != "Mn")))
    return sorted(out)


def pagina(ubigeo, start):
    f = CACHE / f"{ubigeo}_{start:05d}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    u = BASE + "?" + urllib.parse.urlencode(
        {"ubigeo": ubigeo, "start": start, "campos": "estadistica"})
    r = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "application/json"})
    d = json.loads(urllib.request.urlopen(r, timeout=90).read().decode("utf-8"))
    items = d.get("items", [])
    if isinstance(items, dict):
        items = [items]
    f.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    time.sleep(PAUSA)
    return items


def main():
    out = {}
    dist = distritos()
    print(f"{len(dist)} distritos", flush=True)
    for ubigeo, nombre in dist:
        start, n = 0, 0
        while True:
            try:
                items = pagina(ubigeo, start)
            except Exception as e:
                print(f"  {nombre} {start}: {e}", flush=True)
                time.sleep(4)
                try:
                    items = pagina(ubigeo, start)
                except Exception:
                    break
            if not items:
                break
            for x in items:
                cm = val(x.get("codMod")).zfill(7)
                e = x.get("estadistica") or {}
                if isinstance(e, list):
                    e = e[0] if e else {}
                if not cm or not e:
                    continue
                nm = e.get("nivelModalidad") or {}
                out[cm] = {
                    "talumno": entero(e.get("talumno")),
                    "tdocente": entero(e.get("tdocente")),
                    "tseccion": entero(e.get("tseccion")),
                    "totalh": entero(e.get("totalh")),
                    "totalm": entero(e.get("totalm")),
                    "nivel": nm.get("valor") if isinstance(nm, dict) else None,
                    # imputado=1 marca cifra estimada por el Minedu, no medida
                    "imputado": val(e.get("imputado")) == "1",
                    "anio": ANIO_PADRON,
                }
            n += len(items)
            if len(items) < 50:
                break
            start += 50
        print(f"  {nombre:26} {n:>5}", flush=True)

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    con = sum(1 for v in out.values() if v["talumno"])
    print(f"LISTO: {len(out):,} codigos · {con:,} con matricula -> {OUT.name}", flush=True)


if __name__ == "__main__":
    main()
