const axios = require("axios");
const fs = require("fs");
const path = require("path");

// ===============================
// CONFIGURACIÓN
// ===============================
const USER = "sTr4yDev";
const REPO = "speakLexi2.0";
const BRANCH = "main";
const TOKEN = ""; // opcional

// ===============================
// URLs base
// ===============================
const API_URL = `https://api.github.com/repos/${USER}/${REPO}/branches/${BRANCH}`;
const RAW_BASE = `https://raw.githubusercontent.com/${USER}/${REPO}/${BRANCH}/`;

const headers = TOKEN
  ? { Authorization: `token ${TOKEN}` }
  : {};

async function obtenerCommitMasReciente() {
  console.log("Verificando commit más reciente...");

  const res = await axios.get(API_URL, { headers });

  const sha = res.data.commit.sha;
  const fecha = res.data.commit.commit.committer.date;

  console.log(`Commit más reciente: ${sha.slice(0, 8)} (${fecha})`);
  return sha;
}

function clasificarArchivo(pathFile) {
  const lower = pathFile.toLowerCase();

  if (
    lower.endsWith(".py") ||
    lower.includes("api") ||
    lower.includes("server") ||
    lower.includes("models") ||
    lower.includes("routes") ||
    lower.includes("config")
  ) {
    return "backend";
  } else if (
    lower.includes("public") ||
    lower.includes("html") ||
    lower.includes("css") ||
    lower.includes("js") ||
    lower.includes("assets")
  ) {
    return "frontend";
  } else if (
    lower.endsWith(".md") ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".docx") ||
    lower.includes("docs")
  ) {
    return "docs";
  } else {
    return "otros";
  }
}

async function generarRawLinks() {
  const sha = await obtenerCommitMasReciente();

  const treeURL = `https://api.github.com/repos/${USER}/${REPO}/git/trees/${sha}?recursive=1`;

  console.log("Obteniendo estructura del repositorio...");
  const res = await axios.get(treeURL, { headers });

  const archivos = res.data.tree.filter((f) => f.type === "blob");
  console.log(`Total de archivos encontrados: ${archivos.length}`);

  const backend = [];
  const frontend = [];
  const docs = [];
  const otros = [];

  for (const file of archivos) {
    const url = `${RAW_BASE}${file.path}`;
    const categoria = clasificarArchivo(file.path);

    if (categoria === "backend") backend.push(url);
    else if (categoria === "frontend") frontend.push(url);
    else if (categoria === "docs") docs.push(url);
    else otros.push(url);
  }

  const rutaSalida = path.join(process.cwd(), "raw_links.txt");

  const contenido = [
    `# RAW LINKS — Actualizado ${new Date().toISOString()}`,
    `# Repositorio: ${USER}/${REPO}`,
    `# Commit: ${sha}`,
    "",
    "========================= BACKEND LINKS =========================",
    backend.join("\n"),
    "",
    "========================= FRONTEND LINKS =========================",
    frontend.join("\n"),
    "",
    "========================= DOCS LINKS =========================",
    docs.join("\n"),
    "",
    "========================= OTROS =========================",
    otros.join("\n"),
  ].join("\n");

  fs.writeFileSync(rutaSalida, contenido, "utf-8");

  console.log(`Archivo sobrescrito correctamente: ${rutaSalida}`);
  console.log(
    `${backend.length} backend | ${frontend.length} frontend | ${docs.length} docs | ${otros.length} otros`
  );
}

(async () => {
  const start = Date.now();
  try {
    await generarRawLinks();
  } catch (err) {
    console.error("Error:", err.message);
  }
  const end = Date.now();
  console.log(`Tiempo total: ${(end - start) / 1000}s`);
})();
