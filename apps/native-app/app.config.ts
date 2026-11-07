import { createEnv } from "@t3-oss/env-core"
import type { ExpoConfig } from "expo/config"
import { z } from "zod"
import { version } from "../../package.json"

const buildEnv = createEnv({
  server: {
    // The web export's version with its commit off a release
    // (`getAppVersion`, set by scripts/build-web.ts); the APK keeps the
    // release version, from which its versionCode is derived.
    PAYKY_APP_VERSION: z.string().default(version),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

const [year, month, micro] = version.split(".").map(Number) as [
  number,
  number,
  number,
]

export default {
  name: "Finito",
  slug: "finito",
  scheme: "finito",
  version: buildEnv.PAYKY_APP_VERSION,
  platforms: ["android", "ios", "web"],
  userInterfaceStyle: "automatic",
  // The PWA icon; launchers without adaptive icons use it as is.
  icon: "./assets/app-icon.png",
  ios: {
    bundleIdentifier: "fit.finito.app",
    supportsTablet: true,
  },
  android: {
    package: "fit.finito.app",
    // The PWA coin on a transparent background, sized to fill the launcher
    // mask (the visible 72 of 108 dp), so no backdrop shows around it.
    adaptiveIcon: {
      foregroundImage: "./assets/launcher-foreground.png",
      backgroundColor: "#00000000",
    },
    allowBackup: false,
    // Removed from the merged manifest: the prebuild template's storage and
    // overlay permissions, and expo-screen-capture's screenshot detection
    // (only `usePreventScreenCapture`, FLAG_SECURE, is used). Files are
    // picked through the system picker and shared through a FileProvider,
    // so nothing reads or writes shared storage.
    blockedPermissions: [
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.DETECT_SCREEN_CAPTURE",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
    versionCode: year * 1_000_000 + month * 10_000 + micro,
  },
  plugins: [
    "expo-router",
    [
      "expo-font",
      {
        // Manrope, Linky's typeface (its `packages/ui` config), built into
        // the APK under the family names tamagui.config.ts uses, so the first
        // render needs no font loading (useFonts took ~45 ms). The files are
        // Google Fonts' static faces (OFL) from `@expo-google-fonts/manrope`,
        // which Bun links into this app's node_modules as a direct dependency.
        android: {
          fonts: [
            ["Manrope", "400Regular", 400],
            ["ManropeSemiBold", "600SemiBold", 600],
            ["ManropeBold", "700Bold", 700],
          ].map(([fontFamily, face, weight]) => ({
            fontFamily: String(fontFamily),
            fontDefinitions: [
              {
                path: `./node_modules/@expo-google-fonts/manrope/${face}/Manrope_${face}.ttf`,
                weight: Number(weight),
              },
            ],
          })),
        },
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "Finito uses the camera to scan payment, pairing and product codes.",
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    // No organization/project/auth token: builds upload no source maps.
    "@sentry/react-native/expo",
    [
      "expo-splash-screen",
      {
        // The app icon on the palette's `background` (src/theme/palette.ts),
        // as AppLoader draws it. The app holds this splash until its first
        // screen is ready (app/_layout.tsx).
        image: "./assets/app-icon.png",
        imageWidth: 140,
        backgroundColor: "#fbfaf7",
        dark: { image: "./assets/app-icon.png", backgroundColor: "#101214" },
      },
    ],
    "./plugins/with-no-data-extraction.cjs",
    "./plugins/with-hardware-key-events.cjs",
    "./plugins/with-switchio-result-capture.cjs",
    "./plugins/with-library-compile-sdk.cjs",
    "./plugins/with-release-proguard-rules.cjs",
    "./plugins/with-release-signing.cjs",
    "./plugins/with-debug-app-id.cjs",
    "./plugins/with-e2e-cleartext.cjs",
  ],
} satisfies ExpoConfig
