# -*- coding: utf-8 -*-
"""
Suma la clasificacion de ACOSO ESCOLAR del MINEDU a la capa publica.

LA FUENTE
Anexo enviado por el MINEDU (SiseVe, corte 31-08-2026): un reporte por fila,
2024-2026, con CODIGO_MODULAR, TIPO_VIOLENCIA y la columna ACOSO ESCOLAR
(BULLYING / CIBERBULLYING / "-"). Se guarda en data/raw, que no entra al repo.

ES UN DATO APARTE, NO UNA CORRECCION
Nuestro `bullying`/`ciberacoso` sale del SUBTIPO de violencia. Esta es otra
clasificacion del MINEDU y marca unas cuatro veces mas reportes. Por eso
entra con claves propias, `acoso_escolar` y `ciberbullying`, y no toca las
existentes. Comprobado al construirlo: en ningun colegio-anio el acoso
marcado supera a los reportes entre estudiantes, y nunca marca violencia
sexual.

EL UNICO CONTEO QUE CAMBIA
Los conteos por colegio y anio coinciden con la capa publica en 19.947 de
19.948 casos. La excepcion es 1008564 (1204 Villa Jardin) en 2026: 24
reportes en el anexo frente a 10, los 14 de mas psicologicos. Se actualizan
`total` y `psicologica`; el presunto agresor de esos 14 no viene en el anexo
y NO se inventa, asi que ahi los actores suman menos que el total.
El script se niega a seguir si aparece cualquier otra diferencia.

QUE TOCA
  schools_detail.json, institutions.json  anios[a].acoso_escolar/ciberbullying
                                          (+ total/psicologica de la excepcion)
  national.json  meta.json  schools_index.json  public/data/search-index.json
Cruce solo por codigo modular. Despues: build_signals y build_correlacion.

    python scripts/sumar_acoso_escolar.py            # diff, no escribe
    python scripts/sumar_acoso_escolar.py --aplicar
"""
import argparse
import collections
import copy
import json
import pathlib

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"
FUENTE = ROOT / "data" / "raw" / "acoso_escolar_2024_2026.xlsx"
INDICE = ROOT / "public" / "data" / "search-index.json"
ANIOS = ("2024", "2025", "2026")
TIPO = {"Física": "fisica", "Psicológica": "psicologica", "Sexual": "sexual"}
EXCEPCION = {("1008564", "2026")}
NUEVAS = ("acoso_escolar", "ciberbullying")


def leer(p):
    return json.loads(p.read_text(encoding="utf-8"))


def escribir(p, d):
    p.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def cargar_anexo():
    ws = openpyxl.load_workbook(FUENTE, read_only=True).worksheets[0]
    filas = ws.iter_rows(values_only=True)
    for r in filas:
        if r and len(r) > 2 and r[2] == "CODIGO_MODULAR":
            hdr = list(r)
            break
    i = {h: k for k, h in enumerate(hdr) if h}
    col_anio = 1  # «AÑO»: la cabecera llega con la eñe mal codificada
    cnt = collections.defaultdict(collections.Counter)
    for r in filas:
        if r[0] is None:
            continue
        cm = str(r[i["CODIGO_MODULAR"]]).strip().zfill(7)
        c = cnt[(cm, str(r[col_anio]))]
        c["total"] += 1
        c[TIPO[r[i["TIPO_VIOLENCIA"]]]] += 1
        marca = r[i["ACOSO ESCOLAR"]]
        if marca == "BULLYING":
            c["acoso_escolar"] += 1
        elif marca == "CIBERBULLYING":
            c["ciberbullying"] += 1
        elif marca != "-":
            raise SystemExit(f"valor de ACOSO ESCOLAR desconocido: {marca!r}")
    return cnt


def poner(d, k, v):
    if v:
        d[k] = v
    else:
        d.pop(k, None)


