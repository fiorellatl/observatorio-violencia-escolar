# -*- coding: utf-8 -*-
"""
Añade a cada colegio los niveles que NO tienen ningún reporte en SíseVe.

    python scripts/completar_niveles_sin_reportes.py             # diff, no escribe
    python scripts/completar_niveles_sin_reportes.py --aplicar   # escribe

EL PROBLEMA
La capa pública nace de los reportes: un servicio sin reportes no entra. En
un colegio con varios niveles eso borra justo los niveles donde no se ha
registrado nada. «Santa Margarita» (Surco) tiene inicial, primaria y
secundaria; solo la inicial tuvo un reporte, y la ficha decía que era un
jardín con 103 alumnos. Medido sobre el corte actual: a 4.833 de 17.185
colegios les faltaba algún nivel, 2.465 de ellos su primaria o su secundaria.

QUÉ NIVELES SE AÑADEN
Los que el Censo Educativo 2024 asigna a la MISMA institución, con las
mismas reglas que ya agrupan los servicios con reportes
(docs/MODELO-INSTITUCIONAL.md):

  - colegio con `codinst`: los servicios del censo con ese `codinst`;
  - colegio sin `codinst`: los del mismo `codlocal`, con el mismo nombre
    oficial, la misma gestión y también sin `codinst`, y solo de básica
    regular —la excepción de unificar_sin_codinst.py, idéntica—;
  - siempre: solo educación básica (regular, alternativa, especial), y nunca
    un nivel que el colegio ya tenga ni uno repetido. Si algo no cuadra, el
    nivel no se añade: preferimos un nivel ausente a uno ajeno.

QUÉ CAMBIA Y QUÉ NO
  servicios, niveles      se añaden los niveles, marcados `sin_reportes`
  matricula, tasa_2024    se recalculan con TODOS los niveles. Es la regla
                          de siempre (suma de alumnos, numerador entre
                          denominador sumados); lo que cambia es que el
                          denominador deja de omitir a los alumnos de los
                          niveles sin reportes, que inflaban la tasa
  reportes                ninguno: se comprueba al final
  slug, nombre, cabecera  ninguno: ninguna URL cambia
No toca schools_detail.json: territorios, señales y hallazgos siguen
calculándose como antes.

PENSIÓN
Los niveles añadidos no están en schools_detail.json, así que no pasan por
reparar_pension.py ni por estado_pension.py. Este paso les aplica las mismas
dos funciones con data/processed/identicole.json: importe con su año, y si no
lo hay, el motivo (no_aplica, no_informada, sin_ficha, conflicto).

Se puede repetir: primero retira los niveles que añadió en una pasada
anterior y los vuelve a construir, así una ficha de Identicole bajada después
sí llega.

Entradas: data/processed/padron_censo_2024.json (padron_censo_2024.py)
          data/processed/identicole.json        (bajar_identicole.py)
"""
import argparse
import collections
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"
PROC = ROOT / "data" / "processed"
sys.path.insert(0, str(ROOT / "scripts"))
from build_public_data import slugify  # noqa: E402
from construir_instituciones import ORDEN_NIVEL  # noqa: E402
from unificar_sin_codinst import norm  # noqa: E402
from reparar_pension import cargar_fichas, pension_de  # noqa: E402
from estado_pension import estado_de  # noqa: E402

