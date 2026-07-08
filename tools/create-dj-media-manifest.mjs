import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { requiredDjVideos } from "./dj-media-config.mjs";

const root = process.cwd();
const localAssetsDir = path.join(root, ".local-media", "assets");
const manifestPath = path.join(root, ".local-media", "dj-media-manifest.json");

const args = process.argv.slice(2);
const includeExtras = args.includes("--all");
const pathMode = args.includes("--flat") || process.env.NEXT_PUBLIC_MEDIA_PATH_MODE === "flat" ? "flat" : "assets";
const explicitBaseUrl = args.find((arg) => arg.startsWith("--base-url="))?.slice("--base-url=".length);
const baseUrl = (explicitBaseUrl || process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "").replace(/\/$/, "");

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function formatBytes(size) {
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getLocalVideos() {
  if (!existsSync(localAssetsDir)) return [];

  return readdirSync(localAssetsDir)
    .filter((file) => file.toLowerCase().endsWith(".mp4"))
    .sort((a, b) => a.localeCompare(b));
}

function createEntry(file) {
  const absolutePath = path.join(localAssetsDir, file);
  const sizeBytes = statSync(absolutePath).size;
  const targetPath = pathMode === "flat" ? file : `assets/${file}`;

  return {
    file,
    required: requiredDjVideos.includes(file),
    localPath: toPosixPath(path.relative(root, absolutePath)),
    targetPath,
    sizeBytes,
    sizeMb: Number((sizeBytes / 1024 / 1024).toFixed(2)),
    url: baseUrl ? `${baseUrl}/${targetPath}` : "",
  };
}

const localVideos = getLocalVideos();
const localVideoSet = new Set(localVideos);
const missingRequired = requiredDjVideos.filter((file) => !localVideoSet.has(file));
const filesToInclude = includeExtras ? localVideos : requiredDjVideos.filter((file) => localVideoSet.has(file));
const files = filesToInclude.map(createEntry);
const totalSize = files.reduce((sum, file) => sum + file.sizeBytes, 0);

const manifest = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  includeExtras,
  localAssetsDir: ".local-media/assets",
  pathMode,
  uploadRoot: pathMode === "flat" ? "." : "assets",
  requiredCount: requiredDjVideos.length,
  fileCount: files.length,
  totalSizeBytes: totalSize,
  totalSizeMb: Number((totalSize / 1024 / 1024).toFixed(2)),
  missingRequired,
  files,
};

mkdirSync(path.dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log("");
console.log("DJ media upload manifest");
console.log(`Output: ${toPosixPath(path.relative(root, manifestPath))}`);
console.log(`Mode: ${includeExtras ? "required + extra local videos" : "required videos only"}`);
console.log(`Path mode: ${pathMode}`);
console.log(`Files: ${files.length} (${formatBytes(totalSize)})`);

if (baseUrl) {
  console.log(`Base URL: ${baseUrl}`);
}

if (missingRequired.length > 0) {
  console.log("");
  console.log("Missing required local files:");
  missingRequired.forEach((file) => console.log(`- ${file}`));
  process.exitCode = 1;
} else {
  console.log("");
  console.log("Manifest is ready. Upload each file so its cloud path matches targetPath.");
}
