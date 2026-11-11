# Nulová a záporná cena položky katalogu (`unitAmount ≤ 0`)

## Kontext

Cena položky katalogu dnes může být jen kladná. Smysl ale dává i nulová cena (voda zdarma, košík pečiva, modifikátor) a záporná cena, tedy sleva pevnou částkou prodávaná jako běžná položka.

Kde omezení dnes je:
- **Nulu** schéma už pouští (`catalogItem.unitAmount`, `item.unitAmount` jsou `NonNegativeInteger`). Odmítá ji jen formulář: `createPriceSchema` a `createPriceCodec` v `packages/app-shared/src/catalog-item-form-schema.ts` volají `decimalAmountToMinorUnits`, který pro `amount <= 0` vrací `null` (`packages/core/src/modules/shared/money.ts`).
- **Zápornou cenu** odmítá celý řetězec:
  - schémata `item`, `catalogItem`, `billLine.totalAmount` a `paymentLine.totalAmount`;
  - ořezání na nulu v `calculateBillLineSummaries` (`bill-line-utils.ts`) i v SQL statistik (`nettedBillLines`, `sales-stats-queries.ts`);
  - za běhu kontrolovaná volání `NonNegativeInteger(...)` nad částkami řádků (výčet v kroku 3).

Rozhodnutí od uživatele:
- Položka může stát **nula i méně**.
- **Sleva nemá sazbu DPH.** Před výpočtem DPH se vždy rozpočítá poměrně na zboží účtu, a tím i mezi sazby DPH (krok 3, Rozpočítání slevy).
- **Platbu jde vytvořit jen tehdy, když je částka k úhradě po zaokrouhlení podle metody > 0.** Položky za 0 i slevy na účtu být můžou, ale účet se součtem 0 nebo záporným nejde zaplatit. U hotovosti v CZK se kontroluje částka zaokrouhlená na celé koruny (`roundCashAmount`, payment/0002), takže účet za 0,01–0,49 Kč v hotovosti zaplatit nejde.
- **Účet se součtem přesně 0 obsluha uzavře tlačítkem „Dokončit“**, bez platby, s oprávněním `sell`. Zápis je `bill.confirmedClosedAt` (spolu s `closedAt`), jehož význam se zobecní na „obsluha potvrdila uzavření účtu“ (krok 1, Dokončení účtu za 0).
- **Účet se zápornou částkou jde jen zrušit** (`discard`). Uzavřený by ve statistikách vytvořil zápornou tržbu.
- **Souběh s offline úpravou se přijímá.** Když jiné zařízení, které o uzavření ještě neví, přidá položku, účet zůstane uzavřený a nedoplacený. Ukáže se varováním na detailu a štítkem v historii; obsluha položku namarkuje na nový účet.
- **Sleva nesmí mít částku 0.** Se zapnutým přepínačem „Sleva“ musí být částka nenulová (výsledná cena < 0). Bez přepínače může být cena 0.
- **Položka za 0 musí mít u plátce DPH sazbu DPH.** Platí jen pro plátce (`isVatPayer`, `legal-entity-utils.ts`); neplátce sazbu nezadává. Kladné položky se dnes u plátce smí uložit bez sazby („zatím nepřiřazená“, komentář u `catalogItem.taxRateId`) a tohle pravidlo to nemění.
- **Přepínač „Sleva“ jde nastavit jen při založení položky.** Existující položce znaménko ceny změnit nejde, protože sleva by si ponechala `catalogItemId` původní položky a statistiky (`coalesce(catalogItemId, itemId)` v `sales-stats-queries.ts`) i rozdíl řádků na detailu platby (`bill-line-utils.ts`) by prodej a slevu sloučily.
- **CLI zápornou cenu přijímá** a položka se zápornou cenou je sleva, se všemi pravidly slevy (bez sazby DPH, znaménko jen při založení). CLI nemá přepínač: znaménko je přímo v zadané částce (krok 3, CLI).
- **Refundace zboží z platby se slevou** vrací čistou částku řádku po rozpočítané slevě, poměrně k vrácenému množství.
- **Rozpočítání slevy se při platbě zmrazí** do `paymentLine`, takže detail platby, refundace a Qerko účtenka se nezmění, ani když se algoritmus později upraví.
- **Sleva po částečné platbě** musí účet uzavřít, když ho doplatí. Oprava je krok 2 a musí být hotová dřív, než jde slevu zadat (krok 3).
- **Zpětná kompatibilita se neřeší.** Nic nebrání zařízení se starší verzí aplikace, aby si synchronizací stáhlo slevu; může spadnout nebo zapsat chybná data (krok 3, Starší verze). Riziko se přijímá a zapíše do `catalog/0002`. Kroky se proto nerozdělují do samostatných vydání.

