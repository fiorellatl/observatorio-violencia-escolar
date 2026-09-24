# Modelo institucional

Cómo el Observatorio distingue un colegio de otro, y cuándo decide que dos
registros son el mismo colegio.

## Tres conceptos que no son lo mismo

El sistema educativo peruano distingue tres cosas que en el habla común se
llaman «colegio». Mantenerlas separadas no es pedantería: mezclarlas produce
números mal construidos.

| Concepto | Qué es | Clave oficial |
|---|---|---|
| **Institución educativa** | La organización. «Colegio Pedro Ruiz Gallo» | `codinst` |
| **Servicio educativo** | Un nivel concreto: la primaria, la secundaria | `codMod` + `anexo` |
| **Local educativo** | El terreno y los edificios | `codlocal` |

Una institución puede prestar varios servicios en un mismo local. Dos
instituciones distintas pueden compartir un local. Un servicio pertenece siempre
a una sola institución.

## La unidad de los datos es el servicio

SíseVe registra cada reporte contra un **código modular**, es decir contra un
servicio educativo, no contra la institución. Por eso un colegio con inicial,
primaria y secundaria aparece tres veces en la fuente, con tres códigos.

La clave del servicio es `codMod + anexo`, no `codMod` solo. Hay códigos
modulares que corresponden a más de un servicio y usar solo el código modular
provoca colisiones silenciosas.

## Cómo se agrupan los servicios en instituciones

**Por `codinst`, y por nada más.**

`codinst` es el identificador oficial de institución educativa del Padrón de
ESCALE. Viene en la misma respuesta de la API que la matrícula.

Dos métodos que **no** se usan, y por qué:

- **`codlocal` no agrupa.** Agrupa edificios. De los locales que alojan más de
  un servicio con reportes, decenas contienen instituciones distintas: un CEBA
  y el colegio regular que comparten patio son dos instituciones, con dos
  poblaciones y dos matrículas. Fusionarlos sumaría reportes de una contra la
  matrícula de la otra.
- **El nombre no agrupa.** Ni exacto ni aproximado. Hay cientos de colegios
  «San Martín de Porres» en el país, y el mismo colegio aparece escrito de
  varias formas. El nombre sirve para *verificar* que `codinst` agrupó bien —y
  coincide en el 95% de los grupos—, nunca para decidir la agrupación.

**Un servicio sin `codinst` se queda solo.** No se le busca acomodo. Preferimos
un colegio sin vista institucional antes que una institución inventada.

### La única excepción (`scripts/unificar_sin_codinst.py`)

858 servicios no tienen `codinst` ni siquiera en el padrón de ESCALE, y en
decenas de casos eso partía un colegio en dos en el ranking: la primaria y la
secundaria de «Padre Iluminato» salían como dos colegios. Se unen solo si se
cumplen **todas** estas condiciones a la vez:

1. ninguno tiene `codinst`, ni en la capa ni en ESCALE;
2. mismo `codlocal` (mismo local) **y** mismo nombre oficial de ESCALE —ni el
   local solo ni el nombre solo, que siguen sin agrupar—;
3. mismo distrito y misma gestión;
4. solo niveles de la básica regular: nunca un CEBA, un CEBE ni un CETPRO,
   que son otras instituciones aunque compartan edificio;
5. ningún nivel repetido.

La institución resultante lleva `"agrupacion": "codlocal_y_nombre"`: se sabe
que no la agrupó un código oficial. Antes, el mismo script agrupa por
`codinst` los servicios que en el padrón de hoy **sí** tienen código y en la
capa no lo tenían —eso es la regla general, no una excepción—.

Resultado del corte actual: 44 uniones por `codinst` y 143 por local y nombre;
17.399 → 17.185 instituciones, sin cambiar un solo reporte ni alumno.

## Reglas de agregación

Cuando la ficha muestra «Institución completa», estos son los cálculos:

| Variable | Regla | Por qué |
|---|---|---|
| Reportes | **Se suman** | Son eventos disjuntos: un reporte pertenece a un solo servicio |
| Matrícula | **Se suma** | Cada nivel atiende a una población distinta; nadie está en dos |
| Tasa | **Se recalcula** desde numerador y denominador sumados | Promediar tasas da un número que no corresponde a ninguna población real |
| Porcentajes | **Se recalculan** | Un porcentaje es un cociente, no una cantidad |
| Pensión | **No se suma.** Se muestra por servicio | Sumar la pensión de primaria y secundaria no da nada interpretable |
| Contexto (área, jornada, conectividad) | **No se duplica.** Vive en el servicio | Son atributos del servicio, no de la institución |

### La regla del denominador completo

**La tasa institucional se calcula solo si todos los servicios de la institución
tienen matrícula.**

Si la primaria tiene matrícula y la secundaria no, el numerador incluye los
reportes de ambas pero el denominador solo cuenta a los alumnos de una. La tasa
resultante estaría inflada y parecería un dato normal. En ese caso la ficha dice
**«tasa no disponible»** y explica por qué.

## Limitaciones vigentes

1. **Un solo año de matrícula.** El padrón disponible es el vigente. No existe
   serie histórica de matrícula, así que no hay serie histórica de tasas, y
   tampoco señales basadas en cambio de tasa.
2. **SíseVe no trae anexo.** Cuando un código modular corresponde a varios
   servicios, no se puede saber a cuál pertenece cada reporte. Se atribuye al
   servicio activo con anexo `0` y el registro queda marcado con
   `anexo_ambiguo`, para que el dato dudoso no se lea como limpio.
3. **La agrupación depende de la cobertura del padrón.** Un servicio que no
   aparece en el padrón no tiene `codinst` y por tanto no se agrupa.
4. **Un reporte no es un caso.** SíseVe entrega reportes registrados, con
   identificador único por fila. No hay forma de saber si dos reportes
   describen el mismo hecho.

## Privacidad

El padrón de ESCALE incluye datos personales de adultos identificables:
director, teléfono, correo, promotor, razón social y RUC. **Ninguno entra al
producto.**

El filtro es una **lista blanca** aplicada en `scripts/bajar_padron_nacional.py`
antes de escribir nada en disco: se nombra lo que entra y todo lo demás se
descarta. Se eligió lista blanca sobre lista negra porque con lista negra
cualquier campo nuevo que agregue el Ministerio entraría solo, y nadie se
enteraría.

`scripts/validate-public.mjs` lo verifica en cada build y lo detiene si algo se
escapó. Corre como `prebuild`, así que también corre en Netlify.
