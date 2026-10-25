import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["node:sqlite", "@napi-rs/canvas", "@resvg/resvg-js", "pdfjs-dist", "linkedom", "@earendil-works/pi-ai", "@earendil-works/pi-agent-core"],
  outputFileTracingExcludes: { "*": [".neuroplast/**/*", "auth.json", ".env*"] },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default config;
