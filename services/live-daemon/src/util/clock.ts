export interface Clock {
  now(): Date;
  nowMs(): number;
  nowIso(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowMs(): number {
    return this.now().getTime();
  }

  nowIso(): string {
    return this.now().toISOString();
  }
}
