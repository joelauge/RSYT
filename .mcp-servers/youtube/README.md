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

## Tools

`videos_getVideo`, `videos_searchVideos`, `videos_getStats`, `videos_getTrending`,
`videos_getRelated`, `transcripts_getTranscript`, `transcripts_searchTranscript`,
`transcripts_getTimestamped`, `channels_getChannel`, `channels_listVideos`,
`channels_getPlaylists`, `channels_getStatistics`, `playlists_getPlaylist`,
`playlists_getPlaylistItems`, `playlists_searchPlaylists`.
