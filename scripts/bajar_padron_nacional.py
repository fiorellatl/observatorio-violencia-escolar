# -*- coding: utf-8 -*-
"""
Padron nacional de IIEE desde ESCALE, distrito por distrito.

    GET https://escale.minedu.gob.pe/padron/rest/instituciones
        ?ubigeo=<6 digitos>&start=<n>&campos=estadistica

Una sola llamada entrega todo lo que necesita el modelo institucional:

    codinst   -> institucion educativa (agrupa Primaria + Secundaria + Inicial)
    codMod    -> servicio educativo
    anexo     -> desambigua servicios que comparten codigo modular
    codlocal  -> local educativo (se guarda como referencia, NO agrupa)
    estadistica -> matricula, docentes, secciones
    area, coordenadas, gestion, nivel, turno

LISTA BLANCA
------------
El payload de ESCALE incluye datos personales de adultos identificables:
`director` (71.6% de las filas), `telefono` (56.9%), `email`, `promotor`,
`rzsocial` y `nroruc`. Nada de eso entra al producto.

El filtro se aplica en `extraer()`, ANTES de escribir el cache: los campos
personales no llegan a tocar el disco en ningun momento. Es lista blanca y no
lista negra a proposito: con lista negra, cualquier campo nuevo que agregue el
Minedu entraria solo, y el dia que eso pase nadie se va a enterar.

    python scripts/bajar_padron_nacional.py                 # los 1,834 distritos
    python scripts/bajar_padron_nacional.py --ubigeo 150101 # uno solo, para probar

Reanudable: cachea cada pagina ya filtrada en data/raw/padron_nacional/.
Pausa deliberada entre peticiones: es un servidor del Estado.
"""
import argparse
import json
import pathlib
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "raw" / "padron_nacional"
OUT = ROOT / "data" / "processed" / "padron_nacional.json"
GEO = ROOT / "data" / "raw" / "peru_distrital_simple.geojson"
CACHE.mkdir(parents=True, exist_ok=True)

BASE = "https://escale.minedu.gob.pe/padron/rest/instituciones"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0"
PAUSA = 0.4
ANIO_PADRON = "2026"          # el padron vigente; la API no expone años anteriores
POR_PAGINA = 50

# Campos personales. No se guardan nunca. La lista existe para que la
# validacion pueda afirmar explicitamente que ninguno sobrevivio.
PROHIBIDOS = ("director", "telefono", "email", "promotor", "rzsocial", "nroruc")


def val(v):
    """Los catalogos de ESCALE llegan como {idCodigo, orden, valor}."""
    if isinstance(v, dict):
        return (v.get("valor") or v.get("$") or "").strip() or None
    return (str(v).strip() or None) if v is not None else None


def entero(v):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def flotante(v):
    try:
        f = float(str(v).strip())
    except (TypeError, ValueError):
        return None
    return f if f != 0.0 else None


def extraer(r: dict, ubigeo: str) -> dict | None:
    """
    LA LISTA BLANCA. Lo que no se nombra aqui, no existe aguas abajo.
    """
    cm = (val(r.get("codMod")) or "").zfill(7)
    if not cm or cm == "0000000":
        return None

    e = r.get("estadistica") or {}
    if isinstance(e, list):
        e = e[0] if e else {}

    d = {
        # --- identidad ---
        "cm": cm,
        "anexo": (val(r.get("anexo")) or "0"),
        "codinst": val(r.get("codinst")),
        "codlocal": val(r.get("codlocal")),
        "nombre": val(r.get("cenEdu")),
        # --- clasificacion ---
        "nivel": val(r.get("nivelModalidad")),
        "gestion": val(r.get("gestion")),
        "gestion_dep": val(r.get("gestionDependencia")),
        "forma": val(r.get("forma")),
        "genero": val(r.get("genero")),
        "turno": val(r.get("turno")),
        "area": val(r.get("area")),
        "estado": val(r.get("estado")),
        # --- territorio ---
        "ubigeo": ubigeo,
        "ugel": None,
        "dre": None,
        # --- geo (para el mapa; es la ubicacion del colegio, no de nadie) ---
        "lat": flotante(r.get("nlatIE")),
        "lon": flotante(r.get("nlongIE")),
    }

    u = r.get("ugel")
    if isinstance(u, dict):
        d["ugel"] = val(u.get("nombreUgel"))
        dre = u.get("direccionRegional")
        if isinstance(dre, dict):
            d["dre"] = val(dre.get("nombreDre"))

    if e:
        d.update({
            "matricula": entero(e.get("talumno")),
            "docentes": entero(e.get("tdocente")),
            "secciones": entero(e.get("tseccion")),
            "alumnos_h": entero(e.get("totalh")),
            "alumnos_m": entero(e.get("totalm")),
            # Se guarda el codigo tal cual. No documentamos que significa "2"
            # porque no lo sabemos: inventar la semantica seria peor que no tenerla.
            "imputado_cod": val(e.get("imputado")),
            "anio_estadistica": ANIO_PADRON,
        })

    return d


