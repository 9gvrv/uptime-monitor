export const ERROR_TYPES = [
  "invalid_url",
  "blocked_host",
  "dns_failure",
  "timeout",
  "network_error",
  "too_many_redirects",
  "unexpected_status",
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number];

class CheckError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
  ) {
    super(message);
  }
}

interface CheckResult {
  url: string;
  checkedAt: string;
  status: "up" | "down" | "degraded";
  isUp: boolean;
  statusCode: number | null;
  finalUrl: string | null;
  redirectCount: number;
  timings: { ttfbMs: number | null; totalMs: number };
  error: { type: ErrorType; message: string } | null;
}

interface CheckOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  degradedAfterMs?: number;
  isExpectedStatus?: (code: number) => boolean;
}

// URL normalizes hex/decimal IPv4 forms to dotted decimal, so this regex is enough
function isPrivateHost(h: string): boolean {
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  )
    return true;
  if (h.startsWith("[")) return true; // reject IPv6 literals outright
  const m = h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (!m) return false;
  const a = Number(m[1]),
    b = Number(m[2]);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function parseUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new CheckError("invalid_url", "Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new CheckError("invalid_url", "Only http(s) is allowed");
  if (url.username || url.password)
    throw new CheckError("invalid_url", "Credentials in URL not allowed");
  if (isPrivateHost(url.hostname.toLowerCase()))
    throw new CheckError("blocked_host", "Host not allowed");
  return url;
}

// Only called after a network failure, to tell "domain doesn't exist" apart
async function isNxDomain(hostname: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
      {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(2000),
      },
    );
    const data = (await res.json()) as { Status: number };
    return data.Status === 3;
  } catch {
    return false;
  }
}

export async function checkWebsite(
  input: string,
  {
    timeoutMs = 10_000,
    maxRedirects = 5,
    degradedAfterMs = 3_000,
    isExpectedStatus = (c) => c >= 200 && c < 300,
  }: CheckOptions = {},
): Promise<CheckResult> {
  const start = performance.now();
  const signal = AbortSignal.timeout(timeoutMs);

  let ttfbMs: number | null = null;
  let statusCode: number | null = null;
  let finalUrl: string | null = null;
  let redirectCount = 0;
  let error: CheckError | null = null;
  let current = input;
  let hostname = "";

  try {
    for (;;) {
      const url = parseUrl(current);
      hostname = url.hostname;

      const reqStart = performance.now();
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual", // lets us record and cap the chain
        signal,
        headers: { "User-Agent": "UptimeMonitor/1.0" },
      });
      ttfbMs = Math.round(performance.now() - reqStart);
      statusCode = res.status;
      finalUrl = url.toString();
      await res.body?.cancel(); // don't leave the body unread

      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        if (++redirectCount > maxRedirects)
          throw new CheckError(
            "too_many_redirects",
            `More than ${maxRedirects} redirects`,
          );
        current = new URL(location, url).toString();
        continue;
      }

      if (!isExpectedStatus(res.status))
        error = new CheckError(
          "unexpected_status",
          `HTTP ${res.status}: ${res.statusText}`,
        );
      break;
    }
  } catch (e) {
    if (e instanceof CheckError) {
      error = e;
    } else {
      const err = e as Error;
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        error = new CheckError("timeout", `No response within ${timeoutMs}ms`);
      } else if (hostname && (await isNxDomain(hostname))) {
        error = new CheckError("dns_failure", "Domain does not exist");
      } else {
        error = new CheckError(
          "network_error",
          err?.message ?? "Unknown error",
        );
      }
    }
  }

  const totalMs = Math.round(performance.now() - start);
  const isUp = error === null;

  return {
    url: input,
    checkedAt: new Date().toISOString(),
    status: !isUp ? "down" : totalMs > degradedAfterMs ? "degraded" : "up",
    isUp,
    statusCode,
    finalUrl,
    redirectCount,
    timings: { ttfbMs, totalMs },
    error: error && { type: error.type, message: error.message },
  };
}
