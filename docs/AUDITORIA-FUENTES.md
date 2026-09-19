# Auditoría de fuentes — plataforma de violencia escolar en el Perú

Fecha de la auditoría: **19 de septiembre de 2026**
Unidad de análisis objetivo: **servicio educativo (código modular) × año**

Todo lo que sigue fue verificado con peticiones reales. Lo que no pude verificar
está marcado como tal. No hay una sola URL, endpoint ni variable inventada.

---

## 0. Advertencia previa: datos personales

El archivo entregado por Transparencia (fuente S2) **no es agregado**. Cada fila
describe a un menor identificable por combinación:

```
AGREDIDO_EDAD · AGREDIDO_SEXO · AGREDIDO_GRADO · AGREDIDO_TURNO · AGREDIDO_IDIOMA
SUPUESTO_AGRESOR_SEXO · SUPUESTO_AGRESOR_EDAD · SUPUESTO_AGRESOR_RELACION_ACTOR
+ INSTITUCION_EDUCATIVA + DIRECCION + DISTRITO + FECHA_REPORTE
```

Un varón de 13 años, 2.º de secundaria, turno único, en un colegio con nombre y
dirección, en una fecha concreta, con una docente como presunta agresora: dentro
de ese colegio eso identifica a una persona. No hace falta el nombre.

Reglas que el pipeline debe imponer, no sugerir:

1. La tabla de nivel-reporte **nunca** sale a la capa pública, ni al repositorio,
   ni embebida en el HTML del frontend.
2. La capa pública consume solo agregados por `(cod_mod, año, dimensión)`.
3. **Supresión de celdas < 5** en cualquier corte que combine violencia sexual
   con nivel, grado o edad.
4. `AGREDIDO_EDAD` y `AGREDIDO_GRADO` no se publican por colegio en ningún corte.
5. El archivo crudo vive cifrado o fuera del repositorio, con `.gitignore`.

Revisado: `MOTIVO_VIOLENCIA` **no contiene narrativa libre**. Es un campo de
casillas; el aparente texto libre es el *placeholder* del formulario filtrándose
(«estatura, peso, uso de anteojos, acné, etc.»). No hay nombres propios.

---

## 1. DATA MAP

| Variable | Fuente | Año | Granularidad | ID | Acceso | Calidad |
|---|---|---|---|---|---|---|
| Reportes de violencia (detalle) | S2 Transparencia | 2013–2026 | reporte | `CODIGO_MODULAR` | archivo entregado | 🟢 |
| Reportes de violencia (agregado) | S1 portal SíseVe | 2024–2026 | UGEL | `CODIGO_UGEL` | API pública | 🟢 |
| Identidad de IE, local, dirección | S3 ESCALE padrón | actual | servicio educativo | `codMod` | API REST pública | 🟢 |
| Coordenadas lat/long | S3 ESCALE padrón | actual | servicio educativo | `codMod` | API REST pública | 🟢 |
| Matrícula total, por sexo y grado | S3 ESCALE padrón | 1 año (actual) | servicio educativo | `codMod` | API REST, `campos=estadistica` | 🟢 |
| Docentes, secciones | S3 ESCALE padrón | 1 año (actual) | servicio educativo | `codMod` | API REST, `campos=estadistica` | 🟢 |
| Nivel/modalidad | S3 ESCALE padrón | actual | servicio educativo | `codMod` | dentro de `estadistica` | 🟢 |
| Matrícula, aprobados, retirados, atraso | S4 Trayectoria | 2021–2024 | cod_mod × nivel × edad | `cod_mod`+`anexo` | CSV directo | 🟢 |
| Pensión 2024 y 2025, APAFA | S5 Identicole | 2024–2025 | servicio educativo | `cod_mod`+`anexo` | HTML servidor | 🟡 |
| Área urbano/rural, turno, JEC | S5 Identicole | 2026 | servicio educativo | `cod_mod`+`anexo` | HTML servidor | 🟢 |
| Infraestructura, equipamiento, internet | S5 Identicole | **2021** | servicio educativo | `cod_mod`+`anexo` | HTML servidor | 🟡 |
| Logros ECE (lectura, mate, HGE) | S5 Identicole | **2018** | servicio educativo | `cod_mod`+`anexo` | HTML servidor | 🟡 |
| Deserción | S6 Datos Abiertos | 2023–2024 | **distrito (ubigeo)** | `ubigeo` | CSV directo | 🟡 |
| Fecha de atención / cierre | — | — | — | — | **NO EXISTE** | 🔴 |

