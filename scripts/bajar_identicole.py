# -*- coding: utf-8 -*-
"""
Extrae la ficha pública de Identicole por código modular.

    GET https://identicole.minedu.gob.pe/colegio/mi_colegio/{cod_mod}{anexo}

Es HTML renderizado en el servidor: no hay API, ni autenticación, ni captcha.
Aporta lo único que no da ESCALE: pensión, área urbano/rural, jornada completa,
infraestructura, conectividad y resultados ECE.

Cada bloque de la ficha declara su propia fuente y año (Padrón 2026, SIAGIE 2025,
Censo Escolar 2021...). Se conservan tal cual: mezclarlos sin decirlo sería
presentar como simultáneo lo que no lo es.

    python scripts/bajar_identicole.py --lista data/public/cross_2024.json
    python scripts/bajar_identicole.py --codmod 0305615

Reanudable: cachea cada ficha en data/raw/identicole/.
"""
import argparse
import html
import json
import pathlib
import re
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "raw" / "identicole"
OUT = ROOT / "data" / "processed" / "identicole.json"
CACHE.mkdir(parents=True, exist_ok=True)

BASE = "https://identicole.minedu.gob.pe/colegio/mi_colegio/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0"
PAUSA = 0.45

# label -> (clave, bloque). El bloque decide de qué fuente y año viene el dato.
CAMPOS = {
    "Área": ("area", "padron"),
    "Turno": ("turno", "padron"),
    "Alumnado": ("alumnado", "padron"),
    "Modelo que opera el servicio": ("modelo", "padron"),
    "Gestión a cargo de": ("gestion_detalle", "padron"),
    "Forma de atención": ("forma_atencion", "padron"),
    "Pensión 2025": ("pension_2025", "siagie"),
    "Pensión 2024": ("pension_2024", "siagie"),
    "APAFA": ("apafa", "siagie"),
    "Espacios educativos": ("espacios_educativos", "censo"),
    "Espacios administrativos": ("espacios_administrativos", "censo"),
    "Infraestructura deportiva": ("infra_deportiva", "censo"),
    "Accesibilidad para personas con discapacidad": ("accesibilidad", "censo"),
    "Equipamiento": ("equipamiento", "censo"),
    "Acceso a internet": ("internet", "censo"),
    "Total de estudiantes en el último año": ("estudiantes", "censo"),
    "Promedio de estudiantes por sección": ("alumnos_por_seccion", "censo"),
    "Total de docentes": ("docentes", "censo"),
    "Qali Warma": ("qali_warma", "padron"),
}


def reparar(s: str) -> str:
    """
    Identicole sirve parte del texto codificado varias veces: "SÃƒÂ­" por "Sí".

    El daño pasó por cp1252, no solo por latin-1— de ahí caracteres como 'ƒ'
    (U+0192, el byte 0x83 leído como cp1252), que están fuera de latin-1 y hacían
    fallar la reparación sin avisar. Se prueban ambos códecs en cada vuelta y se
    para en cuanto el texto deja de cambiar.
    """
    for _ in range(3):
        anterior = s
        for codec in ("cp1252", "latin-1"):
            try:
                s = s.encode(codec).decode("utf-8")
                break
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
        if s == anterior:
            break
    return s


