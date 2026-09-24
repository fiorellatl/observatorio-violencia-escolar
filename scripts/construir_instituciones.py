# -*- coding: utf-8 -*-
"""
Agrupa servicios educativos en INSTITUCIONES y escribe la capa institucional.

POR QUE EXISTE ESTE SCRIPT Y NO SE RE-EJECUTA EL ETL
`build_public_data.py` ya contiene `construir_instituciones()` con estas mismas
reglas, pero necesita el XLSX de SiseVe de Transparencia, que ya no esta en
disco. Re-ejecutarlo tampoco seria gratis: deshariamos el denominador del Censo
Educativo 2024 que se aplico despues. Asi que la agrupacion se deriva de la
capa publica ya generada mas los dos padrones que estan en data/processed, sin
tocar el ETL ni el denominador.

    python scripts/construir_instituciones.py

Entradas  data/public/schools_detail.json
          data/processed/padron_censo_2024.json
          data/processed/padron_nacional.json
Salidas   data/public/institutions.json        {slug: institucion}
          data/public/service-redirects.json   {slug_servicio: [slug_inst, nivel]}

LA CLAVE
`codinst` es el identificador oficial de institucion educativa del padron. NO
se usa `codlocal` —agrupa edificios: un CEBA y el colegio regular que comparten
local son instituciones distintas— ni coincidencia de nombres. Un servicio sin
`codinst` se queda solo: preferimos no agrupar antes que agrupar mal.

Cobertura medida: 96,2% de los servicios de SiseVe obtienen `codinst` cruzando
los dos padrones. Los 858 restantes quedan como institucion de un solo
servicio, que es lo que honestamente sabemos de ellos.

REGLAS DE AGREGACION
  reportes    se suman; son eventos disjuntos
  matricula   se suma; cada nivel tiene una poblacion distinta
  tasa        se recalcula desde numerador y denominador sumados, NUNCA
              promediando tasas
  tasa        solo si TODOS los servicios traen denominador: si falta uno, el
              numerador incluiria alumnos que el denominador no cuenta y la
              tasa saldria inflada
  pension     NO se suma; se expone por servicio
  contexto    NO se duplica; se toma el del servicio cabecera
"""
import json
import pathlib
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"
PROC = ROOT / "data" / "processed"

# Orden de PRESENTACION de los niveles dentro de una ficha: de menor a mayor.
ORDEN_NIVEL = {
    "Inicial no escolarizado": 0, "Inicial - Cuna": 1, "Inicial - Cuna-Jardín": 2,
    "Inicial - Jardín": 3, "Primaria": 4, "Secundaria": 5,
    "Básica Especial - Inicial": 6, "Básica Especial - Primaria": 7,
    "Básica Alternativa - Inicial e Intermedio": 8,
    "Básica Alternativa - Avanzado": 9, "CETPRO": 10,
}

# Que servicio da NOMBRE y URL a la institucion. No es el orden anterior: por
# ORDEN_NIVEL, un CETPRO adosado le ganaria a Secundaria. Aqui manda el nivel
# de educacion basica regular mas alto, que es el que suele llevar el nombre
# completo de la institucion. Gana el numero mas bajo.
PRIORIDAD_CABECERA = {
    "Secundaria": 0, "Primaria": 1, "Inicial - Jardín": 2, "Inicial - Cuna-Jardín": 3,
    "Inicial - Cuna": 4, "Básica Especial - Primaria": 5, "Básica Especial - Inicial": 6,
    "Básica Alternativa - Avanzado": 7, "Básica Alternativa - Inicial e Intermedio": 8,
    "CETPRO": 9, "Inicial no escolarizado": 10,
}

CLAVES_CONTEO = ("total", "psicologica", "fisica", "sexual",
                 "bullying", "ciberacoso", "personal_ie", "entre_escolares")


