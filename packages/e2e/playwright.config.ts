import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    // Serve the production build so the CSP and the PDF worker are exercised as shipped.
    command:
      "pnpm --filter @maskit/web build && pnpm --filter @maskit/web exec vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 180_000,
    cwd: "../..",
  },
});
