# -*- coding: utf-8 -*-
"""
Detector de cambios en el registro de reportes.

NO es una puntuacion del colegio. No ordena colegios por violencia, por riesgo
ni por nada parecido. Responde a una sola pregunta:

    ¿En que colegios cambio el registro de reportes mas de lo que cabria
    esperar si nada hubiera cambiado?

Y la respuesta siempre admite dos lecturas que el producto no puede separar:
puede haber cambiado lo que ocurre, o puede haber cambiado la disposicion a
reportarlo. Un colegio que estrena psicologo y empieza a registrar aparece
igual que uno donde algo empeoro.

    python scripts/build_signals.py
    python scripts/build_signals.py --validar   # casos extremos, sin escribir

Entrada : data/public/schools_detail.json  (no toca el ETL ni la fuente cruda)
Salida  : data/public/signals.json


EL METODO
=========

1. Prueba binomial condicional
------------------------------
Un colegio registro `a` reportes un anio y `b` al siguiente. Si los conteos se
comportan como Poisson con la misma exposicion, entonces, condicionando en el
total n = a + b, se cumple exactamente

    b ~ Binomial(n, θ)

Bajo la hipotesis nula "este colegio cambio igual que el pais",

    θ₀ = R / (1 + R),    R = total nacional del anio 2 / total del anio 1

Asi, un colegio que sube un 8% cuando el pais sube un 8% no es una senal.

El p-valor es a dos colas por duplicacion de la cola menor:

    p = min(1, 2 · min( P(X ≤ b), P(X ≥ b) ))

POR QUE ESTA PRUEBA Y NO UN PORCENTAJE
Resuelve sola el problema de 1 → 5 frente a 100 → 180, sin constantes
inventadas ni umbrales arbitrarios:

    1 → 5    n=6     p ≈ 0,22    no sorprende
    100 → 180 n=280  p ≈ 1e-6    sorprende mucho

El +400% queda por debajo del +80% porque con seis reportes repartidos al azar
un reparto 1-5 ocurre una de cada cinco veces.

SUPUESTOS, Y SON FUERTES
  - Exposicion constante entre los dos anios. Solo tenemos un padron de
    matricula, asi que se asume que el colegio no cambio de tamano de forma
    apreciable. Si cambio, la senal puede reflejar eso.
  - Independencia entre reportes. Es dudosa: un mismo hecho puede generar
    varios reportes, y un caso sonado puede arrastrar denuncias. Esto tiende a
    producir mas dispersion de la que el modelo espera, de modo que el metodo
    peca de optimista. Por eso se corrige por multiplicidad y se exige un
    minimo de volumen.

2. Correccion por multiplicidad (Benjamini-Hochberg)
----------------------------------------------------
Se prueban miles de colegios a la vez. A α = 0,05 sin corregir, uno de cada
veinte colegios que no cambiaron nada apareceria como senal, y esos falsos
positivos tendrian nombre y direccion. Se aplica Benjamini-Hochberg con
q = 0,05 sobre el conjunto de colegios de cada par de anios: de las senales
publicadas, se espera que como mucho un 5% sean ruido.

3. Orden
--------
El p-valor FILTRA; no ordena. Entre las que sobreviven se ordena por cambio
absoluto, para que arriba quede lo que afecta a mas estudiantes y no lo que
tiene el porcentaje mas llamativo.

4. Volumen minimo
-----------------
Se exige n = a + b ≥ MIN_N. La prueba ya descarta los casos pequenos por si
sola, pero el minimo evita publicar fichas construidas sobre dos o tres
registros, que no aguantan la lectura que un lector va a hacer de ellas.


SENALES SIN PRUEBA ESTADISTICA
==============================
Reaparicion y persistencia son PATRONES, no contrastes: no hay hipotesis nula
que rechazar, son definiciones. Se publican como tales, con su regla explicita
y sin p-valor, y nunca mezcladas en el mismo orden que las anteriores.


LO QUE NO SE CALCULA, Y POR QUE
===============================
Cambio de TASA entre anios. Solo existe un padron de matricula (ESCALE 2026).
Dividir los reportes de 2023 y de 2024 por el mismo denominador produce una
serie cuyas variaciones son identicas a las de los conteos: no aporta
informacion y sugiere una precision que no tenemos. La tasa aparece como
contexto del anio con denominador valido, nunca como serie.
"""
import argparse
import json
import math
import pathlib
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"

