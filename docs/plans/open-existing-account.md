# Otevření existujícího účtu: jeden rozcestník pro onboarding i Settings

## Kontext

Finito dnes nabízí čtyři cesty k účtu a na každém místě je skládá jinak:

- **Onboarding**: uvítací obrazovka → „Obnovit existující účet" → stránka, která rovnou ukazuje formulář na 20 slov a pod ním sekundární tlačítka „Přenést z jiného zařízení" a (jen když ho detekce najde) „Přenést z Payky" (account/0008).
- **Settings → Accounts**: sekce „Přidat účet" má čtyři položky vedle sebe. „Založit nový účet" je potvrzovací dialog, „Obnovit existující účet" rozbalí inline frázi, „Přenést z jiného zařízení" otevře route `/pair` a „Přenést z Payky" rozbalí inline `AccountFromPayky`.

Nejpracnější a nejrizikovější cesta, opisování 20 slov, je tak v onboardingu první, co uživatel vidí. Navíc se dvě úrovně rozhodnutí míchají dohromady: „nový, nebo existující" a „odkud existující".

## Cíl

Uživatel nejdřív vybere, **odkud** účet vezme, a teprve pak dělá samotný úkon. Rozcestník vypadá a chová se stejně v onboardingu i v Settings. Nabídka je seřazená od nejsnazšího k nejpracnějšímu:

1. **Z aplikace Payky v tomto telefonu.** Bez opisování, stačí schválit. Zobrazí se jen tehdy, když detekce Payky najde. Žádný štítek: nejsnazší cestu ukazuje pořadí.
2. **Z jiného zařízení.** QR kód a opsání kódu (account/0001).
3. **Obnovovací fráze (20 slov).** Až když nemáte po ruce jiné zařízení.

## UX

### Rozcestník

```
←

Otevřít existující účet
Vyberte, kde účet teď máte.

┌───────────────────────────────────────┐
│ 📱  Z aplikace Payky v tomto telefonu │
│     Bez opisování, stačí schválit.    │
├───────────────────────────────────────┤
│ ⊞   Z jiného zařízení                 │
│     Naskenujete QR kód a opíšete kód. │
├───────────────────────────────────────┤
│ 🔑  Obnovovací fráze (20 slov)        │
│     Když nemáte po ruce jiné zařízení.│
└───────────────────────────────────────┘
```

- Řádky jsou `VerticalNav` (celý řádek je klikací), stejné jako jinde v Settings.
- Bez Payky má rozcestník dvě položky. Nic nezešedne a nic neříká „nainstalujte Payky" (account/0008).
- Popisy říkají, co uživatele čeká, ne jak to funguje.
- Když detekce přestane platit, dokud je uživatel na rozcestníku, řádek Payky zmizí. Uživatel ho ještě nevybral, takže mu nic nemizí pod rukama. Uvnitř kroku `fromPayky` platí dál, že krok zůstane otevřený a selže až s `notInstalled`.

### Kroky po výběru

| Volba | Obsah | Zpět |
|---|---|---|
| Payky | `AccountFromPayky` | rozcestník |
| Jiné zařízení | `AccountTransferTarget` | rozcestník |
| Fráze | `RestoreAccountStep` | rozcestník |

