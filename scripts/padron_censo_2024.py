# -*- coding: utf-8 -*-
"""
Denominador del mismo anio: numero de alumnos 2024 del Censo Educativo 2024.

POR QUE EXISTE ESTE SCRIPT
La tasa del producto dividia reportes de 2024 entre alumnos de 2026, que era
el unico padron que teniamos. Comprobado contra colegios reales, la diferencia
entre ambos anios llega al 10%: no era un detalle.

El Censo Educativo 2024 publica el padron completo en un unico fichero, con
COD_MOD + ANEXO —nuestra clave de servicio— y TALUMNO. Cruza con el 98,5% de
los colegios que SiseVe registra.

    Fuente : https://escale.minedu.gob.pe/censo-escolar/.../view/9538443
    Fichero: 00_Padron.zip -> Padron.dbf  (11,5 MB)

    python scripts/padron_censo_2024.py --zip <ruta al 00_Padron.zip>

Salida: data/processed/padron_censo_2024.json   {"codmod-anexo": {...}}

LISTA BLANCA
El DBF incluye DIRECTOR, TELEFONO y EMAIL. Igual que con el padron REST, el
filtro se aplica antes de escribir nada: se nombra lo que entra y el resto se
descarta. Con lista negra, cualquier campo nuevo entraria solo.
"""
import argparse
import json
import pathlib
import struct
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed" / "padron_censo_2024.json"
ANIO = "2024"

# LA LISTA BLANCA. Lo que no esta aqui no sale del DBF.
CAMPOS = {
    "COD_MOD": "cm",
    "ANEXO": "anexo",
    "CODINST": "codinst",
    "CODLOCAL": "codlocal",
    "NIV_MOD": "nivel_cod",
    "D_NIV_MOD": "nivel",
    "D_GESTION": "gestion",
    "GES_DEP": "gestion_dep",
    "AREA_CENSO": "area_cod",
    "CODGEO": "ubigeo",
    "TALUMNO": "alumnos",
    "TALUM_HOM": "alumnos_h",
    "TALUM_MUJ": "alumnos_m",
    "TDOCENTE": "docentes",
    "TSECCION": "secciones",
    "IMPUTADO": "imputado_cod",
}
NUMERICOS = {"alumnos", "alumnos_h", "alumnos_m", "docentes", "secciones"}


def leer_dbf(raw: bytes):
    """Lector DBF minimo. No hace falta una dependencia para 54 campos."""
    n_rec, hdr_len, rec_len = struct.unpack("<IHH", raw[4:12])
    campos, off = [], 32
    while raw[off] != 0x0D:
        b = raw[off:off + 32]
        campos.append((b[:11].split(b"\0")[0].decode("latin-1"), b[16]))
        off += 32

    # Posicion de cada campo dentro del registro; solo se leen los de la lista.
    pos, o = {}, 1
    for nombre, largo in campos:
        pos[nombre] = (o, largo)
        o += largo

    for i in range(n_rec):
        p = hdr_len + i * rec_len
        r = raw[p:p + rec_len]
        if r[:1] == b"*":          # registro borrado
            continue
        fila = {}
        for origen, destino in CAMPOS.items():
            if origen not in pos:
                continue
            a, l = pos[origen]
            fila[destino] = r[a:a + l].decode("latin-1").strip()
        yield fila


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", required=True, help="ruta a 00_Padron.zip del CE 2024")
    a = ap.parse_args()

    z = zipfile.ZipFile(a.zip)
    nombre = next(i.filename for i in z.infolist() if i.filename.lower().endswith(".dbf"))
    raw = z.read(nombre)

    out, sin_alumnos = {}, 0
    for f in leer_dbf(raw):
        cm = (f.get("cm") or "").zfill(7)
        if not cm or cm == "0000000":
            continue
        for k in NUMERICOS:
            v = f.get(k, "")
            f[k] = int(v) if v.isdigit() else None
        if not f.get("alumnos"):
            sin_alumnos += 1
        f["anio"] = ANIO
        f["cm"] = cm
        f["anexo"] = f.get("anexo") or "0"
        out[f"{cm}-{f['anexo']}"] = f

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")

    con = sum(1 for v in out.values() if v.get("alumnos"))
    ci = sum(1 for v in out.values() if v.get("codinst"))
    print(f"{len(out):,} servicios del Censo Educativo {ANIO}")
    print(f"  con numero de alumnos : {con:,} ({100*con/len(out):.1f}%)")
    print(f"  con codinst           : {ci:,} ({100*ci/len(out):.1f}%)")
    print(f"  sin alumnos           : {sin_alumnos:,}")
    print(f"-> {OUT.relative_to(ROOT)}  {OUT.stat().st_size/1e6:.1f} MB")

    # Comprobacion explicita de la lista blanca.
    texto = OUT.read_text(encoding="utf-8").lower()
    for p in ("director", "telefono", "email", "pagweb", "direccion"):
        assert f'"{p}"' not in texto, f"FILTRO ROTO: aparece {p}"
    print("lista blanca verificada: sin director, telefono, email, direccion")


if __name__ == "__main__":
    main()
