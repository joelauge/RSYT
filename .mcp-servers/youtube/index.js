#!/usr/bin/env node
"use strict";

/**
 * YouTube MCP server — working entrypoint.
 *
 * The published `zubeid-youtube-mcp-server@1.0.0` ships a broken MCP glue layer
 * (its dist/server.js calls a fictional `McpServer.addMethod()/listen()` API that
 * does not exist in @modelcontextprotocol/sdk). The package's *service classes*,
 * however, are correct — they wrap the YouTube Data API (googleapis) and
 * youtube-transcript. This file reuses those service classes verbatim and exposes
 * them as MCP tools through the real SDK (Server + StdioServerTransport).
 *
 * Requires the YOUTUBE_API_KEY environment variable (a YouTube Data API v3 key).
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

// Reuse the upstream package's service classes (these are correct as published).
const { VideoService } = require("zubeid-youtube-mcp-server/dist/services/video");
const { TranscriptService } = require("zubeid-youtube-mcp-server/dist/services/transcript");
const { ChannelService } = require("zubeid-youtube-mcp-server/dist/services/channel");
const { PlaylistService } = require("zubeid-youtube-mcp-server/dist/services/playlist");

if (!process.env.YOUTUBE_API_KEY) {
  console.error("Error: YOUTUBE_API_KEY environment variable is required.");
  console.error("Set it to a YouTube Data API v3 key before starting the server.");
  process.exit(1);
}

// Services that hit the Data API need the key at construction time.
const video = new VideoService();
const channel = new ChannelService();
const playlist = new PlaylistService();
const transcript = new TranscriptService();

// Tool registry: name -> { description, inputSchema, handler }.
const TOOLS = {
  videos_getVideo: {
    description: "Get detailed information about a YouTube video.",
    inputSchema: {
      type: "object",
      properties: {
        videoId: { type: "string", description: "The YouTube video ID." },
        parts: {
          type: "array",
          items: { type: "string" },
          description: "Video resource parts to retrieve (default: snippet, contentDetails, statistics).",
        },
      },
      required: ["videoId"],
    },
    handler: (args) => video.getVideo(args),
  },
  videos_searchVideos: {
    description: "Search for videos on YouTube.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        maxResults: { type: "number", description: "Maximum number of results (default 10)." },
      },
      required: ["query"],
    },
    handler: (args) => video.searchVideos(args),
  },
  videos_getStats: {
    description: "Get statistics (views, likes, comments) for a video.",
    inputSchema: {
      type: "object",
      properties: { videoId: { type: "string", description: "The YouTube video ID." } },
      required: ["videoId"],
    },
    handler: (args) => video.getVideoStats(args),
  },
  videos_getTrending: {
    description: "Get trending (most popular) videos for a region.",
    inputSchema: {
      type: "object",
      properties: {
        regionCode: { type: "string", description: "ISO 3166-1 alpha-2 region code (default US)." },
        maxResults: { type: "number", description: "Maximum number of results (default 10)." },
        videoCategoryId: { type: "string", description: "Optional video category ID to filter by." },
      },
    },
    handler: (args) => video.getTrendingVideos(args || {}),
  },
  videos_getRelated: {
    description: "Get videos related to a given video.",
    inputSchema: {
      type: "object",
      properties: {
        videoId: { type: "string", description: "The YouTube video ID." },
        maxResults: { type: "number", description: "Maximum number of results (default 10)." },
      },
      required: ["videoId"],
    },
    handler: (args) => video.getRelatedVideos(args),
  },
  transcripts_getTranscript: {
    description: "Get the transcript of a YouTube video.",
    inputSchema: {
      type: "object",
      properties: {
        videoId: { type: "string", description: "The YouTube video ID." },
        language: { type: "string", description: "Language code (default from YOUTUBE_TRANSCRIPT_LANG or 'en')." },
      },
      required: ["videoId"],
    },
    handler: (args) => transcript.getTranscript(args),
  },
  transcripts_searchTranscript: {
    description: "Search within a video's transcript for a query string.",
    inputSchema: {
      type: "object",
      properties: {
        videoId: { type: "string", description: "The YouTube video ID." },
        query: { type: "string", description: "Text to search for in the transcript." },
        language: { type: "string", description: "Language code (default from YOUTUBE_TRANSCRIPT_LANG or 'en')." },
      },
      required: ["videoId", "query"],
    },
    handler: (args) => transcript.searchTranscript(args),
  },
  transcripts_getTimestamped: {
    description: "Get a video transcript with human-readable timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        videoId: { type: "string", description: "The YouTube video ID." },
        language: { type: "string", description: "Language code (default from YOUTUBE_TRANSCRIPT_LANG or 'en')." },
      },
      required: ["videoId"],
    },
    handler: (args) => transcript.getTimestampedTranscript(args),
  },
  channels_getChannel: {
    description: "Get information about a YouTube channel.",
    inputSchema: {
      type: "object",
      properties: { channelId: { type: "string", description: "The YouTube channel ID." } },
      required: ["channelId"],
    },
    handler: (args) => channel.getChannel(args),
  },
  channels_listVideos: {
    description: "Get videos from a specific channel.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "The YouTube channel ID." },
        maxResults: { type: "number", description: "Maximum number of results (default 50)." },
      },
      required: ["channelId"],
    },
    handler: (args) => channel.listVideos(args),
  },
  channels_getPlaylists: {
    description: "Get the playlists of a YouTube channel.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "The YouTube channel ID." },
        maxResults: { type: "number", description: "Maximum number of results (default 50)." },
      },
      required: ["channelId"],
    },
    handler: (args) => channel.getPlaylists(args),
  },
  channels_getStatistics: {
    description: "Get statistics for a YouTube channel.",
    inputSchema: {
      type: "object",
      properties: { channelId: { type: "string", description: "The YouTube channel ID." } },
      required: ["channelId"],
    },
    handler: (args) => channel.getStatistics(args),
  },
  playlists_getPlaylist: {
    description: "Get information about a YouTube playlist.",
    inputSchema: {
      type: "object",
      properties: { playlistId: { type: "string", description: "The YouTube playlist ID." } },
      required: ["playlistId"],
    },
    handler: (args) => playlist.getPlaylist(args),
  },
  playlists_getPlaylistItems: {
    description: "Get the videos in a YouTube playlist.",
    inputSchema: {
      type: "object",
      properties: {
        playlistId: { type: "string", description: "The YouTube playlist ID." },
        maxResults: { type: "number", description: "Maximum number of results (default 50)." },
      },
      required: ["playlistId"],
    },
    handler: (args) => playlist.getPlaylistItems(args),
  },
  playlists_searchPlaylists: {
    description: "Search for YouTube playlists by query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        maxResults: { type: "number", description: "Maximum number of results (default 10)." },
      },
      required: ["query"],
    },
    handler: (args) => playlist.searchPlaylists(args),
  },
};

const server = new Server(
  { name: "youtube", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(TOOLS).map(([name, t]) => ({
    name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = TOOLS[name];
  if (!tool) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
    };
  }
  try {
    const result = await tool.handler(args || {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Note: log to stderr only — stdout is the JSON-RPC channel.
  console.error("YouTube MCP server running on stdio.");
}

main().catch((error) => {
  console.error("Fatal error starting YouTube MCP server:", error);
  process.exit(1);
});
