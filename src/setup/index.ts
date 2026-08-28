import { execSync } from 'child_process';

function isClaudeInstalled(): boolean {
  try {
    execSync('which claude', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isClaudeAuthenticated(): boolean {
  try {
    const out = execSync('claude auth status', { encoding: 'utf8', timeout: 5000 });
    const status = JSON.parse(out);
    return status.loggedIn === true;
  } catch {
    return false;
  }
}

function installClaude(): void {
  console.log('Installing Claude CLI...');
  execSync('npm install -g @anthropic-ai/claude-code', { stdio: 'inherit', timeout: 60_000 });
  console.log('Claude CLI installed.');
}

function authenticateClaude(): void {
  console.log('Opening browser for authentication...');
  execSync('claude auth login', { stdio: 'inherit', timeout: 120_000 });
}

export function ensureClaudeCLI(): void {
  if (!isClaudeInstalled()) {
    installClaude();
  }

  if (!isClaudeAuthenticated()) {
    authenticateClaude();
  }
}
