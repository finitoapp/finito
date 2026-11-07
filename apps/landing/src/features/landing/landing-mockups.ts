import type { BrandId } from "@payky/app-shared/brand"
import { landingSite } from "@/core/landing-site.ts"
import type { Language } from "@/i18n/resources.ts"
import finitoCzechBillMockup from "../../../../native-app/docs/mockup/cs/bill.webp"
import finitoCzechHomeMockup from "../../../../native-app/docs/mockup/cs/home.webp"
import finitoCzechItemsMockup from "../../../../native-app/docs/mockup/cs/items.webp"
import finitoCzechPaidMockup from "../../../../native-app/docs/mockup/cs/paid.webp"
import finitoCzechPaymentMockup from "../../../../native-app/docs/mockup/cs/payment.webp"
import finitoCzechSplitMockup from "../../../../native-app/docs/mockup/cs/split.webp"
import finitoCzechStatsMockup from "../../../../native-app/docs/mockup/cs/stats.webp"
import finitoCzechStatsChartsMockup from "../../../../native-app/docs/mockup/cs/stats-charts.webp"
import finitoCzechTableBillMockup from "../../../../native-app/docs/mockup/cs/table-bill.webp"
import finitoCzechTablesMockup from "../../../../native-app/docs/mockup/cs/tables.webp"
import finitoEnglishBillMockup from "../../../../native-app/docs/mockup/en/bill.webp"
import finitoEnglishHomeMockup from "../../../../native-app/docs/mockup/en/home.webp"
import finitoEnglishItemsMockup from "../../../../native-app/docs/mockup/en/items.webp"
import finitoEnglishPaidMockup from "../../../../native-app/docs/mockup/en/paid.webp"
import finitoEnglishPaymentMockup from "../../../../native-app/docs/mockup/en/payment.webp"
import finitoEnglishSplitMockup from "../../../../native-app/docs/mockup/en/split.webp"
import finitoEnglishStatsMockup from "../../../../native-app/docs/mockup/en/stats.webp"
import finitoEnglishStatsChartsMockup from "../../../../native-app/docs/mockup/en/stats-charts.webp"
import finitoEnglishTableBillMockup from "../../../../native-app/docs/mockup/en/table-bill.webp"
import finitoEnglishTablesMockup from "../../../../native-app/docs/mockup/en/tables.webp"
import finitoSlovakBillMockup from "../../../../native-app/docs/mockup/sk/bill.webp"
import finitoSlovakHomeMockup from "../../../../native-app/docs/mockup/sk/home.webp"
import finitoSlovakItemsMockup from "../../../../native-app/docs/mockup/sk/items.webp"
import finitoSlovakPaidMockup from "../../../../native-app/docs/mockup/sk/paid.webp"
import finitoSlovakPaymentMockup from "../../../../native-app/docs/mockup/sk/payment.webp"
import finitoSlovakSplitMockup from "../../../../native-app/docs/mockup/sk/split.webp"
import finitoSlovakStatsMockup from "../../../../native-app/docs/mockup/sk/stats.webp"
import finitoSlovakStatsChartsMockup from "../../../../native-app/docs/mockup/sk/stats-charts.webp"
import finitoSlovakTableBillMockup from "../../../../native-app/docs/mockup/sk/table-bill.webp"
import finitoSlovakTablesMockup from "../../../../native-app/docs/mockup/sk/tables.webp"
import paykyCzechBillMockup from "../../../../web-app/docs/mockup/cs/bill.webp"
import paykyCzechHomeMockup from "../../../../web-app/docs/mockup/cs/home.webp"
import paykyCzechItemsMockup from "../../../../web-app/docs/mockup/cs/items.webp"
import paykyCzechPaidMockup from "../../../../web-app/docs/mockup/cs/paid.webp"
import paykyCzechPaymentMockup from "../../../../web-app/docs/mockup/cs/payment.webp"
import paykyCzechSplitMockup from "../../../../web-app/docs/mockup/cs/split.webp"
import paykyCzechStatsMockup from "../../../../web-app/docs/mockup/cs/stats.webp"
import paykyCzechStatsChartsMockup from "../../../../web-app/docs/mockup/cs/stats-charts.webp"
import paykyCzechTableBillMockup from "../../../../web-app/docs/mockup/cs/table-bill.webp"
import paykyCzechTablesMockup from "../../../../web-app/docs/mockup/cs/tables.webp"
import paykyEnglishBillMockup from "../../../../web-app/docs/mockup/en/bill.webp"
import paykyEnglishHomeMockup from "../../../../web-app/docs/mockup/en/home.webp"
import paykyEnglishItemsMockup from "../../../../web-app/docs/mockup/en/items.webp"
import paykyEnglishPaidMockup from "../../../../web-app/docs/mockup/en/paid.webp"
import paykyEnglishPaymentMockup from "../../../../web-app/docs/mockup/en/payment.webp"
import paykyEnglishSplitMockup from "../../../../web-app/docs/mockup/en/split.webp"
import paykyEnglishStatsMockup from "../../../../web-app/docs/mockup/en/stats.webp"
import paykyEnglishStatsChartsMockup from "../../../../web-app/docs/mockup/en/stats-charts.webp"
import paykyEnglishTableBillMockup from "../../../../web-app/docs/mockup/en/table-bill.webp"
import paykyEnglishTablesMockup from "../../../../web-app/docs/mockup/en/tables.webp"
import paykySlovakBillMockup from "../../../../web-app/docs/mockup/sk/bill.webp"
import paykySlovakHomeMockup from "../../../../web-app/docs/mockup/sk/home.webp"
import paykySlovakItemsMockup from "../../../../web-app/docs/mockup/sk/items.webp"
import paykySlovakPaidMockup from "../../../../web-app/docs/mockup/sk/paid.webp"
import paykySlovakPaymentMockup from "../../../../web-app/docs/mockup/sk/payment.webp"
import paykySlovakSplitMockup from "../../../../web-app/docs/mockup/sk/split.webp"
import paykySlovakStatsMockup from "../../../../web-app/docs/mockup/sk/stats.webp"
import paykySlovakStatsChartsMockup from "../../../../web-app/docs/mockup/sk/stats-charts.webp"
import paykySlovakTableBillMockup from "../../../../web-app/docs/mockup/sk/table-bill.webp"
import paykySlovakTablesMockup from "../../../../web-app/docs/mockup/sk/tables.webp"