### Zamítnuté varianty pro účet za 0
- **Transakce 0 Kč v hotovosti:** závisí na účtu hotovosti, který vypnutí hotovosti soft-smaže; vytvoří platbu, číslo platby a tržbu 0 v EET; dvě zařízení vytvoří dvě platby.
- **Nový typ platby s virtuálním účtem:** porušuje význam účtu a potřebuje výjimky v nastavení metod, EET, refundacích, statistikách a v šesti úplných mapách nad druhy účtů; starší verze na neznámém druhu účtu spadnou.
- **Účet za 0 je automaticky zaplacený:** uzavřel by prázdný košík nebo účet uprostřed objednávky; `bill.closedAt` se ukládá, nepočítá.
- **Nové pole `bill.closedWithoutPaymentAt`:** buď podmíněné (účet uzavřený, dokud je součet 0), pak se po offline úpravě z jiného zařízení sám znovu otevře, ale `closedAt` zůstane a účet zmizí z přehledu stolů; nebo konečné, pak potřebuje výjimku v `deriveBillStatus` a příznak konfliktu. Starší verze nové pole neznají a viděly by účet jako otevřený. `confirmedClosedAt` dává totéž bez nového pole.
- **Akce „znovu otevřít“** pro uzavřený účet, do kterého někdo offline přidal položku: potřebuje nové pole (`confirmedClosedAt` se nikdy nemaže) a nový stav v životním cyklu účtu.

### Důsledky
- **Účet za 0** se uzavře „Dokončit“ a ve statistikách se počítá jako prodaný, takže se započítají i kusy zdarma a 100% slevy. Nevznikne platba, číslo platby, tržba v EET ani refundace.
- **Záporný účet** jde jen zrušit, což vyžaduje `discard`. Nevadí to, protože slevu, která ho do záporu dostala, přidal někdo s `discard` (krok 3, Oprávnění). Zrušený účet se jako prodej nepočítá.
- **Obrací se dnešní chování.** Test `payment-actions.test.ts:2830` („a bill with a zero line-item total is trivially paid once its zero-amount payment is confirmed“) a `docs/bill-payment-states.md` (odstavec „Priority 3 requires an active claim“ a řádek „paid“ v tabulce pokrytí, „a $0 claim for a fully-discounted bill“) dnes počítají s uzavřením účtu za 0 platbou za 0. Test se přepíše na `BillTotalNotPositive` a přibude test „Dokončit“; dokument se upraví a `payment/0012` i `payment/0013` na tu změnu odkážou. Testovací fixtures, které volají `createPayment` na účet bez řádků, je potřeba projít.
- **Mění se význam `confirmedClosedAt`.** Dnes ho nastavuje jen `confirmBillClosedDespiteCancellation` (vyřešení konfliktu „zrušený, ale zaplacený“). Nově znamená obecně „obsluha potvrdila uzavření účtu“ a má dva zdroje. Pravidlo „uzavření vyžaduje přiřazenou platbu“ se mění na „přiřazenou platbu, nebo výslovné potvrzení obsluhy“.
- **Mění se, kdy se zapisuje `closedAt`.** Dnes jen při přiřazení platby, nově i při zápisu do košíku, který účet doplatí (krok 2).
- Placený účet má součet zboží > 0, takže po rozpočítání slevy vyjde každá sazba DPH nezáporná. Na účtence ani v Qerko `taxInfo` nikdy není záporný řádek DPH.

## Kroky

Kroky jdou v tomto pořadí. Krok 1 je samostatná hodnota a jde vydat hned. Krok 2 opravuje chybu, která existuje už dnes; na kroku 1 nezávisí, jen oba upravují guardy v `bill-guards.ts`. Krok 3 potřebuje krok 2, protože sleva po částečné platbě je běžný postup. Uvnitř kroku 3 jde nejdřív čtení a výpočty se zápornými částkami, zadání slevy (formulář, CLI) až nakonec; to je pořadí práce a revizí, ne vydání.

### 1. Cena 0, pravidlo „platit jen > 0“ a dokončení účtu za 0
- **Parser:** nový parser ceny v `packages/core/src/modules/shared/money.ts` vedle `decimalAmountToMinorUnits`, který nulu povolí. `decimalAmountToMinorUnits` zůstane kladný pro klávesnici terminálu, spropitné, hotovost a výběry. `createPriceSchema` i `createPriceCodec` v `catalog-item-form-schema.ts` přejdou na nový parser. Schéma se nemění.
- **Pravidla ceny a sazby jako jedna čistá funkce** v `catalog-item-utils.ts`, třeba `validateCatalogItemPricing({ unitAmount, taxRateId, vatPayer })`. Vrací `Result` s chybou pro každé porušení. V tomto kroku jediné pravidlo: cena 0 bez sazby u plátce DPH → `ZeroPriceWithoutTaxRate`. Krok 3 do ní přidá pravidla slevy.

  Používá ji formulář (`parseCatalogItemForm`, s chybou u pole sazby nebo ceny), úprava přímo v poli (cena i sazba; uložit cenu 0, když položka nemá sazbu, nebo zrušit sazbu u položky za 0 nejde) a core v `catalog-item-actions.ts` při založení i úpravě. Core si `vatPayer` načte přes `legalEntityQuery`; CLI tak pravidlo dodrží taky.
  - Pravidlo platí v okamžiku uložení. Když se účet stane plátcem DPH později, existující položky za 0 bez sazby se nepřepisují; formulář je při další úpravě ceny nebo sazby zachytí.
