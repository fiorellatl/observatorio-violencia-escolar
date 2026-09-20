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
# Orden pedagogico, para que la institucion se presente de menor a mayor.
ORDEN_NIVEL = {
    "Inicial no escolarizado": 0, "Inicial - Cuna": 1, "Inicial - Cuna-Jardín": 2,
    "Inicial - Jardín": 3, "Primaria": 4, "Secundaria": 5,
    "Básica Especial - Inicial": 6, "Básica Especial - Primaria": 7,
    "Básica Alternativa - Inicial e Intermedio": 8,
    "Básica Alternativa - Avanzado": 9, "CETPRO": 10,
}
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


def cargar_padron():
    """
    Padron nacional de ESCALE: codigo modular -> servicio educativo.

    El padron identifica un servicio por `codMod + anexo`; SiseVe solo trae
    CODIGO_MODULAR, sin anexo. Cuando un codigo modular corresponde a varios
    servicios no hay forma de saber a cual pertenece cada reporte, asi que se
    elige uno (activo, anexo 0, con matricula) y el resultado queda marcado con
    `anexo_ambiguo`. Marcarlo importa: sin la marca, una atribucion dudosa se
    leeria como un dato limpio.
    """
    f = ROOT / "data" / "processed" / "padron_nacional.json"
    if not f.exists():
        return {}, 0

    porcm = defaultdict(list)
    for s in json.loads(f.read_text(encoding="utf-8")).values():
        porcm[s["cm"]].append(s)

    def prioridad(s):
        return (s.get("estado") != "Activo",
                s.get("anexo") != "0",
                not s.get("matricula"))

    out, ambiguos = {}, 0
    for cm, servicios in porcm.items():
        servicios.sort(key=prioridad)
        elegido = dict(servicios[0])
        if len(servicios) > 1:
            elegido["anexo_ambiguo"] = True
            elegido["anexos"] = sorted(s["anexo"] for s in servicios)
            ambiguos += 1
        out[cm] = elegido
    return out, ambiguos


def cargar_identicole():
    """
    Ficha de Identicole por codigo modular.

    Cada bloque de la ficha declara su propia fuente y ano (Padron 2026,
    SIAGIE 2025, Censo Escolar 2021). Se conserva esa procedencia por campo en
    vez de aplanarla: la interfaz muestra el ano de cada dato y aplanarlo aqui
    seria presentar como simultaneo lo que no lo es.
    """
    f = ROOT / "data" / "processed" / "identicole.json"
    if not f.exists():
        return {}
    crudo = json.loads(f.read_text(encoding="utf-8"))
    out = {}
    for cm, d in crudo.items():
        anios = d.get("_anios", {})
        ctx = {}

        def poner(clave, valor, bloque, etiqueta):
            if valor not in (None, "", "No disponible"):
                ctx[clave] = {"v": valor, "f": etiqueta, "a": anios.get(bloque)}

        poner("area", d.get("area"), "padron", "Identicole")
        poner("turno", d.get("turno"), "padron", "Identicole")
        poner("jornada", d.get("modelo"), "padron", "Identicole")
        poner("alumnado", d.get("alumnado"), "padron", "Identicole")
        poner("internet", d.get("internet"), "censo", "Censo Escolar")
        poner("accesibilidad", d.get("accesibilidad"), "censo", "Censo Escolar")
        poner("espacios_educativos", d.get("espacios_educativos_n"), "censo", "Censo Escolar")
        poner("equipamiento", d.get("equipamiento_n"), "censo", "Censo Escolar")

        out[cm.zfill(7)] = {
            "pension_2024": d.get("pension_2024"),
            "pension_2025": d.get("pension_2025"),
            "anio_pension": anios.get("siagie"),
            "contexto": ctx,
        }
    return out


