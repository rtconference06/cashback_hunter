import { runUpcomingDigests } from "@/lib/digest-service";

const globalForScheduler = globalThis as unknown as { cashbackScheduler?: boolean };

export function startScheduler() {
  if (globalForScheduler.cashbackScheduler) return;
  globalForScheduler.cashbackScheduler = true;
  if (process.env.SCHEDULER_ENABLED === "false") return;
  const minutes = Number(process.env.SCHEDULER_INTERVAL_MINUTES || 360);
  const tick = () => {
    runUpcomingDigests().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[cashback-hunter] scheduled digest failed: ${message}`);
    });
  };
  setTimeout(tick, 20_000).unref?.();
  setInterval(tick, Math.max(1, minutes) * 60_000).unref?.();
}