- **Pravidlo jako čistá funkce:** `isBillPayable` v `bill-utils.ts`. Vstup je součet řádků účtu **bez řádků spropitného** a metoda platby; vrací `true`, když je částka po zaokrouhlení podle metody > 0 (u hotovosti `roundCashAmount`, jinak beze změny). Spropitné se nepočítá, aby spropitné nezvedlo nad nulu účet, jehož zboží je ≤ 0 (dnes jde přes CLI `add-tip`, `bill-actions.ts`). Používá ji core i obě UI, aby si pravidlo nesestavovaly každé samo.
- **Blokace v core:** chyba `BillTotalNotPositive` definovaná a vyhazovaná v `bill-guards.ts`.
  - `requireBillInStatus` (`bill-guards.ts`) bude vracet celý `BillStatusSnapshot` místo `{ bill, items }`. Jeho volající (`requireEditableBill`, `requireCancelableBill`, `requireBillAcceptingPayment`) čtou jen `bill` a `items`, takže změna je bezpečná. Krok 2 ze snapshotu čte i zaplacenou částku.
  - `requireBillAcceptingPayment` nejdřív ověří stav, pak `isBillPayable`. Dostane proto i metodu platby.
  - `createPayment` (`payment-actions.ts`) ji zdědí přes guard a přidá ji do `CreatePaymentError` (`payment-errors.ts`). Kontrola čte účet, ne `payment.amount`, které volí volající. `createPayment` je jediné místo, kde vzniká řádek platby, takže pravidlo platí pro všechny metody i pro CLI.
  - Pravidlo se vynucuje při vytvoření platby, ne později. Qerko `paymentStart` ani výsledky terminálu účet znovu nekontrolují; účet, který po vytvoření platby klesne na ≤ 0, skončí uzavřený a přeplacený, stejně jako dnes po odebrání položek. `payment/0012` to řekne výslovně.
  - CLI `payments update --billId` (`cli-payments.ts`) připojuje platbu k účtu přes `updatePayment` bez guardu. Buď guard doplnit, nebo připojení k účtu v CLI odmítnout.
  - Odmítnutí nuly u Lightningu (`ZeroAmountNotPayable` v `payment-preparation-actions.ts`) zůstane jako pojistka.
- **Dokončení účtu za 0:** nová akce `closeZeroBill` v `bill-actions.ts`.
  - Ověří, že účet jde upravovat (`requireEditableBill`, tedy otevřený a bez čekající platby), má aspoň jeden řádek po sečtení přidání a odebrání (`items.length > 0`, ne surové řádky `billLine`), součet zboží je přesně 0 a nemá žádný řádek spropitného. Jinak vrátí chybu (`BillNotZero` nebo stávající chyby guardu).
  - Jedním zápisem nastaví `closedAt` (přehled stolů a statistiky podle něj filtrují) a `confirmedClosedAt`.
  - `deriveBillStatus` se nemění: `confirmedClosedAt` už dnes má nejvyšší prioritu (`bill-utils.ts`), takže je uzavření konečné a účet se sám znovu neotevře. Starší verze aplikace pole znají a účet uvidí jako uzavřený.
  - Statistiky účet s `confirmedClosedAt` už dnes počítají jako prodaný (`sales-stats-queries.ts`, filtr uzavřených účtů).
  - Souběh dvou zařízení je neškodný: obě zapíšou stejná pole. Když jedno účet za 0 zruší a druhé dokončí, vyhraje dokončení (`confirmedClosedAt` má přednost před `canceledAt`) a konflikt se nehlásí; u účtu za 0 to nevadí.
  - CLI: `closeBill` (`bill-actions.ts`, `cli-bills.ts close`) je nástroj na opravu `closedAt` a účet bez platby dál odmítá. Pro účet za 0 může CLI nabídnout `closeZeroBill`.
- **Souběh s offline úpravou:** zařízení, které o uzavření ještě neví, může na účet přidat položku. Po synchronizaci je účet uzavřený a nedoplacený (součet > 0, nic přiřazeno).
  - Detail účtu to už dnes ukáže varováním, protože varování vychází z pokrytí (`bill-detail.tsx`, web i nativ).
  - `billHistoryIssueLabels` (`packages/app-shared/src/activity-history.ts`) dnes hlásí nedoplatek jen u účtu s přiřazenou platbou (`claimedSum > 0`). Přibude podmínka: nedoplatek se hlásí i u účtu s `confirmedClosedAt` bez `canceledAt`.
  - Obsluha chybějící položku namarkuje na nový účet. Statistiky položku započítají jako prodanou, stejně jako dnes u zaplaceného účtu, kterému se po platbě změnil součet.