Q_FDR = 0.05          # tasa de falso descubrimiento admitida
MIN_N = 8             # reportes minimos sumando los dos anios
MIN_COMPOSICION = 30  # reportes por anio para contrastar composicion
TOPE_POR_PAR = 400    # senales publicadas por par de anios y tipo


# ---------------------------------------------------------------- binomial --
def _log_pmf(k: int, n: int, t: float) -> float:
    if t <= 0.0:
        return 0.0 if k == 0 else -math.inf
    if t >= 1.0:
        return 0.0 if k == n else -math.inf
    return (math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)
            + k * math.log(t) + (n - k) * math.log1p(-t))


def p_binomial(b: int, n: int, t: float) -> float:
    """p a dos colas por duplicacion de la cola menor."""
    if n <= 0:
        return 1.0
    cola_baja = sum(math.exp(_log_pmf(k, n, t)) for k in range(0, b + 1))
    cola_alta = sum(math.exp(_log_pmf(k, n, t)) for k in range(b, n + 1))
    return min(1.0, 2.0 * min(cola_baja, cola_alta))


def benjamini_hochberg(pares, q: float = Q_FDR):
    """
    pares: [(p, carga), ...]. Devuelve las cargas que sobreviven.

    Se ordena por p; se busca el mayor k con p_(k) ≤ k/m · q; se aceptan todas
    las hipotesis hasta ese k.
    """
    m = len(pares)
    if m == 0:
        return []
    orden = sorted(pares, key=lambda x: x[0])
    corte = 0
    for i, (p, _) in enumerate(orden, 1):
        if p <= i / m * q:
            corte = i
    return [carga for _, carga in orden[:corte]]


# ------------------------------------------------------------- chi cuadrado --
def p_chi2(x: float, df: int) -> float:
    """
    Cola superior de una chi-cuadrado. Cerrada para los dos grados de libertad
    que necesitamos, asi que no hace falta scipy:
        df = 2  ->  exp(-x/2)
        df = 1  ->  erfc(sqrt(x/2))
    """
    if x <= 0:
        return 1.0
    if df == 2:
        return math.exp(-x / 2.0)
    if df == 1:
        return math.erfc(math.sqrt(x / 2.0))
    raise ValueError(f"df no soportado: {df}")


def contraste_composicion(a: dict, b: dict):
    """
    ¿Cambio el reparto entre tipos de violencia? Chi-cuadrado de homogeneidad
    sobre la tabla 2 x k. Devuelve (p, df) o None si no hay caso.
    """
    tipos = [t for t in ("fisica", "psicologica", "sexual")
             if (a.get(t, 0) + b.get(t, 0)) > 0]
    if len(tipos) < 2:
        return None
    na = sum(a.get(t, 0) for t in tipos)
    nb = sum(b.get(t, 0) for t in tipos)
    if na < MIN_COMPOSICION or nb < MIN_COMPOSICION:
        return None

    total = na + nb
    x2 = 0.0
    for t in tipos:
        col = a.get(t, 0) + b.get(t, 0)
        for n_anio, obs in ((na, a.get(t, 0)), (nb, b.get(t, 0))):
            esp = n_anio * col / total
            if esp <= 0:
                continue
            x2 += (obs - esp) ** 2 / esp
    df = len(tipos) - 1
    if df not in (1, 2):
        return None
    return p_chi2(x2, df), df


# ------------------------------------------------------------------ senales --
def anios_comparables(meta):
    """Anios utilizables: sin pandemia y sin el anio parcial."""
    pandemia = set(meta["anios_pandemia"])
    return [a for a in sorted(
        {str(y) for y in range(int(meta["anio_min"]), int(meta["anio_max"]) + 1)})
        if a not in pandemia and a != meta["anio_parcial"]]


