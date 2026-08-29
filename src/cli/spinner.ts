// [presentParticiple, pastTense] — spinner shows "Sautéing…", done line shows "Sautéed for 2s"
const VERBS: [string, string][] = [
  ['Sautéing', 'Sautéed'],
  ['Simmering', 'Simmered'],
  ['Percolating', 'Percolated'],
  ['Noodling', 'Noodled'],
  ['Marinating', 'Marinated'],
  ['Brewing', 'Brewed'],
  ['Conjuring', 'Conjured'],
  ['Pondering', 'Pondered'],
  ['Ruminating', 'Ruminated'],
  ['Vibing', 'Vibed'],
  ['Incubating', 'Incubated'],
  ['Finagling', 'Finagled'],
];

export const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  yellow: '\x1b[93m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  coral:  '\x1b[38;2;217;119;87m',
};

export class Spinner {
  private timer: NodeJS.Timeout | null = null;
  private startMs = Date.now();
  private ing: string;
  private ed: string;
  private pulse = false;
  private tokens = 0;

  constructor(_label: string) {
    const [ing, ed] = VERBS[Math.floor(Math.random() * VERBS.length)];
    this.ing = ing;
    this.ed = ed;
  }

  start(): void {
    this.startMs = Date.now();
    this.render();
    this.timer = setInterval(() => { this.pulse = !this.pulse; this.render(); }, 600);
  }

  // Live output-token count, rendered as "↓ N tok" inside the spinner line.
  setTokens(n: number): void {
    this.tokens = n;
    this.render();
  }

  stop(): { elapsedSec: number; verb: string } {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.clearLine();
    return { elapsedSec: Math.round((Date.now() - this.startMs) / 1000), verb: this.ed };
  }

  private clearLine(): void {
    if (process.stdout.isTTY) {
      process.stdout.cursorTo(0);
      process.stdout.clearLine(0);
    }
  }

  private render(): void {
    const elapsed = Math.round((Date.now() - this.startMs) / 1000);
    const star = this.pulse ? '✳' : '✴';
    const meta = this.tokens > 0 ? `${elapsed}s · ↓ ${this.tokens} tok` : `${elapsed}s`;
    this.clearLine();
    process.stdout.write(
      `${C.coral}${star}${C.reset} ${C.bold}${this.ing}…${C.reset} ${C.dim}(${meta})${C.reset}`
    );
  }
}
