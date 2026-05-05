/**
 * Next.js 15 instrumentation hook. Runs once per process, in both the Node
 * server and the standalone runner. Used here to:
 *   1. Validate process env up-front (fail-fast if production secrets are
 *      missing so ACA restarts with a clear error log).
 *   2. Wire Application Insights when `APPLICATIONINSIGHTS_CONNECTION_STRING`
 *      is present. AI is loaded lazily so dev (without AI) doesn't pay the
 *      import cost.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertEnvAtBoot } = await import("./lib/env");
  assertEnvAtBoot();

  const aiConn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!aiConn) return;

  try {
    const appInsights = await import(
      /* webpackIgnore: true */ "applicationinsights"
    );
    appInsights
      .setup(aiConn)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(true)
      .setDistributedTracingMode(
        appInsights.DistributedTracingModes.AI_AND_W3C,
      )
      .start();
    // `defaultClient` shape varies by applicationinsights major version
    // (v2 exposes .context.tags directly, v3 routes through OTel). Guard so
    // a future SDK refactor doesn't crash boot.
    const ctx = appInsights.defaultClient?.context;
    if (ctx?.tags && ctx.keys?.cloudRole) {
      ctx.tags[ctx.keys.cloudRole] =
        process.env.WEBSITE_SITE_NAME ?? "bsc-web";
    }
    console.log("[instrumentation] Application Insights enabled");
  } catch (err) {
    console.error("[instrumentation] failed to init App Insights", err);
  }
}
