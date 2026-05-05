import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  // Keep `@react-pdf/renderer` external so its reconciler is not mixed with
  // Next’s bundled server React (avoids production "React error #31"). Traced
  // into `.next/standalone/node_modules` by the standalone output.
  // `applicationinsights` + the OpenTelemetry/gRPC tree it drags in must also
  // stay external — otherwise webpack tries to bundle Node-only modules
  // (`stream`, `tls`, `net`, …) that grpc-js requires and the build fails.
  serverExternalPackages: [
    "@react-pdf/renderer",
    "applicationinsights",
    "@azure/monitor-opentelemetry",
    "@azure/monitor-opentelemetry-exporter",
    "@opentelemetry/api",
    "@opentelemetry/sdk-node",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/sdk-metrics",
    "@opentelemetry/sdk-logs",
    "@opentelemetry/exporter-trace-otlp-grpc",
    "@opentelemetry/exporter-metrics-otlp-grpc",
    "@opentelemetry/exporter-logs-otlp-grpc",
    "@opentelemetry/otlp-grpc-exporter-base",
    "@opentelemetry/otlp-exporter-base",
    "@opentelemetry/instrumentation",
    "@opentelemetry/instrumentation-http",
    "@grpc/grpc-js",
    "@grpc/proto-loader",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