- **Refundace:** řádky za 0 se v refundaci po položkách nenabízejí (`deriveRefundableLines` v `refund-utils.ts`), protože výběr jen jich končí chybou `RefundAmountInvalid`.
- **UI web i nativ:**
  - součet zboží přesně 0 (a aspoň jeden řádek): místo Charge tlačítko „Dokončit“, bez výběru metody a spropitného; oprávnění `sell`. Po dokončení UI přejde tam, kam po zaplacení;
  - u hotovosti, kde by zaokrouhlení dalo 0 (`isBillPayable` vrátí `false`), je zablokovaná jen hotovost;
  - překlady v en/cs/sk.
- **Dokumentace:** doc komentář `confirmedClosedAt` v `bill.ts` a `bill-utils.ts`; `docs/bill-payment-states.md` (nový zdroj `confirmedClosedAt`, pravidlo uzavření, souběh s offline úpravou, a pasáže uvedené v Důsledcích); přepsat test `payment-actions.test.ts:2830`.
- **Testy:**
  - parser a formulář s nulou;
  - plátce DPH nemůže uložit položku za 0 bez sazby (formulář, úprava v poli i core), neplátce ano;
  - účet za 0 nejde zaplatit žádnou metodou;
  - účet za 0,40 Kč nejde zaplatit hotově, kartou ano;
  - spropitné nezvedne nad nulu účet se zbožím za 0;
  - účet s položkou za 0 a kladným součtem zaplatit jde;
  - „Dokončit“ uzavře účet za 0: stav `closed`, `closedAt` nastavené, účet zmizí z přehledu stolů, zámek košíku platí, statistiky ho počítají;
  - „Dokončit“ odmítne prázdný účet, účet se součtem ≠ 0, účet s čekající platbou a účet se spropitným;
  - účet uzavřený „Dokončit“, na který jiné zařízení přidá položku, zůstane uzavřený a historie u něj hlásí nedoplatek;
  - refundace po položkách nenabízí řádek za 0.

### 2. Uzavření účtu, který zápis do košíku doplatí
Dnes se `closedAt` zapisuje jen při přiřazení platby (`loadBillClosedAtIfCovered` v `bill-guards.ts`, volané z `reconciliation-claim-actions.ts`). Účet 300, zaplaceno 200, pak obsluha odebere položku za 100 (po kroku 3 i přidá slevu −100): odvozený stav je uzavřený (pokrytí `paid`, přiřazená platba), ale `closedAt` zůstane prázdné. Účet tak visí na přehledu stolů (`openBillsQuery` filtruje `closedAt is null`) a nejde upravit, zaplatit ani zrušit, protože guardy čtou odvozený stav. Chyba existuje už dnes; se slevou se z ní stane běžný postup.

- **Pravidlo jako čistá funkce** v `bill-utils.ts`, třeba `deriveCartWriteClosing({ billTotalAfter, claimedSum, hasActiveClaim })`, vracející `"keep-open" | "close" | "reject"`:
  - bez přiřazené platby → `"keep-open"`;
  - součet po zápisu > zaplaceno → `"keep-open"`;
  - součet po zápisu = zaplaceno → `"close"`;
  - součet po zápisu < zaplaceno → `"reject"`. Uzavřený přeplacený účet by vracel peníze mimo refundaci; obsluha má jít přes refundaci.
- **Zápisy do košíku:** všechny akce za `requireEditableBill` (`addCatalogItemToBill`, `addManualAmountToBill`, `addTipToBill`, `appendRemoveBillLine`, `appendGuardedBillLines`, `splitBill`, `splitBillIntoNewBill`, u rozdělení zdroj i cíl).
  - `requireEditableBill` vrací snapshot se zaplacenou částkou (navazuje na změnu `requireBillInStatus` z kroku 1).
  - Součet po zápisu se počítá stejnou projekcí jako pokrytí: `items` ze snapshotu plus nové řádky přes `calculateBillLineSummaries`, ne vlastní aritmetikou. Spropitné se posuzuje stejně jako v `deriveBillCoverage`.
  - `"close"` zapíše `closedAt` ve stejné dávce jako řádky (`upsertBillClosedAt`); `"reject"` vrátí novou chybu `BillTotalBelowPaid` (`bill-guards.ts`).
  - Pravidlo je best-effort jako ostatní guardy: souběh dvou offline zařízení ho obejít může. `closedAt` zůstává cache a `cli bills close` ho dál umí opravit.
