# Přenos účtu z Payky do Finita přes Android intent

## Kontext

Finito (`apps/native-app`, `fit.finito.app`) a Payky (`apps/native-shell`, Capacitor, `me.payky`) sdílí jeden účet (brand/0001). Kdo má Payky na stejném telefonu, dnes musí do Finita přepsat 20 slov, nebo projít QR přenosem (account/0001), který potřebuje dvě zařízení a Nostr relay. Nová cesta vede přímo app-to-app na jednom telefonu.

Cílový tok:

1. Finito vygeneruje kontrolní kód (6 číslic) a jednorázové `requestId`, ukáže kód a otevře Payky intentem `startActivityForResult`.
2. Payky ukáže schvalovací obrazovku: kdo žádá (jméno a ikona aplikace podle Androidu, plus jméno, které o sobě aplikace tvrdí v intentu), kód a jméno účtu, který odejde.
3. Payky vrátí buď schválení s účtem, nebo odmítnutí.
4. Finito účet přidá (stejně jako po QR přenosu) a pokračuje na `/restore-account`.

Rozhodnutí od uživatele:

- **Žádné ověřování podpisu APK ani allowlist balíčku.** Požádat smí jakákoliv aplikace. Riziko podvržené aplikace nese uživatel.
- **Schvalovací obrazovka ukazuje kód i skutečného volajícího**, toho, kterého hlásí Android (`getCallingPackage()`). Jméno z extras intentu je jen tvrzení žadatele.
- **Posílá se aktivní účet Payky**, stejně jako u QR přenosu. Kdo chce poslat jiný, nejdřív v Payky přepne účet.
- **Vstup ve Finitu je v onboardingu (Restore) i v Settings → Accounts**, vedle „Přenést z jiného zařízení".

## Bezpečnostní analýza

### Co skutečně chrání seed

- **Výsledek `startActivityForResult` dostane jen volající aktivita.** Systém ho předává přes binder přímo volajícímu, nejde přes broadcast a jiná aplikace ho nepřečte. Logcat (`ActivityTaskManager: START u0 {… (has extras)}`) obsah extras nevypisuje.
- **`getCallingPackage()` nastavuje systém a podvrhnout ho nejde.** Je ale nenulové jen při spuštění „for result", takže intent bez for-result Payky zahodí. Volající aplikace je pro Payky viditelná automaticky (pravidla package visibility, Android 11+, výslovně zahrnují aplikaci, která spustila naši aktivitu přes `startActivityForResult`), takže `PackageManager` vrátí její label a ikonu bez `<queries>`.
- **Souhlas uživatele v Payky** a, je-li zapnutá správa přístupu, **PIN s oprávněním `admin`** (access/0002: přenos účtu je `admin`). Bez správy přístupu účet vydá kdokoliv, kdo drží odemčený telefon. To je stejný důsledek jako u account/0001.

### Co kód (6 číslic) nedělá

