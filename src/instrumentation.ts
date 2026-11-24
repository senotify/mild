export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { syncContentPosts } = await import("./lib/content-sync");
  const run = () => {
    try {
      const r = syncContentPosts();
      if (r.created || r.updated) console.log("[content-sync]", r);
    } catch (e) {
      console.error("[content-sync] failed", e);
    }
  };
  run();
  // Cheap (hash compare per file); also picks up an owner seeded after boot.
  setInterval(run, 60 * 1000).unref();
}
