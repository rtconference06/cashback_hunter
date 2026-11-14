export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SCHEDULER_ENABLED === "false") return;
  if (process.env.npm_lifecycle_event === "build") return;
  const { startScheduler } = await import("@/lib/scheduler");
  startScheduler();
}
