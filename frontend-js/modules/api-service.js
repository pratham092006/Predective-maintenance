export function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function inferDefaultApiBase() {
  const fromMeta = document.querySelector("meta[name='pm-api-base']")?.getAttribute("content");
  const normalizedMeta = normalizeApiBase(fromMeta);
  if (normalizedMeta) {
    return normalizedMeta;
  }

  const protocol = window.location.protocol || "";
  const host = window.location.host || "";
  if ((protocol === "http:" || protocol === "https:") && host) {
    return `${protocol}//${host}`;
  }

  return "https://predictive-maintenance-api.vercel.app";
}

export class ApiError extends Error {
  constructor(message, status = 0, detail = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export class ApiService {
  constructor(baseUrl = "", apiKey = "") {
    this.baseUrl = normalizeApiBase(baseUrl);
    this.apiKey = String(apiKey || "").trim();
  }

  setConfig({ baseUrl, apiKey }) {
    this.baseUrl = normalizeApiBase(baseUrl);
    this.apiKey = String(apiKey || "").trim();
  }

  buildHeaders(extraHeaders = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }
    return headers;
  }

  async request(path, { method = "GET", body } = {}) {
    if (!this.baseUrl) {
      throw new ApiError("API base URL is not configured.");
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      const detail = payload?.detail || "";
      const message = detail || `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, detail);
    }

    return payload;
  }

  async health() {
    return this.request("/");
  }

  async clientConfig() {
    return this.request("/client-config");
  }

  async getHistory(limit = 250) {
    return this.request(`/history?limit=${Number(limit) || 250}`);
  }

  async predict(payload) {
    return this.request("/predict", {
      method: "POST",
      body: payload,
    });
  }

  async predictBatch(rows, persist = false) {
    return this.request("/predict/batch", {
      method: "POST",
      body: {
        rows,
        persist,
      },
    });
  }
}