---

## 2. FUENTES VERIFICADAS

### S1 — Portal público SíseVe
`https://siseve.minedu.gob.pe/Web/`

Siete endpoints reales, todos `POST`, cuerpo `{"filter": "<AES-128-CBC>"}`.
La clave viaja en el HTML (`div#divTheme[data-url]`): es ofuscación de cliente,
no autenticación, sin sesión ni token.

| Ruta | Parámetros |
|---|---|
| `/TableroControl/ListarAnio` | — |
| `/TableroControl/ListarDatosMapa` | `ANIO` |
| `/TableroControl/ListarDreUgel` | — |
| `/TableroControl/ListarDatosGraficoNacional` | `ANIO` |
| `/TableroControl/ListarDatosGraficoRegion` | `ANIO`, `CODIGO_MAPA` |
| `/TableroControl/ListarDatosGraficoUgel` | `ANIO`, `CODIGO_MAPA`, `CODIGO_UGEL` |
| `/Inicio/DescargarEXCEL` | — (xlsx caso por caso) |

**Verificado que NO existe granularidad por IE**: los endpoints ignoran
`CODIGO_IE`, `COD_MOD`, `CODIGO_MODULAR`, `CODIGO_LOCAL`, `CODIGO_INSTITUCION`,
`ID_IE` (respuestas idénticas byte a byte); ocho nombres de endpoint plausibles
devuelven un 404 cifrado; el Excel público llega solo hasta `UGEL`.
Años publicados hoy: **2024, 2025, 2026** únicamente.

Rol en el proyecto: **validación cruzada**, no fuente primaria.

### S2 — Base SíseVe por Transparencia ⭐ fuente primaria
Archivo `AnexoMPD2026EXT0825304.xlsx`, hoja `ReporteCasos`.

**122,984 reportes · 2013-01 a 2026-08-31 · 22,569 códigos modulares · 27 columnas.**

```
CODIGO_UNICO, FECHA_REPORTE, ESTADO_REPORTE, REGION, PROVINCIA, DISTRITO,
DIRECCION, DRE, UGEL, INSTITUCION_EDUCATIVA, CODIGO_MODULAR, TIPO_GESTION,
NIVEL_EDUCATIVO, TIPO_REPORTE, AGREDIDO_EDAD, AGREDIDO_SEXO, AGREDIDO_IDIOMA,
AGREDIDO_GRADO, AGREDIDO_TURNO, AGREDIDO_RELACION_ACTOR, SUPUESTO_AGRESOR_SEXO,
SUPUESTO_AGRESOR_EDAD, SUPUESTO_AGRESOR_RELACION_ACTOR, TIPO_VIOLENCIA,
SUBTIPO_VIOLENCIA, FRECUENCIA, MOTIVO_VIOLENCIA
```

**Validación contra S1 — coincidencia exacta:**

| Prueba | S2 | S1 |
|---|---:|---:|
| Total 2024 | 19,297 | 19,297 ✓ |
| Total 2025 | 19,531 | 19,531 ✓ |
| Total 2026 | 11,791 | 11,791 ✓ |
| 2025 Física / Psicológica / Sexual | 8,457 / 7,608 / 3,466 | idénticos ✓ |
| UGEL 07 San Borja 2025 | 1,266 | 1,266 ✓ |

Serie anual completa:

| 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026* |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 207 | 2,029 | 3,635 | 5,288 | 5,552 | 9,383 | 13,001 | 755 | 768 | 12,025 | **19,722** | 19,297 | 19,531 | 11,791 |

\* enero–agosto. 2020–2021 es el cierre de colegios por pandemia: la serie **no
es comparable** en esos años. El pico real es 2023.

### S3 — ESCALE, API REST del Padrón de IIEE ⭐
`https://escale.minedu.gob.pe/padron/rest/`

Descubierta leyendo `/PadronWeb/resources/js/form.js` (`PADRON_URL="/padron"`).
Pública, sin autenticación. El `token` del export es 8 caracteres aleatorios
generados en el cliente — anti-caché, no credencial.

