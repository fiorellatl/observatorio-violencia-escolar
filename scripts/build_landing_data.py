# -*- coding: utf-8 -*-
"""
Arma el paquete de datos del buscador publico.

Unidad: la UGEL. Es el maximo detalle que SiseVe publica, y la unica cifra
honesta que le podemos mostrar a un padre que busca su colegio.

Salida: data/processed/landing_data.json
"""
import json
import pathlib
from collections import defaultdict

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parents[1]
XLSX = ROOT / "data" / "raw" / "EstadisticaExcel.xlsx"
OUT = ROOT / "data" / "processed" / "landing_data.json"

PIE = "Personal IE a Escolares"
FIN = "Atención finalizada"
PROC = ("Atención en proceso", "Atención finalizada por validar")
NIV = {"Inicial - Jardín": "ini", "Inicial - Cuna-Jardín": "ini",
       "Básica Especial - Inicial": "ini", "Primaria": "pri",
       "Básica Especial - Primaria": "pri", "Secundaria": "sec"}
TV = {"Psicológica": "psi", "Física": "fis", "Sexual": "sex"}

# jurisdiccion DRELM (misma que usa el mapa)
UGEL_DISTRITOS = {
    "UGEL 01 San Juan de Miraflores": ["Lurín", "Pachacámac", "Pucusana", "Punta Hermosa",
        "Punta Negra", "San Bartolo", "San Juan de Miraflores", "Santa María del Mar",
        "Villa El Salvador", "Villa María del Triunfo"],
    "UGEL 02 Rímac": ["Rímac", "Independencia", "Los Olivos", "San Martín de Porres"],
    "UGEL 03 Cercado": ["Breña", "Cercado de Lima", "Jesús María", "La Victoria", "Lince",
        "Magdalena del Mar", "Pueblo Libre", "San Isidro", "San Miguel"],
    "UGEL 04 Comas": ["Ancón", "Carabayllo", "Comas", "Puente Piedra", "Santa Rosa"],
    "UGEL 05 San Juan de Lurigancho": ["San Juan de Lurigancho", "El Agustino"],
    "UGEL 06 Ate": ["Ate", "Chaclacayo", "Cieneguilla", "La Molina",
                    "Lurigancho-Chosica", "Santa Anita"],
    "UGEL 07 San Borja": ["Barranco", "Chorrillos", "Miraflores", "San Borja", "San Luis",
                          "Santiago de Surco", "Surquillo"],
}


def perfil():
    return {"tot": 0, "y": defaultdict(int), "psi": 0, "fis": 0, "sex": 0,
            "staff": 0, "ini": 0, "pri": 0, "sec": 0,
            "fin": 0, "proc": 0, "pend": 0,
            "sexStaff": 0, "sexIni": 0, "sub": defaultdict(int),
            "subSex": defaultdict(int)}


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True)
    rows = [r for r in wb["BaseCompleta"].iter_rows(min_row=7, values_only=True) if r[0]]

    por_ugel = defaultdict(perfil)
    nac = perfil()

    for r in rows:
        anio, dre, ugel, nivel, tipo, viol, sub, estado = (
            str(r[0])[:4], r[1], r[2], r[3], r[4], r[5], r[6], r[7])
        destinos = [nac]
        if dre == "DRE Lima Metropolitana":
            destinos.append(por_ugel[ugel])
        for p in destinos:
            p["tot"] += 1
            p["y"][anio] += 1
            p[TV[viol]] += 1
            p["staff"] += tipo == PIE
            n = NIV.get(nivel)
            if n:
                p[n] += 1
            p["fin"] += estado == FIN
            p["proc"] += estado in PROC
            p["pend"] += estado != FIN and estado not in PROC
            p["sub"][sub] += 1
            if viol == "Sexual":
                p["sexStaff"] += tipo == PIE
                p["subSex"][sub] += 1
                if n == "ini":
                    p["sexIni"] += 1

    def limpiar(p):
        d = {k: v for k, v in p.items() if k not in ("y", "sub", "subSex")}
        d["y"] = dict(sorted(p["y"].items()))
        d["sub"] = dict(sorted(p["sub"].items(), key=lambda kv: -kv[1])[:8])
        d["subSex"] = dict(sorted(p["subSex"].items(), key=lambda kv: -kv[1]))
        return d

    data = {
        "corte": "31 de agosto de 2026",
        "periodo": "enero 2024 – agosto 2026",
        "nacional": limpiar(nac),
        "ugeles": {u: limpiar(p) for u, p in sorted(por_ugel.items())},
        "distritos": {d: u for u, ds in UGEL_DISTRITOS.items() for d in ds},
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")

    print(f"nacional: {nac['tot']:,} reportes · {nac['sex']:,} sexuales "
          f"({100*nac['sex']/nac['tot']:.1f} %)")
    print(f"{len(por_ugel)} UGEL de Lima Metropolitana · "
          f"{len(data['distritos'])} distritos mapeados")
    print(f"-> {OUT.name} ({OUT.stat().st_size/1024:.1f} KB)\n")
    for u, p in sorted(por_ugel.items(), key=lambda kv: -kv[1]["sex"]):
        print(f"  {u:32} sexual {p['sex']:>4} ({100*p['sex']/p['tot']:4.1f} %) "
              f"· de personal IE {p['sexStaff']:>4}")


if __name__ == "__main__":
    main()
