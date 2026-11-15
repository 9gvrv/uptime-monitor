interface SiteStatus {
  statusCode: number | null;
  latencyMs: number;
  isUp: boolean;
  errorMessage: string | null;
}

function safeParseUrl(input: string): URL | null {
  const url = URL.parse(input); // Returns null if invalid
  if (!url) return null;

  // 1. Validate Protocol
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Invalid protocol");
  }

  // 2. Validate Hostname (SSRF Protection)
  // if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
  //   throw new Error("Invalid host");
  // }

  // Optional: Check against a blocklist of known malicious IPs/domains
  return url;
}

async function checkWebsite(
  url: string,
  timeoutMs: number = 5000
): Promise<SiteStatus> {
  const parsedUrl = safeParseUrl(url);
  if (!parsedUrl) throw new Error("Invalid URL");

  const start = performance.now();

  try {
    const response = await fetch(parsedUrl.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });

    const latencyMs = Math.round(performance.now() - start);

    return {
      statusCode: response.status,
      latencyMs,
      isUp: response.ok,
      errorMessage: response.ok
        ? null
        : `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);

    return {
      statusCode: null,
      latencyMs,
      isUp: false,
      errorMessage:
        error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export default checkWebsite;
