import type { DeviceLanguage } from "../evolu/device-client.ts"

/**
 * The fictional café a demo account is filled with (demo-data/0001). Names
 * are data, not UI copy, so they live here rather than in `src/i18n`: they are
 * written into the account once, in the language the device had at the time.
 */

type Localized = Readonly<Record<DeviceLanguage, string>>

/** When in the day a category sells, as relative weights. */
export interface DemoDayPartWeights {
  readonly morning: number
  readonly noon: number
  readonly evening: number
}

export interface DemoItem {
  readonly name: Localized
  /** Whole crowns. */
  readonly price: number
  /** Relative popularity within its category. */
  readonly popularity: number
}

export interface DemoCategory {
  readonly name: Localized
  /** Alcohol is taxed at the standard rate, everything else at the reduced one. */
  readonly taxRate: "standard" | "reduced"
  readonly dayParts: DemoDayPartWeights
  readonly items: ReadonlyArray<DemoItem>
}

const item = (
  cs: string,
  sk: string,
  en: string,
  vi: string,
  price: number,
  popularity = 1
): DemoItem => ({ name: { cs, sk, en, vi }, price, popularity })

export const demoCategories: ReadonlyArray<DemoCategory> = [
  {
    name: { cs: "Káva", sk: "Káva", en: "Coffee", vi: "Cà phê" },
    taxRate: "reduced",
    dayParts: { morning: 6, noon: 2, evening: 2.5 },
    items: [
      item("Espresso", "Espresso", "Espresso", "Espresso", 55, 3),
      item("Cappuccino", "Cappuccino", "Cappuccino", "Cappuccino", 69, 5),
      item("Flat white", "Flat white", "Flat white", "Flat white", 79, 4),
      item("Caffè latte", "Caffè latte", "Caffè latte", "Caffè latte", 75, 3),
      item("Americano", "Americano", "Americano", "Americano", 59, 2),
      item("Cortado", "Cortado", "Cortado", "Cortado", 65, 1),
      item(
        "Espresso tonic",
        "Espresso tonic",
        "Espresso tonic",
        "Espresso tonic",
        89,
        1
      ),
    ],
  },
  {
    name: {
      cs: "Čaj a nealko",
      sk: "Čaj a nealko",
      en: "Tea & soft drinks",
      vi: "Trà và nước ngọt",
    },
    taxRate: "reduced",
    dayParts: { morning: 2, noon: 3, evening: 2 },
    items: [
      item("Sypaný čaj", "Sypaný čaj", "Loose-leaf tea", "Trà lá", 59, 2),
      item(
        "Domácí limonáda",
        "Domáca limonáda",
        "Homemade lemonade",
        "Nước chanh nhà làm",
        69,
        3
      ),
      item(
        "Fresh pomeranč",
        "Fresh pomaranč",
        "Fresh orange juice",
        "Nước cam tươi",
        85,
        2
      ),
      item(
        "Coca-Cola 0,33 l",
        "Coca-Cola 0,33 l",
        "Coca-Cola 0.33 l",
        "Coca-Cola 0,33 l",
        49,
        2
      ),
      item(
        "Voda 0,75 l",
        "Voda 0,75 l",
        "Water 0.75 l",
        "Nước suối 0,75 l",
        39,
        2
      ),
      item(
        "Horká čokoláda",
        "Horúca čokoláda",
        "Hot chocolate",
        "Sô cô la nóng",
        75,
        1
      ),
    ],
  },
  {
    name: { cs: "Snídaně", sk: "Raňajky", en: "Breakfast", vi: "Bữa sáng" },
    taxRate: "reduced",
    dayParts: { morning: 4, noon: 0.6, evening: 0.1 },
    items: [
      item(
        "Máslový croissant",
        "Maslový croissant",
        "Butter croissant",
        "Croissant bơ",
        45,
        4
      ),
      item(
        "Vejce Benedikt",
        "Vajcia Benedikt",
        "Eggs Benedict",
        "Trứng Benedict",
        189,
        2
      ),
      item(
        "Avokádový toast",
        "Avokádový toast",
        "Avocado toast",
        "Bánh mì nướng bơ quả",
        165,
        2
      ),
      item(
        "Granola s jogurtem",
        "Granola s jogurtom",
        "Granola & yogurt",
        "Granola sữa chua",
        129,
        1
      ),
      item("Lívance", "Lievance", "Pancakes", "Bánh pancake", 145, 1),
    ],
  },
  {
    name: { cs: "Obědy", sk: "Obedy", en: "Lunch", vi: "Bữa trưa" },
    taxRate: "reduced",
    dayParts: { morning: 0.2, noon: 6, evening: 1.2 },
    items: [
      item(
        "Polévka dne",
        "Polievka dňa",
        "Soup of the day",
        "Súp trong ngày",
        79,
        3
      ),
      item(
        "Hovězí burger",
        "Hovädzí burger",
        "Beef burger",
        "Burger bò",
        239,
        3
      ),
      item(
        "Caesar salát",
        "Caesar šalát",
        "Caesar salad",
        "Salad Caesar",
        199,
        2
      ),
      item(
        "Těstoviny dne",
        "Cestoviny dňa",
        "Pasta of the day",
        "Mì Ý trong ngày",
        219,
        2
      ),
      item(
        "Quiche se salátem",
        "Quiche so šalátom",
        "Quiche & salad",
        "Quiche và salad",
        149,
        1
      ),
      item(
        "Kuřecí wrap",
        "Kurací wrap",
        "Chicken wrap",
        "Bánh cuốn gà",
        175,
        2
      ),
    ],
  },
  {
    name: { cs: "Dezerty", sk: "Dezerty", en: "Desserts", vi: "Tráng miệng" },
    taxRate: "reduced",
    dayParts: { morning: 1, noon: 1.2, evening: 3 },
    items: [
      item("Cheesecake", "Cheesecake", "Cheesecake", "Cheesecake", 95, 3),
      item(
        "Mrkvový dort",
        "Mrkvová torta",
        "Carrot cake",
        "Bánh cà rốt",
        89,
        2
      ),
      item("Brownie", "Brownie", "Brownie", "Brownie", 75, 2),
      item("Tiramisu", "Tiramisu", "Tiramisu", "Tiramisu", 99, 1),
      item(
        "Zmrzlina, kopeček",
        "Zmrzlina, kopček",
        "Ice cream scoop",
        "Kem viên",
        45,
        1
      ),
    ],
  },
  {
    name: {
      cs: "Pivo a víno",
      sk: "Pivo a víno",
      en: "Beer & wine",
      vi: "Bia và rượu vang",
    },
    taxRate: "standard",
    dayParts: { morning: 0.05, noon: 0.8, evening: 3.5 },
    items: [
      item(
        "Pilsner Urquell 0,5 l",
        "Pilsner Urquell 0,5 l",
        "Pilsner Urquell 0.5 l",
        "Pilsner Urquell 0,5 l",
        65,
        4
      ),
      item(
        "Nealko pivo 0,33 l",
        "Nealko pivo 0,33 l",
        "Alcohol-free beer 0.33 l",
        "Bia không cồn 0,33 l",
        55,
        1
      ),
      item(
        "Bílé víno 0,15 l",
        "Biele víno 0,15 l",
        "White wine 0.15 l",
        "Vang trắng 0,15 l",
        79,
        2
      ),
      item(
        "Červené víno 0,15 l",
        "Červené víno 0,15 l",
        "Red wine 0.15 l",
        "Vang đỏ 0,15 l",
        85,
        2
      ),
      item(
        "Prosecco 0,1 l",
        "Prosecco 0,1 l",
        "Prosecco 0.1 l",
        "Prosecco 0,1 l",
        99,
        1
      ),
      item(
        "Aperol spritz",
        "Aperol spritz",
        "Aperol spritz",
        "Aperol spritz",
        149,
        2
      ),
    ],
  },
]

