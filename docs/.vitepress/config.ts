import { defineConfig } from "vitepress";

export default defineConfig({
  title: "fetchstream-js",
  description:
    "High-performance streaming JSON parser for application/json. Emits values as bytes arrive — no waiting for the full response.",
  base: "/fetchstream-js/",
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ["link", { rel: "icon", href: "/favicon.svg" }],
    ["meta", { name: "theme-color", content: "#10b981" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "fetchstream-js" }],
    [
      "meta",
      {
        property: "og:description",
        content: "Streaming JSON parser with selective materialization",
      },
    ],
  ],

  themeConfig: {
    logo: { src: "/logo.svg", width: 24, height: 24 },
    siteTitle: "fetchstream-js",

    nav: [
      { text: "Guide", link: "/guide/react", activeMatch: "/guide/" },
      { text: "API", link: "/api/", activeMatch: "/api/" },
      { text: "Examples", link: "/examples/", activeMatch: "/examples/" },
      {
        text: "v0.1",
        items: [
          {
            text: "Changelog",
            link: "https://github.com/eklavya-raj/fetchstream-js/blob/master/packages/fetchstream-js/CHANGELOG.md",
          },
          {
            text: "Contributing",
            link: "https://github.com/eklavya-raj/fetchstream-js/blob/master/CONTRIBUTING.md",
          },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Start here",
          items: [
            { text: "What is fetchstream-js?", link: "/guide/what-is-fetchstream-js" },
            { text: "React quick start", link: "/guide/react" },
            { text: "Why replace fetch / axios?", link: "/guide/why-streaming" },
          ],
        },
        {
          text: "The primary API: .live()",
          items: [
            { text: "Live mirror mode", link: "/guide/live-mode" },
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Node.js", link: "/guide/node" },
          ],
        },
        {
          text: "Advanced",
          items: [
            { text: "Per-match callbacks", link: "/guide/on-matches" },
            { text: "Path syntax", link: "/guide/paths" },
            { text: "Async iteration", link: "/guide/iteration" },
            { text: "Manual feeding", link: "/guide/manual-feeding" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API reference",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "fetchStream()", link: "/api/fetch-stream" },
            { text: "streamJSON()", link: "/api/stream-json" },
            { text: "StreamHandle", link: "/api/stream-handle" },
            { text: "parse()", link: "/api/parse" },
            { text: "JSONStreamParser", link: "/api/json-stream-parser" },
          ],
        },
      ],
      "/examples/": [
        {
          text: "Examples",
          items: [
            { text: "Overview", link: "/examples/" },
            { text: "React benchmark demo", link: "/examples/react" },
            { text: "Node consumer", link: "/examples/node" },
            { text: "Vanilla browser", link: "/examples/browser" },
          ],
        },
      ],
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/eklavya-raj/fetchstream-js",
      },
      {
        icon: "npm",
        link: "https://www.npmjs.com/package/fetchstream-js",
      },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025-present Eklavya Raj",
    },

    search: {
      provider: "local",
      options: {
        detailedView: true,
      },
    },

    editLink: {
      pattern:
        "https://github.com/eklavya-raj/fetchstream-js/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    outline: { level: [2, 3], label: "On this page" },
  },

  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
    lineNumbers: false,
  },
});
