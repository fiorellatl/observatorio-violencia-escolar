# -*- coding: utf-8 -*-
"""
ETL: base privada -> capa publica agregada.

Esta es la PUERTA DE ANONIMIZACION del pipeline. Todo lo que sale de aqui puede
publicarse; nada de lo que entra puede. En concreto, estas columnas de la base
de Transparencia NO cruzan esta funcion:

    AGREDIDO_EDAD, AGREDIDO_SEXO, AGREDIDO_GRADO, AGREDIDO_TURNO,
    AGREDIDO_IDIOMA, AGREDIDO_RELACION_ACTOR, SUPUESTO_AGRESOR_SEXO,
    SUPUESTO_AGRESOR_EDAD, SUPUESTO_AGRESOR_RELACION_ACTOR, MOTIVO_VIOLENCIA,
    FRECUENCIA, CODIGO_UNICO, FECHA_REPORTE (dia)

Se agrega a (colegio x anio x tipo de violencia x tipo de reporte). La fecha se
reduce a anio: un dia exacto mas un colegio con nombre es reidentificante.

    python scripts/build_public_data.py --fuente <ruta del xlsx>

Salida: data/public/*.json
"""
import argparse
import json
import pathlib
import re
import unicodedata
from collections import defaultdict

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "public"
PADRON = ROOT / "data" / "processed" / "padron_lima_dist.json"

# columnas que jamas se leen de la fuente
PROHIBIDAS = {
    "AGREDIDO_EDAD", "AGREDIDO_SEXO", "AGREDIDO_GRADO", "AGREDIDO_TURNO",
    "AGREDIDO_IDIOMA", "AGREDIDO_RELACION_ACTOR", "SUPUESTO_AGRESOR_SEXO",
    "SUPUESTO_AGRESOR_EDAD", "SUPUESTO_AGRESOR_RELACION_ACTOR",
    "MOTIVO_VIOLENCIA", "FRECUENCIA", "CODIGO_UNICO",
}

