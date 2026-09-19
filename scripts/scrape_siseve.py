"""
TAREA 5/7 - Construye los datasets a partir de las fuentes publicas de SiseVe.

Granularidad maxima real del portal: UGEL. No existe ningun endpoint ni columna
que exponga la institucion educativa, por lo que las columnas school_name,
modular_code, district y management se emiten VACIAS de forma deliberada:
el portal no las entrega y no se rellenan con estimaciones.
"""
import csv
import pathlib
import sys
from collections import defaultdict

import openpyxl

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from siseve_client import SiseveClient  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW, PROC = ROOT / "data" / "raw", ROOT / "data" / "processed"
XLSX = RAW / "EstadisticaExcel.xlsx"

# Estados del Excel agrupados segun el esquema pedido (pending/in_process/finished)
ESTADO_BUCKET = {
    "Pendiente de atención por la IE": "pending",
    "Observado por UGEL": "pending",
    "Atención en proceso": "in_process",
    "Atención finalizada por validar": "in_process",
    "Atención finalizada": "finished",
}
VIOLENCIA_COL = {"Psicológica": "psychological", "Física": "physical", "Sexual": "sexual"}

CAMPOS = ["year", "school_name", "modular_code", "district", "dre", "ugel",
          "management", "education_level", "aggressor_type",
          "psychological", "physical", "sexual", "total",
          "pending", "in_process", "finished"]


def leer_casos():
    """Devuelve el listado caso-por-caso del xlsx publico (cabecera en la fila 6)."""
    wb = openpyxl.load_workbook(XLSX, read_only=True)
    ws = wb["BaseCompleta"]
    for fila in ws.iter_rows(min_row=7, values_only=True):
        if not fila[0]:
            continue
        fecha, dre, ugel, nivel, tipo_rep, tipo_viol, _subtipo, estado = fila[:8]
        yield {
            "year": str(fecha)[:4],
            "dre": dre, "ugel": ugel, "education_level": nivel,
            "aggressor_type": tipo_rep, "violencia": tipo_viol, "estado": estado,
        }


def agregar(casos, filtro=None):
    """Agrega a la llave (year, dre, ugel, nivel, tipo_agresor)."""
    acc = defaultdict(lambda: dict.fromkeys(
        ["psychological", "physical", "sexual", "total", "pending", "in_process", "finished"], 0))
    for c in casos:
        if filtro and not filtro(c):
            continue
        k = (c["year"], c["dre"], c["ugel"], c["education_level"], c["aggressor_type"])
        fila = acc[k]
        col = VIOLENCIA_COL.get(c["violencia"])
        if col:
            fila[col] += 1
        fila["total"] += 1
        bucket = ESTADO_BUCKET.get(c["estado"])
        if bucket:
            fila[bucket] += 1
    return acc


def escribir(path, acc):
    filas = []
    for (year, dre, ugel, nivel, agresor), v in acc.items():
        filas.append({
            "year": year, "school_name": "", "modular_code": "", "district": "",
            "dre": dre, "ugel": ugel, "management": "",
            "education_level": nivel, "aggressor_type": agresor, **v,
        })
    filas.sort(key=lambda r: (r["year"], r["ugel"], r["education_level"], r["aggressor_type"]))
    with open(path, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=CAMPOS)
        w.writeheader()
        w.writerows(filas)
    print(f"  -> {path.name}: {len(filas)} filas")
    return filas


def escribir_top50(path, casos):
    """Ranking de UGEL por total de reportes (todos los anios disponibles)."""
    tot = defaultdict(lambda: {"total": 0, "psychological": 0, "physical": 0, "sexual": 0})
    for c in casos:
        t = tot[(c["dre"], c["ugel"])]
        t["total"] += 1
        col = VIOLENCIA_COL.get(c["violencia"])
        if col:
            t[col] += 1
    filas = [{"rank": i, "dre": d, "ugel": u, **v} for i, ((d, u), v) in
             enumerate(sorted(tot.items(), key=lambda kv: -kv[1]["total"]), 1)][:50]
    with open(path, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=["rank", "dre", "ugel", "psychological",
                                           "physical", "sexual", "total"])
        w.writeheader()
        w.writerows(filas)
    print(f"  -> {path.name}: {len(filas)} filas")


def main():
    PROC.mkdir(parents=True, exist_ok=True)
    if not XLSX.exists():
        print("Descargando el Excel publico...")
        SiseveClient().descargar_excel(XLSX)

    casos = list(leer_casos())
    print(f"{len(casos):,} casos leidos de {XLSX.name}\n")

    print("Generando datasets:")
    # "Lima" = las 4 DRE cuyo ambito es el departamento de Lima + Callao excluido.
    es_lima = lambda c: c["dre"] in ("DRE Lima Metropolitana", "DRE Lima Provincias")  # noqa: E731
    escribir(PROC / "siseve_ugel_lima.csv", agregar(casos, es_lima))
    escribir(PROC / "siseve_ugel_nacional.csv", agregar(casos))
    escribir_top50(PROC / "top_50_ugel_nacional.csv", casos)
    escribir_top50(PROC / "top_50_ugel_lima.csv", [c for c in casos if es_lima(c)])


if __name__ == "__main__":
    main()
