# -*- coding: utf-8 -*-
"""
Cuanto del sistema escolar podemos contextualizar.

La pregunta que responde: de los colegios que SiseVe registra, a cuantos
podemos ponerles un denominador, una institucion y un contexto. No es lo mismo
"tenemos 122.984 reportes" que "podemos situar estadisticamente a N colegios".

    python scripts/medir_cobertura.py
    python scripts/medir_cobertura.py --md    # tablas en Markdown

IMPORTANTE MIENTRAS LA DESCARGA ESTA EN CURSO
---------------------------------------------
Un colegio sin match puede estarlo por dos razones muy distintas:

  a) su distrito todavia no se ha descargado  -> no sabemos nada aun
  b) su distrito ya esta y el codigo no aparece -> es un no-match de verdad

Mezclarlas daria una cobertura falsamente mala y, peor, un perfil de "quien
queda fuera" que en realidad seria el orden en que descargamos. El informe las
separa siempre.
"""
import argparse
import collections
import json
import pathlib
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"
PADRON = ROOT / "data" / "processed" / "padron_nacional.json"
CACHE = ROOT / "data" / "raw" / "padron_nacional"
GEO = ROOT / "data" / "raw" / "peru_distrital_simple.geojson"
MATRICULA_MINIMA = 100

# El nombre del distrito no coincide siempre entre fuentes. Solo alias
# verificados uno a uno; lo que no se pueda resolver se reporta, no se adivina.
ALIAS = {
    "PUEBLO LIBRE": "MAGDALENA VIEJA",
    "LIMA": "CERCADO DE LIMA",
    "CERCADO DE LIMA": "LIMA",
    "NASCA": "NAZCA",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.upper().split())


def pct(a: int, b: int) -> str:
    return f"{100 * a / b:.1f}%" if b else "—"


def cargar():
    """
    El padron se reconstruye desde el cache de paginas, no desde el volcado
    periodico: mientras la descarga corre, el volcado va por detras y medir con
    el subestima la cobertura real que ya hay en disco.
    """
    det = json.loads((PUB / "schools_detail.json").read_text(encoding="utf-8"))
    pad = {}
    for f in CACHE.glob("*.json"):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue                      # pagina a medio escribir; se ignora
        for x in (d.get("items", []) if isinstance(d, dict) else d):
            pad[f"{x['cm']}-{x['anexo']}"] = x
    if not pad and PADRON.exists():
        pad = json.loads(PADRON.read_text(encoding="utf-8"))
    return list(det.values()), pad


def mapa_distritos():
    """(DEPARTAMENTO, DISTRITO) normalizados -> ubigeo."""
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    m = {}
    for f in geo["features"]:
        p = f["properties"]
        ubi = str(p["IDDIST"]).zfill(6)
        dep, dis = norm(p["NOMBDEP"]), norm(p["NOMBDIST"])
        m[(dep, dis)] = ubi
    for viejo, nuevo in ALIAS.items():
        for k, v in list(m.items()):
            if isinstance(k, tuple) and k[1] == norm(nuevo):
                m[(k[0], norm(viejo))] = v
    return m


def descargados():
    """Ubigeos con al menos una pagina en el cache."""
    return {f.stem.split("_")[0] for f in CACHE.glob("*.json")} if CACHE.exists() else set()


