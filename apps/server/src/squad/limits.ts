// Per-socket token bucket for client events. A phone that spams (stuck button, buggy retry loop or a
// curious student) gets 'rate-limited' acks instead of flooding the session.

export interface BucketSpec {
  /** Burst size. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
}

export const SEAT_BUCKET: BucketSpec = { capacity: 30, refillPerSec: 8 };
export const HOST_BUCKET: BucketSpec = { capacity: 40, refillPerSec: 10 };

export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly spec: BucketSpec,
    now: number,
  ) {
    this.tokens = spec.capacity;
    this.last = now;
  }

  take(now: number, cost = 1): boolean {
    const elapsed = Math.max(0, now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.spec.capacity, this.tokens + elapsed * this.spec.refillPerSec);
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}
