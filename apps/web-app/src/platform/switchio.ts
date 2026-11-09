import { Capacitor, registerPlugin } from "@capacitor/core"
import { err } from "@evolu/common"
import {
  createSwitchioResultUnreadableError,
  createSwitchioUnavailableError,
  interpretSwitchioPaymentResult,
  type SwitchioNativePayResult,
  type SwitchioTerminalDep,
} from "@payky/core/switchio"

/**
 * Bridge to the SwitchioPay terminal app's ECR API (v8), which is driven
 * entirely through Android intents — there is no HTTP or local-socket
 * interface — so this only works inside the Capacitor Android runtime. The
 * native side lives in `android/app/src/main/java/me/payky/SwitchioPlugin.java`.
 */
interface SwitchioNativePlugin {
  isInstalled(): Promise<{ readonly installed: boolean }>
  pay(options: {
    readonly transactionId: string
    readonly amount: number
    readonly tipAmount: number
    readonly currencyCode: number
    readonly invoiceNumber?: string
  }): Promise<SwitchioNativePayResult>
}

/** The Capacitor plugin name and the rejection code for a missing app. */
export const SWITCHIO_PLUGIN_NAME = "Switchio"
const SWITCHIO_NOT_INSTALLED_CODE = "SWITCHIO_NOT_INSTALLED"

const SwitchioNative =
  registerPlugin<SwitchioNativePlugin>(SWITCHIO_PLUGIN_NAME)

/** Whether this device can launch SwitchioPay; always `false` outside the native app. */
export const isSwitchioInstalled = async (): Promise<boolean> =>
  Capacitor.isNativePlatform() && (await SwitchioNative.isInstalled()).installed

const isNotInstalledRejection = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === SWITCHIO_NOT_INSTALLED_CODE

/**
 * Takes card payments through SwitchioPay. A demo account calls no outside
 * service (demo-data/0001), so it never reaches the terminal, as in Finito.
 */
export const createSwitchioTerminalDep = ({
  demo,
}: {
  readonly demo: boolean
}): SwitchioTerminalDep => ({
  switchioTerminal: {
    pay: async (request) => {
      if (demo) return err(createSwitchioUnavailableError({ reason: "demo" }))
      if (!Capacitor.isNativePlatform()) {
        return err(
          createSwitchioUnavailableError({ reason: "notNativeRuntime" })
        )
      }

      try {
        return interpretSwitchioPaymentResult(await SwitchioNative.pay(request))
      } catch (error) {
        // Only a missing SwitchioPay activity is known to fail before
        // anything was charged. Any other rejection (a dropped bridge call,
        // a recreated activity) may come after the terminal took the card,
        // so it is reported as an unknown outcome, never as "unavailable".
        if (isNotInstalledRejection(error)) {
          return err(createSwitchioUnavailableError({ reason: "notInstalled" }))
        }
        return err(
          createSwitchioResultUnreadableError({
            resultCode: null,
            rawResult: null,
          })
        )
      }
    },
  },
})