| Endpoint | Parámetros |
|---|---|
| `/instituciones` | `ubigeo` (acepta prefijo: `15`, `1501`, `150140`), `nombreIE`, `codmod`, `codlocal`, `codinst`, `ugel`, `start` (pág. de 50), `campos` |
| `/instituciones/cuenta` | igual — requiere `Accept: text/plain` |
| `/regiones`, `/provincias`, `/distritos`, `/ugels`, `/direccionesRegionales` | catálogos |
| `/padron/xls/padron` | export, mismos filtros + `campos` + `token` |

**Campos poblados**: `codMod`, `codlocal`, `codinst`, `cenEdu`, `dirCen`,
`gestion`, `director`, `telefono`, `fechareg`, `cenPob`, `localidad`, `codccpp`,
`nlatIE`, `nlongIE`, `nlatCp`, `nlongCp`, `nzoom`, `anexo`.

**Campos siempre vacíos**: `area`, `distrito`, `ugel`, `nivelModalidad`,
`estado`, `turno`, `genero`, `email`, `nroruc`, `pagweb`.

> El distrito se resuelve **consultando por ubigeo de distrito**: así se conoce
> por construcción. El nivel se resuelve por `estadistica.nivelModalidad`.

**`campos=estadistica` es la llave del denominador.** Devuelve:

```json
{"codMod":"0643270","talumno":"132","tdocente":"18","tseccion":"15",
 "totalh":"74","totalm":"58","matr1h":"5","matr1m":"5", ... "matr10m":"25",
 "nivelModalidad":{"idCodigo":"E2","valor":"Básica Especial - Primaria"},
 "imputado":"2"}
```

Limitación verificada: **un solo año**. Los parámetros `anio` y `anioCenso` no
tienen efecto. Para series históricas hay que usar S4.

### S4 — Matriculación y Trayectoria Estudiantil 2021–2024 ⭐
`https://www.datosabiertos.gob.pe/dataset/matriculación-y-trayectoria-estudiantil-2021-2024`

Un CSV por año + diccionario. Derivado de SIAGIE. Descarga directa:

```
.../sites/default/files/Matriculación y Trayectoria Estudiantil 2021.csv
                                                        ... 2022.csv
                                                        ... 2023.csv
                                                        ... 2024.csv
.../sites/default/files/Diccionario_6.xlsx
```

Granularidad: `cod_mod` × `anexo` × `id_nivel` × `Edad` × `TipoDiscaIntegrada`.

```
cod_mod, anexo, Nombre, gestion, id_nivel, dsc_nivel, Edad, TipoDiscaIntegrada,
TotalEstudiantes, Discapacidad, Mujer, Hombre, Venezolanos, Peruanos,
Extranjeros, DNI_validado, DNI_SinValidar, No_DNI, Aprobado, Desaprobado,
Retirado, Fallecido, RequiereRecuperacion, Matriculado, PostergaEvaluacion,
tot_atraso
```

**`Retirado` da deserción a nivel de colegio** — mucho mejor que S6, que solo
llega a distrito. `tot_atraso` da atraso escolar.

### S5 — Identicole
`https://identicole.minedu.gob.pe/`

API de catálogos: `POST /api/provincia/{id}`, `/api/distrito/{id}`, `/api/Dre/`,
`/api/Ugel/`, `/api/nivel/`.

**Ficha del colegio, renderizada en el servidor, sin API ni captcha:**
`GET /colegio/mi_colegio/{cod_mod}{anexo}` — ej. `/colegio/mi_colegio/03056150`

Contenido verificado, con su fuente declarada en la propia página:

| Bloque | Variables | Fuente declarada |
|---|---|---|
| Contacto | director, dirección, ubigeo, **área urbano/rural**, teléfono | Padrón 2026 |
| Datos generales | gestión, gestión a cargo de, modalidad, nivel, forma de atención, clasificación, **modelo JEC/No JEC**, alumnado, turno | Padrón 2026 |
| **Costos y pagos** | **Pensión 2025, Pensión 2024**, APAFA | **SIAGIE 2025** |
| Infraestructura | espacios educativos, administrativos, deportivos, accesibilidad | **Censo Escolar 2021** |
| Equipamiento | equipamiento, **acceso a internet** | **Censo Escolar 2021** |
| Estudiantes y docentes | total estudiantes, promedio por sección, secciones por grado, total docentes | Censo Escolar 2021 |
| **Logros ECE** | lectura, matemática, HGE, con comparación a colegios similares, región y país | **ECE 2018** |
| Programas | Qali Warma | Padrón 2026 |