def distritos(solo: str | None = None):
    """Los 1,834 distritos del Peru, del geojson del INEI."""
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    out = set()
    for f in geo["features"]:
        p = f["properties"]
        idd = str(p.get("IDDIST", "")).zfill(6)
        if not idd or idd == "000000":
            continue
        if solo and idd != solo:
            continue
        nom = unicodedata.normalize("NFD", f"{p['NOMBDIST']}, {p['NOMBDEP']}")
        out.add((idd, "".join(c for c in nom if unicodedata.category(c) != "Mn")))
    return sorted(out)


def pagina(ubigeo: str, start: int) -> list:
    """Una pagina, ya filtrada. Lo que se cachea es la salida de extraer()."""
    f = CACHE / f"{ubigeo}_{start:05d}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))

    u = BASE + "?" + urllib.parse.urlencode(
        {"ubigeo": ubigeo, "start": start, "campos": "estadistica"})
    req = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "application/json"})
    crudo = json.loads(urllib.request.urlopen(req, timeout=90).read().decode("utf-8"))

    items = crudo.get("items", [])
    if isinstance(items, dict):
        items = [items]

    limpio = [x for x in (extraer(r, ubigeo) for r in items) if x]
    # `completa` distingue "pagina llena" de "ultima pagina" aunque extraer()
    # haya descartado filas: sin esto, una fila invalida cortaria la paginacion.
    f.write_text(json.dumps({"n": len(items), "items": limpio}, ensure_ascii=False),
                 encoding="utf-8")
    time.sleep(PAUSA)
    return {"n": len(items), "items": limpio}


def leer(ubigeo: str, start: int) -> dict:
    d = pagina(ubigeo, start)
    # compatibilidad con paginas cacheadas como lista plana
    return d if isinstance(d, dict) else {"n": len(d), "items": d}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ubigeo", help="un solo distrito, para probar")
    a = ap.parse_args()

    dist = distritos(a.ubigeo)
    print(f"{len(dist)} distritos", flush=True)

    out, fallos = {}, []
    for i, (ubigeo, nombre) in enumerate(dist, 1):
        start, n = 0, 0
        while True:
            try:
                d = leer(ubigeo, start)
            except Exception as exc:
                print(f"  !! {nombre} start={start}: {exc}", flush=True)
                time.sleep(4)
                try:
                    d = leer(ubigeo, start)
                except Exception:
                    fallos.append((ubigeo, start))
                    break
            for x in d["items"]:
                out[f"{x['cm']}-{x['anexo']}"] = x
            n += d["n"]
            if d["n"] < POR_PAGINA:
                break
            start += POR_PAGINA

        if i % 50 == 0 or a.ubigeo:
            print(f"  [{i}/{len(dist)}] {nombre:38} {n:>5} servicios · "
                  f"acumulado {len(out):,}", flush=True)
            OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                           encoding="utf-8")

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")

    con_mat = sum(1 for v in out.values() if v.get("matricula"))
    con_ci = sum(1 for v in out.values() if v.get("codinst"))
    print(f"\nLISTO: {len(out):,} servicios · {con_ci:,} con codinst · "
          f"{con_mat:,} con matricula -> {OUT.name}", flush=True)
    if fallos:
        print(f"paginas fallidas ({len(fallos)}): {fallos[:10]}", flush=True)
        print("vuelve a correr el script: solo reintenta lo que falta.", flush=True)


if __name__ == "__main__":
    main()
