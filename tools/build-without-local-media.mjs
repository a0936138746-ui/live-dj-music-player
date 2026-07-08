import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmdirSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const assetsDir = path.join(root, "public", "assets");
const cacheDir = path.join(root, ".local-media-cache", "assets");
const stagingRoot = path.join(root, ".next-build-staging");
const dryRun = process.argv.includes("--dry-run");
const shouldUseStagedBuild = !process.env.VERCEL && process.env.CI !== "true";
let activeStageRoot = "";

function getLocalVideos() {
  if (!existsSync(assetsDir)) return [];

  return readdirSync(assetsDir)
    .filter((file) => file.toLowerCase().endsWith(".mp4"))
    .map((file) => ({
      file,
      from: path.join(assetsDir, file),
      to: path.join(cacheDir, file),
    }))
    .filter(({ from }) => existsSync(from));
}

function moveLocalVideosOut(videos) {
  if (videos.length === 0) return { ok: true };
  mkdirSync(cacheDir, { recursive: true });

  for (const video of videos) {
    if (dryRun) {
      console.log(`[dry-run] move out ${video.file}`);
      continue;
    }

    try {
      renameSync(video.from, video.to);
    } catch (error) {
      restoreLocalVideos(videos);

      const reason = error && typeof error === "object" && "code" in error ? ` (${error.code})` : "";
      return { ok: false, file: video.file, reason };
    }
  }

  return { ok: true };
}

function restoreLocalVideos(videos) {
  for (const video of videos) {
    if (!existsSync(video.to) || existsSync(video.from)) continue;

    renameSync(video.to, video.from);
  }

  if (!dryRun && existsSync(path.join(root, ".local-media-cache"))) {
    try {
      rmSync(path.join(root, ".local-media-cache"), { recursive: true, force: true });
    } catch {
      // The cache folder is only a build helper; leaving it is harmless if Windows locks a file briefly.
    }
  }
}

function shouldCopyToStage(source) {
  const relativePath = path.relative(root, source);

  if (!relativePath) return true;

  const parts = relativePath.split(path.sep);
  const topLevel = parts[0];

  if (
    parts.length === 1 &&
    (topLevel === "package-lock.json" ||
      topLevel === "yarn.lock" ||
      topLevel === "pnpm-lock.yaml" ||
      topLevel === "bun.lockb")
  ) {
    return false;
  }

  if (
    topLevel === ".git" ||
    topLevel === ".local-media" ||
    topLevel === ".local-media-cache" ||
    topLevel === ".next" ||
    topLevel === ".next-build-staging" ||
    topLevel === "node_modules"
  ) {
    return false;
  }

  return !(parts[0] === "public" && parts[1] === "assets" && source.toLowerCase().endsWith(".mp4"));
}

function createStagedBuildRoot() {
  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(stagingRoot, { recursive: true });

  activeStageRoot = mkdtempSync(path.join(stagingRoot, "build-"));

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const source = path.join(root, entry.name);
    if (!shouldCopyToStage(source)) continue;

    cpSync(source, path.join(activeStageRoot, entry.name), {
      filter: shouldCopyToStage,
      recursive: true,
    });
  }

  symlinkSync(path.join(root, "node_modules"), path.join(activeStageRoot, "node_modules"), "junction");

  return activeStageRoot;
}

function isInside(parent, child) {
  const relativePath = path.relative(parent, child);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function cleanupStagedBuild() {
  if (!activeStageRoot) return;

  const resolvedStagingRoot = path.resolve(stagingRoot);
  const resolvedStageRoot = path.resolve(activeStageRoot);
  if (!isInside(resolvedStagingRoot, resolvedStageRoot)) return;

  try {
    const stagedNodeModules = path.join(activeStageRoot, "node_modules");
    if (existsSync(stagedNodeModules)) rmdirSync(stagedNodeModules);
  } catch {
    // The staging folder is disposable; the next build will recreate it if cleanup is blocked.
  }

  try {
    rmSync(stagingRoot, { recursive: true, force: true });
  } catch {
    // The next build can replace the staging folder if Windows keeps a handle briefly.
  }

  activeStageRoot = "";
}

function runNextBuild(buildRoot = root) {
  return new Promise((resolve) => {
    const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
    let child;

    try {
      child = spawn(process.execPath, [nextCli, "build"], {
        cwd: buildRoot,
        shell: false,
        stdio: "inherit",
      });
    } catch (error) {
      const reason = error && typeof error === "object" && "code" in error ? ` (${error.code})` : "";
      console.error("");
      console.error(`Cannot start Next.js build${reason}.`);
      resolve(1);
      return;
    }

    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

const videos = getLocalVideos();

if (dryRun) {
  moveLocalVideosOut(videos);
  console.log(`Local MP4 files found: ${videos.length}`);
  process.exit(0);
}

let exitCode = 1;

const restoreAndExit = () => {
  restoreLocalVideos(videos);
  process.exit(exitCode);
};

process.on("SIGINT", restoreAndExit);
process.on("SIGTERM", restoreAndExit);

try {
  if (shouldUseStagedBuild) {
    console.log("Running local production build from a temporary copy.");
    console.log("This keeps the dev server .next cache untouched.");

    const stageRoot = createStagedBuildRoot();
    exitCode = await runNextBuild(stageRoot);
  } else {
    const moveResult = moveLocalVideosOut(videos);

    if (moveResult.ok) {
      exitCode = await runNextBuild();
    } else {
      console.error("");
      console.error(`Cannot move ${moveResult.file}${moveResult.reason} because Windows is locking it.`);
      console.error("The media files were left in public/assets.");
      exitCode = 1;
    }
  }
} finally {
  restoreLocalVideos(videos);
  cleanupStagedBuild();
}

process.exit(exitCode);
