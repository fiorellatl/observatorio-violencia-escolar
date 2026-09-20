/**
 * Puerta de privacidad del build.
 *
 * Se ejecuta como `prebuild`, asi que corre solo con `npm run build`, tanto en
 * local como en Netlify. Si encuentra algo que no debe publicarse, termina con
 * codigo 1 y el build no ocurre. No depende de que alguien se acuerde de mirar.
 *
 * Esta escrito en Node y no en Python a proposito: el build de Netlify garantiza
 * Node, no Python. Una validacion que no corre en produccion no es una validacion.
 *
 *   node scripts/validate-public.mjs
 */
import fs from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();
const DIRS = ["data/public", "public/data"];

/**
 * Nunca pueden aparecer. Las primeras son columnas de la base de nivel-reporte
 * de SiseVe (datos personales de menores); las ultimas son campos del padron de
 * ESCALE con datos personales de adultos identificables.
 */
const PROHIBIDOS = [
  "AGREDIDO_EDAD",
  "AGREDIDO_SEXO",
  "AGREDIDO_GRADO",
  "AGREDIDO_TURNO",
  "AGREDIDO_IDIOMA",
  "AGREDIDO_RELACION_ACTOR",
  "SUPUESTO_AGRESOR_SEXO",
  "SUPUESTO_AGRESOR_EDAD",
  "SUPUESTO_AGRESOR_RELACION_ACTOR",
  "MOTIVO_VIOLENCIA",
  "FRECUENCIA",
  "CODIGO_UNICO",
  "director",
  "telefono",
  "email",
  "promotor",
  "rzsocial",
  "nroruc",
];

/** Restos de doble codificacion. Identicole llego a servir texto asi. */
const MOJIBAKE = ["Ã©", "Ã³", "Ã¡", "Ã­", "Ãº", "Ã±", "â€", "Â¿", "Â°", "ï¿½"];

const fallos = [];
const avisos = [];

function archivos(dir) {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".json"))
    .map((d) => path.join(dir, d.name));
}

/**
 * Recorre el JSON y devuelve las claves de objeto y los valores de texto.
 *
 * Se camina el arbol en vez de buscar en el texto crudo porque buscar en crudo
 * da falsos positivos reales: existe un colegio llamado "Infinity School", y
 * una busqueda de la cadena "Infinity" lo marcaba como valor invalido.
 */
function recorrer(valor, acc = { claves: new Set(), textos: new Set() }) {
  if (Array.isArray(valor)) {
    for (const v of valor) recorrer(v, acc);
  } else if (valor && typeof valor === "object") {
    for (const k of Object.keys(valor)) {
      acc.claves.add(k);
      recorrer(valor[k], acc);
    }
  } else if (typeof valor === "string") {
    acc.textos.add(valor);
  } else if (typeof valor === "number" && !Number.isFinite(valor)) {
    acc.claves.add("__no_finito__");
  }
  return acc;
}

function revisar(rel) {
  const texto = fs.readFileSync(path.join(RAIZ, rel), "utf-8");

  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    fallos.push(`${rel}: JSON invalido — ${e.message}`);
    return;
  }

  const { claves, textos } = recorrer(datos);

  // 1. Claves prohibidas, en cualquier nivel de anidamiento.
  const enMinuscula = new Map([...claves].map((k) => [k.toLowerCase(), k]));
  for (const p of PROHIBIDOS) {
    const hit = enMinuscula.get(p.toLowerCase());
    if (hit) fallos.push(`${rel}: clave prohibida "${hit}"`);
  }
  if (claves.has("__no_finito__")) fallos.push(`${rel}: contiene un numero no finito`);

  // 2. Los nombres de columna de SiseVe, por si viajaran como valor de texto.
  //    Solo las MAYUSCULAS: los campos de ESCALE son palabras comunes que
  //    aparecerian en cualquier direccion o nombre propio.
  const columnas = PROHIBIDOS.filter((p) => p === p.toUpperCase());
  for (const t of textos) {
    for (const c of columnas) {
      if (t.includes(c)) fallos.push(`${rel}: el texto ${JSON.stringify(t.slice(0, 60))} contiene "${c}"`);
    }
  }

  // 3. Basura que no debe llegar a la interfaz.
  for (const m of MOJIBAKE) {
    if (texto.includes(m)) {
      fallos.push(`${rel}: texto mal codificado ("${m}")`);
      break;
    }
  }
  for (const t of textos) {
    if (["NaN", "undefined", "null", "Infinity", "[object Object]"].includes(t.trim())) {
      fallos.push(`${rel}: valor de texto invalido ${JSON.stringify(t)}`);
    }
  }

  // 4. Tamano: un archivo enorme suele ser un dataset que se colo entero.
  const mb = Buffer.byteLength(texto) / 1024 / 1024;
  if (mb > 20) avisos.push(`${rel}: ${mb.toFixed(1)} MB — revisa si todo eso hace falta`);
}

const lista = DIRS.flatMap(archivos);
if (lista.length === 0) {
  console.error("✗ no hay nada en data/public. Genera la capa publica antes del build.");
  process.exit(1);
}

for (const f of lista) revisar(f);

console.log(`Privacidad: ${lista.length} archivos revisados en ${DIRS.join(", ")}`);
for (const a of avisos) console.log(`  aviso: ${a}`);

if (fallos.length) {
  console.error("\n✗ BUILD DETENIDO. La capa publica contiene algo que no debe publicarse:\n");
  for (const f of fallos) console.error(`   ${f}`);
  console.error(
    "\nNo publiques esto. Corrige la puerta de anonimizacion en " +
      "scripts/build_public_data.py y vuelve a generar data/public/.\n"
  );
  process.exit(1);
}

console.log("✓ sin campos personales ni valores invalidos");