ANIOS_PANDEMIA = {"2020", "2021"}
ANIO_TRANSVERSAL = "2024"          # unico anio con reportes + matricula + pension
# Piso de matricula para calcular una tasa por 1,000. Por debajo, un solo
# reporte mueve la tasa decenas de puntos y el numero deja de significar nada:
# la fuente trae codigos modulares con 1-4 alumnos registrados que producen
# tasas de 1,000 a 4,500 por mil. No son colegios violentos: son denominadores rotos.
MATRICULA_MINIMA = 100
VIOLENCIA = {"Psicológica": "psicologica", "Física": "fisica", "Sexual": "sexual"}
BULLYING = {"Acoso escolar": "bullying", "Ciber acoso": "ciberacoso"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").strip()


def slugify(nombre: str, distrito: str, cod: str) -> str:
    """Slug legible y estable. Lleva el codigo modular porque los nombres se repiten."""
    base = f"{norm(nombre)}-{norm(distrito)}".lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")[:70]
    return f"{base}-{cod}"


def titulo(s: str) -> str:
    chico = {"de", "del", "la", "las", "el", "los", "y", "en"}
    out = []
    for i, w in enumerate(str(s or "").split()):
        lw = w.lower()
        out.append(w.capitalize() if (i == 0 or lw not in chico) else lw)
    return " ".join(out)


def cargar_matricula():
    """codigo modular -> matricula y docentes, del padron de ESCALE (solo Lima)."""
    if not PADRON.exists():
        return {}
    # el padron descargado no trae estadistica; se completa en una pasada aparte.
    est = ROOT / "data" / "processed" / "escale_estadistica.json"
    if not est.exists():
        return {}
    return {k: v for k, v in json.loads(est.read_text(encoding="utf-8")).items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fuente", required=True, help="xlsx de SiseVe por Transparencia")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    wb = openpyxl.load_workbook(a.fuente, read_only=True)
    ws = wb["ReporteCasos"]
    it = ws.iter_rows(values_only=True)
    hdr = [str(h) for h in next(it)]
    idx = {h: i for i, h in enumerate(hdr)}

    usadas = [c for c in hdr if c not in PROHIBIDAS]
    print("columnas leidas   :", ", ".join(usadas))
    print("columnas omitidas :", ", ".join(c for c in hdr if c in PROHIBIDAS))
    print()

    escuelas = {}
    agg = defaultdict(lambda: defaultdict(int))        # (cm, anio) -> contadores
    nacional = defaultdict(lambda: defaultdict(int))   # anio -> contadores
    n = 0

    for r in it:
        if not r[0]:
            continue
        n += 1
        cm_raw = r[idx["CODIGO_MODULAR"]]
        if cm_raw is None:
            continue
        cm = str(cm_raw).strip().zfill(7)              # <- join key, siempre 7
        anio = str(r[idx["FECHA_REPORTE"]])[:4]        # <- solo anio, nunca el dia
        tv = r[idx["TIPO_VIOLENCIA"]]
        st = r[idx["SUBTIPO_VIOLENCIA"]]
        tr = r[idx["TIPO_REPORTE"]]

        if cm not in escuelas:
            escuelas[cm] = {
                "cm": cm,
                "nombre": titulo(r[idx["INSTITUCION_EDUCATIVA"]]),
                "distrito": titulo(r[idx["DISTRITO"]]),
                "provincia": titulo(r[idx["PROVINCIA"]]),
                "departamento": titulo(r[idx["REGION"]]),
                "gestion": titulo(r[idx["TIPO_GESTION"]]),
                "nivel": r[idx["NIVEL_EDUCATIVO"]],
                "dre": r[idx["DRE"]],
                "ugel": r[idx["UGEL"]],
            }

        for bucket in (agg[(cm, anio)], nacional[anio]):
            bucket["total"] += 1
            k = VIOLENCIA.get(tv)
            if k:
                bucket[k] += 1
            b = BULLYING.get(st)
            if b:
                bucket[b] += 1
            if tr == "Personal IE a Escolares":
                bucket["personal_ie"] += 1
            else:
                bucket["entre_escolares"] += 1

    print(f"{n:,} reportes leidos · {len(escuelas):,} colegios")

    # ---- reportes por colegio y anio ----
    por_colegio = defaultdict(dict)
    for (cm, anio), c in agg.items():
        por_colegio[cm][anio] = dict(c)

    # ---- matricula, si esta disponible ----
    mat = cargar_matricula()
    print(f"{len(mat):,} colegios con matricula de ESCALE")

    # ---- indice de busqueda + ficha ----
    indice, fichas = [], {}
    for cm, e in escuelas.items():
        anios = por_colegio[cm]
        total = sum(v["total"] for v in anios.values())
        slug = slugify(e["nombre"], e["distrito"], cm)
        m = mat.get(cm)

        tasa = None
        if m and (m.get("talumno") or 0) >= MATRICULA_MINIMA:
            r24 = anios.get(ANIO_TRANSVERSAL, {}).get("total", 0)
            tasa = round(r24 / m["talumno"] * 1000, 2)

        indice.append({
            "s": slug, "n": e["nombre"], "cm": cm, "d": e["distrito"],
            "p": e["provincia"], "r": e["departamento"], "g": e["gestion"],
            "nv": e["nivel"], "t": total,
        })
        fichas[slug] = {
            **e, "slug": slug, "total": total, "anios": anios,
            "matricula": (m or {}).get("talumno"),
            "docentes": (m or {}).get("tdocente"),
            "secciones": (m or {}).get("tseccion"),
            "anio_matricula": (m or {}).get("anio"),
            "tasa_2024": tasa,
        }

    indice.sort(key=lambda x: -x["t"])

    # ---- serie nacional ----
    serie = [{"anio": y, **dict(c), "pandemia": y in ANIOS_PANDEMIA}
             for y, c in sorted(nacional.items())]

    # ---- corte transversal 2024: solo colegios con matricula ----
    cross = [{
        "slug": f["slug"], "nombre": f["nombre"], "distrito": f["distrito"],
        "gestion": f["gestion"], "nivel": f["nivel"],
        "matricula": f["matricula"], "reportes": f["anios"].get(ANIO_TRANSVERSAL, {}).get("total", 0),
        "tasa": f["tasa_2024"],
    } for f in fichas.values() if f["matricula"] and f["tasa_2024"] is not None]

    meta = {
        "corte": "2026-08-31",
        "generado": __import__("datetime").date.today().isoformat(),
        "reportes": n,
        "colegios": len(escuelas),
        "anio_min": min(nacional), "anio_max": max(nacional),
        "anio_transversal": ANIO_TRANSVERSAL,
        "anios_pandemia": sorted(ANIOS_PANDEMIA),
        "matricula_minima": MATRICULA_MINIMA,
        "anio_parcial": max(nacional),
        "fuentes": {
            "reportes": {"nombre": "SíseVe – MINEDU", "anio": f"{min(nacional)}–{max(nacional)}",
                         "via": "Solicitud de acceso a la información pública"},
            "matricula": {"nombre": "Padrón de IIEE – ESCALE", "anio": "2026",
                          "via": "API pública escale.minedu.gob.pe/padron/rest"},
        },
    }

    # Indice compacto para el buscador del navegador: arrays, no objetos, y sin
    # el slug (se recalcula en el cliente con la misma funcion). Se sirve como
    # archivo estatico desde public/ y se descarga solo al primer tecleo.
    compacto = [[e["nombre"], e["distrito"], e["departamento"], cm,
                 por_colegio[cm] and sum(v["total"] for v in por_colegio[cm].values())]
                for cm, e in escuelas.items()]
    compacto.sort(key=lambda r: -r[4])
    pub_web = ROOT / "public" / "data"
    pub_web.mkdir(parents=True, exist_ok=True)
    idxp = pub_web / "search-index.json"
    idxp.write_text(json.dumps(compacto, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")
    print(f"  -> public/data/{idxp.name:11} {idxp.stat().st_size/1e6:6.2f} MB (cliente)")

    for nombre, obj in [("meta", meta), ("schools_index", indice),
                        ("schools_detail", fichas), ("national", serie),
                        ("cross_2024", cross)]:
        p = OUT / f"{nombre}.json"
        p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")),
                     encoding="utf-8")
        print(f"  -> {p.name:22} {p.stat().st_size/1e6:6.2f} MB")

    print(f"\ncorte transversal {ANIO_TRANSVERSAL}: {len(cross):,} colegios con tasa "
          f"(matricula >= {MATRICULA_MINIMA})")
    sin_rep = sum(1 for c in cross if c["reportes"] == 0)
    print(f"  de ellos, {sin_rep:,} sin ningun reporte ese anio")


if __name__ == "__main__":
    main()
