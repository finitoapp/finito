import { defineConfig } from "vitest/config"
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "apps/web-app/src/**/*.{ts,tsx}",
        "apps/landing/src/**/*.{ts,tsx}",
        "packages/web-shared/src/**/*.ts",
        "packages/app-shared/src/**/*.ts",
        "apps/web-app/api/**/*.ts",
        "apps/cli/src/**/*.ts",
        "packages/core/src/**/*.ts",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "**/*-test-fixtures.ts",
        "packages/core/src/testing/**",
        "apps/web-app/src/components/ui/**",
        "apps/landing/src/components/ui/**",
        "apps/web-app/src/components/reui/**",
        "apps/web-app/src/routeTree.gen.ts",
      ],
    },
    projects: [
      "apps/web-app/vite.config.ts",
      "apps/landing/vite.config.ts",
      {
        test: {
          name: "web-shared",
          include: ["packages/web-shared/src/**/*.test.ts"],
        },
      },
      "packages/core/vitest.config.ts",
      "apps/cli/vitest.config.ts",
      {
        test: {
          name: "app-shared",
          include: ["packages/app-shared/src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "native-bootstrap",
          include: [
            "apps/native-app/src/platform/**/*.test.ts",
            "apps/native-app/src/core/**/*.test.ts",
            "apps/native-app/src/atoms/**/*.test.ts",
            "apps/native-app/src/features/**/*.test.ts",
            "apps/native-app/src/hooks/**/*.test.ts",
            "apps/native-app/src/components/**/*.test.ts",
            "apps/native-app/src/theme/**/*.test.ts",
            "apps/native-app/src/ui-parity/**/*.test.ts",
            "apps/native-app/src/e2e/**/*.test.ts",
          ],
          // Its polyfills import its native modules from `react-native`, so
          // it goes through Vitest, where a test's mock of `react-native`
          // reaches it, instead of loading React Native's Flow source.
          server: { deps: { inline: ["@evolu/react-native"] } },
        },
      },
      { test: { name: "tools", include: ["bin/**/*.test.ts"] } },
    ],
  },
})
