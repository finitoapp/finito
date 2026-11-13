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
    "{appName} a karetní terminál SwitchioPay: platba, storno, refundace a uzávěrka",
  "landing.terminal.meta.description":
    "Jak přijímat platby kartou v aplikaci {appName} na terminálu NEXGO se SwitchioPay: zapnutí, platba, storno, vrácení peněz na kartu, uzávěrka, nestandardní situace a testování u Comgate.",
  "landing.terminal.hero.eyebrow": "Platby kartou",
  "landing.terminal.hero.title": "{appName} a karetní terminál SwitchioPay",
  "landing.terminal.hero.body":
    "Aplikace {appName} běží přímo na platebním terminálu NEXGO N92 vedle aplikace SwitchioPay. Při platbě kartou jí jen předá částku, s údaji z karty vůbec nepracuje. Účtenky tiskne SwitchioPay na tiskárně terminálu podle svého nastavení.",
  "landing.terminal.hero.note":
    "Všechny snímky obrazovky na této stránce jsou pořízené přímo z aplikace. Kroky, které se odehrávají v aplikaci SwitchioPay, zastupuje šedá plocha s popiskem.",
  "landing.terminal.toc.title": "Obsah",
  "landing.terminal.switchioPay.name": "SwitchioPay",

  "landing.terminal.switchioPay.cardTap": "Zákazník přiloží kartu",
  "landing.terminal.switchioPay.reversal": "Storno platby",
  "landing.terminal.switchioPay.refund": "Vrácení peněz na kartu",
  "landing.terminal.switchioPay.closure": "Uzávěrka",

  "landing.terminal.requirements.eyebrow": "Než začnete",
  "landing.terminal.requirements.title": "Co budete potřebovat",
  "landing.terminal.requirements.terminal":
    "Platební terminál NEXGO s aplikací SwitchioPay a smlouvu s Comgate.",
  "landing.terminal.requirements.install":
    "Aplikaci {appName} nainstalovanou na terminál ze Switchio Store (podepsanou společností Comgate).",
  "landing.terminal.requirements.onboarding":
    "Dokončené první spuštění, při kterém si během minuty založíte účet podniku.",
  "landing.terminal.requirements.permissions.title": "Oprávnění",
  "landing.terminal.requirements.permissions.body":
    "Jakmile majitel nastaví PIN, vyžaduje každá z těchto akcí příslušné oprávnění:",
  "landing.terminal.requirements.permissions.activation":
    "Zapnutí plateb kartou",
  "landing.terminal.requirements.permissions.refund":
    "Storno a vrácení peněz na kartu",
  "landing.terminal.requirements.permissions.closure": "Uzávěrka",
  "landing.terminal.requirements.tester.title": "Pro testery Comgate",
  "landing.terminal.requirements.tester.body":
    "K testování nepotřebujete žádné přihlašovací údaje ani testovací účet. Nainstalujte APK, projděte prvním spuštěním a PIN nenastavujte – pak může obsluha dělat všechno. Nakonec zapněte platby kartou podle návodu níže.",

  "landing.terminal.activation.eyebrow": "Zapnutí",
  "landing.terminal.activation.title": "Zapněte platby kartou",
  "landing.terminal.activation.body":
    "Stačí to udělat jednou v nastavení. Platí to pro všechna zařízení podniku.",
  "landing.terminal.activation.step.settings":
    "Otevřete Nastavení a v něm Platební metody.",
  "landing.terminal.activation.step.off":
    "Platby kartou jsou ve výchozím stavu vypnuté. Pokud na terminálu chybí SwitchioPay, upozorní vás na to text u platební karty.",
  "landing.terminal.activation.step.on":
    "Zapněte přepínač. Při placení se jako první otevře metoda označená jako výchozí; pořadí metod změníte přetažením.",
  "landing.terminal.activation.step.card":
    "Po klepnutí na platební kartu uvidíte, co platby kartou vyžadují, a odkaz na uzávěrky terminálů.",

  "landing.terminal.payment.eyebrow": "Platba",
  "landing.terminal.payment.title": "Přijetí platby kartou",
  "landing.terminal.payment.body":
    "{appName} předá aplikaci SwitchioPay částku, zvlášť spropitné, měnu a číslo platby jako číslo dokladu.",
  "landing.terminal.payment.step.amount":
    "Zadejte částku a klepněte na Zaplatit. Účet u stolu nebo z katalogu se platí stejně.",
  "landing.terminal.payment.step.tip":
    "Máte-li zapnuté spropitné, zákazník si ho vybere. SwitchioPay ho dostane odděleně od částky.",
  "landing.terminal.payment.step.cardTab":
    "Na záložce Platební karta spusťte platbu.",
  "landing.terminal.payment.step.waiting":
    "{appName} počká, až SwitchioPay platbu dokončí.",
  "landing.terminal.payment.step.switchioPay":
    "Dál pokračuje SwitchioPay: zákazník přiloží kartu, a pokud o to terminál požádá, zadá PIN.",
  "landing.terminal.payment.step.received":
    "Po návratu do aplikace je platba přijatá.",
  "landing.terminal.payment.step.detail":
    "V detailu platby najdete maskované číslo karty, typ karty, autorizační kód, ID transakce a ID terminálu.",
  "landing.terminal.payment.note":
    "Ke schválené platbě si {appName} uloží vše, co je potřeba pro její pozdější vrácení: ID transakce, identifikátor pro refundaci, zařízení, na kterém platba proběhla, a čas schválení.",

  "landing.terminal.reversal.eyebrow": "Storno",
  "landing.terminal.reversal.title": "Storno platby před uzávěrkou",
  "landing.terminal.reversal.body":
    "Storno zruší celou platbu přímo na terminálu a karta k němu není potřeba. Aplikace {appName} ho použije automaticky, pokud jsou splněny všechny tyto podmínky:",
  "landing.terminal.reversal.rule.whole":
    "vracíte celou platbu včetně spropitného,",
  "landing.terminal.reversal.rule.first": "z platby se zatím nic nevracelo,",
  "landing.terminal.reversal.rule.sameTerminal":
    "jste na terminálu, na kterém platba proběhla,",
  "landing.terminal.reversal.rule.noClosure":
    "na tomto terminálu od platby neproběhla uzávěrka spuštěná z aplikace {appName}.",
  "landing.terminal.reversal.step.button":
    "V Aktivitě otevřete platbu a klepněte na Vrátit peníze.",
  "landing.terminal.reversal.step.choose":
    "Vyberte celou platbu. U způsobu vrácení uvidíte, že terminál vezme platbu zpět celou a karta není potřeba.",
  "landing.terminal.reversal.step.running":
    "Potvrďte vrácení. {appName} počká, až SwitchioPay platbu stornuje.",
  "landing.terminal.reversal.step.switchioPay":
    "SwitchioPay stornuje přesně tu transakci, jejíž ID mu aplikace předala.",
  "landing.terminal.reversal.step.detail":
    "V detailu vrácení je uvedeno, že platba byla stornována na terminálu, spolu s ID transakce, autorizačním kódem a pořadovým číslem.",

  "landing.terminal.refund.eyebrow": "Refundace",
  "landing.terminal.refund.title": "Vrácení peněz na kartu po uzávěrce",
  "landing.terminal.refund.body":
    "Když storno není možné, vrátí {appName} peníze na kartu, kterou zákazník platil. Tak je to po uzávěrce, při vrácení jen části platby nebo jen spropitného, když už se z platby něco vracelo, nebo když vracíte na jiném terminálu, než na kterém platba proběhla.",
  "landing.terminal.refund.step.referral":
    "Po uzávěrce nabídne stejná obrazovka vrácení na kartu, kterou zákazník platil.",
  "landing.terminal.refund.step.partial":
    "Při vrácení části platby zadejte částku nebo vyberte položky.",
  "landing.terminal.refund.step.tip": "Spropitné můžete vrátit i samostatně.",
  "landing.terminal.refund.step.switchioPay":
    "SwitchioPay vrátí peníze na kartu; dál postupujte podle pokynů na terminálu.",
  "landing.terminal.refund.step.detail":
    "V detailu vrácení uvidíte, že peníze šly zpět na kartu, i údaje, které terminál vrátil.",
  "landing.terminal.refund.step.declined":
    "Pokud byla dávka uzavřena mimo aplikaci {appName}, terminál storno odmítne. Aplikace pak ověří ve SwitchioPay, jestli platba přece jen stornovaná není, a pokud ne, nabídne místo storna vrácení na kartu.",

  "landing.terminal.closure.eyebrow": "Uzávěrka",
  "landing.terminal.closure.title": "Uzávěrka po každé směně",
  "landing.terminal.closure.body":
    "Uzávěrka odešle platby kartou z terminálu k vypořádání. Provádějte ji každý den po skončení směny, na každém terminálu zvlášť.",
  "landing.terminal.closure.step.row":
    "V Nastavení otevřete Uzávěrky terminálů. Tato položka se objeví po zapnutí plateb kartou.",
  "landing.terminal.closure.step.page":
    "Uvidíte poslední uzávěrku tohoto terminálu. Spusťte novou.",
  "landing.terminal.closure.step.confirm":
    "Potvrďte, že se platby kartou od poslední uzávěrky mají odeslat k vypořádání.",
  "landing.terminal.closure.step.switchioPay": "SwitchioPay uzavře dávku.",
  "landing.terminal.closure.step.detail":
    "{appName} uloží souhrn uzávěrky (platby včetně spropitného, vrácené platby, opravy plateb) s číslem dávky a směny. Historie uzávěrek a přehled všech terminálů podniku jsou vidět na každém zařízení.",
  "landing.terminal.closure.note.perTerminal":
    "Každý terminál uzavírá jen svou vlastní dávku, a to přímo na sobě.",
  "landing.terminal.closure.note.outside":
    "O uzávěrce spuštěné přímo v aplikaci SwitchioPay nebo provedené automaticky aplikace {appName} neví.",
  "landing.terminal.closure.note.reconciliation":
    "Součty z uzávěrky zatím aplikace {appName} neporovnává se svými platbami.",

  "landing.terminal.edge.eyebrow": "Nestandardní situace",
  "landing.terminal.edge.title": "Když něco nejde podle plánu",
  "landing.terminal.edge.body":
    "Co uvidíte, co máte udělat a co se v aplikaci uloží. Platba se počítá jako zaplacená jen tehdy, když ji SwitchioPay schválil. Pokud výsledek není jasný, aplikace před dalším pokusem o platbu chce, abyste ho nejdřív ověřili.",
  "landing.terminal.edge.column.situation": "Situace",
  "landing.terminal.edge.column.see": "Co uvidíte",
  "landing.terminal.edge.column.do": "Co udělat",
  "landing.terminal.edge.column.records": "Co se uloží",
  "landing.terminal.edge.declined.situation":
    "Karta je zamítnutá nebo banka zákazníka platbu odmítne.",
  "landing.terminal.edge.declined.see": "Hlášení na záložce Platební karta:",
  "landing.terminal.edge.declined.do":
    "Zkuste platbu kartou znovu, nebo ať zákazník zaplatí jinak.",
  "landing.terminal.edge.declined.records": "Nic, platba zůstává nezaplacená.",
  "landing.terminal.edge.canceled.situation": "Platba je zrušena na terminálu.",
  "landing.terminal.edge.canceled.see":
    "Podle odpovědi SwitchioPay platba buď neproběhla, nebo má neznámý výsledek. Toto chování ještě ověřujeme na vývojovém terminálu Comgate.",
  "landing.terminal.edge.canceled.do":
    "Zkuste platbu znovu; při neznámém výsledku nejdřív zkontrolujte SwitchioPay.",
  "landing.terminal.edge.canceled.records":
    "Nic, dokud SwitchioPay platbu neschválí.",
  "landing.terminal.edge.unknown.situation":
    "SwitchioPay nevrátí srozumitelný výsledek, například když spadne nebo ho ukončí Android.",
  "landing.terminal.edge.unknown.see":
    "Upozornění, že výsledek není známý. Aplikace se pak na transakci sama zeptá SwitchioPay.",
  "landing.terminal.edge.unknown.do":
    "Počkejte na odpověď. Pokud SwitchioPay schválení nepotvrdí, zkontrolujte transakci přímo ve SwitchioPay.",
  "landing.terminal.edge.unknown.records":
    "Platbu jako zaplacenou, až když SwitchioPay schválení potvrdí. Při jakékoli jiné odpovědi zůstane výsledek neznámý.",
  "landing.terminal.edge.chargeAgain.situation":
    "Chcete zaplatit kartou znovu, i když výsledek předchozího pokusu není známý.",
  "landing.terminal.edge.chargeAgain.see":
    "Potvrzovací okno s varováním, že platba z karty už mohla proběhnout:",
  "landing.terminal.edge.chargeAgain.do":
    "Potvrďte až poté, co ve SwitchioPay ověříte, že předchozí pokus neprošel.",
  "landing.terminal.edge.chargeAgain.records":
    "Nový pokus s novým ID transakce.",
  "landing.terminal.edge.busy.situation":
    "SwitchioPay je zaneprázdněný jinou operací nebo se nespustí.",
  "landing.terminal.edge.busy.see":
    "Upozornění, že SwitchioPay je zaneprázdněný a máte to zkusit znovu.",
  "landing.terminal.edge.busy.do":
    "Dokončete rozpracovanou operaci ve SwitchioPay a spusťte platbu znovu.",
  "landing.terminal.edge.busy.records": "Nic, terminál se vůbec nespustil.",
  "landing.terminal.edge.notInstalled.situation":
    "Na terminálu není nainstalovaný SwitchioPay.",
  "landing.terminal.edge.notInstalled.see":
    "Upozornění u platební karty v nastavení a při placení:",
  "landing.terminal.edge.notInstalled.do":
    "Nechte SwitchioPay na terminál nainstalovat a nastavit.",
  "landing.terminal.edge.notInstalled.records": "Nic.",
  "landing.terminal.edge.restored.situation":
    "Android aplikaci {appName} ukončí ve chvíli, kdy je na obrazovce SwitchioPay.",
  "landing.terminal.edge.restored.see": "Po návratu do aplikace:",
  "landing.terminal.edge.restored.do":
    "Nic. Výsledek z terminálu se nezapomene a zpracuje se, jakmile se aplikace znovu otevře.",
  "landing.terminal.edge.restored.records":
    "Platbu podle toho, co SwitchioPay ohlásil.",
  "landing.terminal.edge.otherAccount.situation":
    "Uložený výsledek patří jinému účtu na tomto terminálu.",
  "landing.terminal.edge.otherAccount.see":
    "Nic, dokud se na ten účet nepřepnete.",
  "landing.terminal.edge.otherAccount.do":
    "Přepněte se na účet, ve kterém platba vznikla. Do té doby terminál další platbu nespustí.",
  "landing.terminal.edge.otherAccount.records":
    "Výsledek se uloží jen do účtu, ke kterému patří.",
  "landing.terminal.edge.canceledButPaid.situation":
    "Platba zrušená na jiném zařízení byla přesto zaplacena kartou.",
  "landing.terminal.edge.canceledButPaid.see": "V detailu platby:",
  "landing.terminal.edge.canceledButPaid.do":
    "Označte platbu jako zaplacenou, nebo peníze vraťte.",
  "landing.terminal.edge.canceledButPaid.records":
    "Platbu kartou – peníze z karty odešly, takže se započítají.",
  "landing.terminal.edge.reversalDeclined.situation":
    "Storno po uzávěrce, která proběhla mimo aplikaci {appName}.",
  "landing.terminal.edge.reversalDeclined.see": "Na obrazovce vrácení peněz:",
  "landing.terminal.edge.reversalDeclined.do":
    "Vraťte peníze místo toho na kartu.",
  "landing.terminal.edge.reversalDeclined.records":
    "Vrácení, jakmile ho terminál schválí. Pokud už platba stornovaná je, nic se neuloží dvakrát.",
  "landing.terminal.edge.refundUnknown.situation":
    "Výsledek vrácení peněz na kartu není známý.",
  "landing.terminal.edge.refundUnknown.see": "U vrácení v detailu platby:",
  "landing.terminal.edge.refundUnknown.do":
    "Nechte aplikaci zeptat se SwitchioPay, nebo vrácení zkontrolujte ve SwitchioPay sami a upozornění zavřete.",
  "landing.terminal.edge.refundUnknown.records":
    "Vrácení, až když ho SwitchioPay potvrdí. Do té doby nejde z této platby vracet nic dalšího.",
  "landing.terminal.edge.refundElsewhere.situation":
    "Vrácení čeká na SwitchioPay na jiném zařízení.",
  "landing.terminal.edge.refundElsewhere.see": "U vrácení v detailu platby:",
  "landing.terminal.edge.refundElsewhere.do":
    "Počkejte. Pokud už to zařízení není k dispozici, zkontrolujte vrácení ve SwitchioPay a upozornění zavřete.",
  "landing.terminal.edge.refundElsewhere.records":
    "Cokoli, co SwitchioPay na tom zařízení schválí, i po zavření upozornění.",
  "landing.terminal.edge.closureUnknown.situation":
    "Výsledek uzávěrky není známý.",
  "landing.terminal.edge.closureUnknown.see": "Na obrazovce uzávěrek:",
  "landing.terminal.edge.closureUnknown.do":
    "Zkontrolujte ve SwitchioPay, jestli se dávka uzavřela.",
  "landing.terminal.edge.closureUnknown.records":
    "Nic, ukládá se jen uzávěrka se srozumitelnými součty.",
  "landing.terminal.edge.demo.situation": "Demo účet.",
  "landing.terminal.edge.demo.see": "Při placení:",
  "landing.terminal.edge.demo.do":
    "Platby kartou přijímejte ve skutečném účtu.",
  "landing.terminal.edge.demo.records":
    "Nic, demo účet SwitchioPay nikdy nespustí.",
  "landing.terminal.edge.offline.situation":
    "Terminál není připojený k internetu.",
  "landing.terminal.edge.offline.see":
    "Aplikace {appName} funguje dál, protože se SwitchioPay komunikuje přímo na terminálu. SwitchioPay ale internet k autorizaci karty potřebuje.",
  "landing.terminal.edge.offline.do": "Obnovte připojení.",
  "landing.terminal.edge.offline.records":
    "Vše se uloží na terminálu a ostatní zařízení podniku to uvidí, jakmile bude znovu online.",

  "landing.terminal.testing.eyebrow": "Testování",
  "landing.terminal.testing.title": "Testování v prostředí Comgate",
  "landing.terminal.testing.body":
    "V testovacím prostředí Comgate určuje výsledek platby její částka a fungují jen bezkontaktní platby. Zadejte na klávesnici tyto částky:",
  "landing.terminal.testing.column.amount": "Částka",
  "landing.terminal.testing.column.simulator": "Odpověď simulátoru",
  "landing.terminal.testing.column.app": "Co ukáže {appName}",
  "landing.terminal.testing.approved.amount": "1,01 Kč",
  "landing.terminal.testing.approved.simulator": "Potvrzeno",
  "landing.terminal.testing.approved.app": "Platba je přijatá a zaplacená.",
  "landing.terminal.testing.partial.amount": "2,01 Kč",
  "landing.terminal.testing.partial.simulator": "Potvrzeno – částečně",
  "landing.terminal.testing.partial.app":
    "Ověřujeme na vývojovém terminálu; {appName} o částečné schválení nežádá.",
  "landing.terminal.testing.duplicate.amount": "1,10 Kč",
  "landing.terminal.testing.duplicate.simulator": "Duplicitní transakce",
  "landing.terminal.testing.insufficientFunds.amount": "6,02 Kč",
  "landing.terminal.testing.insufficientFunds.simulator":
    "Nedostatek prostředků",
  "landing.terminal.testing.expiredCard.amount": "6,05 Kč",
  "landing.terminal.testing.expiredCard.simulator": "Karta s prošlou platností",
  "landing.terminal.testing.authorizationTimeout.amount": "7,09 Kč",
  "landing.terminal.testing.authorizationTimeout.simulator":
    "Vypršel časový limit autorizace",
  "landing.terminal.testing.cardTimeout.amount": "31,09 Kč",
  "landing.terminal.testing.cardTimeout.simulator":
    "Vypršel časový limit pro přiložení karty",
  "landing.terminal.testing.other.amount": "Jakákoli jiná částka",
  "landing.terminal.testing.other.simulator": "Potvrzeno",
  "landing.terminal.testing.declined":
    "Platba zůstane nezaplacená a můžete ji zkusit kartou znovu.",
  "landing.terminal.testing.operations":
    "Storno, vrácení na kartu a uzávěrku vyzkoušíte podle návodu výše: zaplaťte 1,01 Kč a platbu stornujte, pak zaplaťte další platbu, proveďte uzávěrku a tuto platbu vraťte na kartu.",
  "landing.terminal.testing.source":
    "Částky jsou převzaté z dokumentace simulátoru Comgate, ověřeno 13. 11. 2026.",
  "landing.terminal.testing.sourceLink": "apidoc.comgate.cz",

  "landing.terminal.limits.eyebrow": "Omezení",
  "landing.terminal.limits.title": "Co {appName} neumí",
  "landing.terminal.limits.receipts":
    "Netiskne účtenky – tiskne je SwitchioPay na tiskárně terminálu podle svého nastavení.",
  "landing.terminal.limits.operations":
    "Nepodporuje předautorizace, platby MOTO ani cashback.",
  "landing.terminal.limits.unlinkedRefund":
    "Nevrací peníze bez původní platby – každé vrácení na kartu patří k platbě přijaté v aplikaci.",
  "landing.terminal.limits.autoClosure":
    "Nespouští uzávěrku automaticky – musí ji spustit obsluha.",
  "landing.terminal.limits.reconciliation":
    "Zatím neporovnává součty z uzávěrky se svými platbami.",

  "landing.terminal.faq.otherTerminal.question":
    "Můžu vrátit platbu, která proběhla na jiném terminálu?",
  "landing.terminal.faq.otherTerminal.answer":
    "Ano, na kartu. Stornovat platbu může jen terminál, na kterém proběhla. Na kterémkoli jiném terminálu podniku vrátí {appName} peníze na kartu, kterou zákazník platil.",
  "landing.terminal.faq.forgotClosure.question":
    "Co když zapomenu udělat uzávěrku?",
  "landing.terminal.faq.forgotClosure.answer":
    "Udělejte ji, jakmile na to přijdete – dávka obsahuje všechny platby kartou od poslední uzávěrky. Pokud dávku uzavře SwitchioPay sám, {appName} o tom neví. Storno, které pak terminál odmítne, aplikace nabídne jako vrácení na kartu.",
  "landing.terminal.faq.cardNumber.question": "Vidí {appName} číslo karty?",
  "landing.terminal.faq.cardNumber.answer":
    "Ne. Kartu čte SwitchioPay a {appName} od něj dostane jen maskované číslo karty, typ karty, autorizační kód a ID transakce, které uloží k platbě.",
  "landing.terminal.faq.receipts.question": "Kdo tiskne účtenku?",
  "landing.terminal.faq.receipts.answer":
    "SwitchioPay, na tiskárně terminálu podle svého nastavení. {appName} sám nic netiskne.",
  "landing.terminal.faq.login.question":
    "Potřebuji k testování účet nebo přihlašovací údaje?",
  "landing.terminal.faq.login.answer":
    "Ne. {appName} žádné přihlašování nemá: nainstalujte ho, projděte prvním spuštěním a zapněte platby kartou. Bez nastaveného PINu může obsluha dělat všechno.",

  "landing.terminal.shot.settings-payments.alt":
    "Nastavení aplikace {appName} s položkou Platební metody v sekci Platby",
  "landing.terminal.shot.payment-methods-off.alt":
    "Platební metody s vypnutou platební kartou",
  "landing.terminal.shot.payment-methods-on.alt":
    "Platební metody se zapnutou platební kartou jako výchozí metodou",
  "landing.terminal.shot.card-settings.alt":
    "Nastavení platební karty s odkazem na uzávěrky terminálů",
  "landing.terminal.shot.pay-amount.alt":
    "Klávesnice se zadanou částkou a tlačítkem Zaplatit",
  "landing.terminal.shot.pay-tip.alt": "Výběr spropitného",
  "landing.terminal.shot.pay-card-tab.alt":
    "Platební obrazovka na záložce Platební karta",
  "landing.terminal.shot.pay-waiting.alt": "Čekání na terminál",
  "landing.terminal.shot.pay-received.alt": "Přijatá platba",
  "landing.terminal.shot.pay-detail.alt":
    "Detail platby kartou s maskovaným číslem karty, autorizačním kódem a ID terminálu",
  "landing.terminal.shot.refund-button.alt":
    "Detail platby kartou s tlačítkem Vrátit peníze",
  "landing.terminal.shot.refund-reversal.alt":
    "Vrácení celé platby stornem ve SwitchioPay",
  "landing.terminal.shot.refund-running.alt":
    "Vrácení peněz čeká na SwitchioPay",
  "landing.terminal.shot.refund-reversed-detail.alt":
    "Detail vrácení stornem na terminálu",
  "landing.terminal.shot.refund-referral.alt":
    "Po uzávěrce aplikace nabízí vrácení peněz na kartu",
  "landing.terminal.shot.refund-partial.alt": "Vrácení části platby",
  "landing.terminal.shot.refund-tip-only.alt": "Vrácení jen spropitného",
  "landing.terminal.shot.refund-referral-detail.alt":
    "Detail vrácení peněz na kartu",
  "landing.terminal.shot.reversal-declined.alt":
    "Terminál odmítl storno a aplikace nabízí vrácení na kartu",
  "landing.terminal.shot.closure-row.alt":
    "Nastavení s položkou Uzávěrky terminálů",
  "landing.terminal.shot.closure-page.alt":
    "Uzávěrky terminálů s poslední uzávěrkou tohoto terminálu",
  "landing.terminal.shot.closure-confirm.alt": "Potvrzení uzávěrky",
  "landing.terminal.shot.closure-detail.alt":
    "Detail uzávěrky se souhrnem, číslem dávky a číslem směny",
  "landing.terminal.shot.edge-declined.alt":
    "Záložka Platební karta po zamítnutí karty",
  "landing.terminal.shot.edge-unknown.alt":
    "Záložka Platební karta s neznámým výsledkem platby",
  "landing.terminal.shot.edge-unknown-resolved.alt":
    "Přijatá platba poté, co ji SwitchioPay dodatečně potvrdil",
  "landing.terminal.shot.edge-charge-again.alt":
    "Potvrzení před dalším pokusem o platbu kartou",
  "landing.terminal.shot.edge-busy.alt":
    "Záložka Platební karta, když je SwitchioPay zaneprázdněný",
  "landing.terminal.shot.edge-not-installed.alt":
    "Upozornění, že SwitchioPay není nainstalovaný",
  "landing.terminal.shot.edge-restored.alt":
    "Oznámení, že platba kartou byla zpracována po restartu aplikace",
  "landing.terminal.shot.edge-canceled-but-paid.alt":
    "Zrušená platba zaplacená kartou s možností označit ji jako zaplacenou nebo peníze vrátit",
  "landing.terminal.shot.edge-refund-unknown.alt":
    "Vrácení s neznámým výsledkem a tlačítkem pro dotaz na SwitchioPay",
  "landing.terminal.shot.edge-closure-unknown.alt":
    "Uzávěrky terminálů s uzávěrkou, jejíž výsledek není známý",
  "landing.terminal.shot.edge-demo.alt":
    "Oznámení, že v demo účtu nejde přijmout skutečnou platbu kartou",
} as const satisfies Record<keyof typeof enTerminal, string>
