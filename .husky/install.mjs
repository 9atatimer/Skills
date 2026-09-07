// install.mjs -- guarded husky bootstrap (the pattern from the husky docs).
// This package publishes with zero installed dependencies, so `prepare`
// must no-op when husky is absent (CI, prepack) instead of failing the run.
if (process.env.CI !== undefined) process.exit(0);
try {
  const husky = (await import("husky")).default;
  console.log(husky());
} catch {
  // husky not installed (production/publish context): nothing to bootstrap
}
