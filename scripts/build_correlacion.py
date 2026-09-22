# -*- coding: utf-8 -*-
"""
Dos cifras por colegio y ano: violencia entre alumnos y de un adulto.

LA UNIDAD DE ANALISIS ES LA INSTITUCION, no el registro de SiseVe ni el
servicio educativo. `institutions.json` ya agrupa primaria, secundaria e
inicial bajo un solo colegio sumando sus reportes, asi que un colegio con
tres niveles es UN punto del grafico y no tres. No se deduplica nada aqui
porque el modelo ya lo resolvio.

LAS DOS CATEGORIAS SON EXHAUSTIVAS Y EXCLUYENTES. Se comprobo sobre la capa
publica: `entre_escolares + personal_ie == total` en los 46.921 ano-colegio
con reportes, sin una sola excepcion. Asi que si un colegio tiene reportes
ese ano, sus dos cifras se conocen: un cero es un cero de verdad, no un
hueco.

QUE ENTRA Y QUE NO, QUE ES LA DECISION IMPORTANTE
Solo entran las instituciones con AL MENOS UN reporte en el ano. Las demas
quedan fuera, y no por comodidad:

  - La capa publica contiene las 17.399 instituciones que alguna vez
    aparecieron en SiseVe, no el padron nacional. Un colegio sin reportes en
    2025 puede no haber tenido ninguno o puede no tener a nadie que registre:
    los datos no distinguen esas dos cosas, asi que su (0,0) no significa lo
    mismo que el de otro.
  - Y sobre todo: meter once mil puntos en el origen fabrica correlacion.
    Medido, para 2025, r pasa de 0,108 a 0,291 solo por incluirlos. Ese 0,291
    no describe ninguna relacion entre los dos tipos de violencia; describe
    que muchos colegios no registran nada de nada.

    python scripts/build_correlacion.py
Salida: data/public/correlacion.json
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"

# La pandemia queda fuera: con los colegios cerrados, los reportes no
# describen lo que pasa dentro de un colegio.
PANDEMIA = {"2020", "2021"}


def pearson(puntos):
    """
    Pearson sobre los COLEGIOS, no sobre los puntos del grafico.

    Cada punto agrupa `n` colegios con los mismos dos valores, asi que entra
    en las sumas `n` veces. Calcularlo sobre las 198 posiciones distintas
    daria otro numero: trataria a un par que reune 1.451 colegios igual que a
    uno que reune uno solo.
    """
    n = sum(p[2] for p in puntos)
    if n < 3:
        return None
    mx = sum(p[0] * p[2] for p in puntos) / n
    my = sum(p[1] * p[2] for p in puntos) / n
    sxy = sum((p[0] - mx) * (p[1] - my) * p[2] for p in puntos)
    sx = sum((p[0] - mx) ** 2 * p[2] for p in puntos) ** 0.5
    sy = sum((p[1] - my) ** 2 * p[2] for p in puntos) ** 0.5
    if sx == 0 or sy == 0:
        return None
    return round(sxy / (sx * sy), 4)


def main():
    inst = json.loads((PUB / "institutions.json").read_text(encoding="utf-8"))
    items = inst if isinstance(inst, list) else list(inst.values())
    meta = json.loads((PUB / "meta.json").read_text(encoding="utf-8"))

    anios = sorted(
        {a for i in items for a in (i.get("anios") or {})} - PANDEMIA,
        reverse=True,
    )[:5]
    anios.sort()

    # ── Un punto por VALOR, no por colegio ─────────────────────────────
    # Los conteos son enteros pequenos y se repiten muchisimo: en 2025, los
    # 6.134 colegios ocupan 198 posiciones distintas y el par (1,0) reune a
    # 1.451 de ellos. Dibujar 6.134 marcas sobre 198 sitios esconderia al 97 %
    # bajo la de encima y el grafico parecerian doscientos colegios.
    #
    # Asi que cada marca es un par de valores y lleva CUANTOS colegios estan
    # ahi. La correlacion, en cambio, se calcula sobre los 6.134 colegios: el
    # grafico agrupa, la estadistica no.
    por_anio = {}
    for a in anios:
        conteo = {}
        for i in items:
            c = (i.get("anios") or {}).get(a)
            if not c or not c.get("total"):
                continue
            clave = (c.get("entre_escolares", 0) or 0, c.get("personal_ie", 0) or 0)
            conteo[clave] = conteo.get(clave, 0) + 1
        puntos = sorted(([e, p, n] for (e, p), n in conteo.items()), key=lambda x: -x[2])
        por_anio[a] = {
            "puntos": puntos,
            "colegios": sum(n for _, _, n in puntos),
            "r": pearson(puntos),
            "ambos": sum(n for e, p, n in puntos if e > 0 and p > 0),
        }

    salida = {
        "anios": anios,
        "anio_parcial": meta.get("anio_parcial"),
        "datos": por_anio,
    }
    f = PUB / "correlacion.json"
    f.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"anios      : {', '.join(anios)}")
    print(f"-> {f.relative_to(ROOT)}  {f.stat().st_size / 1024:.1f} KB\n")
    print(f"  {'ano':<6}{'colegios':>10}{'puntos':>8}{'r':>8}{'con ambos':>11}")
    for a in anios:
        d = por_anio[a]
        print(f"  {a:<6}{d['colegios']:>10,}{len(d['puntos']):>8}{d['r']:>8.3f}"
              f"{d['ambos'] / d['colegios'] * 100:>10.1f} %")


if __name__ == "__main__":
    main()