- **Účty, které už dnes visí** (odvozeně uzavřené, `closedAt` prázdné), opraví app migrace v `packages/core/src/migrations` (vlastní soubor, `appMigrations`), která jim zapíše `closedAt`. `hasWork` a `run` čtou stejný plán (doc komentář `Migration` v `migrations.ts`).
- **UI web i nativ:** chyba `BillTotalBelowPaid` se ukáže srozumitelnou hláškou (účet je částečně zaplacený, součet nemůže klesnout pod zaplacenou částku; vrácení peněz jde přes refundaci). Překlady v en/cs/sk.
- **Dokumentace:** doc komentář `closedAt` v `bill.ts` a u `loadBillClosedAtIfCovered`; `docs/bill-payment-states.md` (druhý zdroj `closedAt`, pravidlo odmítnutí).
- **Testy:**
  - odebrání položky, které částečně zaplacený účet doplatí, zapíše `closedAt` a účet zmizí z přehledu stolů;
  - zápis, který by součet stáhl pod zaplacenou částku, se odmítne; to samé u rozdělení zdroje;
  - účet bez přiřazené platby se chová jako dnes;
  - migrace zapíše `closedAt` visícímu účtu a ostatních se nedotkne.

### 3. Záporná cena (sleva)

#### Schéma a pravidla položky
- **Schéma:**
  - `unitAmount` u `catalogItem` a `item`, a `totalAmount` u `billLine` a `paymentLine`, z `NonNegativeIntegerSchema` na `IntegerSchema`;
  - nový sloupec `paymentLine.discountShare: Integer | null` (≤ 0), viz Zmrazení do platby;
  - znaménko nese částka a `billLine.kind` (`add`/`remove`) dál určuje jen směr. Zvláštní typ „sleva“ se nezavádí: sleva je `unitAmount < 0`;
  - id položky hashuje cenu, takže sleva dostane vlastní `item`;
  - `payment.amount` se nemění a zúžení nepotřebuje.
- **`validateCatalogItemPricing`** (krok 1) dostane pravidla slevy:
  - záporná cena se sazbou → `DiscountWithTaxRate`;
  - při úpravě změna znaménka ceny mezi zápornou a nezápornou → `CatalogItemPriceSignChange`. Funkce pro úpravu dostane i původní cenu; pravidlo „znaménko jen při založení“ tak drží core, ne jen formulář, a platí i pro CLI.
- **Sleva nemá sazbu DPH:** položka se zápornou cenou má vždy `taxRateId = null`. `null` ale dnes znamená i „bez DPH“ u neplátce. Sleva proto nesmí spadnout do skupiny „bez sazby“ v `calculateTaxRecap`; rozpočítání se řídí znaménkem řádku, ne `taxRateId`.

#### Rozpočítání slevy a DPH
- **Rozpočítání slevy:** jedna čistá funkce v core (`bill-line-tax-utils.ts` nebo vlastní `*-utils.ts`), která z řádků účtu nebo platby spočítá čistou částku každého řádku zboží.
  - Součet záporných řádků se rozdělí na kladné řádky zboží poměrně k jejich hrubé částce. Řádky spropitného se nepočítají; ruční částky a položky bez sazby ano, takže i skupina „bez DPH“ dostane svůj podíl.
  - Rozpočítává se **po řádcích**, ne po sazbách. Rekapitulace DPH (seskupení čistých řádků podle sazby) i refundace pak čtou stejná čísla a nerozejdou se o haléře.
  - Zaokrouhlení metodou největšího zbytku s pevným pořadím (podle id řádku), takže součet podílů přesně odpovídá slevě a výsledek je deterministický.
  - Pojistka: žádný řádek nesmí po rozpočítání vyjít záporný (u velmi malého řádku a slevy blízké celému součtu by zaokrouhlení mohlo dát −1 haléř).
  - Účet bez kladného zboží: sleva se nerozpočítá. Takový účet nejde zaplatit; rekapitulace DPH se u něj nezobrazí.
  - Funkce je zdokumentovaná jako pevný algoritmus. Změna by měnila rekapitulaci otevřených účtů a statistiky, ne zmrazené platby.
- **Rekapitulace DPH přes rozpočítání:**
  - `calculateTaxRecap` na detailu účtu a v košíku (web i nativ) počítá za běhu z čistých řádků;
  - detail platby a Qerko `taxInfo` (`payment-qerko-payment-utils.ts`, `payment-qerko-payment-actions.ts`) čtou zmrazené hodnoty z `paymentLine`;
  - `splitInclusiveAmount` (`tax-rate-utils.ts`) dostává jen nezáporné částky, symetrické zaokrouhlení pro záporná čísla tam není potřeba.
