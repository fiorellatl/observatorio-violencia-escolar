# -*- coding: utf-8 -*-
"""
Local educativo y nombre oficial de los servicios que no tienen `codinst`.

    python scripts/bajar_codlocal_sin_codinst.py

POR QUE EXISTE
858 servicios de la capa publica no tienen codigo de institucion ni en el
padron de ESCALE, asi que cada uno quedo como su propia institucion. En 183
casos eso parte un mismo colegio en dos: la primaria y la secundaria de
«Padre Iluminato» comparten local (`codlocal`) y nombre oficial exacto, pero
aparecian como dos colegios. `unificar_sin_codinst.py` decide si se unen;
esto solo trae los dos datos que necesita, del padron publico, por codigo
modular.

Reanudable: cachea cada respuesta en data/raw/escale_servicio/.
Salida: data/processed/servicios_sin_codinst.json  {cm: {codlocal, nombre, nivel, estado}}
"""
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "raw" / "escale_servicio"
OUT = ROOT / "data" / "processed" / "servicios_sin_codinst.json"
BASE = "https://escale.minedu.gob.pe/padron/rest/instituciones"
PAUSA = 0.5


def campo(xml: str, tag: str) -> str | None:
    m = re.search(rf"<{tag}>(.*?)</{tag}>", xml, re.S)
    if not m:
        return None
    v = m.group(1)
    mv = re.search(r"<valor>(.*?)</valor>", v)
    return (mv.group(1) if mv else v).strip() or None


def servicio(cm: str) -> dict:
    f = CACHE / f"{cm}.xml"
    if f.exists():
        xml = f.read_text(encoding="utf-8")
    else:
        req = urllib.request.Request(BASE + "?" + urllib.parse.urlencode({"codmod": cm}),
                                     headers={"User-Agent": "Mozilla/5.0"})
        xml = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        f.write_text(xml, encoding="utf-8")
        time.sleep(PAUSA)
    # La consulta por codmod puede devolver varios anexos; el que interesa es
    # el del propio codigo modular, anexo 0.
    bloque = re.search(rf'<items uri="[^"]*/{cm}/0/">(.*?)</items>', xml, re.S)
    x = bloque.group(1) if bloque else xml
    return {
        "codinst": campo(x, "codinst"),
        "codlocal": campo(x, "codlocal"),
        "nombre": campo(x, "cenEdu"),
        "nivel": campo(x, "nivelModalidad"),
        "estado": campo(x, "estado"),
    }


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    inst = json.loads((ROOT / "data" / "public" / "institutions.json").read_text(encoding="utf-8"))
    cms = sorted({s["cm"] for i in inst.values() if not i.get("codinst") for s in i["servicios"]})
    out = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    for k, cm in enumerate(cms, 1):
        if cm in out:
            continue
        try:
            out[cm] = servicio(cm)
        except Exception as e:  # red o servidor: se reintenta en la proxima corrida
            print(f"  {cm}: {e}", flush=True)
            time.sleep(3)
            continue
        if k % 100 == 0:
            OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
            print(f"  {k}/{len(cms)}", flush=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
    con = sum(1 for v in out.values() if v.get("codlocal"))
    print(f"LISTO: {len(out)}/{len(cms)} servicios · {con} con codlocal", flush=True)


if __name__ == "__main__":
    main()