def construir(det, meta, verbose=True):
    anios = anios_comparables(meta)
    pares = [(anios[i - 1], anios[i]) for i in range(1, len(anios))
             if int(anios[i]) - int(anios[i - 1]) == 1]

    escuelas = list(det.values())

    # Totales nacionales por anio, para la hipotesis nula.
    nacional = defaultdict(int)
    for s in escuelas:
        for anio, c in s["anios"].items():
            nacional[anio] += c.get("total", 0)

    salida = {"pares": [], "meta": {
        "q_fdr": Q_FDR, "min_n": MIN_N, "min_composicion": MIN_COMPOSICION,
        "anios": anios,
    }}

    for a1, a2 in pares:
        if not nacional.get(a1) or not nacional.get(a2):
            continue
        R = nacional[a2] / nacional[a1]
        theta = R / (1.0 + R)

        candidatos, comp_cand = [], []
        reaparicion, persistencia = [], []
        previos = [x for x in anios if int(x) < int(a2)]

        for s in escuelas:
            ca = s["anios"].get(a1, {})
            cb = s["anios"].get(a2, {})
            a, b = ca.get("total", 0), cb.get("total", 0)
            n = a + b

            # --- cambio de volumen ---
            if n >= MIN_N:
                p = p_binomial(b, n, theta)
                candidatos.append((p, (s, a, b, p)))

            # --- cambio de composicion ---
            cc = contraste_composicion(ca, cb)
            if cc:
                comp_cand.append((cc[0], (s, ca, cb, cc[0], cc[1])))

            # --- reaparicion: dos anios comparables previos en cero ---
            if b > 0 and len(previos) >= 2:
                ultimos = previos[-2:]
                if all(s["anios"].get(x, {}).get("total", 0) == 0 for x in ultimos):
                    antes = [x for x in previos if s["anios"].get(x, {}).get("total", 0) > 0]
                    if antes:
                        reaparicion.append((s, b, len(ultimos), antes[-1]))

            # --- persistencia: 5 de los ultimos 6 anios comparables ---
            ventana = [x for x in anios if int(x) <= int(a2)][-6:]
            if len(ventana) == 6:
                con = [x for x in ventana if s["anios"].get(x, {}).get("total", 0) > 0]
                if len(con) >= 5:
                    persistencia.append((s, len(con), len(ventana),
                                         sum(s["anios"].get(x, {}).get("total", 0)
                                             for x in ventana)))

        vol = benjamini_hochberg(candidatos)
        comp = benjamini_hochberg(comp_cand)

        def ficha(s):
            return {
                "nombre": s["nombre"], "cm": s["cm"], "slug": s["slug"],
                "distrito": s["distrito"], "provincia": s["provincia"],
                "region": s["departamento"], "gestion": s["gestion"],
                "nivel": s["nivel"], "matricula": s.get("matricula"),
                "anio_matricula": s.get("anio_matricula"),
            }

        aumentos, bajadas = [], []
        for s, a, b, p in vol:
            item = {**ficha(s), "anterior": a, "actual": b, "cambio": b - a, "p": round(p, 6)}
            (aumentos if b > a else bajadas).append(item)
        aumentos.sort(key=lambda x: -x["cambio"])
        bajadas.sort(key=lambda x: x["cambio"])

        comp_items = []
        for s, ca, cb, p, df in comp:
            comp_items.append({
                **ficha(s), "p": round(p, 6), "df": df,
                "antes": {k: ca.get(k, 0) for k in ("fisica", "psicologica", "sexual")},
                "ahora": {k: cb.get(k, 0) for k in ("fisica", "psicologica", "sexual")},
                "total_antes": ca.get("total", 0), "total_ahora": cb.get("total", 0),
            })
        comp_items.sort(key=lambda x: x["p"])

        reaparicion.sort(key=lambda x: -x[1])
        persistencia.sort(key=lambda x: -x[3])

        salida["pares"].append({
            "anio_anterior": a1, "anio": a2,
            "nacional_anterior": nacional[a1], "nacional": nacional[a2],
            "ratio_nacional": round(R, 4), "theta": round(theta, 4),
            "probados": len(candidatos), "probados_composicion": len(comp_cand),
            # Las listas van recortadas a TOPE_POR_PAR; el total real se guarda
            # aparte para que la interfaz no presente el recorte como el dato.
            "totales": {
                "aumento": len(aumentos), "disminucion": len(bajadas),
                "composicion": len(comp_items), "reaparicion": len(reaparicion),
                "persistencia": len(persistencia),
            },
            "aumento": aumentos[:TOPE_POR_PAR],
            "disminucion": bajadas[:TOPE_POR_PAR],
            "composicion": comp_items[:TOPE_POR_PAR],
            "reaparicion": [{**ficha(s), "actual": b, "anios_sin": k, "ultimo_con": u}
                            for s, b, k, u in reaparicion[:TOPE_POR_PAR]],
            "persistencia": [{**ficha(s), "anios_con": k, "ventana": v, "total": t}
                             for s, k, v, t in persistencia[:TOPE_POR_PAR]],
        })

        if verbose:
            print(f"{a1} -> {a2}  R={R:.3f}  probados={len(candidatos):,}  "
                  f"aumento={len(aumentos)}  disminucion={len(bajadas)}  "
                  f"composicion={len(comp_items)}  reaparicion={len(reaparicion)}  "
                  f"persistencia={len(persistencia)}", flush=True)

    return salida


