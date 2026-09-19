# Solicitud de acceso a la información pública — base SíseVe desagregada por IE

> Borrador. Reemplazar los campos entre `[corchetes]` antes de enviar.
> Vía: Mesa de Partes Virtual del Minedu (gob.pe) o el Formulario de Solicitud de
> Acceso a la Información Pública del portal de transparencia del sector.
> Base legal: Ley N° 27806, TUO aprobado por D.S. N° 021-2019-JUS.
> Plazo: 10 días hábiles, prorrogable por 2 días adicionales previa comunicación.

---

**Señores**
Ministerio de Educación del Perú
Unidad de Transparencia y Acceso a la Información Pública

**Solicitante:** [nombre completo]
**Documento de identidad:** [DNI]
**Domicilio / correo para notificación:** [correo electrónico]
**Fecha:** [fecha]

**Asunto:** Solicitud de acceso a información pública — base de datos de reportes
del Sistema Especializado en Reporte de Casos sobre Violencia Escolar (SíseVe),
desagregada por institución educativa.

---

## I. Petitorio

Al amparo del artículo 2°, numeral 5, de la Constitución Política del Perú y del
Texto Único Ordenado de la Ley N° 27806, Ley de Transparencia y Acceso a la
Información Pública, solicito se me entregue **en formato electrónico reutilizable
(CSV o XLSX)** la base de datos de reportes registrados en la plataforma SíseVe,
con el siguiente detalle:

### Período
Del **1 de enero de 2019** al **[fecha de corte más reciente disponible]**.

De no ser posible el período completo, solicito la serie más extensa que obre en
los registros de la entidad, indicando expresamente la fecha de inicio de la
cobertura entregada.

### Unidad de registro
**Un registro por reporte**, no agregados ni tablas resumen.

### Campos solicitados

| Campo | Descripción |
|---|---|
| `ANIO` | Año del reporte |
| `FECHA_REPORTE` | Fecha de registro del reporte |
| `CODIGO_MODULAR` | **Código modular de la institución educativa** |
| `NOMBRE_IE` | **Nombre de la institución educativa** |
| `CODIGO_UGEL` / `UGEL` | Unidad de Gestión Educativa Local |
| `CODIGO_DRE` / `DRE` | Dirección Regional de Educación |
| `UBIGEO` / `DISTRITO` / `PROVINCIA` / `REGION` | Ubicación geográfica |
| `TIPO_GESTION` | Pública o privada |
| `AREA` | Urbana o rural |
| `MODALIDAD` | Básica Regular, Alternativa, Especial |
| `NIVEL_EDUCATIVO` | Inicial, Primaria, Secundaria |
| `TIPO_REPORTE` | Entre escolares / Personal IE a escolares |
| `TIPO_VIOLENCIA` | Física, psicológica, sexual |
| `SUBTIPO_VIOLENCIA` | Subtipo según la clasificación vigente del sistema |
| `TIPO_ESTADO_REPORTE` | Estado de atención al corte |
| `FECHA_CIERRE` | Fecha de cierre o cambio de estado, de existir |
| `NUMERO_MATRICULADO` | Matrícula de la IE en el año del reporte, de estar disponible |

Los dos campos resaltados (`CODIGO_MODULAR` y `NOMBRE_IE`) constituyen el objeto
central de esta solicitud.

### Documentación complementaria
Solicito adjuntar el **diccionario de datos** correspondiente, con la definición de
cada campo, el catálogo de valores admitidos en los campos categóricos y la
descripción del criterio de cierre de casos.

## II. Fundamento

1. **La información solicitada es pública y ya fue entregada por esta entidad.**
   En 2023 el Ministerio de Educación entregó, mediante solicitud de acceso a la
   información pública, una base de reportes SíseVe desagregada a nivel de
   institución educativa, la cual fue publicada por el diario El Comercio en su
   plataforma ECData. Existe, por tanto, precedente institucional de entrega.

2. **No se solicita ningún dato personal.** El petitorio no comprende nombres,
   documentos de identidad, edad, sexo ni ninguna característica identificatoria de
   estudiantes, docentes, denunciantes o presuntos agresores. Se solicitan
   exclusivamente atributos de la **institución educativa** —persona jurídica o
   dependencia del Estado— y la categorización administrativa del reporte. En
   consecuencia, no resulta aplicable la excepción del artículo 17°, numeral 5, del
   TUO de la Ley N° 27806, ni la Ley N° 29733 de Protección de Datos Personales.

3. **La información obra en poder de la entidad en la forma solicitada.** El
   reporte público que el propio portal SíseVe pone a disposición de la ciudadanía
   (`Descargar Excel`, en `siseve.minedu.gob.pe/Web/App/Mapa`) ya entrega un
   listado **caso por caso** con los campos `FECHA_REPORTE`, `DRE`, `UGEL`,
   `NIVEL_EDUCATIVO`, `TIPO_REPORTE`, `TIPO_VIOLENCIA`, `SUBTIPO_VIOLENCIA` y
   `TIPO_ESTADO_REPORTE`. La presente solicitud pide ese mismo archivo con dos
   columnas adicionales que el sistema necesariamente registra, dado que el flujo
   de atención de SíseVe se asigna a una institución educativa determinada. No se
   requiere, por tanto, producir información nueva ni realizar análisis alguno.

4. **Finalidad.** [Investigación periodística / académica / de incidencia sobre
   violencia escolar en el Perú.] Se deja constancia de que, conforme al artículo
   7° del TUO de la Ley N° 27806, no existe obligación de expresar la causa de la
   solicitud; se indica únicamente a título informativo.

## III. Forma de entrega

Solicito la entrega en **formato digital**, remitida al correo electrónico
consignado, o mediante enlace de descarga. De generarse costo de reproducción,
solicito se me informe previamente el monto liquidado y el procedimiento de pago,
conforme al artículo 20° del TUO de la Ley N° 27806.

## IV. Reserva de derechos

De denegarse total o parcialmente lo solicitado, solicito que la respuesta exprese
por escrito **la excepción específica invocada**, con indicación de la norma, el
razonamiento que la sustenta y el plazo por el que se extiende la reserva, conforme
al artículo 13° del TUO de la Ley N° 27806. Me reservo el derecho de interponer
recurso de apelación ante el Tribunal de Transparencia y Acceso a la Información
Pública.

Atentamente,

**[Nombre completo]**
DNI [número]

---

## Notas prácticas

- **Entrega parcial como plan B.** Si el Minedu objeta `NOMBRE_IE`, el
  `CODIGO_MODULAR` por sí solo resuelve el problema: se cruza contra el Padrón de
  Instituciones Educativas de ESCALE, que es público, y de ahí salen nombre,
  dirección, distrito, gestión y nivel.
- **Punto de apoyo más fuerte del pedido.** El argumento 3 es el decisivo: el
  Estado ya publica el archivo caso por caso. Lo que se pide es la misma tabla con
  dos columnas más, no un producto nuevo.
- **Si alegan protección de datos personales.** Conviene responder que una IE no es
  una persona natural, y que el propio Minedu publica indicadores por código
  modular en ESCALE y en Identicole.
- **Plazo y silencio.** Vencidos los 10 días hábiles sin respuesta, opera la
  denegatoria ficta y queda expedito el recurso de apelación ante el Tribunal de
  Transparencia (plazo: 15 días hábiles desde el vencimiento).
