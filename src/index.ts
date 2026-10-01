#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ENTRY_TYPES, FizlogApiError, FizlogClient } from "./client.js";

const VERSION = "0.1.0";
const DEFAULT_BASE_URL = "https://fizlog.com";
const MAX_TITLE_LENGTH = 160;
const MAX_ENTRIES_RETURNED = 30;

const client = new FizlogClient(process.env.FIZLOG_BASE_URL || DEFAULT_BASE_URL, process.env.FIZLOG_API_KEY || undefined);
const defaultPublicKey = process.env.FIZLOG_PUBLIC_KEY || undefined;

const server = new McpServer({ name: "fizlog", version: VERSION });

function errorResult(error: unknown) {
  const message = error instanceof FizlogApiError || error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text" as const, text: `Fizlog error: ${message}` }] };
}

server.registerTool(
  "publish_entry",
  {
    title: "Publish changelog entry",
    description:
      "Publish a new entry to the project's Fizlog changelog (in-app widget, public page and RSS). " +
      "Use it after shipping a feature or fix. Write for end users, not developers: a short benefit-focused title " +
      "and 1–3 sentences of Markdown (**bold**, *italic*, `code`, [links](url), '- ' lists). " +
      "Set draft=true to save without publishing, or published_at to schedule.",
    inputSchema: {
      title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).describe("Short, user-facing headline, e.g. 'Dark mode is here'."),
      body: z.string().max(20_000).optional().describe("Details in Fizlog's Markdown subset."),
      type: z.enum(ENTRY_TYPES).default("new").describe("new = feature, improved = enhancement, fixed = bug fix."),
      published_at: z.iso.datetime({ offset: true }).optional().describe("ISO 8601 date-time. A future value schedules the entry."),
      draft: z.boolean().default(false).describe("Save as an unpublished draft instead of publishing."),
      notify_subscribers: z.boolean().default(false).describe("Also email the project's subscribers (only for immediate, non-draft entries)."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async (args) => {
    try {
      const { entry, public_page } = await client.publishEntry(args);
      const state = !entry.is_published ? "saved as draft" : entry.scheduled ? `scheduled for ${entry.published_at} (UTC)` : "published";
      const lines = [
        `Entry #${entry.id} "${entry.title}" (${entry.type}) ${state}.`,
        entry.notified ? "Subscribers were emailed." : "",
        `Public changelog: ${public_page}`,
      ].filter(Boolean);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "get_public_changelog",
  {
    title: "Read public changelog",
    description:
      "Read the latest published entries of a Fizlog project by its public key (the key in the embed snippet / public page URL). " +
      "Useful to avoid duplicate announcements or to summarize recent releases.",
    inputSchema: {
      public_key: z.string().trim().min(1).max(64).optional().describe("Project public key. Defaults to FIZLOG_PUBLIC_KEY."),
      limit: z.number().int().min(1).max(MAX_ENTRIES_RETURNED).default(10),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ public_key, limit }) => {
    const key = public_key ?? defaultPublicKey;
    if (!key) {
      return errorResult(new Error("No public_key given and FIZLOG_PUBLIC_KEY is not set."));
    }
    try {
      const changelog = await client.getPublicChangelog(key);
      const entries = changelog.entries.slice(0, limit);
      const text = [
        `${changelog.project} — ${entries.length} latest entries (${changelog.public_page})`,
        ...entries.map((e) => `- [${e.date}] (${e.type}) ${e.title}${e.body ? `: ${e.body}` : ""}`),
      ].join("\n");
      return { content: [{ type: "text", text }], structuredContent: { project: changelog.project, public_page: changelog.public_page, entries } };
    } catch (error) {
      return errorResult(error);
    }
  },
);

await server.connect(new StdioServerTransport());