- **Zmrazení do platby:** `snapshotBillLinesForPayment` (`payment-line-actions.ts`) zapíše ke každému řádku zboží jeho `discountShare` z rozpočítání. Řádek slevy se uloží jako dnes (se zápornou `totalAmount`) kvůli zobrazení. Čistá částka řádku je `totalAmount + (discountShare ?? 0)`; staré platby mají `null` a chovají se jako dnes.
- **Statistiky prodejů:**
  - DPH ve statistikách (`salesTaxRecap`, `sales-stats-utils.ts`; seskupení podle sazby a částky přímo v SQL, `sales-stats-queries.ts`) se musí počítat z čistých řádků. Účty bez slevy zůstanou v SQL; řádky účtů se slevou se načtou po účtech a rozpočítají stejnou funkcí v JS. Rozpočítání v SQL (window funkce) se nedělá, protože by zaokrouhlilo jinak než detail;
  - u účtu, který se po platbě nezměnil, musí statistiky dát stejná čísla jako zmrazená platba. Test to ověří;
  - žebříček položek seskupí slevy zvlášť, místo aby je řadil jako položku se záporným obratem.

#### Záporné částky v projekcích a pojistky
- **Vstupy, které zůstanou nezáporné:** spropitné (`addTipToBill`) a ruční částka (`addManualAmountToBill`) berou typ z `InsertValues<typeof billLine>` a se změnou schématu by se rozšířily potichu taky. Jejich vstupní typy je potřeba výslovně zúžit zpět na `NonNegativeInteger`.
- **Volání, která na záporném čísle spadnou za běhu** (`tsc` je nenajde, `NonNegativeInteger` je `decode`):
  - `bill-actions.ts:292`: přidání položky do košíku;
  - `getBillLineSummaryUnitAmount` v `bill-line-utils.ts`: vykreslení řádků účtu (web i nativ), „odeber jednu“ i rozdělení;
  - `deriveSplitItems` v `packages/app-shared/src/split-selection.ts`;
  - záznam pro zpět/znovu v `use-cart-bill.ts` (web i nativ);
  - `sumBillRows` v `packages/app-shared/src/pos-overview.ts`;
  - DPH ve statistikách v `sales-stats-utils.ts`.

  Seznam je z recenze a není úplný. Součástí kroku je projít všechna `NonNegativeInteger(` nad částkou řádku nebo položky a převést je na `Integer`.
- **Ořezání:** zrušit `Math.max(0, …)` v `calculateBillLineSummaries` i `max(0, …)` v SQL `nettedBillLines` (`sales-stats-queries.ts`). `BillLineSummary.totalAmount` a `deriveBillSummaryTotal` budou vracet `Integer`. Komentář guardu rozdělení v `bill-guards.ts`, který se na ořezání odvolává, upravit.
- **Rozdíl mezi JS a SQL:** JS sčítání zahodí řádek a začne znovu, když jeho množství klesne na 0 (`bill-line-utils.ts`), SQL sčítá vše. Bez ořezání `max(0)` může rozdíl vyjít záporně. Test na odebrání a znovupřidání slevy, který obě sčítání porovná.
- **Zaokrouhlování:** jeden pomocník pro symetrické zaokrouhlení (od nuly) v `money.ts`. Použije se při výpočtu řádku z ceny a množství (`bill-actions.ts:292`) a v jednotkové ceně (`getBillLineSummaryUnitAmount`).
- **Zpět/znovu:** záznam pro „zpět“ v `use-cart-bill.ts` (web i nativ) se dnes počítá v UI z řádku katalogu (`unitAmount * quantity` bez zaokrouhlení). `addCatalogItemToBill` bude vracet částku, kterou skutečně zapsal, a UI zaznamená tu. Zaokrouhlení tak žije na jednom místě a „zpět“ po změně ceny odebere správnou částku.
- **Pokrytí:** `deriveBillCoverage` (`bill-utils.ts`) bude porovnávat zaplacené s `max(0, billTotal)`. Záporný účet bez přiřazené platby by jinak v historii, na detailu účtu i u platby vyšel jako přeplacený. Oprava na jednom místě v core místo podmínky ve čtyřech UI; stav účtu se nezmění, protože uzavření dál vyžaduje přiřazenou platbu. Pravidlo kroku 2 (`deriveCartWriteClosing`) slevu pod zaplacenou částku odmítne.
- **Signál zrušených účtů:** `signalsQuery` sčítá řádky zrušených účtů (`sales-stats-queries.ts`). Bez ořezání by se dal vynulovat: přidat slevu ve výši součtu a účet zrušit. Signál bude sčítat jen kladné skupiny (zahozené zboží), ne slevy.
- **Záporný účet jde jen zrušit:** `isBillPayable` (krok 1) ho už odmítá a „Dokončit“ ho nenabízí. UI (web i nativ) u něj Charge zablokuje s vysvětlením, že účet jde jen zrušit.
- **Rozdělení:** rozdělení, po kterém by kterýkoli neprázdný účet měl součet < 0, se odmítne, aby obsluha nezůstala se zbytkem, který jde jen zrušit. Zbytek přesně 0 je v pořádku, protože jde dokončit. `cancelSourceBillIfEmptied` (`bill-actions.ts`) dál ruší jen zcela vyprázdněný zdroj.

