# -*- coding: utf-8 -*-
"""
Recupera las pensiones que ya teniamos en disco y no llegaron a publicarse.

QUE PASO
`data/processed/identicole.json` tiene 337 fichas con pension. La capa publica
solo publica 168. Las otras 169 se descargaron DESPUES de la ultima ejecucion
del ETL, y el ETL no se puede repetir: el XLSX de SiseVe de Transparencia que
genero la capa actual ya no esta en disco.

Asi que esto no re-ejecuta nada. Toma la capa publica tal como esta y le
escribe UNICAMENTE el campo de pension, igual que `construir_instituciones.py`
deriva la capa institucional sin tocar el ETL.

QUE TOCA, EXACTAMENTE
  schools_detail.json   pension, anio_pension
  institutions.json     pension, anio_pension  (dentro de cada servicio)
  cross_2024.json       pension

`anio_pension` viaja con la pension y no es un campo aparte: publicar un
importe sin su ano contradiria la regla del producto de que cada cifra lleva
su fuente y su ano, y la interfaz lo pinta en la misma insignia. Es el unico
campo adyacente que se toca, y se dice aqui para que no haya que deducirlo.

QUE NO TOCA
  Reportes, matricula, docentes, secciones, tasa, rankings, senales, contexto
  ni ningun otro campo. Al terminar se comprueba campo a campo: si algo mas
  cambio, aborta y no escribe.

    python scripts/reparar_pension.py             # diff, no escribe
    python scripts/reparar_pension.py --aplicar   # escribe
"""
import argparse
import copy
import json
import pathlib
import collections

ROOT = pathlib.Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "public"
PROC = ROOT / "data" / "processed"
CACHE = ROOT / "data" / "raw" / "identicole"


def leer(p):
    return json.loads(p.read_text(encoding="utf-8"))