Advertencias: el texto de infraestructura viene con *mojibake* y hay que
normalizar la codificación; la nota del propio portal dice que los costos son
**declarativos** del colegio.

### S6 — Deserción por distrito
`https://www.datosabiertos.gob.pe/dataset/tasa-y-número-de-desertores-en-educación-primaria-y-secundaria-20232024`

Columnas: `ubigeo, Departamento, Provincia, Distrito, desertor, denominador, Tasa`.
Granularidad **distrital**, no escolar. Úsese solo como control territorial;
para deserción por colegio, `Retirado` de S4 es superior.

### Fuentes buscadas y NO encontradas

- **SíseVe en Datos Abiertos**: no existe dataset.
- **Docentes por colegio a nivel nacional en Datos Abiertos**: los resultados son
  universitarios o regionales. La vía real es `tdocente` de S3.
- **Infraestructura por local en Datos Abiertos**: solo proyectos de obra
  (FONCODES, inspecciones), no características del local.
- **INEI / MIDIS / MEF**: no verifiqué fuentes concretas. Las dejo fuera del
  informe antes que listarlas sin comprobar. 🔴 pendiente.

---

## 3. LLAVES DE UNIÓN

```
codinst  (institución educativa)   1 ─┐
                                      ├─ n  codlocal (local físico)
                                      └─ n  codMod + anexo (servicio educativo)
```

Los tres conceptos son distintos y el proyecto debe mantenerlos separados:

- **`codMod` + `anexo`** — un nivel educativo en un local. Es la unidad de S2,
  S3, S4 y S5. **Llave principal.**
- **`codlocal`** — el campus. Es lo que una familia llama «el colegio».
  Agregación correcta para el buscador público.
- **`codinst`** — la institución jurídica.

Verificado con el Colegio de la Inmaculada (Jesuitas): tres `codMod`
(0305615, 0324053, 1055680), un `codlocal` (340962), una dirección.

**Normalización obligatoria**: S2 trae el código modular sin rellenar
(85,194 filas con 6 dígitos, 37,786 con 7, 4 con 4). Hay que hacer
`zfill(7)` antes de cualquier join. Sin eso, el cruce falla en silencio.

**Distritos**: los nombres de ESCALE vienen sin tilde («Rimac», «Brena»,
«Pachacamac») y Lurigancho aparece sin el «-Chosica». Normalizar quitando
diacríticos antes de unir, o unir por ubigeo.

---

## 4. COBERTURA TEMPORAL

| Dataset | 2018 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| S2 SíseVe Transparencia | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (ene–ago) |
| S1 SíseVe portal | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| S3 ESCALE padrón + estadística | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (solo actual) |
| S4 Trayectoria | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| S5 pensiones | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| S5 infraestructura | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| S5 ECE | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| S6 deserción distrital | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |

**La ventana donde todo coincide es 2024.** Es el único año con reportes,
matrícula histórica, pensión y deserción. Para el análisis transversal
principal, usar 2024.

---

## 5. DATA WAREHOUSE PROPUESTO

```sql
-- dimensión: el servicio educativo
schools(cod_mod PK, anexo, cod_local, cod_inst, nombre_ie, ubigeo,
        departamento, provincia, distrito, dre, ugel, gestion, gestion_detalle,
        nivel, modalidad, area, turno, jec, lat, lon, direccion, fuente, cargado_en)

-- un campus: lo que el buscador público muestra
school_sites(cod_local PK, nombre, direccion, ubigeo, distrito, ugel, lat, lon)
school_site_members(cod_local FK, cod_mod FK)

enrollment(cod_mod, anexo, anio, nivel, edad, total, mujer, hombre,
           aprobado, desaprobado, retirado, requiere_recuperacion, atraso,
           discapacidad, extranjeros, fuente, PK(cod_mod,anexo,anio,nivel,edad))

teachers(cod_mod, anio, docentes, secciones, alumnos_por_seccion, fuente,
         PK(cod_mod,anio))

infrastructure(cod_local, anio, espacios_educativos, espacios_administrativos,
               infra_deportiva, accesibilidad, equipamiento, internet, fuente,
               PK(cod_local,anio))

tuition(cod_mod, anio, pension, apafa, matricula, cuota_ingreso, fuente,
        declarativo BOOLEAN, PK(cod_mod,anio))

learning(cod_mod, anio, area, nivel_logro, porcentaje, fuente)

-- HECHO PRIVADO — nunca sale a la capa pública
siseve_reports(codigo_unico PK, cod_mod, fecha_reporte, anio, estado,
               tipo_reporte, tipo_violencia, subtipo_violencia, frecuencia,
               motivo, agredido_edad, agredido_sexo, agredido_grado,
               agredido_turno, agresor_sexo, agresor_relacion)

-- HECHO PÚBLICO — lo único que consume la API
siseve_agg(cod_mod, anio, tipo_violencia, tipo_reporte, estado,
           reportes, suprimido BOOLEAN)

-- métrica derivada
school_year_metrics(cod_mod, anio, reportes, estudiantes,
                    reportes_por_1000, reportes_sexual_por_1000,
                    ratio_alumno_docente, pension, tasa_retiro)
```