export interface DemoTable {
  readonly name: Localized
  readonly seatCount: number
}

const table = (
  cs: string,
  sk: string,
  en: string,
  vi: string,
  seatCount: number
): DemoTable => ({ name: { cs, sk, en, vi }, seatCount })

export const demoTables: ReadonlyArray<DemoTable> = [
  table("Stůl 1", "Stôl 1", "Table 1", "Bàn 1", 2),
  table("Stůl 2", "Stôl 2", "Table 2", "Bàn 2", 2),
  table("Stůl 3", "Stôl 3", "Table 3", "Bàn 3", 4),
  table("Stůl 4", "Stôl 4", "Table 4", "Bàn 4", 4),
  table("Stůl 5", "Stôl 5", "Table 5", "Bàn 5", 4),
  table("Stůl 6", "Stôl 6", "Table 6", "Bàn 6", 6),
  table("Okno", "Okno", "Window", "Cửa sổ", 2),
  table("Bar", "Bar", "Bar", "Quầy bar", 3),
  table("Zahrádka 1", "Terasa 1", "Patio 1", "Sân 1", 4),
  table("Zahrádka 2", "Terasa 2", "Patio 2", "Sân 2", 4),
]

export const demoDeviceNames: ReadonlyArray<Localized> = [
  { cs: "Pokladna", sk: "Pokladňa", en: "Counter", vi: "Quầy thu ngân" },
  {
    cs: "Tablet – sál",
    sk: "Tablet – sála",
    en: "Floor tablet",
    vi: "Tablet – phòng khách",
  },
  {
    cs: "Mobil – zahrádka",
    sk: "Mobil – terasa",
    en: "Patio phone",
    vi: "Điện thoại – sân",
  },
]