#### Oprávnění
Podle access/0010 vyžaduje `discard` každý zápis do košíku se `remove` řádkem, protože snižuje součet. Sleva je `add` řádek, který součet snižuje taky.
- `linesNeedDiscard` (`packages/app-shared/src/cart-lines.ts`) a `mayWrite` v `use-cart-bill.ts` (web i nativ) dostanou `Pick<CartLine, "kind" | "totalAmount">` a pravidlo zní `kind === "remove" || totalAmount < 0`.
- `addQuantity` (ťuknutí v mřížce i naskenování) dnes `mayWrite` nevolá. Bude ho volat před `ensureBillExists`. `removeFromCart` předá skutečné částky místo holého `{ kind: "remove" }`.
- **Souběh se změnou ceny:** core si řádek katalogu při přidání načte znovu (`bill-actions.ts`). `addCatalogItemToBill` dostane očekávané znaménko ceny a odmítne zápis, když se liší, aby kontrola v UI nad starými daty nepustila slevu bez `discard`.
- **Rozdělení:** výběr, který obsahuje záporný řádek, vyžaduje `discard`. Přesun slevy snižuje součet cílového účtu (`buildSplitLines` v `bill-actions.ts`).
- Nový access record (`access/0012`), který nahradí access/0010 a převezme jeho znění. Popis testu v `cart-lines.test.ts` („access/0002“) přejmenovat.

#### Refundace a Qerko
- **Refundace v core i UI:**
  - řádek se slevou se samostatně refundovat nedá; `deriveRefundableLines` (`refund-utils.ts`) ho nenabízí a `loadRefundLines` (`refund-actions.ts`) ho odmítne;
  - vrácený řádek zboží se refunduje za čistou částku (`totalAmount + discountShare`) poměrně k vrácenému množství: `calculateRefundLineAmount` (`refund-utils.ts`) přejde na čistou částku. Platí stejně v core (`loadRefundLines`, `loadGoodsRefundPlan`) i v `refund-form.ts`;
  - `loadGoodsRefundPlan` odmítne součet `<= 0` místo dnešního `=== 0`. Kryje i Switchio a Qerko refundace, které ho skládají;
  - refundace částkou zůstává beze změny, protože je omezená tím, co platba vybrala.
- **Qerko:** do Qerka jde jen jeden řádek „Platba #N“ s částkou platby (`payment-qerko-payment-utils.ts`, qerko/0009), takže sleva samotná ani `denyDiscounts` nevadí. `taxInfo` se počítá ze zmrazených čistých řádků platby a každá sazba v něm je nezáporná.

#### Zadání slevy
- **Formulář:** přepínač „Sleva“, který obrátí znaménko, protože klávesnice s `inputMode="decimal"` na Androidu nemá mínus.
  - Jen při založení položky, ve formuláři katalogu i v dialogu pro založení položky z účtu (`create-catalog-item-dialog.tsx`, web i nativ). U existující položky se znaménko změnit nedá.
  - Při zapnutém přepínači se skryje výběr sazby DPH a uloží se `taxRateId = null`. Krátká nápověda: sleva se rozpočítá poměrně na zboží účtu.
  - Při zapnutém přepínači je částka 0 neplatná (chyba u pole ceny). Bez přepínače je 0 platná, u plátce DPH jen se sazbou (krok 1).
  - Web i nativ, s položkou v `ui-parity`.
- **CLI** (`apps/cli/src/cli-catalog-items.ts`): `unitAmount` u založení i úpravy přejde z `NonNegativeIntegerFromStringSchema` na `IntegerFromStringSchema` (už existuje v `packages/core/src/modules/shared/schema.ts`). Záporná částka založí slevu. Pravidla hlídá `validateCatalogItemPricing` v core, takže CLI dostane stejné chyby jako formulář: slevu se sazbou DPH, položku za 0 bez sazby u plátce a změnu znaménka při úpravě odmítne. Nápověda příkazu zmíní, že záporná cena znamená slevu.
- **Zobrazení:** slevový řádek s mínusem v košíku, na detailu účtu a na detailu platby, bez sazby DPH. Statistiky prodejů seskupí slevy zvlášť, místo aby je řadily jako položku se záporným obratem.
- **Slovník pojmů:** do `docs/glossary.md` přidat „sleva“ (položka se zápornou cenou, bez sazby DPH, rozpočítaná poměrně na zboží) a odlišit ji od procentní slevy na účet.