---

## 6. PIPELINE

```
S1 portal    S2 Transparencia    S3 ESCALE API    S4 CSV    S5 Identicole    S6 CSV
    │              │                   │             │            │             │
    └──────────────┴─────────┬─────────┴─────────────┴────────────┴─────────────┘
                             ▼
                     EXTRACCIÓN  (cache en disco, incremental, rate-limit, retries)
                             ▼
                   NORMALIZACIÓN  zfill(7) · diacríticos · mojibake · ubigeo
                             ▼
                     VALIDACIÓN  S2 vs S1 por año/tipo/UGEL · cobertura de joins
                             ▼                              ⤷ falla ⇒ aborta
                    TABLA MAESTRA  schools × año
                             ▼
                        MÉTRICAS  tasas por 1,000 · ratios
                             ▼
                     ANONIMIZACIÓN  agregación + supresión n<5     ← puerta obligatoria
                             ▼
                            API  solo lee siseve_agg y *_metrics
                             ▼
                   LANDING / DASHBOARD
```

La anonimización es una **puerta del pipeline**, no una convención: si la API
pudiera leer `siseve_reports`, algún día lo hará.

---

## 7. ANÁLISIS POSIBLES

| # | Análisis | Estado | Nota |
|---|---|---|---|
| A | Pensión ↔ reportes/1000 | 🟢 | pensión 2024–2025 (S5) × matrícula (S3/S4). Solo privados con pensión declarada. |
| B | Tamaño ↔ reportes/1000 | 🟢 | matrícula de S3 o S4 |
| C | Gestión pública vs privada | 🟢 | `TIPO_GESTION` en S2 y S3 |
| D | Ubicación (dpto/prov/dist) | 🟢 | S2 ya trae los tres |
| E | Nivel educativo | 🟢 | S2 `NIVEL_EDUCATIVO` |
| F | Infraestructura y conectividad | 🟡 | S5, pero **Censo 2021**: 3–5 años de desfase contra reportes 2024–2026 |
| G | Docentes, ratio alumno/docente | 🟡 | `tdocente` de S3 es de un solo año; no hay serie |
| H | Deserción ↔ violencia | 🟢 | `Retirado` de S4 por cod_mod, 2021–2024. Cuidado con la dirección causal |
| I | **Días de atención** | 🔴 | **NO DISPONIBLE.** S2 solo trae `FECHA_REPORTE`. No inferir. |
| — | Serie histórica 2013–2026 | 🟢 | solo S2. Excluir 2020–2021 de toda comparación |
| — | Logros de aprendizaje ↔ violencia | 🟡 | ECE 2018, muy desfasado |

### Confusores que el análisis debe declarar

El análisis A (pensión ↔ violencia) está confundido, como mínimo, por:

- **Propensión a reportar.** El hallazgo central de esta investigación: a menor
  volumen de reportes, mayor gravedad de la composición (r = −0,54 entre
  log-volumen y % de agresor-personal-IE, por DRE). Reportar mucho es señal de
  que el canal funciona, no de que haya más violencia.
- **Tamaño del colegio** (correlaciona con pensión y con conteo bruto).
- **Composición socioeconómica** y capacidad de las familias de escalar un caso.
- **Ubicación**: los colegios caros están en distritos con más cobertura UGEL.
- **Nivel educativo**: la secundaria concentra el 64 % de los reportes.

Ninguna asociación de esta plataforma admite lectura causal. La redacción debe
decir «se asocia con», nunca «provoca».

