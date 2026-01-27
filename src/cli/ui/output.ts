/**
 * CLI output utilities
 *
 * Provides consistent formatting for CLI output.
 * Respects CI mode (no colors).
 */

const isCI = process.env.CI === 'true' || process.argv.includes('--ci');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function color(text: string, ...codes: string[]): string {
  if (isCI) {
    return text;
  }
  return codes.join('') + text + colors.reset;
}

/**
 * Output utilities for consistent CLI formatting
 */
export const output = {
  /**
   * Print a header
   */
  header(text: string): void {
    console.log(color(`\n▶ ${text}`, colors.bold, colors.cyan));
  },

  /**
   * Print a subheader
   */
  subheader(text: string): void {
    console.log(color(`  ${text}:`, colors.bold));
  },

  /**
   * Print an info message
   */
  info(text: string): void {
    console.log(color(`ℹ ${text}`, colors.blue));
  },

  /**
   * Print a success message
   */
  success(text: string): void {
    console.log(color(`✓ ${text}`, colors.green));
  },

  /**
   * Print a warning message
   */
  warn(text: string): void {
    console.log(color(`⚠ ${text}`, colors.yellow));
  },

  /**
   * Print an error message
   */
  error(text: string): void {
    console.log(color(`✗ ${text}`, colors.red));
  },

  /**
   * Print a check result (for doctor command)
   */
  check(name: string, status: 'ok' | 'warn' | 'error', message: string): void {
    const icon = status === 'ok' ? '✓' : status === 'warn' ? '⚠' : '✗';
    const colorCode =
      status === 'ok' ? colors.green : status === 'warn' ? colors.yellow : colors.red;
    console.log(`  ${color(icon, colorCode)} ${name}: ${message}`);
  },

  /**
   * Print a "created" message
   */
  created(path: string): void {
    console.log(color(`  + ${path}`, colors.green));
  },

  /**
   * Print an "updated" message
   */
  updated(path: string): void {
    console.log(color(`  ~ ${path}`, colors.yellow));
  },

  /**
   * Print a "skipped" message
   */
  skipped(path: string): void {
    console.log(color(`  - ${path}`, colors.dim));
  },

  /**
   * Print a config key-value pair
   */
  config(key: string, value: string): void {
    console.log(`  ${color(`${key}:`, colors.dim)} ${value}`);
  },

  /**
   * Print a stat key-value pair
   */
  stat(key: string, value: string): void {
    console.log(`    ${key}: ${color(value, colors.cyan)}`);
  },

  /**
   * Print a numbered step
   */
  step(num: string, text: string): void {
    console.log(`  ${color(`${num}.`, colors.cyan)} ${text}`);
  },

  /**
   * Print a bullet point
   */
  bullet(text: string): void {
    console.log(`  • ${text}`);
  },

  /**
   * Print a newline
   */
  newline(): void {
    console.log();
  },

  /**
   * Print raw text
   */
  raw(text: string): void {
    console.log(text);
  },

  /**
   * Print a table (simple)
   */
  table(rows: string[][]): void {
    // Calculate column widths
    const widths: number[] = [];
    for (const row of rows) {
      row.forEach((cell, i) => {
        widths[i] = Math.max(widths[i] ?? 0, cell.length);
      });
    }

    // Print rows
    for (const row of rows) {
      const formatted = row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ');
      console.log(`  ${formatted}`);
    }
  },

  /**
   * Print a progress indicator (simple)
   */
  progress(current: number, total: number, label?: string): void {
    const percent = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
    const text = label ? `${label} ` : '';
    process.stdout.write(`\r  ${text}[${bar}] ${percent}%`);
    if (current === total) {
      console.log();
    }
  },
};