#### Starší verze
Evolu při synchronizaci kontroluje jen tabulku a sloupec, ne hodnotu. Nový sloupec `discountShare` starší klient ignoruje (Evolu ho odloží stranou), záporný řádek ale uloží a pak:
- spadne na detailu platby a na Qerko účtence (Qerko pak platbu zruší);
- zapíše „odeber jednu“ jako `remove(1, 0)`;
- při rozdělení slevu ztratí;
- účtuje součet bez slevy;
- nezná rozpočítání, takže by slevu zařadil do skupiny „bez DPH“ a nezmrazil by `discountShare`.

Ochrana se nedělá (žádná podmínka na verzi zařízení). `catalog/0002` to zapíše jako vědomě přijaté riziko.

#### Testy
- rozpočítání: více sazeb, položky bez sazby, spropitné vyloučené, zaokrouhlení největším zbytkem, žádný řádek záporný, determinismus pořadí;
- rekapitulace DPH účtu se slevou nemá řádek slevy ani zápornou sazbu;
- zmrazení `discountShare` při platbě a jeho čtení na detailu platby a v Qerko `taxInfo`;
- statistiky dávají u nezměněného účtu stejná čísla jako zmrazená platba;
- položku se zápornou cenou a sazbou DPH nejde uložit; core odmítne úpravu, která mění znaménko ceny;
- formulář: sleva s částkou 0 je neplatná, přepínač jen při založení, CLI se zápornou částkou založí slevu;
- projekce s odebíráním a znovupřidáváním slevy;
- záporný účet bez platby není přeplacený a nejde zaplatit žádnou metodou;
- spropitné nezvedne nad nulu účet se zbožím < 0;
- sleva přidaná ťuknutím, skenem, přes zpět/znovu i rozdělením vyžaduje `discard`;
- core odmítne přidání, když se znaménko ceny mezitím změnilo;
- rozdělení se slevou; rozdělení, které nechá neprázdný účet se zápornou částkou, se odmítne, se zbytkem přesně 0 projde;
- sleva po částečné platbě, která účet doplatí, ho uzavře; sleva pod zaplacenou částku se odmítne;
- signál zrušených účtů nejde slevou vynulovat;
- refundace řádku zboží z platby se slevou vrátí čistou částku; řádek slevy nejde refundovat;
- žádné spadnutí ve vykreslení řádků, statistik a Qerko účtenky.

## Decision records
- Doménu `catalog` zapsat do seznamu v `docs/decisions/README.md`, jinak neprojde `check:decisions`.
- Krok 1:
  - `catalog/0001`: cena položky může být 0; u plátce DPH musí mít položka za 0 sazbu DPH.
  - `payment/0012`: platbu jde vytvořit jen při částce k úhradě po zaokrouhlení podle metody > 0, bez spropitného; pravidlo se vynucuje při vytvoření platby; odkazuje na změnu `bill-payment-states.md`.
  - `payment/0013`: účet se součtem přesně 0 a aspoň jedním řádkem obsluha uzavře „Dokončit“ (`sell`) přes `confirmedClosedAt`, bez platby; uzavření je konečné; souběh s offline úpravou se přijímá a hlásí jako nedoplatek. Odkazuje na změnu `bill-payment-states.md`.
- Krok 2:
  - `payment/0014`: zápis do košíku, který účet s přiřazenou platbou doplatí, zapíše `closedAt`; zápis, který by součet stáhl pod zaplacenou částku, se odmítne. Odkazuje na změnu `bill-payment-states.md`.
- Krok 3:
  - `catalog/0002`: cena položky může být záporná (sleva); sleva nesmí mít částku 0; znaménko jde nastavit jen při založení (hlídá core); sleva nemá sazbu DPH; CLI zápornou cenu přijímá jako slevu; přijaté riziko zařízení se starší verzí aplikace.
  - `catalog/0003`: sleva se rozpočítává poměrně na řádky zboží (bez spropitného) metodou největšího zbytku; DPH se počítá z čistých řádků; rozpočítání se při platbě zmrazí do `paymentLine.discountShare`.
  - `payment/0015`: účet se zápornou částkou jde jen zrušit; rozdělení nesmí nechat neprázdný účet se zápornou částkou.
  - `access/0012`: nahradí access/0010 a převezme jeho znění; řádek se zápornou částkou (přidaný, odebraný i přesunutý rozdělením) vyžaduje `discard`.
  - `refund/0014`: nahradí refund/0002 a převezme jeho znění (`check:decisions` nahrazené recordy nekontroluje); doplní, že řádek zboží se refunduje za čistou částku po rozpočítané slevě a řádek slevy samostatně refundovat nejde. refund/0002 dostane `Status: superseded by refund/0014`.

Každý record jmenuje testy, které ho drží, pod `## Enforced by`.

## Mimo rozsah
- Procentní sleva na celý účet: úprava účtu, ne položka, a jiný model.
- Položka s cenou zadávanou až při prodeji: nulová cena ji nenahrazuje.
