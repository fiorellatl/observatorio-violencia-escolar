# -*- coding: utf-8 -*-
"""
Recupera el contexto de Identicole que ya teniamos y no llego a publicarse.

MISMO FALLO QUE LAS PENSIONES, MAS GRANDE
Hay 756 fichas de Identicole en `data/processed/identicole.json` y solo 367
servicios llevan su contexto en la capa publica. Las otras 389 se descargaron
despues de la ultima ejecucion del ETL, que no se puede repetir porque el
XLSX de SiseVe que genero la capa actual ya no esta en disco. Area, turno,
jornada, conectividad, accesibilidad e infraestructura existen y no se ven.

EL MAPEO NO SE REINVENTA
Las claves, las fuentes y los anos por bloque son EXACTAMENTE los de
`cargar_identicole()` en build_public_data.py, copiados campo por campo. Si
ese mapeo cambiara alli, este script quedaria desfasado; por eso lo dice aqui
en vez de dejarlo implicito.

QUE TOCA
  schools_detail.json  contexto
  institutions.json    contexto  (de la institucion, desde su cabecera)
Nada mas. Al terminar lo comprueba campo a campo y aborta si algo se movio.

    python scripts/reparar_contexto.py             # diff, no escribe
    python scripts/reparar_contexto.py --aplicar
"""
import argparse
import collections
import copy
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"
PROC = ROOT / "data" / "processed"


def leer(p):
    return json.loads(p.read_text(encoding="utf-8"))


def escribir(p, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def contexto_de(d):
    """Copia literal del mapeo del ETL. No se anade ni se quita ningun campo."""
    anios = d.get("_anios", {}) or {}
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
    return ctx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true")
    args = ap.parse_args()

    ident = leer(PROC / "identicole.json")
    fichas = {str(k).zfill(7): v for k, v in ident.items()}

    det = leer(PUB / "schools_detail.json")
    antes = copy.deepcopy(det)

    porCm = collections.defaultdict(list)
    for slug, s in det.items():
        porCm[str(s["cm"]).zfill(7)].append(slug)
    repes = {k: v for k, v in porCm.items() if len(v) > 1}
    if repes:
        raise SystemExit(f"ABORTA: {len(repes)} codigos modulares repetidos")

    nuevos = cambiados = iguales = 0
    campos = collections.Counter()
    ejemplos = []

    for cm, ficha in fichas.items():
        slugs = porCm.get(cm)
        if not slugs:
            continue
        ctx = contexto_de(ficha)
        if not ctx:
            continue
        s = det[slugs[0]]
        actual = s.get("contexto") or {}
        if actual == ctx:
            iguales += 1
            continue
        if not actual:
            nuevos += 1
            if len(ejemplos) < 6:
                ejemplos.append((cm, s["nombre"][:30], s["departamento"], sorted(ctx)))
        else:
            cambiados += 1
        for k in ctx:
            if actual.get(k) != ctx[k]:
                campos[k] += 1
        s["contexto"] = ctx

    print(f"fichas de Identicole      : {len(fichas)}")
    print(f"ya estaban y coinciden    : {iguales}")
    print(f"RECUPERAN contexto        : {nuevos}")
    print(f"tenian contexto y cambia  : {cambiados}")
    print(f"\ncampos afectados: {dict(campos)}")
    print("\nejemplos recuperados:")
    for cm, n, r, ks in ejemplos:
        print(f"  {cm} {n:<31}{r:<10}{', '.join(ks)}")

    tocados = 0
    for slug, s in det.items():
        a = antes[slug]
        for k in s:
            if k == "contexto":
                continue
            if s[k] != a.get(k):
                print(f"  !! {slug}.{k} cambio y no debia")
                tocados += 1
    if tocados:
        raise SystemExit(f"ABORTA: {tocados} campos ajenos modificados")
    print(f"\nCampos ajenos modificados: 0  (comprobados {len(det)} servicios)")

    if not args.aplicar:
        print("\nEnsayo. Nada escrito. Repite con --aplicar.")
        return

    # La institucion hereda el contexto de su servicio cabecera, que es de
    # donde lo saca tambien el ETL: describe el local, no el nivel.
    porSlug = {s["slug"]: s for s in det.values()}
    inst = leer(PUB / "institutions.json")
    items = inst if isinstance(inst, list) else list(inst.values())
    nI = 0
    for i in items:
        cab = porSlug.get(i.get("slug"))
        if cab and (i.get("contexto") or {}) != (cab.get("contexto") or {}):
            i["contexto"] = cab.get("contexto") or {}
            nI += 1

    escribir(PUB / "schools_detail.json", det)
    escribir(PUB / "institutions.json", inst)
    print(f"\nEscrito.  schools_detail: {nuevos + cambiados}  institutions: {nI}")


if __name__ == "__main__":
    main()
