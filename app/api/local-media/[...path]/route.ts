import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const localMediaRoot = path.resolve(process.cwd(), ".local-media");

function getContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".mp4") return "video/mp4";
  if (extension === ".webm") return "video/webm";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";

  return "application/octet-stream";
}

function resolveLocalMediaPath(parts: string[]) {
  const filePath = path.resolve(localMediaRoot, ...parts);
  const rootWithSeparator = `${localMediaRoot}${path.sep}`;

  if (filePath !== localMediaRoot && filePath.startsWith(rootWithSeparator)) {
    return filePath;
  }

  return undefined;
}

function parseRange(rangeHeader: string | null, fileSize: number) {
  if (!rangeHeader) return undefined;

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return undefined;

  const [, rawStart, rawEnd] = match;
  const start = rawStart ? Number(rawStart) : 0;
  const end = rawEnd ? Number(rawEnd) : fileSize - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= fileSize) {
    return undefined;
  }

  return {
    end: Math.min(end, fileSize - 1),
    start,
  };
}

async function serveLocalMedia(request: Request, context: RouteContext, isHead = false) {
  const { path: mediaPath = [] } = await context.params;
  const filePath = resolveLocalMediaPath(mediaPath);

  if (!filePath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const range = parseRange(request.headers.get("range"), fileStat.size);
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Type": getContentType(filePath),
    });

    if (range) {
      headers.set("Content-Length", String(range.end - range.start + 1));
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${fileStat.size}`);

      return new Response(
        isHead ? null : (Readable.toWeb(createReadStream(filePath, range)) as ReadableStream),
        {
          headers,
          status: 206,
        },
      );
    }

    headers.set("Content-Length", String(fileStat.size));

    return new Response(isHead ? null : (Readable.toWeb(createReadStream(filePath)) as ReadableStream), {
      headers,
      status: 200,
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export function HEAD(request: Request, context: RouteContext) {
  return serveLocalMedia(request, context, true);
}

export function GET(request: Request, context: RouteContext) {
  return serveLocalMedia(request, context);
}