def escribir(p, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def pension_de(ficha):
    """
    El importe y su ano.

    NO se usa `pension_2025 or pension_2024`: ese `or` descarta un cero, y un
    colegio con pension cero no es un colegio sin dato. Hoy no hay ceros en la
    fuente, pero la forma correcta no cuesta mas.
    """
    p25 = ficha.get("pension_2025")
    if p25 is not None and p25 != "":
        return p25, (ficha.get("_anios", {}) or {}).get("siagie") or "2025"
    p24 = ficha.get("pension_2024")
    if p24 is not None and p24 != "":
        return p24, "2024"
    return None, None


def cargar_fichas():
    """
    Las fichas indexadas por su llave real de servicio: codigo modular + anexo.

    El anexo no esta dentro del JSON, pero si en el nombre del fichero que se
    descargo, que es la llave con la que Identicole respondio. Se reconstruye
    desde ahi en vez de suponerlo, y se comprueba que el codigo modular del
    contenido coincide con el del nombre: si no coinciden, la ficha se
    descarto mal y no se puede cruzar.
    """
    ident = leer(PROC / "identicole.json")
    anexos = {}
    for f in CACHE.glob("*.html"):
        if len(f.stem) == 8:
            anexos[f.stem[:7]] = f.stem[7:]

    fichas = {}
    for cm, d in ident.items():
        clave = str(cm).zfill(7)
        interno = str(d.get("cod_mod", "")).zfill(7)
        if interno != clave:
            raise SystemExit(f"ABORTA: la ficha {clave} contiene cod_mod {interno}")
        fichas[(clave, anexos.get(clave, "0"))] = d
    return fichas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true", help="escribe (por defecto solo muestra el diff)")
    args = ap.parse_args()

    fichas = cargar_fichas()
    anexos = {k[1] for k in fichas}
    print(f"Fichas de Identicole: {len(fichas)}  ·  anexos presentes: {sorted(anexos)}")

    det = leer(PUB / "schools_detail.json")
    antes = copy.deepcopy(det)

    # El servicio de la capa publica no guarda el anexo; su codigo modular es
    # unico, cosa que se comprueba aqui en vez de darse por hecha. Si algun dia
    # deja de serlo, esto para antes de cruzar mal.
    porCm = collections.defaultdict(list)
    for slug, s in det.items():
        porCm[str(s["cm"]).zfill(7)].append(slug)
    repes = {k: v for k, v in porCm.items() if len(v) > 1}
    if repes:
        raise SystemExit(f"ABORTA: {len(repes)} codigos modulares repetidos; el cruce seria ambiguo")

    cambios, conflictos = [], []
    for (cm, _anexo), ficha in fichas.items():
        slugs = porCm.get(cm)
        if not slugs:
            continue
        valor, anio = pension_de(ficha)
        if valor is None:
            continue
        s = det[slugs[0]]

        # Conflicto de fuentes: SiseVe dice publico e Identicole, privado.
        # Publicar la pension pondria un importe en una ficha que a la vez
        # dice "no aplica: es un colegio publico". No se resuelve a ojo: se
        # deja fuera y se informa, que es lo unico honesto con dos fuentes
        # que no coinciden.
        detalle = str(ficha.get("gestion_detalle") or "")
        if s["gestion"].startswith("Públic") and detalle.startswith("Privad"):
            conflictos.append({
                "cm": cm, "nombre": s["nombre"], "siseve": s["gestion"],
                "identicole": detalle, "pension": valor,
            })
            continue

        if s.get("pension") == valor and s.get("anio_pension") == anio:
            continue
        cambios.append({
            "slug": s["slug"], "cm": cm, "nombre": s["nombre"],
            "gestion": s["gestion"], "region": s["departamento"],
            "antes": s.get("pension"), "despues": valor, "anio": anio,
        })
        s["pension"] = valor
        s["anio_pension"] = anio

    nuevos = [c for c in cambios if c["antes"] is None]
    pisados = [c for c in cambios if c["antes"] is not None]
    porGestion = collections.Counter(c["gestion"] for c in nuevos)

    if conflictos:
        print(f"\nEXCLUIDOS POR CONFLICTO DE GESTION: {len(conflictos)}")
        for c in conflictos:
            print(f"    {c['cm']} {c['nombre'][:34]:<34} "
                  f"SiseVe={c['siseve']} / Identicole={c['identicole']} (S/ {c['pension']})")

    print(f"\nCAMBIOS: {len(cambios)}")
    print(f"  recuperan pension (antes null): {len(nuevos)}  -> {dict(porGestion)}")
    print(f"  ya tenian valor y cambia:       {len(pisados)}")
    for c in pisados[:10]:
        print(f"    {c['cm']} {c['nombre'][:32]:<32} {c['antes']} -> {c['despues']}")

    print("\n  Primeros 8 recuperados:")
    for c in nuevos[:8]:
        print(f"    {c['cm']} {c['nombre'][:34]:<34} {c['gestion']:<8} {c['region']:<10} S/ {c['despues']} ({c['anio']})")

    # ── Lo que NO debe haber cambiado ──────────────────────────────────
    tocados = 0
    for slug, s in det.items():
        a = antes[slug]
        for k in s:
            if k in ("pension", "anio_pension"):
                continue
            if s[k] != a.get(k):
                print(f"  !! {slug}.{k} cambio y no debia")
                tocados += 1
    if tocados:
        raise SystemExit(f"ABORTA: {tocados} campos ajenos modificados")
    print(f"\n  Campos ajenos modificados: 0  (comprobados {len(det)} servicios)")

    if not args.aplicar:
        print("\nEnsayo. Nada escrito. Repite con --aplicar.")
        return

    # ── Propagar a las capas que tambien llevan pension ────────────────
    porSlug = {s["slug"]: s for s in det.values()}

    inst = leer(PUB / "institutions.json")
    items = inst if isinstance(inst, list) else list(inst.values())
    nI = 0
    for i in items:
        for sv in i.get("servicios", []):
            f = porSlug.get(sv.get("slug"))
            if f and (sv.get("pension") != f.get("pension")):
                sv["pension"] = f.get("pension")
                sv["anio_pension"] = f.get("anio_pension")
                nI += 1

    cross = leer(PUB / "cross_2024.json")
    nC = 0
    for fila in cross:
        f = porSlug.get(fila.get("slug"))
        if f and fila.get("pension") != f.get("pension"):
            fila["pension"] = f.get("pension")
            nC += 1

    escribir(PUB / "schools_detail.json", det)
    escribir(PUB / "institutions.json", inst)
    escribir(PUB / "cross_2024.json", cross)
    print(f"\nEscrito.  schools_detail: {len(cambios)}  institutions: {nI}  cross_2024: {nC}")


if __name__ == "__main__":
    main()
