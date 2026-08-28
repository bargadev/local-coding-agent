const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private frame = 0;
  private timer: NodeJS.Timeout | null = null;
  private startMs = Date.now();
  private backend: string;

  constructor(backend: string) {
    this.backend = backend;
  }

  start(): void {
    this.startMs = Date.now();
    this.render();
    this.timer = setInterval(() => this.render(), 80);
  }

  stop(tokens?: number, isLocal = false): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const elapsed = ((Date.now() - this.startMs) / 1000).toFixed(1);
    const tokenStr = isLocal
      ? '0 tokens (free)'
      : tokens !== undefined ? `↓ ~${tokens} tokens` : '';
    process.stderr.write(`\r\x1b[K[${this.backend}] ${elapsed}s ${tokenStr}\n`);
  }

  private render(): void {
    const elapsed = ((Date.now() - this.startMs) / 1000).toFixed(1);
    const frame = FRAMES[this.frame % FRAMES.length];
    this.frame++;
    process.stderr.write(`\r\x1b[K${frame} [${this.backend}] ${elapsed}s`);
  }
}
