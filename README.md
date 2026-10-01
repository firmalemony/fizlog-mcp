# fizlog-mcp

MCP server for [Fizlog](https://fizlog.com) — the changelog widget for indie SaaS.
Let Claude, Cursor or any MCP client announce what you just shipped:

> "Publish a changelog entry for the CSV export I just finished."

## Tools

| Tool | What it does |
|---|---|
| `publish_entry` | Publishes (or schedules / saves as draft) an entry — shows up in your in-app widget, public changelog page and RSS. Optional subscriber email. |
| `get_public_changelog` | Reads your latest published entries, so the assistant can avoid duplicates or summarize releases. |

## Setup

1. In Fizlog, open your project and copy the **API key** (and the public key from the embed snippet).
2. Add the server to your MCP client:

**Claude Code**
```bash
claude mcp add fizlog -e FIZLOG_API_KEY=fz_xxx -e FIZLOG_PUBLIC_KEY=your_public_key -- npx -y fizlog-mcp
```

**Claude Desktop** (`claude_desktop_config.json`) / **Cursor** (`~/.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "fizlog": {
      "command": "npx",
      "args": ["-y", "fizlog-mcp"],
      "env": { "FIZLOG_API_KEY": "fz_xxx", "FIZLOG_PUBLIC_KEY": "your_public_key" }
    }
  }
}
```

| Env var | Required | Default |
|---|---|---|
| `FIZLOG_API_KEY` | for `publish_entry` | — |
| `FIZLOG_PUBLIC_KEY` | no (default for `get_public_changelog`) | — |
| `FIZLOG_BASE_URL` | no (self-hosted Fizlog) | `https://fizlog.com` |

## Related

- **[publish-to-fizlog](https://github.com/firmalemony/publish-to-fizlog)** — GitHub Action that posts a Fizlog entry for every GitHub release.
- **[Fizlog migration guides](https://fizlog.com/migrate/index.php)** — move your changelog from Beamer, Headway, AnnounceKit, Canny and others.
- Listed in the official [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.firmalemony/fizlog-mcp`.

## Development

```bash
npm install
npm run build
FIZLOG_BASE_URL=http://localhost:8888/fizlog FIZLOG_API_KEY=... FIZLOG_PUBLIC_KEY=demo npm run smoke
```
The smoke test creates one **draft** entry in the target project — run it against a local/test instance.

MIT © Lemony Apps
