// Unit tests for the Fizlog API client against a local mock HTTP server (no network, no deps).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { FizlogClient, FizlogApiError } from "../dist/client.js";

let server;
let baseUrl;
const requests = [];

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      res.setHeader("Content-Type", "application/json");
      if (req.url.startsWith("/api/entries.php")) {
        if (req.headers.authorization !== "Bearer good-key") {
          res.statusCode = 401;
          return res.end(JSON.stringify({ error: "Invalid API key." }));
        }
        const input = JSON.parse(body);
        res.statusCode = 201;
        return res.end(JSON.stringify({
          entry: { id: 7, type: input.type, title: input.title, body: input.body, is_published: input.is_published, published_at: "2026-10-05 08:00:00", scheduled: false, notified: input.notify },
          public_page: "https://fizlog.com/changelog/demo",
        }));
      }
      if (req.url.startsWith("/api/changelog.php")) {
        return res.end(JSON.stringify({ project: "Demo", public_page: "https://fizlog.com/changelog/demo", feed_url: "https://fizlog.com/changelog/demo/rss", entries: [{ id: 1, type: "new", title: "Hello", body: "", date: "2026-10-01", reactions: {} }] }));
      }
      if (req.url.startsWith("/html")) {
        res.setHeader("Content-Type", "text/html");
        return res.end("<html>oops</html>");
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Not found" }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test("publishEntry sends a Bearer token and maps fields to the Fizlog API", async () => {
  const client = new FizlogClient(baseUrl, "good-key");
  const result = await client.publishEntry({ title: "Dark mode", body: "Now in settings.", type: "improved", draft: true, notify_subscribers: true });
  assert.equal(result.entry.id, 7);
  const sent = JSON.parse(requests.at(-1).body);
  assert.deepEqual(sent, { title: "Dark mode", body: "Now in settings.", type: "improved", published_at: "", is_published: false, notify: true });
  assert.equal(requests.at(-1).method, "POST");
});

test("publishEntry defaults to a published 'new' entry without notifications", async () => {
  const client = new FizlogClient(baseUrl, "good-key");
  await client.publishEntry({ title: "Hi" });
  const sent = JSON.parse(requests.at(-1).body);
  assert.equal(sent.type, "new");
  assert.equal(sent.is_published, true);
  assert.equal(sent.notify, false);
});

test("publishEntry without an API key fails before any request", async () => {
  const before = requests.length;
  const client = new FizlogClient(baseUrl, undefined);
  await assert.rejects(client.publishEntry({ title: "x" }), (e) => e instanceof FizlogApiError && e.status === 401);
  assert.equal(requests.length, before);
});

test("API errors surface the server's message and status", async () => {
  const client = new FizlogClient(baseUrl, "bad-key");
  await assert.rejects(client.publishEntry({ title: "x" }), (e) => e instanceof FizlogApiError && e.status === 401 && e.message === "Invalid API key.");
});

test("getPublicChangelog URL-encodes the key and returns entries", async () => {
  const client = new FizlogClient(baseUrl, undefined);
  const changelog = await client.getPublicChangelog("a b&c");
  assert.equal(changelog.entries.length, 1);
  assert.equal(requests.at(-1).url, "/api/changelog.php?key=a%20b%26c");
});

test("non-JSON responses become a readable error", async () => {
  const client = new FizlogClient(baseUrl.replace(/\/$/, "") + "/html", undefined);
  await assert.rejects(client.getPublicChangelog("demo"), (e) => e instanceof FizlogApiError && /non-JSON/.test(e.message));
});

test("unreachable hosts produce status 0", async () => {
  const client = new FizlogClient("http://127.0.0.1:9/", undefined);
  await assert.rejects(client.getPublicChangelog("demo"), (e) => e instanceof FizlogApiError && e.status === 0);
});