# ------------------------------------------------------------- validacion ---
def validar():
    print("CASOS EXTREMOS DE LA PRUEBA BINOMIAL (θ = 0,5)\n")
    casos = [
        (1, 5, "el caso que nos preocupaba: +400%"),
        (100, 180, "mismo sentido, +80%, mucho mas volumen"),
        (0, 5, "aparicion desde cero"),
        (0, 30, "aparicion desde cero, con volumen"),
        (3, 11, "el ejemplo del encargo"),
        (14, 4, "disminucion"),
        (50, 50, "sin cambio"),
        (2, 3, "ruido"),
        (1, 1, "nada que decir"),
    ]
    for a, b in [(c[0], c[1]) for c in casos]:
        pass
    for a, b, nota in casos:
        n = a + b
        p = p_binomial(b, n, 0.5)
        rel = f"{(b - a) / a * 100:+.0f}%" if a else "—"
        marca = "SENAL" if p < 0.05 else "  ·  "
        print(f"  {a:>4} -> {b:<4} n={n:<5} cambio={b-a:+4d} {rel:>7}  "
              f"p={p:.4g}  {marca}   {nota}")

    print("\n  Lectura: 1 -> 5 NO es senal y 100 -> 180 si. El porcentaje")
    print("  llamativo pierde frente al volumen, que es lo que buscabamos.")

    print("\n\nEFECTO DEL RATIO NACIONAL")
    print("  Si el pais sube un 50%, un colegio que sube un 50% no es noticia:")
    for R in (1.0, 1.5):
        t = R / (1 + R)
        p = p_binomial(30, 50, t)
        print(f"    20 -> 30  con R={R:.1f} (θ={t:.3f})  p={p:.4g}")

    print("\n\nBENJAMINI-HOCHBERG")
    import random
    random.seed(7)
    # 1.000 colegios sin ningun cambio real: p ~ Uniforme(0,1)
    falsos = [(random.random(), i) for i in range(1000)]
    print(f"  1.000 colegios sin cambio real, α=0,05 sin corregir: "
          f"{sum(1 for p, _ in falsos if p < 0.05)} falsos positivos")
    print(f"  con Benjamini-Hochberg q=0,05: {len(benjamini_hochberg(falsos))}")

    print("\n\nCHI-CUADRADO DE COMPOSICION")
    a = {"fisica": 50, "psicologica": 50, "sexual": 0, "total": 100}
    b = {"fisica": 50, "psicologica": 50, "sexual": 0, "total": 100}
    print(f"  identicas            -> {contraste_composicion(a, b)}")
    b2 = {"fisica": 10, "psicologica": 90, "sexual": 0, "total": 100}
    print(f"  vuelco 50/50 a 10/90 -> {contraste_composicion(a, b2)}")
    chico = {"fisica": 5, "psicologica": 5, "sexual": 0, "total": 10}
    print(f"  por debajo del minimo-> {contraste_composicion(chico, chico)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--validar", action="store_true")
    a = ap.parse_args()

    if a.validar:
        validar()
        return

    det = json.loads((PUB / "schools_detail.json").read_text(encoding="utf-8"))
    meta = json.loads((PUB / "meta.json").read_text(encoding="utf-8"))
    print(f"{len(det):,} colegios\n")
    salida = construir(det, meta)

    p = PUB / "signals.json"
    p.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")),
                 encoding="utf-8")
    print(f"\n-> {p.name}  {p.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
