/**
 * Trips a provider "down" after N consecutive failures, so a dead provider
 * isn't retried on every single incoming message (PHASES.md #2). Recovers
 * automatically after a cooldown window — the next call after cooldown is
 * allowed through as a health probe; if it fails, the cooldown restarts.
 */
export class CircuitBreaker {
    private consecutiveFailures = 0;
    private openedAt: number | null = null;

    constructor(
        private readonly threshold: number,
        private readonly cooldownMs: number
    ) {}

    /** Whether a call should be allowed through right now. */
    canAttempt(): boolean {
        if (this.openedAt === null) return true;
        return Date.now() - this.openedAt >= this.cooldownMs;
    }

    recordSuccess(): void {
        this.consecutiveFailures = 0;
        this.openedAt = null;
    }

    recordFailure(): void {
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= this.threshold) {
            this.openedAt = Date.now();
        }
    }

    get isOpen(): boolean {
        return this.openedAt !== null && !this.canAttempt();
    }
}
