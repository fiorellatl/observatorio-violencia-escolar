"""
TAREA 1/2 - Inspeccion: verifica cada endpoint publico de SiseVe y guarda las
respuestas JSON originales (ya descifradas) en data/raw/.
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from siseve_client import SiseveClient  # noqa: E402

RAW = pathlib.Path(__file__).resolve().parents[1] / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)


def dump(nombre, obj):
    path = RAW / f"{nombre}.json"
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  -> {path.relative_to(RAW.parents[2])}")


def main():
    c = SiseveClient()
    print(f"keyInstance : {c.instance}")
    print(f"clave AES   : {c.key}\n")

    print("[1] /TableroControl/ListarAnio")
    anios = c.listar_anios()
    print(f"    anios publicados: {[a['ANIO'] for a in anios]}")
    dump("listar_anio", anios)

    print("\n[2] /TableroControl/ListarDreUgel")
    ugeles = c.listar_dre_ugel()
    print(f"    {len(ugeles)} UGEL en el catalogo nacional")
    dump("listar_dre_ugel", ugeles)

    # Los anios 2023..2026 se prueban explicitamente para documentar cuales
    # devuelven datos y cuales responden vacio.
    for anio in ["2023", "2024", "2025", "2026"]:
        print(f"\n[3] /TableroControl/ListarDatosMapa  ANIO={anio}")
        bloques = c.listar_datos_mapa(anio)
        regiones = bloques[1] if len(bloques) > 1 else []
        tipos = bloques[2] if len(bloques) > 2 else []
        total = sum(t.get("NUMERO_CASOS", 0) for t in tipos)
        print(f"    corte={bloques[0][0]['FECHA_PROCESO']!r} "
              f"regiones={len(regiones)} total_casos={total}")
        dump(f"mapa_{anio}", bloques)

    print("\n[4] /TableroControl/ListarDatosGraficoNacional  ANIO=2025")
    dump("grafico_nacional_2025", c.grafico_nacional("2025"))

    print("\n[5] /TableroControl/ListarDatosGraficoRegion  PE.LR (Lima Metropolitana)")
    dump("grafico_region_PE.LR_2025", c.grafico_region("2025", "PE.LR"))

    print("\n[6] /TableroControl/ListarDatosGraficoUgel  UGEL 07 San Borja (150108)")
    ugel07 = c.grafico_ugel("2025", "PE.LR", "150108")
    for g in ugel07:
        print(f"    - {g['title']}")
    dump("grafico_ugel_150108_2025", ugel07)

    print("\n[7] /Inicio/DescargarEXCEL")
    destino = RAW / "EstadisticaExcel.xlsx"
    c.descargar_excel(destino)
    print(f"    -> {destino.name} ({destino.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