def limpiar(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = reparar(s)
    return re.sub(r"\s+", " ", s).strip()


RE_PAR = re.compile(
    r'class="strlabel">\s*([^<]{2,80}?):?\s*</div>.{0,400}?<strong[^>]*>(.*?)</strong>',
    re.S,
)
# El nombre de la fuente puede llevar tildes ("Padrón") y venir mal codificado,
# así que se acepta cualquier cosa que no sea marcado ni dígito.
RE_FUENTE = re.compile(r"Fuente:\s*([^<>\d]{3,30}?)\s*(\d{4})", re.S)


def parsear(h: str) -> dict | None:
    if "strlabel" not in h:
        return None
    datos: dict[str, str] = {}
    for m in RE_PAR.finditer(h):
        etiqueta = limpiar(m.group(1)).rstrip(":")
        if etiqueta not in CAMPOS:
            continue
        valor = limpiar(m.group(2))
        if valor and valor.lower() not in ("no disponible", "texto de referencia"):
            datos[CAMPOS[etiqueta][0]] = valor

    # Años declarados por la propia ficha, por bloque.
    anios: dict[str, str] = {}
    for m in RE_FUENTE.finditer(h):
        nombre = limpiar(m.group(1)).lower()
        anio = m.group(2)
        if "padr" in nombre:
            anios.setdefault("padron", anio)
        elif "siagie" in nombre:
            anios.setdefault("siagie", anio)
        elif "censo" in nombre:
            anios.setdefault("censo", anio)
    if anios:
        datos["_anios"] = anios
    return datos or None


def soles(v: str | None) -> int | None:
    if not v:
        return None
    m = re.search(r"(\d[\d\s,.]*)", v.replace("S/", ""))
    if not m:
        return None
    try:
        return int(re.sub(r"[^\d]", "", m.group(1)))
    except ValueError:
        return None


def ficha(cod_mod: str, anexo: str = "0") -> dict | None:
    cm = str(cod_mod).strip().zfill(7)
    f = CACHE / f"{cm}{anexo}.html"
    if f.exists():
        h = f.read_text(encoding="utf-8", errors="replace")
    else:
        req = urllib.request.Request(BASE + cm + anexo, headers={"User-Agent": UA})
        try:
            h = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise
        f.write_text(h, encoding="utf-8")
        time.sleep(PAUSA)

    d = parsear(h)
    if not d:
        return None
    d["cod_mod"] = cm
    for k in ("pension_2024", "pension_2025", "apafa"):
        if k in d:
            d[k] = soles(d[k])

    # Las listas de infraestructura vienen corrompidas en origen de forma
    # irrecuperable: hay bytes ya perdidos ("MÃ¢â€?Å’LTIPLES" por "MÚLTIPLES").
    # No se publica texto roto; sí se publica cuántos elementos declara, que es
    # lo que sobrevive intacto al separar por comas.
    for k in ("espacios_educativos", "espacios_administrativos",
              "infra_deportiva", "equipamiento"):
        if d.get(k):
            d[k + "_n"] = len([p for p in str(d[k]).split(",") if p.strip()])

    for k in ("estudiantes", "docentes", "alumnos_por_seccion"):
        if d.get(k):
            try:
                d[k] = int(re.sub(r"[^\d]", "", str(d[k])))
            except ValueError:
                d.pop(k, None)
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lista", help="JSON con objetos que tengan slug terminado en el codmod")
    ap.add_argument("--codmod", help="un solo código modular, para probar")
    ap.add_argument("--limite", type=int, default=0)
    a = ap.parse_args()

    if a.codmod:
        print(json.dumps(ficha(a.codmod), ensure_ascii=False, indent=2))
        return

    filas = json.loads(pathlib.Path(a.lista).read_text(encoding="utf-8"))
    codigos = [f["slug"].rsplit("-", 1)[-1] for f in filas]
    if a.limite:
        codigos = codigos[: a.limite]

    out, fallos = {}, 0
    if OUT.exists():
        out = json.loads(OUT.read_text(encoding="utf-8"))

    for i, cm in enumerate(codigos, 1):
        if cm in out:
            continue
        try:
            d = ficha(cm)
        except Exception as e:
            print(f"  {cm}: {e}", flush=True)
            time.sleep(3)
            continue
        if d:
            out[cm] = d
        else:
            fallos += 1
        if i % 200 == 0:
            OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                           encoding="utf-8")
            print(f"  {i}/{len(codigos)} · {len(out)} fichas · {fallos} sin datos", flush=True)

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    con_pension = sum(1 for v in out.values() if v.get("pension_2025") or v.get("pension_2024"))
    print(f"LISTO: {len(out)} fichas · {con_pension} con pensión · {fallos} sin datos", flush=True)


if __name__ == "__main__":
    main()