def construir_instituciones(fichas):
    """
    Agrupa servicios educativos en instituciones por `codinst`.

    `codinst` es el identificador oficial de institucion educativa del padron.
    No se usa `codlocal` (agrupa edificios: un CEBA y el colegio regular que
    comparten local son instituciones distintas) ni coincidencia de nombres.
    Un servicio sin `codinst` se queda solo: preferimos no agrupar antes que
    agrupar mal.

    REGLAS DE AGREGACION
      reportes    se suman; son eventos disjuntos
      matricula   se suma; cada nivel tiene una poblacion distinta
      tasa        se recalcula desde numerador y denominador sumados,
                  nunca promediando tasas
      tasa        SOLO si todos los servicios tienen denominador valido: si
                  falta uno, el numerador incluiria alumnos que el denominador
                  no cuenta y la tasa saldria inflada
      pension     NO se suma; se expone por servicio
      contexto    NO se duplica; vive en el servicio
    """
    grupos = defaultdict(list)
    for f in fichas.values():
        if f.get("codinst"):
            grupos[f["codinst"]].append(f)

    out = {}
    for ci, servicios in grupos.items():
        servicios.sort(key=lambda s: ORDEN_NIVEL.get(s["nivel"], 99))
        cab = servicios[0]

        anios = defaultdict(lambda: defaultdict(int))
        for s in servicios:
            for anio, c in s["anios"].items():
                for k, v in c.items():
                    anios[anio][k] += v

        mats = [s.get("matricula") for s in servicios]
        completa = all(m for m in mats)
        matricula = sum(mats) if completa else None

        tasa = None
        if matricula and matricula >= MATRICULA_MINIMA:
            tasa = round(anios.get(ANIO_TRANSVERSAL, {}).get("total", 0)
                         / matricula * 1000, 2)

        out[ci] = {
            "codinst": ci,
            "nombre": cab["nombre"],
            "distrito": cab["distrito"],
            "provincia": cab["provincia"],
            "departamento": cab["departamento"],
            "gestion": cab["gestion"],
            "dre": cab["dre"],
            "ugel": cab["ugel"],
            "area": cab.get("area"),
            "niveles": [s["nivel"] for s in servicios],
            "servicios": [s["slug"] for s in servicios],
            "total": sum(s["total"] for s in servicios),
            "anios": {a: dict(c) for a, c in sorted(anios.items())},
            "matricula": matricula,
            "matricula_completa": completa,
            "anio_matricula": cab.get("anio_matricula"),
            "tasa_2024": tasa,
        }
    return out


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

    # ---- padron: matricula, codinst, area, coordenadas ----
    mat, ambiguos = cargar_padron()
    con_mat = sum(1 for v in mat.values() if v.get("matricula"))
    print(f"{len(mat):,} servicios en el padron · {con_mat:,} con matricula · "
          f"{ambiguos:,} codigos modulares con mas de un anexo")
    ident = cargar_identicole()
    con_pension = sum(1 for v in ident.values() if v["pension_2025"] or v["pension_2024"])
    print(f"{len(ident):,} fichas de Identicole · {con_pension:,} con pension")

    # ---- indice de busqueda + ficha ----
    indice, fichas = [], {}
    for cm, e in escuelas.items():
        anios = por_colegio[cm]
        total = sum(v["total"] for v in anios.values())
        slug = slugify(e["nombre"], e["distrito"], cm)
        m = mat.get(cm)

        tasa = None
        if m and (m.get("matricula") or 0) >= MATRICULA_MINIMA:
            r24 = anios.get(ANIO_TRANSVERSAL, {}).get("total", 0)
            tasa = round(r24 / m["matricula"] * 1000, 2)

        indice.append({
            "s": slug, "n": e["nombre"], "cm": cm, "d": e["distrito"],
            "p": e["provincia"], "r": e["departamento"], "g": e["gestion"],
            "nv": e["nivel"], "t": total,
        })
        ic = ident.get(cm, {})
        fichas[slug] = {
            **e, "slug": slug, "total": total, "anios": anios,
            "pension": ic.get("pension_2025") or ic.get("pension_2024"),
            "anio_pension": ic.get("anio_pension") if ic.get("pension_2025")
                            else ("2024" if ic.get("pension_2024") else None),
            "contexto": ic.get("contexto") or {},
            "matricula": (m or {}).get("matricula"),
            "docentes": (m or {}).get("docentes"),
            "secciones": (m or {}).get("secciones"),
            "anio_matricula": (m or {}).get("anio_estadistica"),
            "tasa_2024": tasa,
            # --- identidad del servicio y de la institucion ---
            "anexo": (m or {}).get("anexo"),
            "anexo_ambiguo": (m or {}).get("anexo_ambiguo", False),
            "codinst": (m or {}).get("codinst"),
            "codlocal": (m or {}).get("codlocal"),
            "area": (m or {}).get("area"),
            "lat": (m or {}).get("lat"),
            "lon": (m or {}).get("lon"),
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
        "tasa": f["tasa_2024"], "pension": f.get("pension"),
    } for f in fichas.values() if f["matricula"] and f["tasa_2024"] is not None]

    # ---- diccionario institucional ----
    instituciones = construir_instituciones(fichas)
    multi = [i for i in instituciones.values() if len(i["servicios"]) > 1]
    print(f"\n{len(instituciones):,} instituciones · {len(multi):,} con mas de un nivel")

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
            "institucion": {"nombre": "Padrón de IIEE – ESCALE (codinst)", "anio": "2026",
                            "via": "API pública escale.minedu.gob.pe/padron/rest"},
            "contexto": {"nombre": "Identicole – MINEDU", "anio": "2021–2026",
                         "via": "Ficha pública por código modular"},
        },
    }

    # Indice compacto para el buscador del navegador: arrays, no objetos, y sin
    # el slug (se recalcula en el cliente con la misma funcion). Se sirve como
    # archivo estatico desde public/ y se descarga solo al primer tecleo.
    compacto = [[e["nombre"], e["distrito"], e["departamento"], cm,
                 por_colegio[cm] and sum(v["total"] for v in por_colegio[cm].values()),
                 e["nivel"] or ""]
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
                        ("cross_2024", cross), ("institutions", instituciones)]:
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
