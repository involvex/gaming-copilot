import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;
  let mockDate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockDate = vi.spyOn(Date, "now");
    mockDate.mockReturnValue(1000);
    limiter = new RateLimiter(60, 10000);
  });

  afterEach(() => {
    mockDate.mockRestore();
  });

  it("should return full remaining counts when no requests made", () => {
    const info = limiter.getInfo();
    expect(info.rpm).toBe(60);
    expect(info.rpd).toBe(10000);
    expect(info.remaining.minute).toBe(60);
    expect(info.remaining.day).toBe(10000);
  });

  it("should decrement remaining counts on increment", () => {
    limiter.increment();
    limiter.increment();
    const info = limiter.getInfo();
    expect(info.remaining.minute).toBe(58);
    expect(info.remaining.day).toBe(9998);
  });

  it("should not go below zero", () => {
    for (let i = 0; i < 70; i++) {
      limiter.increment();
    }
    const info = limiter.getInfo();
    expect(info.remaining.minute).toBe(0);
    expect(info.remaining.day).toBe(9930);
  });

  it("should reset minute counter after 60 seconds", () => {
    limiter.increment();
    limiter.increment();

    mockDate.mockReturnValue(1000 + 61_000);
    const info = limiter.getInfo();
    expect(info.remaining.minute).toBe(60);
    expect(info.remaining.day).toBe(9998);
  });

  it("should reset day counter after 24 hours", () => {
    limiter.increment();
    limiter.increment();

    mockDate.mockReturnValue(1000 + 86_400_001);
    const info = limiter.getInfo();
    expect(info.remaining.day).toBe(10000);
    expect(info.remaining.minute).toBe(60);
  });
});
