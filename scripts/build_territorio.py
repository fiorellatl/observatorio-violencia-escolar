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

# La cobertura del denominador no se trata como un si/no.
#
# Si el denominador cubre una proporcion c de las instituciones, la tasa
# publicada esta sobreestimada como maximo en 1/c - 1: el numerador cuenta
# todos los reportes y el divisor solo a los alumnos conocidos. Con c = 0,96
# eso son cuatro puntos, irrelevante; con c = 0,60 son sesenta y siete, que
# cambia la lectura entera.
#
# Un corte binario en 0,90 dejaba fuera a la UGEL 03 Cercado por 0,001 y le
# borraba la tasa del mapa, como si no supieramos nada de ella cuando la
# sabemos con un 11 % de margen. Asi que hay dos umbrales y una respuesta
# graduada: por encima de FIABLE la tasa se publica sin mas, entre FIABLE y
# MINIMA se publica marcada como aproximada, y por debajo no se publica.
COBERTURA_FIABLE = 0.95
COBERTURA_MINIMA = 0.75
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
            base = v["n"] >= MINIMO_INSTITUCIONES and v["alumnos"] > 0
            publicable = base and cobertura >= COBERTURA_MINIMA
            aproximada = publicable and cobertura < COBERTURA_FIABLE
            fila = {
                "nombre": nombre,
                "reportes": v["reportes"],
                "alumnos": v["alumnos"],
                "instituciones": v["n"],
                "sin_denominador": v["sin_denominador"],
                "cobertura": round(cobertura, 4),
                # Null y no cero: sin denominador fiable no hay tasa, y un cero
                # se ordenaria como si fuera el territorio que menos registra.
                "tasa": round(v["reportes"] / v["alumnos"] * 1000, 2) if publicable else None,
                # La tasa existe pero el denominador no cubre el territorio
                # entero: es un techo, no una medida exacta.
                "aproximada": aproximada,
                "sobreestima_max": round((1 / cobertura - 1) * 100, 1) if publicable else None,
                "serie": {a: n for a, n in sorted(v["serie"].items())},
            }
            if clave == "ugel":
                # La region de la UGEL, para poder agrupar sin volver a cruzar.
                regiones = {i["departamento"] for i in items if i.get("ugel") == nombre}
                fila["region"] = regiones.pop() if len(regiones) == 1 else None
            salida[destino].append(fila)

        salida[destino].sort(key=lambda x: -x["reportes"])

    salida["cobertura"] = {
        "fiable": COBERTURA_FIABLE,
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





def mapa_lima():
    """
    Geometria de Lima Metropolitana + las cifras de HOY.

    El fichero de `data/processed/lima_ugel_map.json` trae los caminos SVG ya
    proyectados y un conteo que viene de una descarga antigua. Ese conteo NO
    se usa: se vuelve a tomar de `territorio.json`, que es la unica fuente
    viva. Si se reutilizara, el mapa iria por su cuenta el dia que cambien los
    datos y nadie se enteraria.

    EL DATO ES DE LA UGEL, NO DEL DISTRITO. Todos los distritos de una misma
    UGEL se pintan igual porque comparten el mismo numero: SiseVe no publica
    nada por debajo de la UGEL. El mapa hace visible esa resolucion en vez de
    disimularla pintando cada distrito de un tono distinto.
    """
    origen = ROOT / "data" / "processed" / "lima_ugel_map.json"
    if not origen.exists():
        print("sin geometria de Lima: se omite el mapa")
        return

    geo = json.loads(origen.read_text(encoding="utf-8"))
    terr = json.loads((PUB / "territorio.json").read_text(encoding="utf-8"))
    porUgel = {u["nombre"]: u for u in terr["ugeles"]}

    faltan = [u for u in geo["ugeles"] if u not in porUgel]
    if faltan:
        raise SystemExit(f"ABORTA: UGEL del mapa sin datos actuales: {faltan}")

    salida = {
        "viewBox": geo["viewBox"],
        "sinGeometria": geo.get("sinGeometria", []),
        "anio": terr["anio"],
        # Solo el camino y su UGEL: el numero vive una vez, en `ugeles`.
        "distritos": [{"d": x["d"], "u": x["u"], "p": x["p"]} for x in geo["distritos"]],
        "ugeles": [
            {
                "nombre": n,
                "reportes": porUgel[n]["reportes"],
                "alumnos": porUgel[n]["alumnos"],
                "instituciones": porUgel[n]["instituciones"],
                "tasa": porUgel[n]["tasa"],
                "aproximada": porUgel[n]["aproximada"],
                "cobertura": porUgel[n]["cobertura"],
            }
            for n in geo["ugeles"]
        ],
    }

    f = PUB / "lima_mapa.json"
    f.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    con = sum(1 for u in salida["ugeles"] if u["tasa"] is not None)
    print(f"\nmapa de Lima: {len(salida['distritos'])} distritos · "
          f"{len(salida['ugeles'])} UGEL ({con} con tasa)")
    print(f"-> {f.relative_to(ROOT)}  {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
    mapa_lima()
