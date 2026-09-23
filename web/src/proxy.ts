import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server.js";

const SESSION_COOKIE = "career_ops_session";
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MULTIPART_ROUTES = new Set(["/api/cv/import", "/api/cv/ingest"]);

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isAllowedHost(value: string | null): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(`http://${value}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return false;
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const remoteHosts = process.env.CAREER_OPS_ALLOW_REMOTE === "1"
      ? (process.env.CAREER_OPS_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean)
      : [];
    const allowedHosts = new Set([
      "localhost",
      "127.0.0.1",
      "::1",
      ...remoteHosts,
    ]);
    return allowedHosts.has(hostname);
  } catch {
    return false;
  }
}

function hasValidSession(request: NextRequest, token: string): boolean {
  const supplied = request.cookies.get(SESSION_COOKIE)?.value;
  if (!supplied) return false;
  const expectedBytes = Buffer.from(token);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function reject(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function hasRequestBody(request: NextRequest): boolean {
  const length = request.headers.get("content-length");
  return (length !== null && length !== "0") || request.headers.has("transfer-encoding");
}

function allowedContentType(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type");
  if (!contentType) return !hasRequestBody(request);
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mediaType === "application/json") return true;
  return mediaType === "multipart/form-data" && MULTIPART_ROUTES.has(request.nextUrl.pathname);
}

function validCsrfHeaders(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || fetchSite !== "same-origin") return false;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  if (!isAllowedHost(request.headers.get("host"))) {
    return reject(403, "Local access only");
  }

  if (isApiPath(request.nextUrl.pathname)) {
    const token = process.env.CAREER_OPS_SESSION_TOKEN;
    if (!token) return reject(503, "Start the web UI with the Career-Ops launcher");
    if (!hasValidSession(request, token)) return reject(401, "Local session token required");
    if (STATE_CHANGING_METHODS.has(request.method) && !validCsrfHeaders(request)) {
      return reject(403, "Same-origin request required");
    }
    if (!allowedContentType(request)) return reject(415, "Unsupported content type");
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const isDocumentRequest = request.method === "GET"
    && request.headers.get("accept")?.includes("text/html");
  if (isDocumentRequest && process.env.CAREER_OPS_SESSION_TOKEN) {
    response.cookies.set(SESSION_COOKIE, process.env.CAREER_OPS_SESSION_TOKEN, {
      httpOnly: true,
      sameSite: "strict",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
