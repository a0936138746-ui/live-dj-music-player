import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const localAssetsDir = path.join(root, ".local-media", "assets");
const requiredDjVideos = [
  "dj-soft.mp4",
  "dj-soft-01.mp4",
  "dj-groove.mp4",
  "dj-groove-01.mp4",
  "dj-peak.mp4",
  "dj-peak-01.mp4",
  "dj-rock-live.mp4",
  "dj-rock-live-01.mp4",
  "dj-guest-01.mp4",
];

const args = process.argv.slice(2);
const explicitBaseUrl = args.find((arg) => arg.startsWith("--base-url="))?.slice("--base-url=".length);
const shouldCheckCloud = args.includes("--cloud") || Boolean(explicitBaseUrl);

function readEnvValue(fileName, key) {
  const filePath = path.join(root, fileName);
  if (!existsSync(filePath)) return "";

  const line = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${key}=`));

  return line?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "") ?? "";
}

function getConfiguredBaseUrl() {
  return (
    explicitBaseUrl ||
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
    readEnvValue(".env.local", "NEXT_PUBLIC_MEDIA_BASE_URL") ||
    readEnvValue(".env", "NEXT_PUBLIC_MEDIA_BASE_URL")
  ).replace(/\/$/, "");
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

async function checkCloudFile(baseUrl, fileName) {
  const url = `${baseUrl}/assets/${fileName}`;

  try {
    const headResponse = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
    });

    if (headResponse.ok) return { ok: true, status: headResponse.status, url };
  } catch {
    // Some storage providers do not support HEAD reliably; try a one-byte range request next.
  }

  try {
    const rangeResponse = await fetch(url, {
      headers: {
        Range: "bytes=0-0",
      },
      signal: AbortSignal.timeout(8000),
    });

    return { ok: rangeResponse.ok, status: rangeResponse.status, url };
  } catch {
    return { ok: false, status: "network", url };
  }
}

function printLocalReport() {
  const localVideos = getLocalVideos();
  const localVideoSet = new Set(localVideos);
  const missingRequired = requiredDjVideos.filter((file) => !localVideoSet.has(file));
  const unusedLocalVideos = localVideos.filter((file) => !requiredDjVideos.includes(file));
  const totalSize = localVideos.reduce((sum, file) => sum + statSync(path.join(localAssetsDir, file)).size, 0);

  console.log("");
  console.log("DJ media local check");
  console.log(`Folder: ${path.relative(root, localAssetsDir)}`);
  console.log(`Found: ${localVideos.length} MP4 (${formatBytes(totalSize)})`);
  console.log(`Required: ${requiredDjVideos.length}`);

  if (missingRequired.length > 0) {
    console.log("");
    console.log("Missing required local files:");
    missingRequired.forEach((file) => console.log(`- ${file}`));
  }

  if (unusedLocalVideos.length > 0) {
    console.log("");
    console.log("Extra local files not currently used by the player:");
    unusedLocalVideos.forEach((file) => console.log(`- ${file}`));
  }

  if (missingRequired.length === 0) {
    console.log("");
    console.log("Local DJ media is ready.");
  }

  return missingRequired.length === 0;
}

async function printCloudReport(baseUrl) {
  console.log("");
  console.log("DJ media cloud check");
  console.log(`Base URL: ${baseUrl || "(not set)"}`);

  if (!baseUrl) {
    console.log("Cloud check skipped. Set NEXT_PUBLIC_MEDIA_BASE_URL or pass --base-url=https://...");
    return true;
  }

  const results = await Promise.all(requiredDjVideos.map((file) => checkCloudFile(baseUrl, file)));
  const missing = results.filter((result) => !result.ok);

  results.forEach((result, index) => {
    const file = requiredDjVideos[index];
    console.log(`${result.ok ? "OK" : "MISSING"} ${file} (${result.status})`);
  });

  if (missing.length > 0) {
    console.log("");
    console.log("Cloud DJ media is incomplete.");
    return false;
  }

  console.log("");
  console.log("Cloud DJ media is ready.");
  return true;
}

const localOk = printLocalReport();
const cloudBaseUrl = getConfiguredBaseUrl();
const cloudOk = shouldCheckCloud || cloudBaseUrl ? await printCloudReport(cloudBaseUrl) : true;

process.exitCode = localOk && cloudOk ? 0 : 1;