---

## 8. DATOS QUE FALTAN

| Falta | Estado | Vía |
|---|---|---|
| Fechas de atención y cierre | 🔴 no existe en lo entregado | pedir en una ampliación de la solicitud |
| Deduplicación reporte → caso | 🔴 imposible | `CODIGO_UNICO` es 1:1 con las filas; identifica el reporte, no el hecho |
| Matrícula histórica 2025–2026 | 🔴 | S4 termina en 2024; S3 solo da el año actual |
| Pensiones antes de 2024 | 🔴 | Identicole solo muestra 2024 y 2025 |
| Infraestructura posterior a 2021 | 🔴 | depende de que publiquen un Censo Escolar más reciente |
| ECE posterior a 2018 | 🔴 | — |
| Área urbano/rural masiva | 🟡 | no está en la API; hay que scrapear Identicole ficha a ficha |

---

## 9. CALIDAD POR FUENTE

| Fuente | Cobertura | Completitud | Riesgos | Veredicto |
|---|---|---|---|---|
| S2 Transparencia | 2013–2026, nacional | `AGREDIDO_EDAD=0` en 10,730 filas (= nulo, no cero); `MOTIVO` con HTML | corte único al 31-08-2026 | 🟢 |
| S1 portal | 2024–2026 | completa | solo agregados | 🟢 validación |
| S3 ESCALE API | actual | 21 campos vacíos de 52 | sin histórico; `imputado` marca estimaciones | 🟢 |
| S4 Trayectoria | 2021–2024 | por verificar en carga | cambio metodológico entre años sin verificar | 🟡 |
| S5 Identicole | mixta | pensión solo en privados | **declarativa**; mojibake; scraping ficha a ficha | 🟡 |
| S6 deserción | 2023–2024 | distrital | granularidad insuficiente | 🟡 |

**Comparabilidad entre años**: 2020 y 2021 no son comparables (colegios
cerrados). 2026 es parcial (ene–ago). 2022 es de retorno progresivo a
presencialidad. Solo **2023, 2024 y 2025** son años lectivos plenos y
comparables entre sí.

---

## 10. LAS 5 FUENTES A INTEGRAR PRIMERO

1. **S2 — Base SíseVe por Transparencia.** Ya la tienes. Es el hecho central y
   sin ella no hay plataforma. Es un archivo: cero riesgo de extracción.
   *Primer paso: cargar, normalizar `zfill(7)`, separar tabla privada de agregado.*

2. **S3 — ESCALE padrón + `campos=estadistica`.** Da identidad, coordenadas,
   nivel, matrícula y docentes de una sola API pública y estable. Es el
   denominador: convierte conteos en tasas, que es lo que hace honesto el
   ranking. ~600 páginas por provincia, ya probado.

3. **S4 — Matriculación y Trayectoria 2021–2024.** Cuatro CSV, descarga directa,
   por `cod_mod`. Aporta la serie histórica de matrícula **y** `Retirado`, que
   habilita el análisis de deserción por colegio. Es la fuente con mejor
   relación valor/esfuerzo.

4. **S5 — Identicole, ficha por colegio.** La única vía a pensión, área
   urbano/rural, JEC, infraestructura y conectividad. Es la más cara —scraping
   ficha a ficha con rate-limit— así que **empezar solo por los colegios que
   aparecen en S2** (22,569), no por el padrón completo.

5. **S1 — Portal SíseVe.** No aporta datos nuevos, pero es el **control de
   calidad**: correr la validación cruzada en cada actualización detecta si el
   archivo de Transparencia envejeció o si el Minedu cambió de criterio.

Deliberadamente fuera del top 5: S6 (granularidad insuficiente) e INEI/MIDIS/MEF
(no verificadas todavía).

---

## Reglas de extracción

- Descubrimiento en este orden: API oficial → dataset descargable → endpoint
  público → HTML → scraping. Se cumplió: S3 y S5 se resolvieron por API/HTML
  público sin llegar a scraping ciego.
- Cache en disco por página, ejecución reanudable, pausa ≥ 0,35 s, reintentos
  con backoff, log de fallos.
- **No se evade login, captcha ni control de acceso.** El área autenticada de
  SíseVe y de SIAGIE queda fuera del proyecto: ahí están los datos por colegio
  en vivo, y el camino a ellos es administrativo, no técnico.
