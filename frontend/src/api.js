async function readErrorMessage(response) {
  const fallback = `${response.status} ${response.statusText}`.trim();
  try {
    const text = await response.text();
    if (!text) {
      return fallback;
    }
    try {
      const payload = JSON.parse(text);
      const message =
        payload?.error?.message || payload?.message || payload?.detail?.message;
      return message || text;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

async function adminRequest({
  baseUrl,
  adminSecret,
  path,
  method = "GET",
  body,
}) {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}${path}`);
  const headers = { "Content-Type": "application/json" };
  if (adminSecret) {
    headers["Admin-Secret"] = adminSecret;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const requestId = response.headers.get("x-request-id") || "";
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return { data, requestId };
}

export async function generateText({
  baseUrl,
  apiKey,
  adminSecret,
  model,
  prompt,
  stream,
  signal,
  onChunk,
}) {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/api/generate`);
  if (!stream) {
    url.searchParams.set("format", "text");
  }

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (adminSecret) {
    headers["Admin-Secret"] = adminSecret;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, prompt, stream }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const requestId = response.headers.get("x-request-id") || "";

  if (!stream) {
    const text = await response.text();
    return { text, requestId };
  }

  if (!response.body) {
    return { text: "", requestId };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let aggregated = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const payload = JSON.parse(trimmed);
        const chunk = payload.response || "";
        if (chunk && onChunk) {
          onChunk(chunk);
        }
        aggregated += chunk;
      } catch {
        if (onChunk) {
          onChunk(trimmed);
        }
        aggregated += trimmed;
      }
    }
  }

  const remaining = buffer.trim();
  if (remaining) {
    try {
      const payload = JSON.parse(remaining);
      const chunk = payload.response || "";
      if (chunk && onChunk) {
        onChunk(chunk);
      }
      aggregated += chunk;
    } catch {
      if (onChunk) {
        onChunk(remaining);
      }
      aggregated += remaining;
    }
  }

  return { text: aggregated, requestId };
}

export async function sendChat({
  baseUrl,
  apiKey,
  adminSecret,
  model,
  messages,
  signal,
}) {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/api/chat`);
  url.searchParams.set("format", "text");

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (adminSecret) {
    headers["Admin-Secret"] = adminSecret;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, stream: false }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const requestId = response.headers.get("x-request-id") || "";
  const text = await response.text();
  return { text, requestId };
}

export async function generateImage({
  baseUrl,
  apiKey,
  adminSecret,
  prompt,
  negativePrompt,
  width,
  height,
  steps,
  guidance,
  seed,
  count,
  signal,
}) {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/api/images`);
  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (adminSecret) {
    headers["Admin-Secret"] = adminSecret;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt,
      negativePrompt,
      width,
      height,
      steps,
      guidance,
      seed,
      count,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const requestId = response.headers.get("x-request-id") || "";
  const data = await response.json();
  return { data, requestId };
}

export async function generateAdminKey({ baseUrl, adminSecret }) {
  return adminRequest({
    baseUrl,
    adminSecret,
    path: "/admin/generate-key",
    method: "POST",
  });
}

export async function revokeAdminKey({ baseUrl, adminSecret, apiKey }) {
  return adminRequest({
    baseUrl,
    adminSecret,
    path: "/admin/revoke-key",
    method: "POST",
    body: { api_key: apiKey },
  });
}

export async function activateAdminKey({ baseUrl, adminSecret, apiKey }) {
  return adminRequest({
    baseUrl,
    adminSecret,
    path: "/admin/activate-key",
    method: "POST",
    body: { api_key: apiKey },
  });
}

export async function listAdminKeys({ baseUrl, adminSecret, limit = 100 }) {
  const safeLimit = Math.max(1, Math.min(500, limit));
  return adminRequest({
    baseUrl,
    adminSecret,
    path: `/admin/keys?limit=${safeLimit}`,
  });
}

export async function fetchAdminUsage({ baseUrl, adminSecret, apiKey, limit = 100 }) {
  const params = apiKey
    ? `api_key=${encodeURIComponent(apiKey)}`
    : `limit=${Math.max(1, Math.min(500, limit))}`;
  return adminRequest({
    baseUrl,
    adminSecret,
    path: `/admin/usage?${params}`,
  });
}
