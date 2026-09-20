# -*- coding: utf-8 -*-
"""
Sustituye el denominador de la tasa por el del mismo anio.

La capa publica venia con `matricula` del padron 2026 y una `tasa_2024`
calculada dividiendo reportes de 2024 entre esos alumnos de 2026. Este script
cambia el denominador por el del Censo Educativo 2024 y recalcula la tasa,
para que numerador y denominador sean del mismo anio.

No toca el resto del ETL ni el modelo de datos: solo reescribe los campos
`matricula`, `docentes`, `secciones`, `anio_matricula` y `tasa_2024` de
schools_detail.json, y regenera cross_2024.json a partir de ellos.

    python scripts/aplicar_denominador_2024.py

Requiere haber ejecutado antes `padron_censo_2024.py`.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"
PADRON = ROOT / "data" / "processed" / "padron_censo_2024.json"
ANIO_REPORTES = "2024"


def main():
    if not PADRON.exists():
        raise SystemExit("Falta padron_censo_2024.json. Corre padron_censo_2024.py antes.")

    padron = json.loads(PADRON.read_text(encoding="utf-8"))
    meta = json.loads((PUB / "meta.json").read_text(encoding="utf-8"))
    det = json.loads((PUB / "schools_detail.json").read_text(encoding="utf-8"))
    minimo = meta["matricula_minima"]

    # SiseVe no trae anexo, asi que se indexa por codigo modular. Cuando un
    # codigo tiene varios servicios se toma el de anexo "0" y, si no lo hay,
    # el de mas alumnos: es la misma regla conservadora del resto del pipeline.
    por_cm = {}
    for s in padron.values():
        por_cm.setdefault(s["cm"], []).append(s)
    for cm, v in por_cm.items():
        v.sort(key=lambda s: (s.get("anexo") != "0", -(s.get("alumnos") or 0)))

    antes_con_mat = sum(1 for s in det.values() if s.get("matricula"))
    antes_con_tasa = sum(1 for s in det.values() if s.get("tasa_2024") is not None)

    cruzan = con_tasa = 0
    for s in det.values():
        e = (por_cm.get(s["cm"]) or [None])[0]
        if not e:
            # Sin dato del mismo anio: se vacia en vez de dejar el de 2026.
            s["matricula"] = None
            s["docentes"] = None
            s["secciones"] = None
            s["anio_matricula"] = None
            s["tasa_2024"] = None
            continue

        cruzan += 1
        alumnos = e.get("alumnos")
        s["matricula"] = alumnos
        s["docentes"] = e.get("docentes")
        s["secciones"] = e.get("secciones")
        s["anio_matricula"] = e.get("anio")

        if alumnos and alumnos >= minimo:
            r = s["anios"].get(ANIO_REPORTES, {}).get("total", 0)
            s["tasa_2024"] = round(r / alumnos * 1000, 2)
            con_tasa += 1
        else:
            s["tasa_2024"] = None

    cross = [{
        "slug": s["slug"], "nombre": s["nombre"], "distrito": s["distrito"],
        "gestion": s["gestion"], "nivel": s["nivel"], "matricula": s["matricula"],
        "reportes": s["anios"].get(ANIO_REPORTES, {}).get("total", 0),
        "tasa": s["tasa_2024"], "pension": s.get("pension"),
    } for s in det.values() if s.get("matricula") and s.get("tasa_2024") is not None]

    meta["fuentes"]["matricula"] = {
        "nombre": "Padrón de IIEE – Censo Educativo",
        "anio": ANIO_REPORTES,
        "via": "Archivo de datos de ESCALE (00_Padron.zip)",
    }

    (PUB / "schools_detail.json").write_text(
        json.dumps(det, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (PUB / "cross_2024.json").write_text(
        json.dumps(cross, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (PUB / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    n = len(det)
    print(f"colegios                    : {n:,}")
    print(f"con numero de alumnos  antes: {antes_con_mat:,} ({100*antes_con_mat/n:.1f}%)  padron 2026")
    print(f"                      ahora : {cruzan:,} ({100*cruzan/n:.1f}%)  censo 2024")
    print(f"con tasa               antes: {antes_con_tasa:,}")
    print(f"                      ahora : {con_tasa:,}")
    print(f"corte transversal {ANIO_REPORTES}      : {len(cross):,} colegios")
    print("\nnumerador y denominador son ahora del mismo anio.")


if __name__ == "__main__":
    main()
