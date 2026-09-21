/**
 * Validación del motor de distribución, contra los datos reales.
 *
 * Ejecuta `src/lib/distribucion.ts` tal cual lo ejecuta la web: si alguien
 * cambia el universo o los cuantiles, este script lo dice. No reimplementa
 * ningún cálculo a propósito —una validación que copia la lógica que quiere
 * comprobar no valida nada—.
 *
 *   node --experimental-strip-types --import ./scripts/registrar-alias.mjs \
 *        scripts/validate-distribucion.mjs
 */
import { getContexto, getDistribucion } from "@/lib/distribucion";
import { getAllInstitutions, getMeta } from "@/lib/data/provider";

const meta = getMeta();
const fila = (d) =>
  `n=${String(d.n).padStart(6)}  p25=${d.p25}  mediana=${d.mediana}  p75=${d.p75}` +
  `  p90=${d.p90}  p95=${d.p95}  p99=${d.p99}  max=${d.max}`;

console.log("META  anio_max=%s  parcial=%s  pandemia=%s", meta.anio_max, meta.anio_parcial, meta.anios_pandemia.join(","));
console.log("INSTITUCIONES EN LA CAPA PÚBLICA: %d\n", Object.keys(getAllInstitutions()).length);

console.log("── DISTRIBUCIÓN NACIONAL POR AÑO ──────────────────────────────");
for (const anio of ["2023", "2024", "2025", "2026"]) {
  const d = getDistribucion(anio);
  console.log("%s  %s%s", anio, d ? fila(d) : "sin universo suficiente", d?.parcial ? "  [PARCIAL]" : "");
}

console.log("\n── EL UNIVERSO ES LA DECISIÓN: 2025 CON Y SIN CEROS ───────────");
for (const [rotulo, o] of [["con >=1 reporte (por defecto)", {}], ["incluyendo ceros", { incluirCeros: true }]]) {
  const d = getDistribucion("2025", { tipo: "pais" }, o);
  console.log("%s %s", rotulo.padEnd(30), fila(d));
  console.log("%s universo: %s", "".padEnd(30), d.universo);
}

console.log("\n── POSICIÓN DE VALORES CONCRETOS (2025, nacional) ─────────────");
for (const v of [0, 1, 2, 3, 5, 10, 18, 45, 76]) {
  const c = getContexto(v, "2025");
  console.log(
    "valor=%s  percentil=%s  puesto=%s de %d  tramo=%s  %s",
    String(v).padStart(3),
    c.percentil.toFixed(1).padStart(5),
    String(c.rank ?? "—").padStart(5),
    c.n,
    c.tramo.padEnd(9),
    c.frase
  );
}

console.log("\n── CAMBIA EL AÑO: EL MISMO VALOR, OTRO CONTEXTO ───────────────");
for (const anio of ["2024", "2025", "2026"]) {
  const c = getContexto(10, anio);
  console.log("valor=10 en %s  percentil=%s  mediana=%s  %s", anio, c.percentil.toFixed(1), c.mediana, c.frase);
}

console.log("\n── CAMBIA EL NIVEL ────────────────────────────────────────────");
for (const nivel of [null, "Primaria", "Secundaria", "Inicial - Jardín"]) {
  const d = getDistribucion("2025", { tipo: "pais" }, { nivel });
  console.log("%s %s", (nivel ?? "(todos)").padEnd(20), d ? fila(d) : "universo corto: no se publica percentil");
}

console.log("\n── CAMBIA EL TIPO DE VIOLENCIA ────────────────────────────────");
for (const tipo of [null, "fisica", "psicologica", "sexual"]) {
  const d = getDistribucion("2025", { tipo: "pais" }, { tipo });
  console.log("%s %s", (tipo ?? "(total)").padEnd(14), d ? fila(d) : "universo corto: no se publica percentil");
}

console.log("\n── CAMBIA EL TERRITORIO ───────────────────────────────────────");
for (const dep of ["Lima", "Madre de Dios", "Moquegua"]) {
  const d = getDistribucion("2025", { tipo: "departamento", valor: dep });
  console.log("%s %s", dep.padEnd(16), d ? fila(d) : "universo corto: no se publica percentil");
}

console.log("\n── LOS CEROS NO SE PIERDEN POR EL CAMINO ──────────────────────");
const todas = Object.values(getAllInstitutions());
const sinReportes2025 = todas.filter((i) => !(Number(i.anios["2025"]?.total) > 0)).length;
const conReportes2025 = todas.length - sinReportes2025;
const dCeros = getDistribucion("2025", { tipo: "pais" }, { incluirCeros: true });
console.log("instituciones totales:            %d", todas.length);
console.log("con >=1 reporte en 2025:          %d", conReportes2025);
console.log("sin reportes en 2025:             %d", sinReportes2025);
console.log("universo por defecto:             %d  %s", getDistribucion("2025").n, getDistribucion("2025").n === conReportes2025 ? "OK" : "DESCUADRA");
console.log("universo incluyendo ceros:        %d  %s", dCeros.n, dCeros.n === todas.length ? "OK" : "DESCUADRA");
