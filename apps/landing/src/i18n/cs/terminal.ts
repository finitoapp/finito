import { csCommon } from "@payky/app-shared/i18n/cs/common"
import { csPayment } from "@payky/app-shared/i18n/cs/payment"
import { csSettings } from "@payky/app-shared/i18n/cs/settings"
import type { enTerminal } from "../en/terminal.ts"
import { pickTerminalAppLabels } from "../terminal-app-labels.ts"

/**
 * The card terminal documentation (landing/0015), which only Finito's
 * landing shows. The app's labels it quotes come from the app's copy.
 */
export const csTerminal = {
  ...pickTerminalAppLabels({ ...csCommon, ...csPayment, ...csSettings }),
  "landing.terminal.meta.title":
    "{appName} na karetním terminálu SwitchioPay: platba, storno, refundace, uzávěrka",
  "landing.terminal.meta.description":
    "Jak {appName} přijímá platby kartou na terminálu NEXGO přes SwitchioPay: zapnutí, platba, storno, vrácení peněz na kartu, uzávěrka, krajní situace a testování v prostředí Comgate.",
  "landing.terminal.hero.eyebrow": "Karetní terminál",
  "landing.terminal.hero.title": "{appName} na karetním terminálu SwitchioPay",
  "landing.terminal.hero.body":
    "{appName} běží přímo na platebním terminálu NEXGO N92 vedle aplikace SwitchioPay. Při platbě kartou předá částku SwitchioPay na tomtéž terminálu a údaje z karty nikdy nevidí. Účtenky tiskne SwitchioPay na tiskárně terminálu podle svého nastavení.",
  "landing.terminal.hero.note":
    "Všechny snímky obrazovky na této stránce pocházejí přímo z aplikace. Kde řízení převezme SwitchioPay, zastupuje jeho obrazovku šedá plocha s popiskem.",
  "landing.terminal.toc.title": "Na této stránce",
  "landing.terminal.switchioPay.name": "SwitchioPay",

  "landing.terminal.switchioPay.cardTap": "Zákazník přiloží kartu",
  "landing.terminal.switchioPay.reversal": "Storno platby",
  "landing.terminal.switchioPay.refund": "Vrácení peněz na kartu",
  "landing.terminal.switchioPay.closure": "Uzávěrka dávky",

  "landing.terminal.requirements.eyebrow": "Než začnete",
  "landing.terminal.requirements.title": "Co je potřeba",
  "landing.terminal.requirements.terminal":
    "Platební terminál NEXGO od Comgate se SwitchioPay a smlouva s Comgate.",
  "landing.terminal.requirements.install":
    "Aplikace {appName} nainstalovaná na terminálu ze Switchio Store a podepsaná Comgate.",
  "landing.terminal.requirements.onboarding":
    "Dokončené první spuštění aplikace {appName}, které za minutu založí účet podniku.",
  "landing.terminal.requirements.permissions.title": "Kdo smí co",
  "landing.terminal.requirements.permissions.body":
    "Jakmile majitel nastaví PIN, potřebuje každá akce své oprávnění:",
  "landing.terminal.requirements.permissions.activation":
    "Zapnutí plateb kartou",
  "landing.terminal.requirements.permissions.refund":
    "Storno a vrácení peněz na kartu",
  "landing.terminal.requirements.permissions.closure": "Uzávěrka",
  "landing.terminal.requirements.tester.title": "Pro testera Comgate",
  "landing.terminal.requirements.tester.body":
    "{appName} nemá žádné přihlášení ani testovací účet, který by bylo potřeba předat. Nainstalujte APK, projděte prvním spuštěním bez nastavení PINu, takže kdokoli s terminálem v ruce smí všechno, a zapněte platby kartou podle návodu níže.",

  "landing.terminal.activation.eyebrow": "Zapnutí",
  "landing.terminal.activation.title": "Zapněte platby kartou",
  "landing.terminal.activation.body":
    "Jednou za podnik, v nastavení. Přepínač platí pro všechna zařízení podniku.",
  "landing.terminal.activation.step.settings":
    "Otevřete nastavení a platební metody.",
  "landing.terminal.activation.step.off":
    "Platby kartou jsou vypnuté, dokud je nezapnete. Když na terminálu chybí SwitchioPay, řádek na to upozorní.",
  "landing.terminal.activation.step.on":
    "Zapněte přepínač. Platební obrazovka se otevře na první metodě v seznamu, označené jako výchozí; pořadí změníte přetažením řádků.",
  "landing.terminal.activation.step.card":
    "Řádek vede k tomu, co platby kartou potřebují, a k uzávěrkám terminálů.",

  "landing.terminal.payment.eyebrow": "Platba",
  "landing.terminal.payment.title": "Přijměte platbu kartou",
  "landing.terminal.payment.body":
    "{appName} pošle SwitchioPay částku, zvlášť spropitné, měnu a číslo platby jako číslo dokladu.",
  "landing.terminal.payment.step.amount":
    "Na klávesnici zadejte částku a pokračujte k platbě. Účet ze stolů nebo z katalogu se platí stejně.",
  "landing.terminal.payment.step.tip":
    "Když máte zapnuté spropitné, zákazník si ho vybere. SwitchioPay dostane spropitné odděleně od částky.",
  "landing.terminal.payment.step.cardTab":
    "Na záložce platební karty spusťte platbu.",
  "landing.terminal.payment.step.waiting":
    "{appName} čeká, než SwitchioPay platbu dokončí.",
  "landing.terminal.payment.step.switchioPay":
    "Řízení převezme SwitchioPay: zákazník přiloží kartu, a když si o to terminál řekne, zadá PIN.",
  "landing.terminal.payment.step.received":
    "Zpátky v aplikaci je platba přijatá.",
  "landing.terminal.payment.step.detail":
    "Detail platby ukazuje maskované číslo karty, značku karty, autorizační kód, ID transakce terminálu a ID terminálu.",
  "landing.terminal.payment.note":
    "U schválené platby si {appName} uloží, co bude potřeba k jejímu vrácení: ID transakce, ID, podle kterého ji SwitchioPay vrací, zařízení, které ji přijalo, a čas schválení.",

  "landing.terminal.reversal.eyebrow": "Storno",
  "landing.terminal.reversal.title": "Stornujte platbu před uzávěrkou",
  "landing.terminal.reversal.body":
    "Storno vezme na terminálu zpět celou platbu a karta k němu není potřeba. Aplikace {appName} ho zvolí sama, kdykoli platí všechno najednou:",
  "landing.terminal.reversal.rule.whole":
    "vrací se celá platba včetně spropitného;",
  "landing.terminal.reversal.rule.first": "z platby se ještě nic nevracelo;",
  "landing.terminal.reversal.rule.sameTerminal":
    "jste na terminálu, který platbu přijal;",
  "landing.terminal.reversal.rule.noClosure":
    "na tomto terminálu od platby neproběhla uzávěrka v aplikaci {appName}.",
  "landing.terminal.reversal.step.button":
    "V aktivitě otevřete platbu a spusťte vrácení peněz.",
  "landing.terminal.reversal.step.choose":
    "Zvolte celou platbu. Metoda řekne, že terminál vezme zpět celou platbu a karta není potřeba.",
  "landing.terminal.reversal.step.running":
    "Potvrďte vrácení. {appName} čeká, než SwitchioPay platbu stornuje.",
  "landing.terminal.reversal.step.switchioPay":
    "SwitchioPay stornuje právě tu transakci, jejíž ID mu aplikace předá.",
  "landing.terminal.reversal.step.detail":
    "Detail vrácení ukazuje platbu stornovanou na terminálu s ID transakce terminálu, autorizačním kódem a pořadovým číslem.",

  "landing.terminal.refund.eyebrow": "Refundace",
  "landing.terminal.refund.title": "Vraťte peníze na kartu po uzávěrce",
  "landing.terminal.refund.body":
    "Kdykoli storno nejde, vrátí {appName} peníze na kartu, kterou zákazník platil: po uzávěrce, při vrácení části platby nebo jen spropitného, po dřívějším vrácení, nebo na jiném terminálu, než který platbu přijal.",
  "landing.terminal.refund.step.referral":
    "Po uzávěrce nabídne stejná obrazovka vrácení na kartu: peníze se vrátí na kartu, kterou zákazník platil.",
  "landing.terminal.refund.step.partial":
    "Část platby: zadejte částku, nebo vyberte položky.",
  "landing.terminal.refund.step.tip": "Samotné spropitné má vlastní vrácení.",
  "landing.terminal.refund.step.switchioPay":
    "SwitchioPay vrátí peníze na kartu; postupujte podle terminálu.",
  "landing.terminal.refund.step.detail":
    "Detail vrácení ukazuje peníze vrácené na kartu i to, co terminál odpověděl.",
  "landing.terminal.refund.step.declined":
    "Když byla dávka uzavřena mimo aplikaci {appName}, terminál storno odmítne. Aplikace se pak zeptá SwitchioPay, jestli platba přece jen stornovaná není, a pokud ne, nabídne místo storna vrácení na kartu.",

  "landing.terminal.closure.eyebrow": "Uzávěrka",
  "landing.terminal.closure.title": "Uzavřete dávku po každé směně",
  "landing.terminal.closure.body":
    "Uzávěrka pošle platby kartou z terminálu k vyúčtování. Dělejte ji každý den po skončení směny, na každém terminálu zvlášť.",
  "landing.terminal.closure.step.row":
    "V nastavení otevřete uzávěrky terminálů. Řádek tam najdete, jakmile zapnete platby kartou.",
  "landing.terminal.closure.step.page":
    "Obrazovka ukazuje poslední uzávěrku tohoto terminálu. Spusťte uzávěrku.",
  "landing.terminal.closure.step.confirm":
    "Potvrďte: platby kartou od poslední uzávěrky půjdou k vyúčtování.",
  "landing.terminal.closure.step.switchioPay": "SwitchioPay uzavře dávku.",
  "landing.terminal.closure.step.detail":
    "{appName} zapíše souhrn (platby se spropitným, vrácené platby, úpravy plateb) s číslem dávky a směny. Historie a přehled všech terminálů podniku ho ukáží na každém zařízení.",
  "landing.terminal.closure.note.perTerminal":
    "Každý terminál uzavírá svou dávku, a to jen sám na sobě.",
  "landing.terminal.closure.note.outside":
    "Uzávěrku spuštěnou přímo ve SwitchioPay nebo provedenou samotným SwitchioPay aplikace {appName} nezná.",
  "landing.terminal.closure.note.reconciliation":
    "Součty uzávěrky aplikace {appName} zatím neporovnává se svými platbami.",

  "landing.terminal.edge.eyebrow": "Krajní situace",
  "landing.terminal.edge.title": "Když něco proběhne jinak",
  "landing.terminal.edge.body":
    "Co uvidíte, co udělat a co {appName} zapíše. Platbu počítá jako zaplacenou, jen když ji SwitchioPay schválil, a po nejasném výsledku chce před dalším strhnutím karty kontrolu.",
  "landing.terminal.edge.column.situation": "Situace",
  "landing.terminal.edge.column.see": "Co uvidíte",
  "landing.terminal.edge.column.do": "Co udělat",
  "landing.terminal.edge.column.records": "Co {appName} zapíše",
  "landing.terminal.edge.declined.situation":
    "Karta je zamítnutá, nebo banka zákazníka platbu odmítne.",
  "landing.terminal.edge.declined.see": "Hlášku na záložce karty:",
  "landing.terminal.edge.declined.do":
    "Strhněte kartu znovu, nebo ať zákazník zaplatí jinak.",
  "landing.terminal.edge.declined.records": "Nic: platba zůstává nezaplacená.",
  "landing.terminal.edge.canceled.situation": "Platba je zrušená na terminálu.",
  "landing.terminal.edge.canceled.see":
    "Podle toho, co SwitchioPay vrátí, platba buď neproběhla, nebo má neznámý výsledek. Chování se ověřuje na vývojovém terminálu Comgate.",
  "landing.terminal.edge.canceled.do":
    "Strhněte kartu znovu; při neznámém výsledku nejdřív zkontrolujte SwitchioPay.",
  "landing.terminal.edge.canceled.records":
    "Žádnou platbu, pokud SwitchioPay nenahlásí schválení.",
  "landing.terminal.edge.unknown.situation":
    "SwitchioPay nevrátí čitelný výsledek, třeba když spadne nebo ho zavře Android.",
  "landing.terminal.edge.unknown.see":
    "Že výsledek není známý. Aplikace se pak SwitchioPay na transakci sama zeptá.",
  "landing.terminal.edge.unknown.do":
    "Počkejte na odpověď. Když SwitchioPay schválení nepotvrdí, zkontrolujte transakci ve SwitchioPay.",
  "landing.terminal.edge.unknown.records":
    "Platbu jako zaplacenou, až když SwitchioPay potvrdí schválení; jakákoli jiná odpověď nechá výsledek neznámý.",
  "landing.terminal.edge.chargeAgain.situation":
    "Strháváte kartu znovu, ačkoli výsledek minulého pokusu není známý.",
  "landing.terminal.edge.chargeAgain.see":
    "Potvrzení s varováním, že karta už mohla být stržena:",
  "landing.terminal.edge.chargeAgain.do":
    "Potvrďte, až ve SwitchioPay ověříte, že minulý pokus neprošel.",
  "landing.terminal.edge.chargeAgain.records":
    "Nový pokus s novým ID transakce.",
  "landing.terminal.edge.busy.situation":
    "SwitchioPay je zaneprázdněný jinou operací, nebo se odmítne spustit.",
  "landing.terminal.edge.busy.see":
    "Že je SwitchioPay zaneprázdněný a máte to zkusit znovu.",
  "landing.terminal.edge.busy.do":
    "Dokončete, co je ve SwitchioPay rozpracované, a spusťte platbu znovu.",
  "landing.terminal.edge.busy.records": "Nic: terminál se vůbec nespustil.",
  "landing.terminal.edge.notInstalled.situation":
    "Na terminálu není nainstalovaný SwitchioPay.",
  "landing.terminal.edge.notInstalled.see":
    "Upozornění u platební karty v nastavení a při platbě:",
  "landing.terminal.edge.notInstalled.do":
    "Nechte SwitchioPay na terminálu nainstalovat a nastavit.",
  "landing.terminal.edge.notInstalled.records": "Nic.",
  "landing.terminal.edge.restored.situation":
    "Android aplikaci {appName} zavře, zatímco obrazovku drží SwitchioPay.",
  "landing.terminal.edge.restored.see": "Až se aplikace vrátí:",
  "landing.terminal.edge.restored.do":
    "Nic: výsledek terminálu na aplikaci počká a vyřídí se, jakmile se vrátí.",
  "landing.terminal.edge.restored.records":
    "Platbu tak, jak ji SwitchioPay nahlásil.",
  "landing.terminal.edge.otherAccount.situation":
    "Uložený výsledek patří jinému účtu na terminálu.",
  "landing.terminal.edge.otherAccount.see":
    "Nic, dokud ten účet není znovu aktivní.",
  "landing.terminal.edge.otherAccount.do":
    "Přepněte na účet, ve kterém platba vznikla. Do té doby terminál další platbu nespustí.",
  "landing.terminal.edge.otherAccount.records":
    "Výsledek jen v jeho vlastním účtu.",
  "landing.terminal.edge.canceledButPaid.situation":
    "Platba zrušená na jiném zařízení je zaplacena kartou.",
  "landing.terminal.edge.canceledButPaid.see": "V detailu platby:",
  "landing.terminal.edge.canceledButPaid.do":
    "Označte platbu jako zaplacenou, nebo ji vraťte.",
  "landing.terminal.edge.canceledButPaid.records":
    "Platbu kartou: karta byla stržena, takže se peníze počítají.",
  "landing.terminal.edge.reversalDeclined.situation":
    "Storno po uzávěrce provedené mimo aplikaci {appName}.",
  "landing.terminal.edge.reversalDeclined.see": "Na obrazovce vrácení:",
  "landing.terminal.edge.reversalDeclined.do":
    "Vraťte peníze místo toho na kartu.",
  "landing.terminal.edge.reversalDeclined.records":
    "Vrácení, až ho terminál schválí; nic dvakrát, pokud už platba stornovaná je.",
  "landing.terminal.edge.refundUnknown.situation":
    "Výsledek vrácení na kartu není známý.",
  "landing.terminal.edge.refundUnknown.see": "Ve vráceních platby:",
  "landing.terminal.edge.refundUnknown.do":
    "Nechte aplikaci zeptat se SwitchioPay, nebo SwitchioPay zkontrolujte sami a vrácení zavřete.",
  "landing.terminal.edge.refundUnknown.records":
    "Vrácení, až když SwitchioPay potvrdí schválení. Do té doby se žádné další vrácení platby nespustí.",
  "landing.terminal.edge.refundElsewhere.situation":
    "Vrácení čeká na SwitchioPay na jiném zařízení.",
  "landing.terminal.edge.refundElsewhere.see": "Ve vráceních platby:",
  "landing.terminal.edge.refundElsewhere.do":
    "Počkejte. Když už to zařízení není k dispozici, zkontrolujte SwitchioPay a vrácení zavřete.",
  "landing.terminal.edge.refundElsewhere.records":
    "Cokoli, co SwitchioPay na tom zařízení schválí, i po zavření.",
  "landing.terminal.edge.closureUnknown.situation":
    "Výsledek uzávěrky není známý.",
  "landing.terminal.edge.closureUnknown.see": "Na obrazovce uzávěrek:",
  "landing.terminal.edge.closureUnknown.do":
    "Ve SwitchioPay zkontrolujte, jestli se dávka uzavřela.",
  "landing.terminal.edge.closureUnknown.records":
    "Nic: zapisuje se jen uzávěrka s čitelnými součty.",
  "landing.terminal.edge.demo.situation": "Demo účet.",
  "landing.terminal.edge.demo.see": "Při platbě:",
  "landing.terminal.edge.demo.do":
    "Platby kartou přijímejte ve skutečném účtu.",
  "landing.terminal.edge.demo.records":
    "Nic: demo účet SwitchioPay nikdy nespustí.",
  "landing.terminal.edge.offline.situation":
    "Terminál nemá připojení k internetu.",
  "landing.terminal.edge.offline.see":
    "{appName} funguje dál: se SwitchioPay komunikuje přímo na terminálu. SwitchioPay ale připojení k autorizaci karty potřebuje.",
  "landing.terminal.edge.offline.do": "Obnovte připojení.",
  "landing.terminal.edge.offline.records":
    "Vše na terminálu; ostatní zařízení podniku to uvidí, jakmile bude online.",

  "landing.terminal.testing.eyebrow": "Testování",
  "landing.terminal.testing.title": "Testování v prostředí Comgate",
  "landing.terminal.testing.body":
    "Testovací prostředí Comgate řídí výsledek částkou a přijímá jen bezkontaktní platby. Na klávesnici zadejte tyto částky:",
  "landing.terminal.testing.column.amount": "Částka",
  "landing.terminal.testing.column.simulator": "Simulátor odpoví",
  "landing.terminal.testing.column.app": "{appName} ukáže",
  "landing.terminal.testing.approved.amount": "1,01 Kč",
  "landing.terminal.testing.approved.simulator": "Potvrzeno",
  "landing.terminal.testing.approved.app": "Platba je přijatá a zaplacená.",
  "landing.terminal.testing.partial.amount": "2,01 Kč",
  "landing.terminal.testing.partial.simulator": "Potvrzeno – částečně",
  "landing.terminal.testing.partial.app":
    "Ověřuje se na vývojovém terminálu; {appName} o částečné schválení nežádá.",
  "landing.terminal.testing.duplicate.amount": "1,10 Kč",
  "landing.terminal.testing.duplicate.simulator": "Duplicitní transakce",
  "landing.terminal.testing.insufficientFunds.amount": "6,02 Kč",
  "landing.terminal.testing.insufficientFunds.simulator":
    "Nedostatek prostředků",
  "landing.terminal.testing.expiredCard.amount": "6,05 Kč",
  "landing.terminal.testing.expiredCard.simulator": "Karta s prošlou platností",
  "landing.terminal.testing.authorizationTimeout.amount": "7,09 Kč",
  "landing.terminal.testing.authorizationTimeout.simulator":
    "Vypršel čas autorizace",
  "landing.terminal.testing.cardTimeout.amount": "31,09 Kč",
  "landing.terminal.testing.cardTimeout.simulator":
    "Vypršel čas na detekci karty",
  "landing.terminal.testing.other.amount": "Jakákoli jiná částka",
  "landing.terminal.testing.other.simulator": "Potvrzeno",
  "landing.terminal.testing.declined":
    "Platba zůstává nezaplacená a kartu lze strhnout znovu.",
  "landing.terminal.testing.operations":
    "Storno, vrácení na kartu a uzávěrku vyzkoušíte podle návodu výše: schvalte platbu za 1,01 Kč a stornujte ji; pak schvalte další platbu, proveďte uzávěrku a tuto platbu vraťte na kartu.",
  "landing.terminal.testing.source":
    "Částky podle dokumentace simulátoru Comgate, ověřeno 13. 11. 2026.",
  "landing.terminal.testing.sourceLink": "apidoc.comgate.cz",

  "landing.terminal.limits.eyebrow": "Omezení",
  "landing.terminal.limits.title": "Co {appName} nedělá",
  "landing.terminal.limits.receipts":
    "Netiskne účtenky: tiskne je SwitchioPay na tiskárně terminálu podle svého nastavení.",
  "landing.terminal.limits.operations":
    "Nemá předautorizace, platby MOTO ani cashback.",
  "landing.terminal.limits.unlinkedRefund":
    "Nevrací peníze bez původní platby: každé vrácení na kartu patří k platbě přijaté v aplikaci.",
  "landing.terminal.limits.autoClosure":
    "Uzávěrku nespouští automaticky: musí ji spustit obsluha.",
  "landing.terminal.limits.reconciliation":
    "Zatím neporovnává součty uzávěrky se svými platbami.",

  "landing.terminal.faq.otherTerminal.question":
    "Můžu vrátit platbu přijatou na jiném terminálu?",
  "landing.terminal.faq.otherTerminal.answer":
    "Ano, na kartu. Stornovat platbu umí jen terminál, který ji přijal, takže na kterémkoli jiném terminálu podniku vrátí {appName} peníze na kartu, kterou zákazník platil.",
  "landing.terminal.faq.forgotClosure.question":
    "Co když zapomenu na uzávěrku?",
  "landing.terminal.faq.forgotClosure.answer":
    "Udělejte ji, jakmile si všimnete: dávka obsahuje všechny platby kartou od poslední uzávěrky. Když dávku uzavře SwitchioPay sám, {appName} o tom neví; storno, které pak terminál odmítne, se nabídne jako vrácení na kartu.",
  "landing.terminal.faq.cardNumber.question": "Vidí {appName} číslo karty?",
  "landing.terminal.faq.cardNumber.answer":
    "Ne. Kartu čte SwitchioPay. {appName} od něj dostane jen maskované číslo karty, značku karty, autorizační kód a ID transakcí a uloží je k platbě.",
  "landing.terminal.faq.receipts.question": "Kdo tiskne účtenku?",
  "landing.terminal.faq.receipts.answer":
    "SwitchioPay, na tiskárně terminálu podle svého nastavení. {appName} netiskne nic.",
  "landing.terminal.faq.login.question":
    "Potřebuji k testování účet nebo přihlášení?",
  "landing.terminal.faq.login.answer":
    "Ne. {appName} žádné přihlášení nemá: nainstalujte ho, projděte prvním spuštěním a zapněte platby kartou. Bez PINu smí kdokoli s terminálem v ruce všechno.",

  "landing.terminal.shot.settings-payments.alt":
    "Nastavení aplikace {appName} s platebními metodami v sekci Platby",
  "landing.terminal.shot.payment-methods-off.alt":
    "Platební metody s vypnutou platební kartou",
  "landing.terminal.shot.payment-methods-on.alt":
    "Platební metody se zapnutou platební kartou označenou jako výchozí",
  "landing.terminal.shot.card-settings.alt":
    "Nastavení platební karty s odkazem na uzávěrky terminálů",
  "landing.terminal.shot.pay-amount.alt":
    "Klávesnice se zadanou částkou a tlačítkem Zaplatit",
  "landing.terminal.shot.pay-tip.alt": "Výběr spropitného při platbě",
  "landing.terminal.shot.pay-card-tab.alt":
    "Platební obrazovka na záložce platební karty",
  "landing.terminal.shot.pay-waiting.alt":
    "Záložka platební karty čeká na terminál",
  "landing.terminal.shot.pay-received.alt": "Přijatá platba",
  "landing.terminal.shot.pay-detail.alt":
    "Detail platby kartou s maskovaným číslem karty, autorizačním kódem a ID terminálu",
  "landing.terminal.shot.refund-button.alt":
    "Detail platby kartou s tlačítkem Vrátit peníze",
  "landing.terminal.shot.refund-reversal.alt":
    "Obrazovka vrácení s celou platbou, kterou SwitchioPay stornuje",
  "landing.terminal.shot.refund-running.alt":
    "Obrazovka vrácení čeká na SwitchioPay",
  "landing.terminal.shot.refund-reversed-detail.alt":
    "Detail vrácení stornovaného na terminálu",
  "landing.terminal.shot.refund-referral.alt":
    "Obrazovka vrácení nabízí po uzávěrce vrácení na kartu",
  "landing.terminal.shot.refund-partial.alt":
    "Obrazovka vrácení s částí platby",
  "landing.terminal.shot.refund-tip-only.alt":
    "Obrazovka vrácení jen se spropitným",
  "landing.terminal.shot.refund-referral-detail.alt": "Detail vrácení na kartu",
  "landing.terminal.shot.reversal-declined.alt":
    "Terminál odmítl storno a aplikace nabízí vrácení na kartu",
  "landing.terminal.shot.closure-row.alt": "Nastavení s uzávěrkami terminálů",
  "landing.terminal.shot.closure-page.alt":
    "Uzávěrky terminálů s poslední uzávěrkou tohoto terminálu",
  "landing.terminal.shot.closure-confirm.alt": "Potvrzení uzávěrky terminálu",
  "landing.terminal.shot.closure-detail.alt":
    "Detail uzávěrky se souhrnem, číslem dávky a směny",
  "landing.terminal.shot.edge-declined.alt":
    "Záložka platební karty po zamítnuté kartě",
  "landing.terminal.shot.edge-unknown.alt":
    "Záložka platební karty s neznámým výsledkem",
  "landing.terminal.shot.edge-unknown-resolved.alt":
    "Přijatá platba poté, co se aplikace zeptala SwitchioPay",
  "landing.terminal.shot.edge-charge-again.alt":
    "Potvrzení před dalším strhnutím karty",
  "landing.terminal.shot.edge-busy.alt":
    "Záložka platební karty se zaneprázdněným SwitchioPay",
  "landing.terminal.shot.edge-not-installed.alt":
    "Upozornění, že SwitchioPay není nainstalovaný",
  "landing.terminal.shot.edge-restored.alt":
    "Hláška, že platba kartou byla dořešena po restartu aplikace",
  "landing.terminal.shot.edge-canceled-but-paid.alt":
    "Zrušená platba zaplacená kartou s volbou označit ji jako zaplacenou, nebo ji vrátit",
  "landing.terminal.shot.edge-refund-unknown.alt":
    "Vrácení s neznámým výsledkem a tlačítkem pro dotaz na SwitchioPay",
  "landing.terminal.shot.edge-closure-unknown.alt":
    "Uzávěrky terminálů s uzávěrkou neznámého výsledku",
  "landing.terminal.shot.edge-demo.alt":
    "Hláška, že demo účet skutečné platby kartou nepřijímá",
} as const satisfies Record<keyof typeof enTerminal, string>