def plano(d, pre=""):
    if isinstance(d, dict):
        for k, v in d.items():
            yield from plano(v, f"{pre}/{k}")
    elif isinstance(d, (list, tuple)):
        for n, v in enumerate(d):
            yield from plano(v, f"{pre}/{n}")
    else:
        yield pre, d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true")
    a = ap.parse_args()

    anexo = cargar_anexo()
    sd = leer(PUB / "schools_detail.json")
    inst = leer(PUB / "institutions.json")
    nac = leer(PUB / "national.json")
    meta = leer(PUB / "meta.json")
    sidx = leer(PUB / "schools_index.json")
    bidx = leer(INDICE)
    antes = copy.deepcopy((sd, inst))

    # 1. Mismos conteos salvo la excepcion conocida (tolera ya aplicado).
    pub = {(s["cm"], y): c for s in sd.values() for y, c in s["anios"].items() if y in ANIOS and c.get("total")}
    claves = set(pub) | set(anexo)
    dif = {k for k in claves if pub.get(k, {}).get("total", 0) != anexo[k]["total"]}
    if not dif <= EXCEPCION:
        raise SystemExit(f"diferencias inesperadas con la capa publica: {sorted(dif)[:10]}")
    for k in claves - EXCEPCION:
        for t in TIPO.values():
            if pub[k].get(t, 0) != anexo[k][t]:
                raise SystemExit(f"tipo {t} distinto en {k}")

    # 2. Servicios.
    extra = collections.Counter()
    for s in sd.values():
        for y in ANIOS:
            c = anexo.get((s["cm"], y))
            if not c:
                continue
            d = s["anios"][y]
            for k in NUEVAS:
                poner(d, k, c[k])
            if (s["cm"], y) in EXCEPCION and d["total"] != c["total"]:
                delta = c["total"] - d["total"]
                d["total"] = c["total"]
                d["psicologica"] = c["psicologica"]
                s["total"] += delta
                extra[s["cm"]] += delta
    por_cm = {s["cm"]: s for s in sd.values()}

    # 3. Instituciones: cada servicio copia el suyo; la institucion suma.
    tocadas = set()
    for i in inst.values():
        for sv in i["servicios"]:
            if sv["cm"] not in por_cm:
                continue
            sv["anios"] = copy.deepcopy(por_cm[sv["cm"]]["anios"])
            if sv["cm"] in extra:
                sv["total"] += extra[sv["cm"]]
                i["total"] += extra[sv["cm"]]
                tocadas.add(i["slug"])
        for y in ANIOS:
            if y not in i["anios"]:
                continue
            d = i["anios"][y]
            for k in NUEVAS:
                poner(d, k, sum(sv["anios"].get(y, {}).get(k, 0) for sv in i["servicios"]))
            if i["slug"] in tocadas and any(y == ye for _, ye in EXCEPCION):
                for k in ("total", "psicologica"):
                    d[k] = sum(sv["anios"].get(y, {}).get(k, 0) for sv in i["servicios"])

    # 4. Nacional, meta e indices.
    for r in nac:
        if r["anio"] in ANIOS:
            g = [c for (cm, y), c in anexo.items() if y == r["anio"]]
            for k in NUEVAS + ("total", "psicologica"):
                r[k] = sum(c[k] for c in g)
    meta["reportes"] += sum(extra.values())
    meta.setdefault("fuentes", {})["acoso"] = {
        "nombre": "SíseVe · MINEDU — clasificación de acoso escolar",
        "anio": "2024–2026",
        "via": "Anexo enviado por el MINEDU (corte al 31 de agosto de 2026)",
    }
    for f in sidx:
        if f["cm"] in extra:
            f["t"] = por_cm[f["cm"]]["total"]
    for f in bidx:
        if f[3] in extra:
            f[4] = por_cm[f[3]]["total"]

    # 5. Nada mas se movio.
    viejo, nuevo = dict(plano(antes)), dict(plano((sd, inst)))
    cambios = {k for k in viejo.keys() | nuevo.keys() if viejo.get(k) != nuevo.get(k)}
    raros = [k for k in cambios if not (k.endswith(NUEVAS) or (k.endswith(("/total", "/psicologica")) and extra))]
    if raros:
        raise SystemExit(f"cambios fuera de lo previsto: {raros[:10]}")
    print(f"claves cambiadas: {len(cambios)} · nuevas de acoso: {sum(k.endswith(NUEVAS) for k in cambios)}")
    print(f"total/psicologica cambiadas: {sorted(k for k in cambios if not k.endswith(NUEVAS))}")
    for r in nac:
        if r["anio"] in ANIOS:
            print(f"  {r['anio']}: total={r['total']} acoso_escolar={r['acoso_escolar']} ciberbullying={r['ciberbullying']}")
    print(f"  reportes nuevos: {sum(extra.values())} · meta.reportes={meta['reportes']}")

    if not a.aplicar:
        print("\n(simulacion: nada escrito; repite con --aplicar)")
        return
    for p, d in ((PUB / "schools_detail.json", sd), (PUB / "institutions.json", inst), (PUB / "national.json", nac),
                 (PUB / "meta.json", meta), (PUB / "schools_index.json", sidx), (INDICE, bidx)):
        escribir(p, d)
    print("\nescrito.")


if __name__ == "__main__":
    main()
