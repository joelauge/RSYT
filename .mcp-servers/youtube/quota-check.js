#!/usr/bin/env node
"use strict";

/**
 * Quota probe for the YouTube Data API key.
 *
 * Makes ONE 1-unit channels.list call and reports whether the key is:
 *   - working (quota available)
 *   - over quota (quotaExceeded)  -> resets at midnight Pacific
 *   - invalid / restricted
 *
 * Reads the key from process.env.YOUTUBE_API_KEY or the local .env file.
 * Usage:  node quota-check.js [channelId]
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

(function loadLocalEnv() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
      }
    }
  } catch (_) {}
})();

const key = process.env.YOUTUBE_API_KEY;
if (!key) {
  console.error("No YOUTUBE_API_KEY found (env or .env).");
  process.exit(1);
}

const channelId = process.argv[2] || "UCZEuV2yOsviJ7un8IRsSi5A"; // default: Realmsmith
const url =
  `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${key}`;

https
  .get(url, (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      let d;
      try { d = JSON.parse(body); } catch { console.error("Bad response:", body.slice(0, 200)); process.exit(1); }
      if (d.error) {
        const reason = d.error.errors && d.error.errors[0] && d.error.errors[0].reason;
        console.log(`status: ${d.error.code} (${reason})`);
        if (reason === "quotaExceeded") {
          console.log("=> Quota is exhausted for today. Resets at midnight Pacific (08:00 UTC).");
        } else if (reason === "keyInvalid" || reason === "badRequest") {
          console.log("=> The API key value is wrong/malformed.");
        } else {
          console.log(`=> ${d.error.message}`);
        }
        process.exit(2);
      }
      const c = d.items && d.items[0];
      if (!c) { console.log("OK (quota available) — but no channel found for that id."); return; }
      const s = c.statistics || {};
      console.log("OK — quota available. Channel reachable:");
      console.log(`  title:       ${c.snippet.title}`);
      console.log(`  subscribers: ${s.subscriberCount}`);
      console.log(`  videos:      ${s.videoCount}`);
      console.log(`  total views: ${s.viewCount}`);
    });
  })
  .on("error", (e) => { console.error("Request failed:", e.message); process.exit(1); });
