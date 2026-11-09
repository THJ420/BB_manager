/** Semver comparison used by the in-app GitHub release updater. */

function versionParts(value: string): number[] {
  return value
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map((part) => {
      const parsed = Number.parseInt(part, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
}

export function isNewerVersion(latest: string, current: string): boolean {
  const a = versionParts(latest);
  const b = versionParts(current);

  for (let index = 0; index < 3; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left > right;
  }

  return false;
}
