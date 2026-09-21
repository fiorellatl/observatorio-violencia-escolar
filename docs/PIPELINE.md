# El pipeline de datos

Seis pasos, un orden que importa y una trampa. Esto es lo que hay que saber
el día que llegue una tanda nueva de SíseVe.

```bash
python scripts/pipeline.py            # comprueba, no escribe nada
python scripts/pipeline.py --run      # ejecuta en orden
python scripts/pipeline.py --run --desde senales
```

## La trampa

`data/public/` es a la vez **salida** del primer paso y **entrada** de los
tres siguientes.

```
EstadisticaExcel.xlsx ──► [1 etl] ──► data/public/  ◄──┐
                                          │            │
                        [3 denominador] ──┤ reescribe ─┤
                        [4 instituciones]─┤ añade ─────┤
                        [5 señales] ──────┘ lee ───────┘
```

Volver a ejecutar el ETL sobrescribe el directorio entero y deshace, sin
decir nada, el denominador del Censo 2024 y la capa institucional. No falla:
el sitio simplemente pasa a servir datos viejos.

Por eso el orquestador comprueba **frescura por fecha**: un paso está
obsoleto cuando alguna de sus entradas es más reciente que su salida. Es una
regla tonta y es la única que hace visible este fallo.

> La primera vez que se ejecutó esta comprobación encontró que `signals.json`
> se había generado antes de aplicar el denominador de 2024. `/senales`
> llevaba desde entonces publicando el número de alumnos del padrón 2026
> mientras la ficha del mismo colegio mostraba el del Censo 2024: El Carmelo
> aparecía con 294 alumnos en un sitio y 311 en el otro. Los conteos de
> reportes eran correctos; el denominador que los acompañaba, no.

## Los pasos

| # | Paso | Lee | Escribe |
|---|------|-----|---------|
| 1 | `etl` | `data/raw/EstadisticaExcel.xlsx` | `data/public/` entero |
| 2 | `padron` | `00_Padron.zip` de ESCALE | `data/processed/padron_censo_2024.json` |
| 3 | `denominador` | 1 + 2 | reescribe `schools_detail`, `cross_2024`, `meta` |
| 4 | `instituciones` | 3 + padrones | `institutions`, `service-redirects`, `facetas` |
| 5 | `senales` | 3 | `signals.json` |
| 6 | `portada` | 4 | `public/og.png` |
| 7 | `privacidad` | todo | nada: falla si aparece un campo personal |

El paso 1 es la **puerta de anonimización**. Todo lo que sale de ahí puede
publicarse; nada de lo que entra puede.

## Las dos fuentes que hay que conseguir a mano

Ninguna se descarga sola, y ninguna vive en el repositorio.

- **SíseVe** llega por solicitud de acceso a la información pública. Se deja
  en `data/raw/EstadisticaExcel.xlsx`.
- **Censo Educativo** se baja de ESCALE (`00_Padron.zip`) y se procesa con
  `python scripts/padron_censo_2024.py --zip <ruta>`.

Si falta alguna, el orquestador para y dice cuál. No inventa un hueco ni
sigue con datos a medias.

## Cuando llegue la tanda nueva

1. Deja el XLSX en `data/raw/`.
2. `python scripts/pipeline.py` — dirá que todo quedó obsoleto.
3. `python scripts/pipeline.py --run`.
4. `npm run build` — la validación de privacidad corre sola antes de compilar.
5. `python scripts/pipeline.py` otra vez: tiene que decir «Todo al día».

El paso 5 no es ceremonia. Es la comprobación que faltaba.

## Lo que este pipeline todavía no arregla

`data/public/` sigue siendo entrada y salida a la vez. Lo correcto sería que
los pasos 3 y 4 ocurrieran **dentro** del ETL y que el directorio fuera una
salida pura, pero eso exige re-ejecutar el ETL para comprobarlo, y el XLSX
que generó la capa actual ya no está en disco. Mientras tanto, la
comprobación de frescura cubre el riesgo: no evita el error, pero lo hace
imposible de no ver.
