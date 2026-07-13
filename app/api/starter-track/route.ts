const starterTrackFileName = "starter-tonight-out-of-control.m4a";
const fallbackMediaBaseUrl =
  "https://github.com/a0936138746-ui/live-dj-music-player/releases/download/dj-media-v1";

function getStarterTrackUrl() {
  const baseUrl = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || fallbackMediaBaseUrl).replace(/\/$/, "");
  const pathMode = process.env.NEXT_PUBLIC_MEDIA_PATH_MODE === "assets" ? "assets" : "flat";
  const mediaPath = pathMode === "flat" ? starterTrackFileName : `assets/${starterTrackFileName}`;

  return `${baseUrl}/${mediaPath}`;
}

async function proxyStarterTrack(request: Request, method: "GET" | "HEAD") {
  const range = request.headers.get("range");
  const upstream = await fetch(getStarterTrackUrl(), {
    headers: range ? { Range: range } : undefined,
    method,
    redirect: "follow",
  });

  if (!upstream.ok) {
    return new Response("Starter track unavailable", { status: upstream.status });
  }

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    "Content-Disposition": `inline; filename="${starterTrackFileName}"`,
    "Content-Type": "audio/mp4",
  });

  for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(method === "HEAD" ? null : upstream.body, {
    headers,
    status: upstream.status,
  });
}

export async function GET(request: Request) {
  return proxyStarterTrack(request, "GET");
}

export async function HEAD(request: Request) {
  return proxyStarterTrack(request, "HEAD");
}