- **Proti podvržené aplikaci nechrání.** Žadatel kód sám generuje a ukazuje na své obrazovce, takže se shoduje vždy. Uživatelova volba „Any app" znamená, že reálnou ochranou proti podvrhu je jen to, že si uživatel přečte jméno a ikonu skutečného volajícího.
- **Chrání proti záměně.** Váže obrazovku Payky na žádost, kterou uživatel právě spustil ve Finitu. Když jiná aplikace na pozadí ve stejnou chvíli vystřelí vlastní žádost, kód nesouhlasí (Finito ho ukázal před otevřením Payky).
- **Porovnání kliknutím account/0001 zamítlo** („a click proves nothing about looking"). Tady je to přijatelné, protože kód je jen pomůcka proti záměně a hlavní kontrolou je identita volajícího. Nové rozhodnutí to musí výslovně říct (viz Rozhodnutí).

### Další hrozby a opatření

| Hrozba | Opatření |
|---|---|
| Podvržená aplikace se představí jako „Finito" v extras | Payky ukazuje label a ikonu podle `getCallingPackage()`. Tvrzené jméno je vedle, označené jako tvrzení. Nesouhlasí-li, ukáže se varování. Ani shoda nic nezaručuje (label si aplikace volí sama), proto se ukazuje i název balíčku. |
| Tapjacking: overlay přes tlačítko „Schválit" | Po dobu schvalovací obrazovky `Window.setHideOverlayWindows(true)` (API 31+, normální oprávnění `HIDE_OVERLAY_WINDOWS`). Na starších verzích `setFilterTouchesWhenObscured(true)` na WebView. |
| Intent bez for-result (`startActivity`), takže chybí `callingPackage` | Trampolína ho tiše ukončí, žádná obrazovka se nezobrazí. |
| Dvě žádosti zároveň | Platí jedna čekající žádost. Druhá zruší první (`busy` pro obě strany), obdobně jako `conflict` v account/0001. |
| Stará nebo opakovaná odpověď | Payky v odpovědi vrací `requestId`. Finito přijme jen odpověď na svou poslední žádost a schéma ověří zodem. |
| Žádost visí v Payky donekonečna | Expirace 2 minuty od přijetí. Odchod ze schvalovací obrazovky, přepnutí účtu nebo zámek PINem znamená odmítnutí. |
| Únik seedu přes logy nebo Sentry | Payload se nikdy neloguje (`run.deps.console` ani breadcrumb). Do Sentry jde jen typ chyby. Sentry scrubber už maskuje recovery phrase, ale nespoléhá se na něj. |
| Finito zabije Android, zatímco je Payky vpředu | Výsledek se neperzistuje (záměrně jinak než `SwitchioResultStore`): seed se nesmí ocitnout na disku mimo device DB. Uživatel prostě začne znovu. |
| Payky zabije Android během čekání | Trampolína ve Finitově tasku skončí s `RESULT_CANCELED`, Finito ukáže „zkus znovu". |
| Demo účet v Payky | Odmítne se s `demo`. Demo účet nikdy nesynchronizuje (demo-data/0001) a jeho přenos nemá smysl. |
| Payky bez účtu nebo s neonboardovaným účtem | Odmítne se s `noAccount`. |

**Šifrování payloadu** (NIP-44 na efemérní klíč Finita) **nepřidáváme.** Kanálem je for-result binder jen k volajícímu, takže šifrování nezavírá žádnou hrozbu: podvržený žadatel by klíč vygeneroval sám. Kdyby se později přešlo na tok bez for-result (dva explicitní intenty), šifrování by bylo nutné.

## Protokol (v1)

Sdílený popis v `packages/core/src/integrations/payky-app/account-share-protocol.ts` (nová složka v `integrations/`: „služba" je druhá aplikace). Konstanty se zrcadlí v Javě (Payky) a Kotlinu (Finito). Test hlídá, že řetězce v nativních zdrojích odpovídají TS konstantám.

**Žádost** (Finito → Payky): explicitní intent `setPackage("me.payky")`, akce `me.payky.action.SHARE_ACCOUNT`, extras:

- `v`: `1`
- `requestId`: 32 hex znaků (16 náhodných bajtů)
- `code`: 6 číslic, rovnoměrně (rejection sampling nad `crypto.getRandomValues`)
- `requesterName`: string do 64 znaků, jen pro zobrazení jako tvrzení

**Odpověď** (Payky → Finito) přes `setResult`:

- `RESULT_OK` + extra `account`: JSON `{ v: 1, requestId, payload: TransferPayload }`. `TransferPayload` se znovu použije z `nostr-account-transfer.ts` (masterKey, accountName, transports), takže Finito přidává účet stejnou cestou jako po QR přenosu.
- `RESULT_CANCELED` + volitelný extra `error`: `rejected | busy | expired | noAccount | demo | unsupportedVersion | invalidRequest`. Chybějící `error` (systémové zrušení, pád procesu) se čte jako `cancelled`.

Čtení a zápis JSON přes `jsonCodec(schema)` (zod-utils), funkce `parseShareRequest` a `parseShareResult(raw, requestId)` vrací `Result`.

## Implementace

### 0. Spike: chování `singleTask` při for-result (nejdřív)

Capacitor `MainActivity` je `singleTask`. Při `startActivityForResult` na `singleTask` aktivitu z cizího tasku Android (podle AOSP `ActivityStarter`) přidá `FLAG_ACTIVITY_NEW_TASK` a volajícímu hned pošle `RESULT_CANCELED`. Ověřit na zařízení (Android 10 a 14), protože to rozhoduje o architektuře:

- Očekávání: přímé volání `MainActivity` for-result nefunguje, takže je potřeba **trampolína** (krok 1).
- Ve spiku zároveň ověřit návrat do Finita po `moveTaskToBack(true)` a chování při zabití procesu Payky.

Druhou `BridgeActivity` (druhé WebView v tasku Finita) **nepoužívat**: dvě instance Evolu nad stejným úložištěm v jednom procesu nemají skutečné vzájemné vyloučení (`android-webview-locks.ts` zámek jen předstírá).

### 1. Payky: Android (`apps/native-shell/android`)

Tyto soubory se při `cap:sync` nepřepisují.

- **`AccountShareActivity.java`**: exportovaná, `launchMode="standard"` (běží v tasku volajícího), průhledné téma bez UI, `excludeFromRecents`, intent-filter na `me.payky.action.SHARE_ACCOUNT` + `DEFAULT`. V `onCreate`:
  - `getCallingPackage()`; když je `null`, `finish()`.
  - Validuje `v` a tvar extras. Při chybě `setResult(CANCELED, error)` a konec.
  - Zjistí label a ikonu volajícího (ikona jako PNG data URI, malá) a zaregistruje žádost do `AccountShareRequests`.
  - Spustí `MainActivity` s interním extra (`REORDER_TO_FRONT`) a zůstane čekat.
- **`AccountShareRequests.java`**: singleton v procesu, drží nejvýš jednu čekající žádost (`requestId`, kód, tvrzené jméno, skutečný balíček, label, ikona, čas přijetí) a slabý odkaz na trampolínu. Nová žádost zruší starou s `busy`. Po 2 minutách `expired`.
- **`AccountSharePlugin.java`** (registrovat v `MainActivity.onCreate`):
  - `getPendingRequest()`
  - event `accountShareRequest` (při `handleOnNewIntent` i při startu)
  - `respond({ requestId, approved, account?, error? })`: trampolíně předá výsledek, ta zavolá `setResult` a `finish()`, `MainActivity.moveTaskToBack(true)` vrátí uživatele do Finita
  - `setOverlayProtection(enabled)`: overlay a tapjacking ochrana
- **`AndroidManifest.xml`**: aktivita, `HIDE_OVERLAY_WINDOWS`.

### 2. Payky: web vrstva (`apps/web-app`)

- **`src/platform/account-share.ts`**: obal pluginu jako `switchio.ts`. Mimo `Capacitor.isNativePlatform()` nic nedělá.
- **`src/components/app/account-share-request-host.tsx`**: singleton (mountuje `App.tsx`, vedle `switchio-restored-result.tsx`). Poslouchá event a `getPendingRequest()` po startu a naviguje na schvalovací route.
  - Bez účtu nebo neonboardovaný účet: `respond(noAccount)`.
  - Demo účet: `respond(demo)`.
- **Route** `_terminal.settings.accounts_.share.tsx`: `staticData.access: "admin"`, bez `loader`. PIN tedy řeší access gate (access/0003). Tenká route, která renderuje `AccountSharePage`.
- **`src/features/settings/account-share-page.tsx`**:
  - Ukáže ikonu a jméno volajícího podle Androidu a název balíčku.
  - Ukáže tvrzené jméno; když se liší od labelu, přidá varování.
  - Velký kód (`formatTransferCode`), jméno aktivního účtu a varování (destructive alert): „Schválením dáš této aplikaci plný přístup k účtu a jeho penězům."
  - Tlačítka Schválit a Odmítnout.
  - Odchod ze stránky, přepnutí účtu nebo expirace znamená `rejected`/`expired`. Po dobu stránky `setOverlayProtection(true)`.
- **Sestavení payloadu** vytáhnout z `account-transfer-source-page.tsx` do `packages/core` (`createTransferPayload(account)` vedle `TransferPayload`), aby QR přenos i intent posílaly totéž.

### 3. Finito: Android modul (`apps/native-app/modules/payky-account-request`)

Expo modul v Kotlinu, po vzoru `payky-switchio`, ale **bez** result store a config pluginu pro zachycení výsledku:

- `canRequestAccount()`: zjistí, jestli **nainstalovaná verze** Payky umí tento intent, ne jen jestli je Payky nainstalované.
  - Finito sestaví přesně ten intent, který by poslalo (akce `me.payky.action.SHARE_ACCOUNT`, `setPackage("me.payky")`), a zavolá `PackageManager.resolveActivity`.
  - Starší Payky bez `AccountShareActivity` i chybějící Payky vrátí `null`, tedy `false`.
  - Payky se nespouští, uživatel nic nevidí.
- Package visibility (Android 11+): do `AndroidManifest.xml` modulu přidat `<queries><package android:name="me.payky" /></queries>`. Bez toho by detekce vracela `false` i pro Payky, které intent umí.
- Verze protokolu se pro v1 nedetekuje, stačí existence aktivity. Až bude v2, Payky přidá k aktivitě `<meta-data android:name="me.payky.SHARE_ACCOUNT_VERSION" />` a `canRequestAccount` ji přečte (`GET_META_DATA`). `versionCode` Payky se nepoužívá, protože by svázal Finito s číslováním vydání Payky.
- `requestAccount({ requestId, code, requesterName })`: `startActivityForResult` přes Expo `OnActivityResult` a vrací `{ resultCode, account: string | null, error: string | null }`. `ActivityNotFoundException` znamená `notInstalled`.
- Interní název `payky` v identifikátorech je v pořádku (brand/0001). Viditelné texty ne, viz Překlady.

### 4. Finito: UI (`apps/native-app/src`)

- **`features/shared/account-from-payky.tsx`**, komponenta po vzoru `AccountTransferTarget` s fázemi:
  - `intro`: vysvětlení a tlačítko „Otevřít {sourceApp}"
  - `waiting`: velký kód, „Zkontroluj, že {sourceApp} ukazuje stejný kód"
  - `adding`
  - `failed`: chyba podle `error`, mapovaná lookup objektem `satisfies Record<…, TranslationKey>`, a tlačítko „Zkusit znovu"
  
  Kód se ukáže **před** otevřením Payky, aby se dal porovnat.
- **Přidání účtu** vytáhnout z `account-transfer-target.tsx` do sdíleného hooku `features/shared/use-add-transferred-account.ts`:
  - kontrola `stale`
  - `confirmBeforeAdding` + `require("admin", …)`
  - `createOrSelectAccount`
  - `restoredAccountAtom`, `reloadAppEvolu`, toast a `router.replace("/restore-account")`
  
  Použijí ho obě komponenty.
- **Přenos z Payky se nabízí jen tehdy, když ho Finito detekuje.** Nikde se neukazuje vypnuté tlačítko ani výzva „nainstaluj nebo aktualizuj Payky". Bez detekce obrazovky vypadají jako dnes.
  - Hook `features/shared/use-can-request-account-from-payky.ts`: `useQuery` (stabilní `queryKey`, `enabled: Platform.OS === "android"`) nad `canRequestAccount()`.
  - Detekce se opakuje při návratu aplikace do popředí (`AppState` → `active`, `queryClient.invalidateQueries`), takže tlačítko se objeví, když uživatel mezitím Payky nainstaluje nebo aktualizuje, a zmizí, když ho odinstaluje.
  - Na webu (PWA) a iOS je výsledek vždy `false`.
  - Kdyby detekce prošla a spuštění pak selhalo (Payky odinstalované mezi detekcí a kliknutím), `ActivityNotFoundException` znamená `notInstalled`: chyba v komponentě a nová detekce, která tlačítko skryje.
- **Onboarding**: nový krok `fromPayky` v `OnboardingStep` (`packages/app-shared/src/onboarding-form-state.ts`) a nový `OnboardingAccountType`. Web musí doplnit své `Record<OnboardingStep, …>` (nebo krok na webu vůbec nevzniká; ověřit při implementaci).
  - V `onboarding-page.tsx` sekundární tlačítko pod „Přenést z jiného zařízení", jen když detekce vrátí `true`.
  - `goBack` z `fromPayky` vede na `restore`.
  - Kdyby detekce během kroku `fromPayky` přestala platit (odinstalace na pozadí), krok zůstane otevřený a selže až při spuštění s `notInstalled`. Nepřepínat krok uživateli pod rukama.
- **Settings → Accounts** (`features/settings/accounts/accounts-settings-page.tsx`): stejná položka vedle přenosu, jen když detekce vrátí `true`, za `require("admin", …)` a s `confirmBeforeAdding`.
- **`src/ui-parity/ui-parity-map.ts`**: nová obrazovka je jen v nativu. Zapsat záznam, a u onboardingu a accounts do `allowedDifferences` doplnit důvod („web has no app-to-app source").

### 5. Překlady (`packages/app-shared/src/i18n`)

- **Payky** (`accountShare.*` v `settings.ts`): titulek, „{caller} žádá o přenos účtu", „Aplikace o sobě tvrdí, že je {claimed}", varování při neshodě, kód, účet, varování o plném přístupu, Schválit, Odmítnout, expirace.
- **Finito** (`accountFromPayky.*` v `onboarding.ts`): tlačítko, úvod, „Otevřít {sourceApp}", čekání a porovnání kódu, chyby (`rejected`, `busy`, `expired`, `noAccount`, `demo`, `notInstalled`, `cancelled`, `invalid`).
- **Jméno druhé aplikace** jde jako parametr `{sourceApp}` vyplněný z `brandName(paykyBrand)` (`packages/app-shared/src/brand.ts`), nikdy literálem. `app-brand.test.ts` tak projde, ale **Finito tím poprvé vědomě ukazuje slovo Payky**. To vyžaduje rozhodnutí (níže). Na straně Payky se jméno volajícího bere z Androidu, žádný literál „Finito".
- Doplnit `cs` a `sk`. Aktualizovat `brand-copy/finito.*.txt` (`vitest -u`) a přečíst diff.

### 6. Rozhodnutí (`docs/decisions/`)

- **`account/0008-an-account-moves-from-payky-to-finito-by-an-approved-app-request.md`**:
  - Payky vydá aktivní účet jen na `startActivityForResult` žádost, kterou uživatel schválil (s `admin`, je-li správa přístupu zapnutá). Ukazuje skutečného volajícího podle Androidu, nepodepisuje ani neověřuje certifikát a nemá allowlist.
  - Kód je pomůcka proti záměně, ne autentizace. Výslovně vysvětlit odchylku od account/0001, kde porovnání kliknutím bylo zamítnuto.
  - Důsledek: podvržená aplikace, kterou uživatel schválí, dostane účet.
  - Alternativy: QR přenos na jednom zařízení; allowlist balíčku; pinning certifikátu; NIP-44 šifrování; dva explicitní intenty místo for-result.
- **`brand/0002-finito-names-payky-as-the-source-of-a-transfer.md`**: zúžení brand/0001. Finito smí jméno Payky ukázat jen jako jméno zdrojové aplikace přenosu, přes `brandName(paykyBrand)`. Ověřit, jestli `app-brand.test.ts` potřebuje úpravu popisu.
- **`Enforced by`**: testy z kroku 7. Ověří `bun run check:decisions`.

### 7. Testy

- **`account-share-protocol.test.ts`**:
  - round-trip žádosti a odpovědi
  - odpověď s cizím `requestId` je chyba
  - neplatný JSON nebo neznámá verze je chyba, ne výjimka
  - `error` se mapuje na všechny důvody, chybějící znamená `cancelled`
  - kód má 6 číslic a jeho rozdělení je rovnoměrné (rejection sampling)
- **`createTransferPayload`**: test přesunutý z QR přenosu (deduplikace a limit relays).
- **Test parity konstant**: akce, názvy extras a chybové kódy v `AccountShareActivity.java` a v Kotlin modulu odpovídají TS (čte zdroje jako `app-brand.test.ts`).
- **Web unit, host**:
  - Žádost na demo účtu nebo bez účtu odpoví bez otevření stránky.
  - Odchod ze stránky odpoví `rejected`.
- **Native unit**: `use-add-transferred-account` (stávající chování QR přenosu se nemění) a mapování chyb v `account-from-payky.tsx`.
- **Native unit, detekce**:
  - Onboarding (krok Restore) a Settings → Accounts tlačítko neukazují, když `canRequestAccount()` vrátí `false`, a ukazují, když vrátí `true` (modul je ve testu fake).
  - Mimo Android se modul nevolá.
  - `notInstalled` při spuštění zneplatní detekci.
- **Ruční test detekce**: Finito se starším Payky (bez aktivity) tlačítko neukáže. Po aktualizaci Payky a návratu do Finita se tlačítko objeví bez restartu.
- **E2E**: Playwright nepokryje intent. Do `e2e-test-bridge.tsx` přidat simulaci žádosti, aby šla otestovat schvalovací obrazovka (schválení, odmítnutí, PIN `admin`). Ve Finitu přes Maestro web export tlačítko není (jen Android), takže stačí unit. Ruční test na zařízení s oběma APK je součástí akceptace.
- Na konci `bun run check`.

## Pořadí práce

1. Spike (krok 0) a podle výsledku potvrdit trampolínu.
2. Protokol v `packages/core` + `createTransferPayload` + testy.
3. Payky: Android trampolína a plugin, web host, route, stránka, překlady.
4. Finito: Expo modul, sdílený hook, komponenta, onboarding a Settings, parity map, překlady.
5. Rozhodnutí account/0008 a brand/0002, `bun run check`, ruční test na telefonu (Android 10 a 14, se zapnutou i vypnutou správou přístupu, zabití obou procesů uprostřed).

## Rizika a otevřené body

- **Výsledek spiku `singleTask`.** Kdyby for-result do `MainActivity` fungoval, trampolína odpadá a tok se zjednoduší.
- **Návrat do Finita po `moveTaskToBack`.** Na některých launcherech se uživatel může vrátit jinam. Fallback: Finito v `waiting` nabídne „Vrátil ses? Zkus znovu".
- **Payky běží na PIN obrazovce nebo uprostřed platby.** Žádost počká, dokud gate nepustí na route. Expirace (2 min) zabrání tomu, aby visela věčně. Uprostřed platby (Switchio for-result) se Payky neotevírá na schvalovací stránku, dokud platba neskončí. Ověřit chování navigace.
- **Pouze Android.** PWA Finita ani iOS tlačítko neukazují (detekce tam vrací `false`).
- **Detekce dokazuje jen, že balíček `me.payky` deklaruje aktivitu s touto akcí.** Neověřuje, že je to opravdu Payky (bez kontroly certifikátu, podle rozhodnutí bez allowlistu). Pro nabídku tlačítka to stačí. Vydaný účet chrání až schválení v Payky.
- **Objevitelnost.** Kdo má staré Payky, o nové cestě se ve Finitu nedozví. To je záměr (nabízí se jen, co funguje). Případné upozornění „aktualizuj Payky" je mimo tento plán.
