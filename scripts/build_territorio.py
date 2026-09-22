# -*- coding: utf-8 -*-
"""
Agregados por territorio: region y UGEL.

POR QUE HASTA AHORA NO EXISTIA
La seccion territorial de /datos decia que hacia falta un denominador: sin el
numero de alumnos de cada region, un mapa de reportes ensena sobre todo donde
vive mas gente. Ese bloqueo ya no esta. El Censo Educativo 2024 cubre 17.097
de las 17.399 instituciones, y las 25 regiones y 220 de las 225 UGEL tienen
denominador casi completo.

LO QUE ESTE FICHERO NO DICE
Una tasa territorial alta NO significa mas violencia. Significa mas registro:
mas confianza en el canal, mas personal que reporta, mas protocolo aplicado.
Tacna registra seis veces mas por alumno que Puno y eso describe dos sistemas
de reporte, no dos infancias. El dato se publica con su cobertura al lado
—cuantas instituciones quedaron sin denominador— para que nadie tenga que
fiarse de una tasa construida sobre la mitad de un territorio.

REGLAS DE AGREGACION
  reportes   se suman
  alumnos    se suman
  tasa       reportes / alumnos x 1.000, recalculada desde los sumados;
             NUNCA se promedian tasas de colegios
  tasa       solo si la cobertura del denominador llega al minimo; por debajo
             se publica el conteo y se dice que falta el denominador

    python scripts/build_territorio.py
Salida: data/public/territorio.json
"""
import collections
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"

# Por debajo de esta proporcion de instituciones con denominador, la tasa
# describiria a una parte del territorio y se presentaria como si fuera todo.
COBERTURA_MINIMA = 0.90
# Un territorio con muy pocas instituciones no sostiene una tasa: un solo
# colegio la mueve entera.
MINIMO_INSTITUCIONES = 10


def main():
    inst = json.loads((PUB / "institutions.json").read_text(encoding="utf-8"))
    items = inst if isinstance(inst, list) else list(inst.values())
    meta = json.loads((PUB / "meta.json").read_text(encoding="utf-8"))
    anio = meta["anio_transversal"]

    def agregar(clave, extra=None):
        d = collections.defaultdict(
            lambda: {"reportes": 0, "alumnos": 0, "n": 0, "sin_denominador": 0, "serie": collections.Counter()}
        )
        for i in items:
            k = i.get(clave)
            if not k:
                continue
            v = d[k]
            v["n"] += 1
            v["reportes"] += (i.get("anios", {}).get(anio) or {}).get("total", 0) or 0
            for a, c in (i.get("anios") or {}).items():
                v["serie"][a] += c.get("total", 0) or 0
            m = i.get("matricula")
            if m:
                v["alumnos"] += m
            else:
                v["sin_denominador"] += 1
            if extra:
                v.setdefault("_extra", {})[extra] = i.get(extra)
        return d

    salida = {"anio": anio, "regiones": [], "ugeles": []}

    for clave, destino in (("departamento", "regiones"), ("ugel", "ugeles")):
        d = agregar(clave)
        for nombre, v in d.items():
            cobertura = (v["n"] - v["sin_denominador"]) / v["n"] if v["n"] else 0
            fiable = (
                cobertura >= COBERTURA_MINIMA
                and v["n"] >= MINIMO_INSTITUCIONES
                and v["alumnos"] > 0
            )
            fila = {
                "nombre": nombre,
                "reportes": v["reportes"],
                "alumnos": v["alumnos"],
                "instituciones": v["n"],
                "sin_denominador": v["sin_denominador"],
                "cobertura": round(cobertura, 4),
                # Null y no cero: sin denominador fiable no hay tasa, y un cero
                # se ordenaria como si fuera el territorio que menos registra.
                "tasa": round(v["reportes"] / v["alumnos"] * 1000, 2) if fiable else None,
                "serie": {a: n for a, n in sorted(v["serie"].items())},
            }
            if clave == "ugel":
                # La region de la UGEL, para poder agrupar sin volver a cruzar.
                regiones = {i["departamento"] for i in items if i.get("ugel") == nombre}
                fila["region"] = regiones.pop() if len(regiones) == 1 else None
            salida[destino].append(fila)

        salida[destino].sort(key=lambda x: -x["reportes"])

    salida["cobertura"] = {
        "minima": COBERTURA_MINIMA,
        "minimo_instituciones": MINIMO_INSTITUCIONES,
        "regiones_con_tasa": sum(1 for r in salida["regiones"] if r["tasa"] is not None),
        "ugeles_con_tasa": sum(1 for u in salida["ugeles"] if u["tasa"] is not None),
    }

    f = PUB / "territorio.json"
    f.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"regiones : {len(salida['regiones'])}  con tasa: {salida['cobertura']['regiones_con_tasa']}")
    print(f"ugeles   : {len(salida['ugeles'])}  con tasa: {salida['cobertura']['ugeles_con_tasa']}")
    print(f"-> {f.relative_to(ROOT)}  {f.stat().st_size // 1024} KB")
    print(f"\nano de la tasa: {anio}")
    top = sorted((r for r in salida["regiones"] if r["tasa"]), key=lambda x: -x["tasa"])
    print(f"  {'region':<18}{'reportes':>9}{'alumnos':>10}{'x1000':>8}")
    for r in top[:3] + top[-2:]:
        print(f"  {r['nombre'][:17]:<18}{r['reportes']:>9}{r['alumnos']:>10}{r['tasa']:>8.2f}")


if __name__ == "__main__":
    main()
