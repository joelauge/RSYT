# YouTube MCP server

A Model Context Protocol (MCP) server exposing YouTube Data API operations
(video/channel/playlist lookup and search, plus transcripts) as MCP tools.

## Why this directory exists

This wraps [`ZubeidHendricks/youtube-mcp-server`](https://github.com/ZubeidHendricks/youtube-mcp-server).
The README of that project tells you to run `npx -y zubeid-youtube-mcp-server`, but
**the published npm package `zubeid-youtube-mcp-server@1.0.0` does not run** — its
compiled `dist/server.js` calls a fictional SDK API (`McpServer.addMethod()` /
`.listen()` / `MCPFunctionGroup`) that does not exist in any version of
`@modelcontextprotocol/sdk`, so it crashes on startup with a module/export error.
(The source even carries a `// @ts-ignore - Ignore MCP SDK import error` comment.)

The package's **service classes** (`dist/services/*.js`) are fine — they correctly
wrap `googleapis` and `youtube-transcript`. So `index.js` here reuses those service
classes unchanged and provides a correct MCP entrypoint built on the real SDK
(`Server` + `StdioServerTransport` + `ListTools`/`CallTool` handlers).

## Configuration

Registered in the repo-root `.mcp.json` as the `youtube` server. It requires a
**YouTube Data API v3 key** supplied via the `YOUTUBE_API_KEY` environment
variable. The key is *not* stored in the repo — `.mcp.json` references
`${YOUTUBE_API_KEY}`, which is expanded from the environment when Claude Code
launches the server.

Get a key: Google Cloud Console → enable **YouTube Data API v3** →
APIs & Services → Credentials → Create credentials → API key.

Set it for Claude Code on the web in your environment's variables, or locally:

```bash
export YOUTUBE_API_KEY="AIza...your-key..."
```

Optional: `YOUTUBE_TRANSCRIPT_LANG` (default `en`).

> Note: this is a **public-data, read-only** server (key-based, not OAuth). It can
> search and read public videos/channels/playlists/transcripts. It cannot read your
> private data, upload, or manage your own channel.

## Install / run

Dependencies are git-ignored. A repo `SessionStart` hook runs `npm install` here
automatically in fresh Claude Code web sessions. To install manually:

```bash
npm install --prefix .mcp-servers/youtube
```

## Quota

The YouTube Data API gives each Google Cloud **project** a default **10,000
units/day**, resetting at **midnight Pacific (08:00 UTC)**. Cost is per
*operation*, not per item returned:

| Operation (tools using it)                              | Units |
|---------------------------------------------------------|-------|
| `search.list` (`videos_searchVideos`, `videos_getRelated`, `playlists_searchPlaylists`, `channels_listVideos`) | **100** |
| `videos.list` (`videos_getVideo`, `videos_getStats`, `videos_getTrending`) | 1 |
| `channels.list` (`channels_getChannel`, `channels_getStatistics`) | 1 |
| `playlists.list` / `playlistItems.list` (`*_getPlaylist*`, `channels_getPlaylists`) | 1 |
| transcript tools (not the Data API — scrapes captions) | 0 |

So ~100 search calls exhaust a full day's quota, while thousands of
video/channel/playlist lookups barely dent it. Search is the expensive verb.

**Check usage:** Google Cloud Console → *APIs & Services → YouTube Data API v3*
→ **Quotas** (current consumption + limits) and **Metrics → Traffic by API
method** (which call is burning it). If usage is high and you don't recognize
it, another app/integration is sharing this key or project.

**Probe the key any time** (reports working / over-quota / invalid):

```bash
node .mcp-servers/youtube/quota-check.js [channelId]
```

**Need more?** Console → Quotas → select the limit → *Edit / Apply for higher
quota* (YouTube's Audit & Quota Extension form). Approval is manual and can take
days. Cheaper first: cache results and avoid `search.list` where a 1-unit
lookup works.

## Tools

`videos_getVideo`, `videos_searchVideos`, `videos_getStats`, `videos_getTrending`,
`videos_getRelated`, `transcripts_getTranscript`, `transcripts_searchTranscript`,
`transcripts_getTimestamped`, `channels_getChannel`, `channels_listVideos`,
`channels_getPlaylists`, `channels_getStatistics`, `playlists_getPlaylist`,
`playlists_getPlaylistItems`, `playlists_searchPlaylists`.
