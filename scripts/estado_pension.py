# -*- coding: utf-8 -*-
"""
Escribe POR QUE no hay pension, no solo que no la hay.

EL PROBLEMA DE MODELADO
Hoy la ausencia de pension es un unico `null` que significa cuatro cosas muy
distintas: un colegio publico que por definicion no cobra, uno privado que
esta fuera de la cobertura de Identicole, uno cuya ficha existe pero no
declara importe, y un caso donde las dos fuentes no se ponen de acuerdo sobre
si es publico o privado. La interfaz no puede distinguirlas porque el dato no
las distingue, asi que acaba diciendo lo mismo para todas.

Este script no inventa informacion: reparte la que ya existe en cuatro
estados explicitos, cruzando la capa publica con `identicole.json` por codigo
modular, igual que `reparar_pension.py`.

  disponible    hay importe, con su ano
  no_aplica     colegio publico: no cobra pension
  no_informada  tiene ficha en Identicole y la ficha no declara importe
  sin_ficha     no se ha consultado su ficha (la cobertura es solo Lima)
  conflicto     SiseVe lo llama publico e Identicole, privado

QUE TOCA
  schools_detail.json  anade `pension_estado`
  institutions.json    anade `pension_estado` dentro de cada servicio
No toca importes, ni matricula, ni reportes, ni ningun otro campo: al
terminar lo comprueba campo a campo y aborta si algo mas cambio.

    python scripts/estado_pension.py             # diff, no escribe
    python scripts/estado_pension.py --aplicar
"""
import argparse
import collections
import copy
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"
PROC = ROOT / "data" / "processed"

CAMPO = "pension_estado"


def leer(p):
    return json.loads(p.read_text(encoding="utf-8"))


def escribir(p, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def estado_de(servicio, ficha):
    """
    El orden de las preguntas importa.

    Primero el importe: si lo hay, lo demas es irrelevante. Luego el conflicto
    de fuentes, que si no quedaria escondido bajo "no aplica". Luego la
    gestion, porque un colegio publico no cobra aunque su ficha exista. Y solo
    al final se distingue entre "la ficha no lo dice" y "no hay ficha", que es
    la distincion que este script existe para hacer.
    """
    if servicio.get("pension") is not None:
        return "disponible"

    detalle = str((ficha or {}).get("gestion_detalle") or "")
    publico = str(servicio.get("gestion") or "").startswith("Públic")

    if publico and detalle.startswith("Privad"):
        return "conflicto"
    if publico:
        return "no_aplica"
    return "no_informada" if ficha else "sin_ficha"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true")
    args = ap.parse_args()

    ident = leer(PROC / "identicole.json")
    fichas = {str(k).zfill(7): v for k, v in ident.items()}

    det = leer(PUB / "schools_detail.json")
    antes = copy.deepcopy(det)

    cuenta = collections.Counter()
    porGestion = collections.defaultdict(collections.Counter)
    for s in det.values():
        e = estado_de(s, fichas.get(str(s["cm"]).zfill(7)))
        s[CAMPO] = e
        cuenta[e] += 1
        porGestion[s.get("gestion") or "?"][e] += 1

    total = len(det)
    print(f"SERVICIOS: {total}\n")
    print(f"  {'estado':<14}{'n':>7}{'%':>8}")
    for e, n in cuenta.most_common():
        print(f"  {e:<14}{n:>7}{n / total * 100:>7.1f}%")

    print("\n  por gestion:")
    for g, c in sorted(porGestion.items(), key=lambda x: -sum(x[1].values())):
        detalle = "  ".join(f"{k}={v}" for k, v in c.most_common())
        print(f"    {g:<10}{detalle}")

    if cuenta["conflicto"]:
        print("\n  conflictos de gestion:")
        for s in det.values():
            if s[CAMPO] == "conflicto":
                f = fichas.get(str(s["cm"]).zfill(7), {})
                print(f"    {s['cm']} {s['nombre'][:32]:<32} SiseVe={s['gestion']} / "
                      f"Identicole={f.get('gestion_detalle')}")

    # ── Nada mas puede haber cambiado ──────────────────────────────────
    tocados = 0
    for slug, s in det.items():
        a = antes[slug]
        for k in s:
            if k == CAMPO:
                continue
            if s[k] != a.get(k):
                print(f"  !! {slug}.{k} cambio y no debia")
                tocados += 1
    if tocados:
        raise SystemExit(f"ABORTA: {tocados} campos ajenos modificados")
    print(f"\n  Campos ajenos modificados: 0  (comprobados {total} servicios)")

    if not args.aplicar:
        print("\nEnsayo. Nada escrito. Repite con --aplicar.")
        return

    porSlug = {s["slug"]: s for s in det.values()}
    inst = leer(PUB / "institutions.json")
    items = inst if isinstance(inst, list) else list(inst.values())
    n = 0
    for i in items:
        for sv in i.get("servicios", []):
            f = porSlug.get(sv.get("slug"))
            if f:
                sv[CAMPO] = f[CAMPO]
                n += 1

    escribir(PUB / "schools_detail.json", det)
    escribir(PUB / "institutions.json", inst)
    print(f"\nEscrito.  schools_detail: {total}  institutions: {n} servicios")


if __name__ == "__main__":
    main()