def indice_codinst(ruta: pathlib.Path) -> dict:
    """codMod -> codinst, a partir de un padron de data/processed."""
    if not ruta.exists():
        return {}
    m = {}
    for s in json.loads(ruta.read_text(encoding="utf-8")).values():
        cm = (s.get("cm") or "").zfill(7)
        ci = (s.get("codinst") or "").strip()
        if cm and ci and cm not in m:
            m[cm] = ci
    return m


def main():
    det = json.loads((PUB / "schools_detail.json").read_text(encoding="utf-8"))
    meta = json.loads((PUB / "meta.json").read_text(encoding="utf-8"))
    minimo = meta["matricula_minima"]
    anio_tasa = meta["anio_transversal"]

    censo = indice_codinst(PROC / "padron_censo_2024.json")
    rest = indice_codinst(PROC / "padron_nacional.json")
    # El censo manda sobre el REST: es el padron del que ya sale el
    # denominador, y discrepan en 37 servicios de 22.569.
    codinst = lambda cm: censo.get(cm) or rest.get(cm)

    grupos = defaultdict(list)
    sin_clave = 0
    for s in det.values():
        ci = codinst(s["cm"])
        if not ci:
            sin_clave += 1
        # Sin codinst, el servicio es su propia institucion. La clave lleva
        # prefijo para que no pueda chocar con un codinst real.
        grupos[ci or f"cm:{s['cm']}"].append(s)

    instituciones = {}
    redirecciones = {}

    for ci, servicios in grupos.items():
        # Cabecera: da nombre, URL y datos de identificacion a la institucion.
        cabecera = min(servicios, key=lambda s: (PRIORIDAD_CABECERA.get(s["nivel"], 99), s["cm"]))
        servicios.sort(key=lambda s: (ORDEN_NIVEL.get(s["nivel"], 99), s["cm"]))

        # La institucion hereda el slug de su cabecera. Asi las 13.005 fichas
        # de un solo servicio conservan su URL indexada tal cual, y solo
        # redirigen los niveles que se absorben.
        slug = cabecera["slug"]

        anios = defaultdict(lambda: defaultdict(int))
        for s in servicios:
            for anio, c in s["anios"].items():
                for k, v in c.items():
                    if k in CLAVES_CONTEO:
                        anios[anio][k] += int(v or 0)

        mats = [s.get("matricula") for s in servicios]
        completa = all(m for m in mats)
        matricula = sum(mats) if completa else None

        tasa = None
        if matricula and matricula >= minimo:
            tasa = round(anios.get(anio_tasa, {}).get("total", 0) / matricula * 1000, 2)

        for s in servicios:
            if s["slug"] != slug:
                redirecciones[s["slug"]] = [slug, s["nivel"]]

        instituciones[slug] = {
            "codinst": ci if not ci.startswith("cm:") else None,
            "slug": slug,
            # Codigo modular del servicio cabecera. Es la clave con la que los
            # indices de navegacion identifican a la institucion y la que
            # reconstruye su slug en el navegador.
            "cm": cabecera["cm"],
            "nombre": cabecera["nombre"],
            "distrito": cabecera["distrito"],
            "provincia": cabecera["provincia"],
            "departamento": cabecera["departamento"],
            "gestion": cabecera["gestion"],
            "dre": cabecera["dre"],
            "ugel": cabecera["ugel"],
            "niveles": [s["nivel"] for s in servicios],
            "total": sum(s["total"] for s in servicios),
            "anios": {a: dict(c) for a, c in sorted(anios.items())},
            "matricula": matricula,
            "matricula_completa": completa,
            "anio_matricula": cabecera.get("anio_matricula"),
            "tasa_2024": tasa,
            # El contexto no se agrega: describe un servicio concreto.
            "contexto": cabecera.get("contexto") or {},
            "servicios": [
                {
                    "cm": s["cm"],
                    "slug": s["slug"],
                    "nombre": s["nombre"],
                    "nivel": s["nivel"],
                    "total": s["total"],
                    "anios": s["anios"],
                    "matricula": s.get("matricula"),
                    "anio_matricula": s.get("anio_matricula"),
                    "docentes": s.get("docentes"),
                    "secciones": s.get("secciones"),
                    "pension": s.get("pension"),
                    "anio_pension": s.get("anio_pension"),
                    "tasa_2024": s.get("tasa_2024"),
                }
                for s in servicios
            ],
        }

    (PUB / "institutions.json").write_text(
        json.dumps(instituciones, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    # Valores validos de cada filtro. Es un fichero diminuto y existe para que
    # el servidor pueda comprobar los parametros de una URL sin cargar los 14 MB
    # de instituciones: sin esto, /rankings?gestion=Privada anunciaba en el
    # titulo un filtro que no se habia aplicado.
    # La UGEL se identifica por DRE + nombre: cuando un nombre existe en dos
    # DRE ("UGEL La Unión", Piura y Arequipa) se muestra con la DRE entre
    # paréntesis. Misma regla que etiquetasUgel() en src/lib/data/provider.ts.
    dres_por_ugel = defaultdict(set)
    for i in instituciones.values():
        dres_por_ugel[i["ugel"]].add(i["dre"])

    def etiqueta_ugel(i):
        if len(dres_por_ugel[i["ugel"]]) > 1:
            return f'{i["ugel"]} ({i["dre"].removeprefix("DRE ")})'
        return i["ugel"]

    facetas = {
        "r": sorted({i["departamento"] for i in instituciones.values()}),
        "p": sorted({i["provincia"] for i in instituciones.values()}),
        "d": sorted({i["distrito"] for i in instituciones.values()}),
        "g": sorted({i["gestion"] for i in instituciones.values()}),
        "n": sorted({n for i in instituciones.values() for n in i["niveles"]}),
        "u": sorted({etiqueta_ugel(i) for i in instituciones.values()}),
    }
    (PUB / "facetas.json").write_text(
        json.dumps(facetas, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    (PUB / "service-redirects.json").write_text(
        json.dumps(redirecciones, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    n = len(det)
    multi = [i for i in instituciones.values() if len(i["servicios"]) > 1]
    tam = defaultdict(int)
    for i in instituciones.values():
        tam[len(i["servicios"])] += 1
    con_tasa = sum(1 for i in instituciones.values() if i["tasa_2024"] is not None)

    print(f"servicios de SiseVe          : {n:,}")
    print(f"  con codinst                : {n - sin_clave:,} ({100*(n-sin_clave)/n:.1f}%)")
    print(f"  sin codinst (ficha suelta) : {sin_clave:,} ({100*sin_clave/n:.1f}%)")
    print(f"instituciones                : {len(instituciones):,}")
    print(f"  con mas de un nivel        : {len(multi):,}")
    print(f"  servicios por institucion  : {dict(sorted(tam.items()))}")
    print(f"  con tasa {anio_tasa}              : {con_tasa:,}")
    print(f"URLs de servicio que redirigen: {len(redirecciones):,}")
    print(f"URLs que NO cambian           : {len(instituciones):,}")

    # Comprobaciones que tienen que sostenerse siempre.
    total_serv = sum(len(i["servicios"]) for i in instituciones.values())
    assert total_serv == n, f"se perdieron servicios: {total_serv} != {n}"
    assert sum(i["total"] for i in instituciones.values()) == sum(s["total"] for s in det.values()), \
        "la suma de reportes no cuadra"
    for i in instituciones.values():
        if i["tasa_2024"] is not None:
            assert i["matricula_completa"], f"{i['slug']}: tasa con denominador incompleto"
    assert not (set(redirecciones) & set(instituciones)), \
        "un slug no puede ser a la vez institucion y redireccion"
    print("\ncomprobaciones: servicios completos, reportes cuadran, "
          "ninguna tasa con denominador parcial")


if __name__ == "__main__":
    main()