def perfil(filas, etiqueta, total_por_clave, clave):
    """Reparto de un subconjunto por una variable, con su peso relativo."""
    c = collections.Counter(f[clave] for f in filas)
    out = []
    for k, n in c.most_common(12):
        base = total_por_clave.get(k, 0)
        out.append((k, n, base, pct(n, base)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--md", action="store_true", help="salida en Markdown")
    a = ap.parse_args()

    escuelas, pad = cargar()
    geo = mapa_distritos()
    listos = descargados()

    # padron indexado por codigo modular (un cm puede tener varios anexos)
    por_cm = collections.defaultdict(list)
    for s in pad.values():
        por_cm[s["cm"]].append(s)

    sin_ubigeo = collections.Counter()
    for e in escuelas:
        dep, dis = norm(e["departamento"]), norm(e["distrito"])
        # Solo (departamento, distrito). Nunca el nombre suelto: hay un
        # "San Miguel" en Puno y otro en Ayacucho, y casarlos por nombre movia
        # colegios de una region a otra.
        ubi = geo.get((dep, dis))
        e["_ubigeo"] = ubi
        e["_distrito_listo"] = bool(ubi and ubi in listos)
        if not ubi:
            sin_ubigeo[(e["departamento"], e["distrito"])] += 1

        serv = por_cm.get(e["cm"], [])
        e["_match"] = bool(serv)
        e["_anexo_ambiguo"] = len(serv) > 1
        elegido = None
        if serv:
            elegido = sorted(serv, key=lambda s: (s.get("estado") != "Activo",
                                                  s.get("anexo") != "0",
                                                  not s.get("matricula")))[0]
        e["_serv"] = elegido
        e["_mat"] = (elegido or {}).get("matricula") or 0
        e["_codinst"] = (elegido or {}).get("codinst")

    N = len(escuelas)
    en_zona = [e for e in escuelas if e["_distrito_listo"]]
    match = [e for e in escuelas if e["_match"]]
    con_mat = [e for e in match if e["_mat"] > 0]
    con_tasa = [e for e in match if e["_mat"] >= MATRICULA_MINIMA]
    ambiguos = [e for e in match if e["_anexo_ambiguo"]]
    con_ci = [e for e in match if e["_codinst"]]

    grupos = collections.defaultdict(list)
    for e in con_ci:
        grupos[e["_codinst"]].append(e)
    multinivel = {k: v for k, v in grupos.items() if len(v) > 1}

    reportes_total = sum(e["total"] for e in escuelas)
    reportes_match = sum(e["total"] for e in match)
    reportes_ambiguos = sum(e["total"] for e in ambiguos)

    fila = (lambda k, v, p="": f"| {k} | {v} | {p} |") if a.md else (
        lambda k, v, p="": f"  {k:<44} {v:>10} {p:>8}")

    print()
    print("COBERTURA DEL PADRON NACIONAL CONTRA SiseVe")
    print("=" * 68)
    if len(listos) < 1834:
        print(f"\n  *** DESCARGA EN CURSO: {len(listos)} de 1.834 distritos "
              f"({pct(len(listos), 1834)}) ***")
        print("  Las cifras 'nacional' son un piso, no el resultado final.\n")

    if a.md:
        print("\n| Métrica | Valor | % |\n|---|---|---|")
    print(fila("Escuelas con reportes SiseVe", f"{N:,}", "100%"))
    print(fila("  en distritos ya descargados", f"{len(en_zona):,}", pct(len(en_zona), N)))
    print(fila("Servicios con match en ESCALE", f"{len(match):,}", pct(len(match), N)))
    print(fila("Con matricula (cualquiera)", f"{len(con_mat):,}", pct(len(con_mat), N)))
    print(fila(f"Con tasa calculable (mat >= {MATRICULA_MINIMA})",
               f"{len(con_tasa):,}", pct(len(con_tasa), N)))
    print(fila("Con codinst (agrupables)", f"{len(con_ci):,}", pct(len(con_ci), N)))
    print(fila("Instituciones (codinst distintos)", f"{len(grupos):,}"))
    print(fila("  de ellas, multinivel", f"{len(multinivel):,}",
               pct(len(multinivel), len(grupos))))
    print(fila("Servicios en institucion multinivel",
               f"{sum(len(v) for v in multinivel.values()):,}"))
    print(fila("Codigos modulares con varios anexos", f"{len(ambiguos):,}",
               pct(len(ambiguos), max(len(match), 1))))
    print(fila("Reportes atribuibles sin ambiguedad",
               f"{reportes_match - reportes_ambiguos:,}",
               pct(reportes_match - reportes_ambiguos, reportes_total)))

    # ---- LA PREGUNTA IMPORTANTE: quien se queda fuera ----
    print("\n")
    print("QUIENES QUEDAN FUERA")
    print("=" * 68)
    fuera_real = [e for e in escuelas if not e["_match"] and e["_distrito_listo"]]
    fuera_pend = [e for e in escuelas if not e["_match"] and not e["_distrito_listo"]]
    print(f"\n  Sin match, distrito YA descargado (no-match real) : {len(fuera_real):,}")
    print(f"  Sin match, distrito AUN NO descargado             : {len(fuera_pend):,}")
    if en_zona:
        m_zona = [e for e in en_zona if e["_match"]]
        print(f"\n  Tasa de match donde ya miramos: {len(m_zona):,} de {len(en_zona):,}"
              f"  ({pct(len(m_zona), len(en_zona))})")

    if fuera_real:
        print("\n  Perfil del no-match real (n, sobre el total de esa categoria en zona):")
        for clave, titulo in (("departamento", "Region"), ("nivel", "Nivel"),
                              ("gestion", "Gestion")):
            base = collections.Counter(e[clave] for e in en_zona)
            print(f"\n   {titulo}")
            for k, n, tot, p in perfil(fuera_real, titulo, base, clave):
                print(f"     {str(k)[:40]:<40} {n:>6} de {tot:>6}  {p:>7}")

        rep_fuera = sum(e["total"] for e in fuera_real)
        rep_zona = sum(e["total"] for e in en_zona)
        print(f"\n   Reportes implicados: {rep_fuera:,} de {rep_zona:,}"
              f" en zona ({pct(rep_fuera, rep_zona)})")
        chicos = sum(1 for e in fuera_real if e["total"] <= 2)
        print(f"   De los sin match, {chicos:,} ({pct(chicos, len(fuera_real))})"
              f" tienen 2 reportes o menos")

    if sin_ubigeo:
        cols = sum(sin_ubigeo.values())
        reps = sum(e["total"] for e in escuelas if not e["_ubigeo"])
        print("")
        print(f"  ZONA CIEGA: {len(sin_ubigeo)} distritos de SiseVe no figuran")
        print("  en el geojson que recorre el descargador, asi que su ubigeo no se")
        print("  consulta nunca y sus colegios no pueden casar, esperemos lo que")
        print("  esperemos.")
        print(f"  Afecta a {cols:,} colegios y {reps:,} reportes.")
        for (dep, dis), n in sin_ubigeo.most_common(12):
            print(f"     {dep} / {dis}: {n} colegios")

    print()


if __name__ == "__main__":
    main()
