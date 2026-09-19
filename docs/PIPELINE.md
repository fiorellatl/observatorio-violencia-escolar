# SíseVe (MINEDU Perú) — inspección técnica y scraper reproducible

Investigación sobre `https://siseve.minedu.gob.pe/Web/App/Mapa`.
Solo se consumen endpoints que el portal invoca desde el navegador de cualquier
ciudadano, sin autenticación, sin CAPTCHA y sin evadir ningún control de acceso.

## Conclusión principal

**El portal público de SíseVe no expone datos a nivel de institución educativa.**
La granularidad máxima es la **UGEL** (225 con casos, 227 en el catálogo).
No existe endpoint, parámetro ni columna con nombre de colegio o código modular.

## Arquitectura

| Capa | Tecnología |
|---|---|
| Backend | ASP.NET MVC (rutas `/Controlador/Accion`, bundles `/Web/bundles/`) |
| Frontend | jQuery 3.7.1 + plantilla Inspinia |
| Mapa | Highmaps + topojson `/Web/Content/json/pe-all.topo.json` |
| Gráficos | Chart.js |
| Ofuscación | AES-128-CBC (CryptoJS) en request y response |

### La capa AES no es un control de acceso

El servidor entrega la clave en el HTML público:

```html
<div id="divTheme" data-url="SBPBSSGP%2FNAep...Bw%3DSBPBSSGP">
```

Los 8 primeros y 8 últimos caracteres se traducen a dígitos con un diccionario
fijo (`L→0, G→1, A→2, q→3, t→4, P→5, Z→6, B→7, M→8, S→9`) y se concatenan
formando una clave de 16 bytes; el bloque del medio se descifra con ella y
produce la clave AES real. Es ofuscación del lado del cliente, no autenticación:
no hay sesión, cookie ni token asociados.

## Endpoints públicos

Todos: `POST https://siseve.minedu.gob.pe/Web` + ruta,
`Content-Type: application/json; charset=utf-8`,
cuerpo `{"filter": "<AES(JSON) url-encoded>"}` (o vacío si no lleva parámetros).

| Ruta | Parámetros | Devuelve |
|---|---|---|
| `/TableroControl/ListarAnio` | — | años publicados |
| `/TableroControl/ListarDatosMapa` | `ANIO` | totales por región y tipo de violencia |
| `/TableroControl/ListarDreUgel` | — | catálogo de 227 DRE/UGEL |
| `/TableroControl/ListarDatosGraficoNacional` | `ANIO` | 22 series nacionales |
| `/TableroControl/ListarDatosGraficoRegion` | `ANIO`, `CODIGO_MAPA` | 22 series por región |
| `/TableroControl/ListarDatosGraficoUgel` | `ANIO`, `CODIGO_MAPA`, `CODIGO_UGEL` | 22 series por UGEL |
| `/Inicio/DescargarEXCEL` | — | xlsx, listado caso por caso (1.9 MB) |

`GET /Web/App/MapaDetalle?filter=<base64(JSON)>` — navegación, no es API.
El `filter` de la URL es Base64 plano (`btoa`), distinto del AES de los POST.

## Uso

```bash
pip install requests pycryptodome openpyxl
python scripts/inspect_siseve.py   # verifica endpoints -> data/raw/
python scripts/scrape_siseve.py    # construye CSVs    -> data/processed/
python scripts/build_lima_map.py   # mapa de Lima      -> data/processed/
python scripts/render_story.py     # video vertical    -> data/processed/
```

## Salidas

| Archivo | Contenido |
|---|---|
| `data/raw/*.json` | respuestas originales descifradas |
| `data/raw/EstadisticaExcel.xlsx` | 50 633 casos, 2024-01-01 a 2026-08-31 |
| `data/processed/siseve_ugel_lima.csv` | Lima agregada por año/UGEL/nivel/agresor |
| `data/processed/siseve_ugel_nacional.csv` | idem, nacional (3035 filas) |
| `data/processed/top_50_ugel_nacional.csv` | ranking por total de reportes |
| `data/processed/top_50_ugel_lima.csv` | idem, Lima (16 UGEL) |
| `data/processed/lima_ugel_map.json` | 42 distritos de Lima con su UGEL y sus reportes |
| `data/processed/siseve_volumen_vs_composicion.mp4` | historia vertical 1080x1920 |

Las columnas `school_name`, `modular_code`, `district` y `management` se emiten
**vacías a propósito**: el portal no las entrega y no se rellenan con estimaciones.

## Fuentes externas

El mapa de Lima cruza tres cosas: la geometría distrital del repositorio público
[peru-geojson](https://github.com/juaneladio/peru-geojson) (guardada en
`data/raw/peru_distrital_simple.geojson`), la jurisdicción de cada UGEL publicada
por la DRELM, y los reportes por UGEL de SíseVe. **El número es de la UGEL, no del
distrito**: todos los distritos de una misma UGEL comparten valor porque el portal
no publica nada más fino. Santa Anita no tiene polígono en la fuente geográfica.

## Interpretación

Nota metodológica del propio Excel oficial:

> La información que se consigna en el presente reporte recoge **alertas de
> violencia escolar**, las mismas que siguen un procedimiento para su atención
> por parte de la IE. El SíseVe es un portal abierto a la ciudadanía, por lo que
> **puede existir más de un reporte sobre un mismo caso**.

Un registro ≠ un caso confirmado, y ≠ "bullying" (el bullying es una categoría
aparte en el portal). Conservar siempre las categorías originales.
