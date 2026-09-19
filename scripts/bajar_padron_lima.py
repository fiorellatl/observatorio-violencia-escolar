# -*- coding: utf-8 -*-
"""
Descarga el padron de IIEE de Lima Metropolitana desde la API publica de ESCALE.

Reanudable: guarda por paginas en data/raw/padron_lima/ y salta las ya bajadas.
Va con pausa deliberada — es un servidor del Estado, no hay prisa.

    python scripts/bajar_padron_lima.py
"""
import json
import pathlib
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "raw" / "padron_lima"
CACHE.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "data" / "processed" / "padron_lima.json"

BASE = "https://escale.minedu.gob.pe/padron/rest/instituciones"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0"
UBIGEO = "1501"          # provincia de Lima
PAUSA = 0.45


def val(v):
    if isinstance(v, dict):
        v = v.get("$", "")
    return (v or "").strip()


def cuenta():
    u = f"{BASE}/cuenta?" + urllib.parse.urlencode({"ubigeo": UBIGEO})
    r = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "text/plain"})
    return int(urllib.request.urlopen(r, timeout=60).read().decode().strip())


def pagina(start):
    f = CACHE / f"{start:06d}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    u = BASE + "?" + urllib.parse.urlencode({"ubigeo": UBIGEO, "start": start})
    r = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "application/json"})
    d = json.loads(urllib.request.urlopen(r, timeout=90).read().decode("utf-8"))
    items = d.get("items", [])
    if isinstance(items, dict):
        items = [items]
    f.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    time.sleep(PAUSA)
    return items


def main():
    total = cuenta()
    print(f"{total} servicios educativos en Lima provincia", flush=True)
    filas = []
    for start in range(0, total + 50, 50):
        try:
            items = pagina(start)
        except Exception as e:
            print(f"  fallo en {start}: {e} — reintento en 5s", flush=True)
            time.sleep(5)
            try:
                items = pagina(start)
            except Exception as e2:
                print(f"  salto {start}: {e2}", flush=True)
                continue
        if not items:
            break
        for x in items:
            filas.append({
                "cm": val(x.get("codMod")), "cl": val(x.get("codlocal")),
                "n": val(x.get("cenEdu")), "ub": val(x.get("codgeo")),
                "g": val(x.get("gestion")), "d": val(x.get("dirCen")),
            })
        if start % 2500 == 0:
            print(f"  {start}/{total} ... {len(filas)} filas", flush=True)

    OUT.write_text(json.dumps(filas, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    locales = {f["cl"] for f in filas if f["cl"]}
    print(f"LISTO: {len(filas)} codigos modulares en {len(locales)} locales "
          f"-> {OUT.name} ({OUT.stat().st_size/1e6:.1f} MB)", flush=True)


if __name__ == "__main__":
    main()
