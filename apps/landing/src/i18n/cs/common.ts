import type { enCommon } from "../en/common.ts"

export const csCommon = {
  "app.name": "{appName}",
  "settings.theme.dark.title": "Tmavý",
  "settings.theme.light.title": "Světlý",
  "settings.theme.system.title": "Auto",
} as const satisfies Record<keyof typeof enCommon, string>
