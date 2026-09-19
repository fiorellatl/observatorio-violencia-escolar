# Observatorio de Violencia Escolar — Perú

Herramienta pública para explorar qué información existe sobre violencia escolar
en los colegios del Perú, a partir de datos abiertos del Ministerio de Educación.

Dos entradas: **buscar un colegio** y ver qué se sabe de él, o **explorar los
datos** agregados del sistema educativo.

---

## ⚠️ Antes de tocar nada: datos personales

La base original de SíseVe obtenida por transparencia **contiene datos personales
de menores**: edad, sexo, grado y turno del estudiante agredido, más
características del presunto agresor. Combinados con el nombre y la dirección del
colegio, identifican a personas concretas.

Reglas que no son opcionales:

1. **El archivo original nunca entra al repositorio.** `.gitignore` excluye
   `data/raw/`, `data/processed/` y todo `*.xlsx`.
2. **La web solo consume `data/public/`**, que es agregado por colegio, año y
   tipo de violencia. El proveedor de datos (`src/lib/data/provider.ts`) es el
   único punto que toca el disco y solo lee de ahí.
3. **No existe ninguna ruta ni API que devuelva un reporte individual**, y no debe
   crearse.
4. La anonimización ocurre en `scripts/build_public_data.py`, que declara
   explícitamente las columnas que nunca lee.

Si una decisión de arquitectura podría permitir exponer datos individuales más
adelante, no la tomes: abre un issue.

---

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS 3**
- **Recharts** para las visualizaciones
- **Python 3** para el pipeline de datos (fuera del runtime de la web)

## Estructura

```
src/
  app/
    page.tsx                  home
    colegios/page.tsx         buscador y navegación por región
    colegio/[slug]/page.tsx   ficha del colegio
    datos/page.tsx            exploración agregada
    metodologia/page.tsx      qué mide y qué no mide
  components/                 SearchBox, MetricCard, ReportTrend, …
  lib/
    data/provider.ts          ÚNICO acceso a disco; solo data/public/
    format.ts                 formato es-PE, normalización, slugs
    types.ts                  contrato de la capa pública
scripts/                      pipeline Python (extracción, ETL, anonimización)
data/
  raw/                        fuentes originales        ← git-ignored
  processed/                  tablas intermedias        ← git-ignored
  public/                     capa agregada y segura    ← versionada
public/data/                  índice de búsqueda para el navegador
docs/                         auditoría de fuentes, prototipos de investigación
```

## Instalación

```bash
npm install
```

Requiere Node ≥ 20. Para el pipeline de datos: Python ≥ 3.10 con
`openpyxl` y `requests`.

## Desarrollo local

```bash
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run build        # build de producción
```

La web necesita `data/public/` para arrancar. Si falta, el proveedor lanza un
error explicando cómo generarla.

## Generar la capa de datos

```bash
# 1. Agregados de SíseVe a partir de la base por transparencia
python scripts/build_public_data.py --fuente ruta/al/Anexo.xlsx

# 2. Matrícula y docentes desde el padrón público de ESCALE
#    (habilita las tasas por 1,000 estudiantes)
python scripts/bajar_estadistica_escale.py

# 3. Contexto desde la ficha pública de Identicole
#    (pensión, área urbano/rural, jornada, conectividad, infraestructura)
python scripts/bajar_identicole.py --lista data/public/cross_2024.json

# 4. Regenerar la capa pública con todo integrado
python scripts/build_public_data.py --fuente ruta/al/Anexo.xlsx
```

Los pasos 2 y 3 son **reanudables**: cachean cada respuesta en `data/raw/` y
saltan lo ya descargado. Van con pausa deliberada — son servidores del Estado.
El paso 3 tarda: cada ficha pesa ~370 KB y el ritmo es de unas 30 por minuto.

El paso 2 es reanudable: cachea cada página en `data/raw/escale_est/` y salta las
ya descargadas.

Otros scripts del pipeline están documentados en [`docs/PIPELINE.md`](docs/PIPELINE.md),
y la auditoría completa de fuentes en
[`docs/AUDITORIA-FUENTES.md`](docs/AUDITORIA-FUENTES.md).

## Deploy en Netlify

1. Conecta el repositorio en Netlify.
2. Build command `npm run build`, publish directory `.next`.
3. El plugin `@netlify/plugin-nextjs` se activa desde `netlify.toml`.

`data/public/` está versionado a propósito: el build de Netlify no necesita
ejecutar Python ni descargar nada.

### Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `PRERENDER_LIMIT` | `0` (todas) | Cuántas fichas de colegio se generan estáticamente en el build. Hay ~15,700 colegios con reportes recientes; generarlas todas alarga el build. El resto se sirven bajo demanda. En desarrollo, `PRERENDER_LIMIT=300` basta. |

No hay secretos ni claves: todas las fuentes son públicas.

## Fuentes

| Fuente | Qué aporta | Vía |
|---|---|---|
| SíseVe — MINEDU | Reportes 2013–2026 por colegio | Solicitud de acceso a la información pública |
| ESCALE — Padrón de IIEE | Matrícula, docentes, secciones, nivel, coordenadas | API pública `escale.minedu.gob.pe/padron/rest` |
| Identicole — MINEDU | Pensión, área urbano/rural, jornada, conectividad, infraestructura | Ficha pública por código modular |

## Decisiones de producto

- **No hay ranking.** El número de reportes no es una etiqueta del colegio: uno
  con muchos reportes puede ser uno donde denunciar funciona. No se usan las
  palabras *peligroso*, *seguro*, *peor* ni *mejor*.
- **Cada dato lleva su año.** Las fuentes se actualizan a ritmos distintos;
  presentarlas como simultáneas sería falso. Por eso existe `DataSourceBadge`.
- **2020–2021 se tratan aparte.** Colegios cerrados por la pandemia; la caída no
  significa menos violencia. Se dibujan huecos y quedan fuera de las
  comparaciones longitudinales.
- **Tasas, no conteos**, donde hay matrícula. Un colegio de 2,000 estudiantes no
  se compara con uno de 200 por cifras brutas.
- **Reportes, no casos.** No deduplicamos: el identificador de la fuente
  distingue reportes, no hechos.
- **Si un dato no está, se dice.** La interfaz distingue «no aplica» de «aún no
  consultado» de «no existe públicamente». Saber qué información falta es parte
  de lo que este sitio quiere mostrar.

## Licencia

Por definir. Los datos de origen son públicos y propiedad del Estado peruano.
