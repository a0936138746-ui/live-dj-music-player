import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const assetsDir = path.join(root, "public", "assets");
const cacheDir = path.join(root, ".local-media-cache", "assets");
const dryRun = process.argv.includes("--dry-run");

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
  if (videos.length === 0) return;
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
      console.error("");
      console.error(`Cannot prepare local build because Windows is locking ${video.file}${reason}.`);
      console.error("Close the local preview/browser tab or stop the dev server, then run npm run build again.");
      console.error("Your media files were left in public/assets.");
      process.exit(1);
    }
  }
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

function runNextBuild() {
  return new Promise((resolve) => {
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(command, ["next", "build"], {
      cwd: root,
      shell: false,
      stdio: "inherit",
    });

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
  moveLocalVideosOut(videos);
  exitCode = await runNextBuild();
} finally {
  restoreLocalVideos(videos);
}

process.exit(exitCode);
