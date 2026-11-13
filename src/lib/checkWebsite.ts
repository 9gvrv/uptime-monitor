interface SiteStatus {
  statusCode: number | null;
  latencyMs: number;
  isUp: boolean;
  errorMessage: string | null;
}

async function checkWebsite(
  url: string,
  timeoutMs: number = 5000
): Promise<SiteStatus> {
  const start = performance.now();

  try {
    const response = await fetch(url, {
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