/**
 * The app screens the page shows, as each app's `scripts/generate-doc-screenshots.ts`
 * captures them: the web app's for Payky's landing, the native app's for
 * Finito's.
 */
export type MockupScreen =
  | "bill"
  | "home"
  | "items"
  | "paid"
  | "payment"
  | "split"
  | "stats"
  | "statsCharts"
  | "tableBill"
  | "tables"

/** Every mockup's pixel size, so the page reserves its space before it loads. */
export const mockupWidth = 1164
export const mockupHeight = 2044

export type LandingMockups = Readonly<Record<MockupScreen, string>>

const mockupsByBrand: Readonly<
  Record<BrandId, Readonly<Record<Language, LandingMockups>>>
> = {
  payky: {
    cs: {
      bill: paykyCzechBillMockup,
      home: paykyCzechHomeMockup,
      items: paykyCzechItemsMockup,
      paid: paykyCzechPaidMockup,
      payment: paykyCzechPaymentMockup,
      split: paykyCzechSplitMockup,
      stats: paykyCzechStatsMockup,
      statsCharts: paykyCzechStatsChartsMockup,
      tableBill: paykyCzechTableBillMockup,
      tables: paykyCzechTablesMockup,
    },
    en: {
      bill: paykyEnglishBillMockup,
      home: paykyEnglishHomeMockup,
      items: paykyEnglishItemsMockup,
      paid: paykyEnglishPaidMockup,
      payment: paykyEnglishPaymentMockup,
      split: paykyEnglishSplitMockup,
      stats: paykyEnglishStatsMockup,
      statsCharts: paykyEnglishStatsChartsMockup,
      tableBill: paykyEnglishTableBillMockup,
      tables: paykyEnglishTablesMockup,
    },
    sk: {
      bill: paykySlovakBillMockup,
      home: paykySlovakHomeMockup,
      items: paykySlovakItemsMockup,
      paid: paykySlovakPaidMockup,
      payment: paykySlovakPaymentMockup,
      split: paykySlovakSplitMockup,
      stats: paykySlovakStatsMockup,
      statsCharts: paykySlovakStatsChartsMockup,
      tableBill: paykySlovakTableBillMockup,
      tables: paykySlovakTablesMockup,
    },
  },
  finito: {
    cs: {
      bill: finitoCzechBillMockup,
      home: finitoCzechHomeMockup,
      items: finitoCzechItemsMockup,
      paid: finitoCzechPaidMockup,
      payment: finitoCzechPaymentMockup,
      split: finitoCzechSplitMockup,
      stats: finitoCzechStatsMockup,
      statsCharts: finitoCzechStatsChartsMockup,
      tableBill: finitoCzechTableBillMockup,
      tables: finitoCzechTablesMockup,
    },
    en: {
      bill: finitoEnglishBillMockup,
      home: finitoEnglishHomeMockup,
      items: finitoEnglishItemsMockup,
      paid: finitoEnglishPaidMockup,
      payment: finitoEnglishPaymentMockup,
      split: finitoEnglishSplitMockup,
      stats: finitoEnglishStatsMockup,
      statsCharts: finitoEnglishStatsChartsMockup,
      tableBill: finitoEnglishTableBillMockup,
      tables: finitoEnglishTablesMockup,
    },
    sk: {
      bill: finitoSlovakBillMockup,
      home: finitoSlovakHomeMockup,
      items: finitoSlovakItemsMockup,
      paid: finitoSlovakPaidMockup,
      payment: finitoSlovakPaymentMockup,
      split: finitoSlovakSplitMockup,
      stats: finitoSlovakStatsMockup,
      statsCharts: finitoSlovakStatsChartsMockup,
      tableBill: finitoSlovakTableBillMockup,
      tables: finitoSlovakTablesMockup,
    },
  },
}

/** This landing's app, in each language (landing/0013). */
export const mockupsByLanguage = mockupsByBrand[landingSite.brand.id]

interface MockupBox {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

/** Where the page's effects sit over a brand's mockups, in percent of the mockup. */
export interface MockupMarks {
  /** The payment mockup's QR card, which the scan line sweeps. */
  readonly qrCard: MockupBox
  /** The paid mockup's check: its centre's height and its width, centred across. */
  readonly paidCheck: { readonly top: number; readonly width: number }
}

// Measured on the mockups; the same in every language.
const mockupMarksByBrand: Readonly<Record<BrandId, MockupMarks>> = {
  payky: {
    qrCard: { top: 37.1, left: 21.8, width: 56.4, height: 32 },
    paidCheck: { top: 37.8, width: 15.3 },
  },
  finito: {
    qrCard: { top: 36.8, left: 19.3, width: 61.3, height: 34.9 },
    paidCheck: { top: 37.4, width: 15.3 },
  },
}

export const mockupMarks = mockupMarksByBrand[landingSite.brand.id]

/** `box` as the inline style that places an element over it. */
export const mockupBoxStyle = (box: MockupBox) => ({
  top: `${box.top}%`,
  left: `${box.left}%`,
  width: `${box.width}%`,
  height: `${box.height}%`,
})
