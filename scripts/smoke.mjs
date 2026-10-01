// Smoke test: spawns the built server over stdio and exercises every tool.
// Usage: FIZLOG_BASE_URL=http://localhost:8888/fizlog FIZLOG_API_KEY=... FIZLOG_PUBLIC_KEY=demo npm run smoke
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function assert(condition, message) {
  if (!condition) { console.error("FAIL:", message); process.exit(1); }
  console.log("ok  -", message);
}

async function connect(env) {
  const client = new Client({ name: "fizlog-smoke", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: { ...process.env, ...env } }));
  return client;
}

const client = await connect({});
const { tools } = await client.listTools();
assert(tools.map((t) => t.name).sort().join() === "get_public_changelog,publish_entry", "lists both tools");

const log = await client.callTool({ name: "get_public_changelog", arguments: { limit: 2 } });
assert(!log.isError && log.structuredContent.entries.length <= 2, "reads public changelog: " + log.content[0].text.split("\n")[0]);

const draft = await client.callTool({ name: "publish_entry", arguments: { title: "MCP smoke test draft", body: "Created by **fizlog-mcp** smoke test.", type: "improved", draft: true } });
assert(!draft.isError && /saved as draft/.test(draft.content[0].text), "publishes a draft: " + draft.content[0].text.split("\n")[0]);
console.log("DRAFT_ID=" + draft.content[0].text.match(/#(\d+)/)[1]);

const invalid = await client.callTool({ name: "publish_entry", arguments: { title: "" } });
assert(invalid.isError, "rejects empty title");

const badDate = await client.callTool({ name: "publish_entry", arguments: { title: "x", published_at: "tomorrow" } });
assert(badDate.isError, "rejects non-ISO published_at");
await client.close();

const badKey = await connect({ FIZLOG_API_KEY: "fz_invalid" });
const denied = await badKey.callTool({ name: "publish_entry", arguments: { title: "should fail", draft: true } });
assert(denied.isError && /Invalid API key/.test(denied.content[0].text), "reports invalid API key: " + denied.content[0].text);
await badKey.close();
console.log("All smoke checks passed.");
