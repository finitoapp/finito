import { createTestInvoice } from "@payky/core/modules/shared/lightning-invoice-test-fixtures"
import type { GuestInvoiceWallet } from "@payky/core/spark/spark-guest-invoice"

declare global {
  interface Window {
    __e2eGuestInvoiceWallet?: boolean
  }
}

export const createE2eGuestInvoiceWallet = (): GuestInvoiceWallet | null => {
  if (!import.meta.env.DEV && !__E2E_TEST_BUILD__) return null
  if (
    typeof window === "undefined" ||
    window.__e2eGuestInvoiceWallet !== true
  ) {
    return null
  }
  return {
    createLightningInvoice: async ({ amountSats, memo }) => ({
      invoice: {
        encodedInvoice: createTestInvoice({
          hrp: `lnbc${amountSats * 10}n`,
          timestamp: Math.floor(Date.now() / 1000),
          description: memo,
        }),
      },
    }),
  }
}
