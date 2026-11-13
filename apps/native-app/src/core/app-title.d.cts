export declare const appChannels: readonly ["production", "edge", "prev", "dev"]

export type AppChannel = (typeof appChannels)[number]

export declare const appTitle: (
  brandName: string,
  channel: AppChannel
) => string
