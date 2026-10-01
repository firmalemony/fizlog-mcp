/** Thin HTTP client for the public Fizlog API (https://fizlog.com/api/*). */

export const ENTRY_TYPES = ["new", "improved", "fixed"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export interface PublishInput {
  title: string;
  body?: string;
  type?: EntryType;
  /** ISO 8601 date-time; in the future = scheduled. */
  published_at?: string;
  draft?: boolean;
  notify_subscribers?: boolean;
}

export interface PublishedEntry {
  id: number;
  type: EntryType;
  title: string;
  body: string;
  is_published: boolean;
  published_at: string;
  scheduled: boolean;
  notified: boolean;
}

export interface PublishResult {
  entry: PublishedEntry;
  public_page: string;
}

export interface ChangelogEntry {
  id: number;
  type: EntryType;
  title: string;
  body: string;
  date: string;
  reactions: Record<string, number>;
}

export interface PublicChangelog {
  project: string;
  public_page: string;
  feed_url: string;
  entries: ChangelogEntry[];
}

export class FizlogApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "FizlogApiError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

export class FizlogClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly apiKey: string | undefined) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async publishEntry(input: PublishInput): Promise<PublishResult> {
    if (!this.apiKey) {
      throw new FizlogApiError("FIZLOG_API_KEY is not set. Copy the API key from your project page on fizlog.com.", 401);
    }
    return this.request<PublishResult>("/api/entries.php", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        body: input.body ?? "",
        type: input.type ?? "new",
        published_at: input.published_at ?? "",
        is_published: !input.draft,
        notify: input.notify_subscribers ?? false,
      }),
    });
  }

  async getPublicChangelog(publicKey: string): Promise<PublicChangelog> {
    return this.request<PublicChangelog>(`/api/changelog.php?key=${encodeURIComponent(publicKey)}`, { method: "GET" });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new FizlogApiError(`Could not reach Fizlog at ${this.baseUrl}: ${reason}`, 0);
    }
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new FizlogApiError(`Unexpected non-JSON response (HTTP ${response.status}) from ${path}.`, response.status);
    }
    if (!response.ok) {
      const message = typeof data === "object" && data !== null && "error" in data ? String((data as { error: unknown }).error) : `HTTP ${response.status}`;
      throw new FizlogApiError(message, response.status);
    }
    return data as T;
  }
}
