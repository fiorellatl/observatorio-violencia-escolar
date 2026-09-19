# -*- coding: utf-8 -*-
"""
Inyecta en buscador.html el indice de colegios y los datos por UGEL.

El padron llega por codigo modular; aqui se agrupa por CODIGO DE LOCAL, que es
lo mas parecido a "un colegio" tal como lo entiende una familia: un campus, con
sus niveles dentro.
"""
import json
import pathlib
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[1]
PAD = ROOT / "data" / "processed" / "padron_lima_dist.json"
LAN = ROOT / "data" / "processed" / "landing_data.json"
HTML = ROOT / "buscador.html"

# el padron escribe los distritos sin tilde y con otro nombre en un caso
ALIAS_DIST = {"LURIGANCHO": "Lurigancho-Chosica"}


def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper().strip()


def main():
    pad = json.loads(PAD.read_text(encoding="utf-8"))
    lan = json.loads(LAN.read_text(encoding="utf-8"))

    # distrito -> UGEL, tolerante a tildes y alias
    d2u = {norm(k): v for k, v in lan["distritos"].items()}
    for viejo, nuevo in ALIAS_DIST.items():
        d2u[viejo] = lan["distritos"][nuevo]

    # nombre bonito del distrito, tomado del mapeo (que si lleva tildes)
    d2nombre = {norm(k): k for k in lan["distritos"]}
    for viejo, nuevo in ALIAS_DIST.items():
        d2nombre[viejo] = nuevo

    colegios, sin_ugel = {}, set()
    for f in pad:
        k = f["cl"] or ("m" + f["cm"])
        nd = norm(f["dist"])
        if nd not in d2u:
            sin_ugel.add(f["dist"])
            continue
        c = colegios.setdefault(k, {
            "l": f["cl"], "n": f["n"], "d": d2nombre[nd], "u": d2u[nd],
            "g": "Privada" if f["g"].startswith("Privada") else "Pública",
            "dir": f["dir"][:46], "m": []})
        c["m"].append(f["cm"])
        if len(f["n"]) > len(c["n"]):          # se queda el nombre mas completo
            c["n"] = f["n"]

    arr = sorted(colegios.values(), key=lambda c: c["n"])
    assert not sin_ugel, f"distritos sin UGEL: {sin_ugel}"

    # Compacto a proposito: 21 mil colegios viajan dentro del HTML y mucha gente
    # lo abrira desde el celular. Arrays en vez de objetos, el distrito como
    # indice, y la UGEL se deriva del distrito en el navegador.
    dists = sorted({c["d"] for c in arr})
    di = {d: i for i, d in enumerate(dists)}
    filas = [[c["n"], di[c["d"]], 1 if c["g"] == "Privada" else 0,
              c["l"], sorted(set(c["m"])), c["dir"][:28]] for c in arr]
    for c in arr:
        c["m"] = sorted(set(c["m"]))
    payload = json.dumps({"d": dists, "c": filas}, ensure_ascii=False,
                         separators=(",", ":"))
    datos = json.dumps(lan, ensure_ascii=False, separators=(",", ":"))

    html = HTML.read_text(encoding="utf-8")
    assert "__PADRON__" in html and "__DATOS__" in html, "faltan los marcadores"
    html = html.replace("__PADRON__", payload).replace("__DATOS__", datos)
    HTML.write_text(html, encoding="utf-8")

    porugel = {}
    for c in arr:
        porugel[c["u"]] = porugel.get(c["u"], 0) + 1
    print(f"{len(arr)} colegios (por local) · {sum(len(c['m']) for c in arr)} codigos modulares")
    print(f"indice: {len(payload)/1e6:.2f} MB · html final: {len(html)/1e6:.2f} MB")
    for u, n in sorted(porugel.items()):
        print(f"  {u:34} {n:>5} colegios")


if __name__ == "__main__":
    main()
