import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { requiredDjVideos } from "./dj-media-config.mjs";

const root = process.cwd();
const localAssetsDir = path.join(root, ".local-media", "assets");
const args = process.argv.slice(2);
const tag = args.find((arg) => arg.startsWith("--tag="))?.slice("--tag=".length) || "dj-media-v1";
const explicitRepo = args.find((arg) => arg.startsWith("--repo="))?.slice("--repo=".length);
const dryRun = args.includes("--dry-run");

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
}

function getRepositoryName() {
  if (explicitRepo) return explicitRepo;

  const gitConfigPath = path.join(root, ".git", "config");
  if (!existsSync(gitConfigPath)) return "";

  const value =
    readFileSync(gitConfigPath, "utf8")
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith("url ="))
      ?.split("=")
      .slice(1)
      .join("=")
      .trim() ?? "";
  const match = value.match(/github\.com[:/](.+?)(?:\.git)?$/i);

  return match?.[1] ?? "";
}

function assertReady() {
  const repository = getRepositoryName();
  if (!repository) {
    console.error("Cannot detect GitHub repository. Pass --repo=owner/name.");
    process.exit(1);
  }

  const missing = requiredDjVideos.filter((file) => !existsSync(path.join(localAssetsDir, file)));
  if (missing.length > 0) {
    console.error("");
    console.error("Missing required DJ videos:");
    missing.forEach((file) => console.error(`- ${file}`));
    process.exit(1);
  }

  if (!dryRun) {
    const auth = run("gh", ["auth", "status"], { capture: true });
    if (auth.status !== 0) {
      console.error("");
      console.error("GitHub CLI is not logged in.");
      console.error("Run this once, then retry:");
      console.error("  gh auth login -h github.com");
      process.exit(1);
    }
  }

  return repository;
}

const repository = assertReady();
const releaseBaseUrl = `https://github.com/${repository}/releases/download/${tag}`;
const filePaths = requiredDjVideos.map((file) => path.join(localAssetsDir, file));

console.log("");
console.log("GitHub DJ media release upload");
console.log(`Repository: ${repository}`);
console.log(`Tag: ${tag}`);
console.log(`Files: ${filePaths.length}`);

if (dryRun) {
  console.log("");
  console.log("Dry run only. No release was created and no files were uploaded.");
} else {
  const existingRelease = run("gh", ["release", "view", tag, "--repo", repository], { capture: true });

  if (existingRelease.status !== 0) {
    const createRelease = run("gh", [
      "release",
      "create",
      tag,
      "--repo",
      repository,
      "--title",
      "DJ media v1",
      "--notes",
      "Required DJ video assets for the live DJ music player.",
    ]);

    if (createRelease.status !== 0) process.exit(createRelease.status ?? 1);
  }

  const upload = run("gh", ["release", "upload", tag, ...filePaths, "--repo", repository, "--clobber"]);
  if (upload.status !== 0) process.exit(upload.status ?? 1);
}

console.log("");
console.log("Use these Vercel Environment Variables:");
console.log(`NEXT_PUBLIC_MEDIA_BASE_URL=${releaseBaseUrl}`);
console.log("NEXT_PUBLIC_MEDIA_PATH_MODE=flat");
console.log("");
console.log("Then redeploy Vercel.");
