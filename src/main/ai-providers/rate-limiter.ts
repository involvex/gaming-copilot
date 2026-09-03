import type { RateLimitInfo } from "./types";

export class RateLimiter {
  private requestCount = { minute: 0, day: 0 };
  private lastMinuteReset = Date.now();
  private lastDayReset = Date.now();

  constructor(
    private readonly rpm: number,
    private readonly rpd: number,
  ) {}

  increment(): void {
    this.requestCount.minute++;
    this.requestCount.day++;
  }

  getInfo(): RateLimitInfo {
    this.resetCountersIfNeeded();
    return {
      rpm: this.rpm,
      rpd: this.rpd,
      remaining: {
        minute: Math.max(0, this.rpm - this.requestCount.minute),
        day: Math.max(0, this.rpd - this.requestCount.day),
      },
    };
  }

  private resetCountersIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastMinuteReset > 60_000) {
      this.requestCount.minute = 0;
      this.lastMinuteReset = now;
    }
    if (now - this.lastDayReset > 86_400_000) {
      this.requestCount.day = 0;
      this.lastDayReset = now;
    }
  }
}