# Código de nivel del censo -> la etiqueta que ya usa la capa pública.
# Medido sobre los servicios que están en ambos: cada código cae en su
# etiqueta en más del 95 % de los casos.
NIVEL = {
    "A1": "Inicial - Cuna",
    "A2": "Inicial - Jardín",
    "A3": "Inicial - Cuna-Jardín",
    "B0": "Primaria",
    "F0": "Secundaria",
    "D1": "Básica Alternativa - Inicial e Intermedio",
    "D2": "Básica Alternativa - Avanzado",
    "E1": "Básica Especial - Inicial",
    "E2": "Básica Especial - Primaria",
}
REGULAR = {"A1", "A2", "A3", "B0", "F0"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true")
    a = ap.parse_args()

    inst = json.loads((PUB / "institutions.json").read_text(encoding="utf-8"))
    meta = json.loads((PUB / "meta.json").read_text(encoding="utf-8"))
    censo = json.loads((PROC / "padron_censo_2024.json").read_text(encoding="utf-8"))

    # Una pasada anterior: se retira lo que añadió y se reconstruye entero.
    original = inst
    inst = {k: {**i, "servicios": [s for s in i["servicios"] if not s.get("sin_reportes")]}
            for k, i in original.items()}
    inst = {k: {**i, "niveles": [s["nivel"] for s in i["servicios"]]} for k, i in inst.items()}
    fichas = {cm: f for (cm, _anexo), f in cargar_fichas().items()}

    def con_pension(sv, gestion):
        f = fichas.get(sv["cm"])
        valor, anio = pension_de(f) if f else (None, None)
        if valor is not None and gestion.startswith("Públic") and str(f.get("gestion_detalle") or "").startswith("Privad"):
            valor, anio = None, None  # dos fuentes que no coinciden: no se publica
        sv["pension"], sv["anio_pension"] = valor, anio
        sv["pension_estado"] = estado_de({"pension": valor, "gestion": gestion}, f)
        return sv

    def recalcular(i, servicios):
        servicios = sorted(servicios, key=lambda s: (ORDEN_NIVEL.get(s["nivel"], 99), s["cm"]))
        mats = [s.get("matricula") for s in servicios]
        completa = all(m for m in mats)
        matricula = sum(mats) if completa else None
        tasa = None
        if matricula and matricula >= meta["matricula_minima"]:
            tasa = round(i["anios"].get(meta["anio_transversal"], {}).get("total", 0) / matricula * 1000, 2)
        return {**i, "niveles": [s["nivel"] for s in servicios], "servicios": servicios,
                "matricula": matricula, "matricula_completa": completa, "tasa_2024": tasa}

    presentes = {s["cm"] for i in inst.values() for s in i["servicios"]}
    por_cm, por_codinst, por_local = {}, collections.defaultdict(list), collections.defaultdict(list)
    for c in censo.values():
        por_cm.setdefault(c["cm"], c)
        if c.get("nivel_cod") not in NIVEL:
            continue
        if c.get("codinst"):
            por_codinst[c["codinst"]].append(c)
        if c.get("codlocal"):
            por_local[c["codlocal"]].append(c)

    def candidatos(i):
        if i.get("codinst"):
            cand = por_codinst.get(i["codinst"], [])
        else:
            # Sin codinst: la referencia es el propio servicio en el censo.
            refs = [por_cm[s["cm"]] for s in i["servicios"] if s["cm"] in por_cm]
            if not refs or any(r.get("codinst") for r in refs):
                return []
            else:
                r0 = refs[0]
                ok = all(r["codlocal"] == r0["codlocal"] and norm(r["nombre"]) == norm(r0["nombre"])
                         and r["gestion"] == r0["gestion"] for r in refs)
                cand = [c for c in por_local.get(r0["codlocal"], [])
                        if ok and not c.get("codinst") and c["nivel_cod"] in REGULAR
                        and norm(c["nombre"]) == norm(r0["nombre"]) and c["gestion"] == r0["gestion"]]
        return [c for c in cand if c["cm"] not in presentes]

    # Un servicio del censo que reclaman dos colegios no es de ninguno: pasa
    # con dos fichas sin codinst que comparten local y nombre y que
    # unificar_sin_codinst.py no unió por algún motivo.
    reclamos = collections.Counter(c["cm"] for i in inst.values() for c in candidatos(i))

    nuevo = {}
    descartes = collections.Counter()
    anadidos = collections.Counter()
    afectados = 0
    for slug, i in inst.items():
        cand = candidatos(i)
        if any(reclamos[c["cm"]] > 1 for c in cand):
            descartes["reclamado por dos colegios"] += sum(1 for c in cand if reclamos[c["cm"]] > 1)
            cand = [c for c in cand if reclamos[c["cm"]] == 1]
        if not cand:
            # Si una pasada anterior le había añadido niveles, hay que
            # recalcular sin ellos; si no, queda exactamente como estaba.
            nuevo[slug] = recalcular(i, i["servicios"]) if len(original[slug]["servicios"]) != len(i["servicios"]) else original[slug]
            continue

        tiene = {s["nivel"] for s in i["servicios"]}
        cuenta = collections.Counter(NIVEL[c["nivel_cod"]] for c in cand)
        extra = []
        for c in cand:
            nivel = NIVEL[c["nivel_cod"]]
            if nivel in tiene:
                descartes["nivel que el colegio ya tiene"] += 1
                continue
            if cuenta[nivel] > 1:
                descartes["nivel repetido en el censo"] += 1
                continue
            m = c.get("alumnos")
            extra.append(con_pension({
                "cm": c["cm"],
                "slug": slugify(i["nombre"], i["distrito"], c["cm"]),
                "nombre": i["nombre"],
                "nivel": nivel,
                "total": 0,
                "anios": {},
                "matricula": m,
                "anio_matricula": c.get("anio"),
                "docentes": c.get("docentes"),
                "secciones": c.get("secciones"),
                "tasa_2024": 0.0 if m and m >= meta["matricula_minima"] else None,
                # Está en el censo pero SíseVe no le registra nada, en ningún año.
                "sin_reportes": True,
            }, i["gestion"]))
            anadidos[nivel] += 1
        if not extra:
            nuevo[slug] = recalcular(i, i["servicios"]) if len(original[slug]["servicios"]) != len(i["servicios"]) else original[slug]
            continue

        afectados += 1
        nuevo[slug] = recalcular(i, i["servicios"] + extra)

    # ── Comprobaciones: ningún reporte, ninguna URL ni ningún servicio cambia ──
    assert list(inst) == list(nuevo), "cambió el conjunto de fichas"
    for slug, i in inst.items():
        n = nuevo[slug]
        assert n["anios"] == i["anios"] and n["total"] == i["total"], f"cambiaron los reportes de {slug}"
        assert sum(s["total"] for s in n["servicios"]) == n["total"], f"servicios descuadrados en {slug}"
    cms = [s["cm"] for x in nuevo.values() for s in x["servicios"]]
    assert len(cms) == len(set(cms)), "un servicio en dos colegios"
    assert presentes <= set(cms), "se perdió un servicio"

    cambio_tasa = sum(1 for s in inst if original[s]["tasa_2024"] != nuevo[s]["tasa_2024"])
    est = collections.Counter(s["pension_estado"] for x in nuevo.values() for s in x["servicios"] if s.get("sin_reportes"))
    print("  pensión de los niveles añadidos:", dict(est.most_common()))
    print(f"colegios completados: {afectados:,} de {len(inst):,} · niveles añadidos: {sum(anadidos.values()):,}")
    print("  por nivel:", dict(anadidos.most_common()))
    print("  descartes:", dict(descartes))
    print(f"  tasa 2024 distinta de la publicada: {cambio_tasa:,} colegios")
    sm = nuevo.get("santa-margarita-santiago-de-surco-0469130")
    if sm:
        print("  ej. Santa Margarita:", [(s["nivel"], s["matricula"], s["total"]) for s in sm["servicios"]],
              "tasa", sm["tasa_2024"])

    if not a.aplicar:
        print("\n(diff: no se escribió nada; usa --aplicar)")
        return
    (PUB / "institutions.json").write_text(json.dumps(nuevo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("escrito: institutions.json")


if __name__ == "__main__":
    main()