- Každý krok má vlastní nadpis a popis (dnešní `headingKeys`/`descriptionKeys`).
- Odkaz „Nejde to naskenovat? Obnovte účet obnovovací frází" ve skeneru vede rovnou na krok s frází, ne zpět na rozcestník.
- Selhání („Zkusit znovu", „Skenovat znovu") zůstává uvnitř kroku. Jinou cestu nabízí šipka zpět.
- Návrat z restore-sync („zkusit jinou frázi", relay nemá data) vede na krok s frází.

### Uvítací obrazovka onboardingu

- „Obnovit existující účet" → **„Už mám účet"**. „Obnovit" zní jako oprava po ztrátě, přitom většina lidí jen přechází z jiného zařízení nebo z Payky.
- „Založit nový účet" zůstává.

### Settings → Accounts

```
Účty na tomto zařízení
  ● Kavárna U Mostu        [Aktivní]
  ○ Stánek na trhu         [Přepnout] 🗑

Přidat účet
  ＋  Založit nový účet
      Začnete s prázdným účtem.
  ↘  Otevřít existující účet               ›
      Z Payky, jiného zařízení nebo z 20 slov.

Tento účet jinde
  ⊞  Přidat zařízení k tomuto účtu         ›
```

- „Přidat účet" má jen dvě položky. „Otevřít existující účet" otevře obrazovku s rozcestníkem.
- Popis položky odpovídá tomu, co je uvnitř: s Payky „Z Payky, jiného zařízení nebo z 20 slov", bez Payky „Z jiného zařízení nebo z 20 slov".
- Inline rozbalování fráze i Payky odpadá. Každá cesta je samostatná obrazovka.
- „Tento účet jinde" zůstává samostatně, protože je to opačný směr (účet odchází).
- Před přidáním se dál ptá na `admin` a potvrzení (`useAddTransferredAccount` s `confirmBeforeAdding`). Rozcestník sám nechce nic víc než oprávnění své route.

## Implementace

### 1. Sdílený stav kroků (`packages/app-shared/src/onboarding-form-state.ts`)

- Do `OnboardingStep` přidat `restoreChoice`. Stávající `restore` dál znamená krok s frází, takže restore-sync stránky (web i native, `step: "restore"`) a webový onboarding se nemění.
- `onboardingStepsByAccountType`: `restore`, `transfer` a `fromPayky` vedou přes `restoreChoice` (`["accountChoice", "restoreChoice", …]`). Na webu se `restoreChoice` nepoužívá, `getOnboardingSteps` web využívá jen pro index kroku a ten se musí ověřit. Kdyby to web rozbilo, nechat tabulku beze změny a `restoreChoice` řešit jen v nativu.
- Web doplní `restoreChoice` do svých `Record<OnboardingStep, …>` v `apps/web-app/src/features/onboarding/onboarding-page.tsx` s poznámkou, že jde o krok jen pro native.

### 2. Sdílená komponenta (`apps/native-app/src/features/shared/`)

- **`open-account-flow.tsx`**, komponenta `OpenAccountFlow`, řízená zvenku:
  - `step: "choice" | "fromPayky" | "transfer" | "phrase"`, `onStepChange(step)`
  - `source: "onboarding" | "settings"`, `confirmBeforeAdding`
  - fráze: `error`, `pending` a `onRestore(phrase)` z `useRestoreAccount`, jako dnes
- **`open-account-choice.tsx`**: samotný rozcestník (`VerticalNav`, bez štítku), detekce přes `useCanRequestAccountFromPayky`.
- Nadpisy a popisy kroků (`choice`, `fromPayky`, `transfer`, `phrase`) jako lookup objekt `satisfies Record<…, TranslationKey>` v komponentě. Onboarding i Settings je vykreslí stejně.
- `AccountTransferTarget.onRestoreWithPhrase` → `onStepChange("phrase")`.

### 3. Onboarding (`apps/native-app/src/features/onboarding/onboarding-page.tsx`)

- Mapování mezi `OnboardingStep` a krokem komponenty: `restoreChoice` ↔ `choice`, `restore` ↔ `phrase`, `transfer` ↔ `transfer`, `fromPayky` ↔ `fromPayky`.
- `onRestore` na uvítací obrazovce nastaví `step: "restoreChoice"`.
- `goBack`: z `restore`, `transfer` a `fromPayky` na `restoreChoice`, z `restoreChoice` a `payments` na `accountChoice`. `existingMnemonic` zůstává bez cesty zpět jako dnes.
- `welcome-step.tsx`: popisek tlačítka „Už mám účet" (nový klíč, starý `accountChoice.restore.title` zůstává, používá ho web).

### 4. Settings (`apps/native-app`)

- **Route `app/settings/accounts/open.tsx`** → `features/settings/accounts/open-account-page.tsx`, která renderuje `OpenAccountFlow` se `source="settings"` a `confirmBeforeAdding`. Krok je v search parametru `step`, aby fungovala systémová šipka zpět a dalo se tam vrátit odkazem. Neznámá hodnota znamená `choice`.
- `src/core/route-access.ts`: `"/settings/accounts/open": "admin"`, stejně jako dnešní `/pair`. Zařadit do `src/core/menu-routes.ts` k tabu Settings (navigation/0001).
- `accounts-settings-page.tsx`: sekce „Přidat účet" má jen „Založit nový účet" a „Otevřít existující účet" (`router.push("/settings/accounts/open")`). Odstranit `restoreOpen`, `fromPaykyOpen`, parametr `restore=1` a inline `RestoreAccountStep`/`AccountFromPayky`.
- **`/pair` se maže** (rozhodnuto): `app/pair.tsx`, `features/preview/pair-target-page.tsx` a jeho záznamy v `route-access.ts`, `menu-routes.ts`/`menu-routes.test.ts` a v ui-parity mapě. Přenos z jiného zařízení je jen `/settings/accounts/open?step=transfer`. Před smazáním ověřit, že na `/pair` nic jiného nevede (deep link, naskenovaný `payky:pair`, Maestro flow); co na něj vede, přepojit na novou route.

### 5. Web (`apps/web-app`)

Sjednotit taky (rozhodnuto), bez Payky (web nemá app-to-app zdroj):

- `features/settings/accounts/accounts-settings-page.tsx`: místo dialogů pro obnovu a přenos jedna položka „Otevřít existující účet" → nová route `_terminal.settings.accounts_.open.tsx` (`staticData.access: "admin"`, `menu: { tab: "settings" }`), která renderuje feature `OpenAccountPage`.
- Rozcestník a kroky v `features/shared/account/` vedle `account-transfer-target.tsx`.
- Webový onboarding se sjednocuje taky: první obrazovka (`AccountTypeChoice`) nabízí jen „Založit nový účet" a „Už mám účet", druhá vede na rozcestník (`restoreChoice`). Jinak by se web lišil mezi onboardingem a Settings. Odkaz „přenést přes QR" pod formulářem fráze (`onboarding.restore.transferLink`) odpadá, tu volbu nabízí rozcestník.

### 6. Překlady (`packages/app-shared/src/i18n`, `onboarding.ts`)

- `openAccount.title` („Otevřít existující účet"), `openAccount.description` („Vyberte, kde účet teď máte.").
- `openAccount.fromPayky.description`, `openAccount.transfer.description`, `openAccount.phrase.title` („Obnovovací fráze (20 slov)"), `openAccount.phrase.description`.
- `openAccount.settings.description` ve dvou variantách (s Payky a bez Payky).
- `accountChoice.existing.title` („Už mám účet") pro uvítací obrazovku.
- Jméno Payky jen jako `{sourceApp}` z `brandName(paykyBrand)` (brand/0004), nikdy literálem.
- Doplnit `cs` a `sk`. Brand-copy snapshoty se mění jen u klíčů s brand placeholderem (`vitest -u`, přečíst diff).

### 7. Parity a testy

- `src/ui-parity/ui-parity-map.ts`: záznamy pro `open-account-flow.tsx`, `open-account-choice.tsx` a `open-account-page.tsx` (s webovými protějšky, nebo s poznámkou „Native only" a `allowedDifferences`). Aktualizovat poznámky u `onboarding-page.tsx` a `accounts-settings-page.tsx`.
- `packages/app-shared/src/onboarding-form-state.test.ts`: kroky pro `restore`, `transfer` a `fromPayky` vedou přes `restoreChoice`.
- Čistá funkce pro sestavení položek rozcestníku (`openAccountChoices({ canRequestFromPayky })`) s testem: pořadí Payky, zařízení, fráze; bez Payky dvě položky.
- Čistá funkce `goBack`/přechodů onboardingu s testem: zpět z každého kroku obnovy vede na rozcestník, z rozcestníku na uvítací obrazovku, `existingMnemonic` bez návratu.
- `preview-access.test.ts` hlídá `useAddTransferredAccount` a zůstává beze změny.
- `route-access.test.ts`/`menu-routes.test.ts`: nová route.
- Maestro flow v `apps/native-app/e2e/` pro restore v onboardingu (pokud existuje) projde rozcestníkem. Číst `apps/native-app/e2e/AGENTS.md`. Webová e2e (`onboarding.spec.ts`, `settings-accounts.spec.ts`) upravit, pokud se mění web (krok 5).
- Na konci `bun run check`.

### 8. Rozhodnutí

Žádné stávající rozhodnutí v `docs/decisions/onboarding/` tento tok nepopisuje (onboarding/0008 řeší jen to, jaké fráze se přijímají). Pořadí (nejsnazší cesta první, fráze poslední), sdílený rozcestník a to, že Payky se nenabízí bez detekce, drží `onboarding/0011-an-existing-account-is-opened-from-the-easiest-source-first.md` s testy `openAccountChoices` a přechodů onboardingu pod `## Enforced by`.

## Pořadí práce

1. Sdílený stav kroků a test (krok 1).
2. `OpenAccountFlow`, rozcestník a čisté funkce s testy (krok 2, část 7).
3. Onboarding (krok 3), překlady (krok 6).
4. Settings route a úprava stránky účtů, smazání `/pair` (krok 4).
5. Web (krok 5).
6. Parity mapa, e2e, `bun run check`, ruční průchod na telefonu s Payky i bez něj.

## Rozhodnuto

- **Web se sjednocuje** (krok 5): dialogy obnovy a přenosu v Settings → Accounts nahradí rozcestník na vlastní route a webový onboarding vede přes stejný rozcestník.
- **`/pair` se maže** (krok 4).
- **Bez štítku „Nejrychlejší"**: nejsnazší cestu ukazuje jen pořadí.
