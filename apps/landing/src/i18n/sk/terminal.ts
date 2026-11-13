import { skCommon } from "@payky/app-shared/i18n/sk/common"
import { skPayment } from "@payky/app-shared/i18n/sk/payment"
import { skSettings } from "@payky/app-shared/i18n/sk/settings"
import type { enTerminal } from "../en/terminal.ts"
import { pickTerminalAppLabels } from "../terminal-app-labels.ts"

/**
 * The card terminal documentation (landing/0015), which only Finito's
 * landing shows. The app's labels it quotes come from the app's copy.
 */
export const skTerminal = {
  ...pickTerminalAppLabels({ ...skCommon, ...skPayment, ...skSettings }),
  "landing.terminal.meta.title":
    "{appName} a kartový terminál SwitchioPay: platba, storno, refundácia a uzávierka",
  "landing.terminal.meta.description":
    "Ako prijímať platby kartou v aplikácii {appName} na termináli NEXGO so SwitchioPay: zapnutie, platba, storno, vrátenie peňazí na kartu, uzávierka, neštandardné situácie a testovanie u Comgate.",
  "landing.terminal.hero.eyebrow": "Platby kartou",
  "landing.terminal.hero.title": "{appName} a kartový terminál SwitchioPay",
  "landing.terminal.hero.body":
    "Aplikácia {appName} beží priamo na platobnom termináli NEXGO N92 vedľa aplikácie SwitchioPay. Pri platbe kartou jej iba odovzdá sumu, s údajmi z karty vôbec nepracuje. Účtenky tlačí SwitchioPay na tlačiarni terminálu podľa svojich nastavení.",
  "landing.terminal.hero.note":
    "Všetky snímky obrazovky na tejto stránke pochádzajú priamo z aplikácie. Kroky, ktoré prebiehajú v aplikácii SwitchioPay, zastupuje sivá plocha s popisom.",
  "landing.terminal.toc.title": "Obsah",
  "landing.terminal.switchioPay.name": "SwitchioPay",

  "landing.terminal.switchioPay.cardTap": "Zákazník priloží kartu",
  "landing.terminal.switchioPay.reversal": "Storno platby",
  "landing.terminal.switchioPay.refund": "Vrátenie peňazí na kartu",
  "landing.terminal.switchioPay.closure": "Uzávierka",

  "landing.terminal.requirements.eyebrow": "Skôr než začnete",
  "landing.terminal.requirements.title": "Čo budete potrebovať",
  "landing.terminal.requirements.terminal":
    "Platobný terminál NEXGO s aplikáciou SwitchioPay a zmluvu s Comgate.",
  "landing.terminal.requirements.install":
    "Aplikáciu {appName} nainštalovanú na terminál zo Switchio Store (podpísanú spoločnosťou Comgate).",
  "landing.terminal.requirements.onboarding":
    "Dokončené prvé spustenie, pri ktorom si za minútu založíte účet podniku.",
  "landing.terminal.requirements.permissions.title": "Oprávnenia",
  "landing.terminal.requirements.permissions.body":
    "Keď majiteľ nastaví PIN, každá z týchto akcií vyžaduje príslušné oprávnenie:",
  "landing.terminal.requirements.permissions.activation":
    "Zapnutie platieb kartou",
  "landing.terminal.requirements.permissions.refund":
    "Storno a vrátenie peňazí na kartu",
  "landing.terminal.requirements.permissions.closure": "Uzávierka",
  "landing.terminal.requirements.tester.title": "Pre testerov Comgate",
  "landing.terminal.requirements.tester.body":
    "Na testovanie nepotrebujete žiadne prihlasovacie údaje ani testovací účet. Nainštalujte APK, prejdite prvým spustením a PIN nenastavujte – obsluha potom môže robiť všetko. Nakoniec zapnite platby kartou podľa návodu nižšie.",

  "landing.terminal.activation.eyebrow": "Zapnutie",
  "landing.terminal.activation.title": "Zapnite platby kartou",
  "landing.terminal.activation.body":
    "Stačí to urobiť raz v nastaveniach. Platí to pre všetky zariadenia podniku.",
  "landing.terminal.activation.step.settings":
    "Otvorte Nastavenia a v nich Platobné metódy.",
  "landing.terminal.activation.step.off":
    "Platby kartou sú predvolene vypnuté. Ak na termináli chýba SwitchioPay, upozorní vás na to text pri platobnej karte.",
  "landing.terminal.activation.step.on":
    "Zapnite prepínač. Pri platení sa ako prvá otvorí metóda označená ako predvolená; poradie metód zmeníte presunutím.",
  "landing.terminal.activation.step.card":
    "Po ťuknutí na platobnú kartu uvidíte, čo platby kartou vyžadujú, a odkaz na uzávierky terminálov.",

  "landing.terminal.payment.eyebrow": "Platba",
  "landing.terminal.payment.title": "Prijatie platby kartou",
  "landing.terminal.payment.body":
    "{appName} odovzdá aplikácii SwitchioPay sumu, osobitne prepitné, menu a číslo platby ako číslo dokladu.",
  "landing.terminal.payment.step.amount":
    "Zadajte sumu a ťuknite na Zaplatiť. Účet za stôl alebo z katalógu sa platí rovnako.",
  "landing.terminal.payment.step.tip":
    "Ak máte zapnuté prepitné, zákazník si ho vyberie. SwitchioPay ho dostane oddelene od sumy.",
  "landing.terminal.payment.step.cardTab":
    "Na záložke Platobná karta spustite platbu.",
  "landing.terminal.payment.step.waiting":
    "{appName} počká, kým SwitchioPay platbu dokončí.",
  "landing.terminal.payment.step.switchioPay":
    "Ďalej pokračuje SwitchioPay: zákazník priloží kartu, a ak o to terminál požiada, zadá PIN.",
  "landing.terminal.payment.step.received":
    "Po návrate do aplikácie je platba prijatá.",
  "landing.terminal.payment.step.detail":
    "V detaile platby nájdete maskované číslo karty, typ karty, autorizačný kód, ID transakcie a ID terminálu.",
  "landing.terminal.payment.note":
    "K schválenej platbe si {appName} uloží všetko, čo je potrebné na jej neskoršie vrátenie: ID transakcie, identifikátor na refundáciu, zariadenie, na ktorom platba prebehla, a čas schválenia.",

  "landing.terminal.reversal.eyebrow": "Storno",
  "landing.terminal.reversal.title": "Storno platby pred uzávierkou",
  "landing.terminal.reversal.body":
    "Storno zruší celú platbu priamo na termináli a karta pri ňom nie je potrebná. Aplikácia {appName} ho použije automaticky, ak sú splnené všetky tieto podmienky:",
  "landing.terminal.reversal.rule.whole":
    "vraciate celú platbu vrátane prepitného,",
  "landing.terminal.reversal.rule.first": "z platby sa zatiaľ nič nevracalo,",
  "landing.terminal.reversal.rule.sameTerminal":
    "ste na termináli, na ktorom platba prebehla,",
  "landing.terminal.reversal.rule.noClosure":
    "na tomto termináli od platby neprebehla uzávierka spustená z aplikácie {appName}.",
  "landing.terminal.reversal.step.button":
    "V Aktivite otvorte platbu a ťuknite na Vrátiť peniaze.",
  "landing.terminal.reversal.step.choose":
    "Vyberte celú platbu. Pri spôsobe vrátenia uvidíte, že terminál vezme platbu späť celú a karta nie je potrebná.",
  "landing.terminal.reversal.step.running":
    "Potvrďte vrátenie. {appName} počká, kým SwitchioPay platbu stornuje.",
  "landing.terminal.reversal.step.switchioPay":
    "SwitchioPay stornuje presne tú transakciu, ktorej ID mu aplikácia odovzdala.",
  "landing.terminal.reversal.step.detail":
    "V detaile vrátenia je uvedené, že platba bola stornovaná na termináli, spolu s ID transakcie, autorizačným kódom a poradovým číslom.",

  "landing.terminal.refund.eyebrow": "Refundácia",
  "landing.terminal.refund.title": "Vrátenie peňazí na kartu po uzávierke",
  "landing.terminal.refund.body":
    "Keď storno nie je možné, vráti {appName} peniaze na kartu, ktorou zákazník platil. Tak je to po uzávierke, pri vrátení iba časti platby alebo iba prepitného, keď sa už z platby niečo vracalo, alebo keď vraciate na inom termináli, než na ktorom platba prebehla.",
  "landing.terminal.refund.step.referral":
    "Po uzávierke ponúkne rovnaká obrazovka vrátenie na kartu, ktorou zákazník platil.",
  "landing.terminal.refund.step.partial":
    "Pri vrátení časti platby zadajte sumu alebo vyberte položky.",
  "landing.terminal.refund.step.tip": "Prepitné môžete vrátiť aj samostatne.",
  "landing.terminal.refund.step.switchioPay":
    "SwitchioPay vráti peniaze na kartu; ďalej postupujte podľa pokynov na termináli.",
  "landing.terminal.refund.step.detail":
    "V detaile vrátenia uvidíte, že peniaze išli späť na kartu, aj údaje, ktoré terminál vrátil.",
  "landing.terminal.refund.step.declined":
    "Ak bola dávka uzavretá mimo aplikácie {appName}, terminál storno odmietne. Aplikácia potom overí v SwitchioPay, či platba predsa len nie je stornovaná, a ak nie, ponúkne namiesto storna vrátenie na kartu.",

  "landing.terminal.closure.eyebrow": "Uzávierka",
  "landing.terminal.closure.title": "Uzávierka po každej zmene",
  "landing.terminal.closure.body":
    "Uzávierka odošle platby kartou z terminálu na vyrovnanie. Robte ju každý deň po skončení zmeny, na každom termináli zvlášť.",
  "landing.terminal.closure.step.row":
    "V Nastaveniach otvorte Uzávierky terminálov. Táto položka sa zobrazí po zapnutí platieb kartou.",
  "landing.terminal.closure.step.page":
    "Uvidíte poslednú uzávierku tohto terminálu. Spustite novú.",
  "landing.terminal.closure.step.confirm":
    "Potvrďte, že sa platby kartou od poslednej uzávierky majú odoslať na vyrovnanie.",
  "landing.terminal.closure.step.switchioPay": "SwitchioPay uzavrie dávku.",
  "landing.terminal.closure.step.detail":
    "{appName} uloží súhrn uzávierky (platby vrátane prepitného, vrátené platby, úpravy platieb) s číslom dávky a zmeny. História uzávierok a prehľad všetkých terminálov podniku sú viditeľné na každom zariadení.",
  "landing.terminal.closure.note.perTerminal":
    "Každý terminál uzatvára iba svoju vlastnú dávku, a to priamo na sebe.",
  "landing.terminal.closure.note.outside":
    "O uzávierke spustenej priamo v aplikácii SwitchioPay alebo vykonanej automaticky aplikácia {appName} nevie.",
  "landing.terminal.closure.note.reconciliation":
    "Súčty z uzávierky aplikácia {appName} zatiaľ neporovnáva so svojimi platbami.",

  "landing.terminal.edge.eyebrow": "Neštandardné situácie",
  "landing.terminal.edge.title": "Keď niečo nejde podľa plánu",
  "landing.terminal.edge.body":
    "Čo uvidíte, čo máte urobiť a čo sa v aplikácii uloží. Platba sa považuje za zaplatenú, iba keď ju SwitchioPay schválil. Ak výsledok nie je jasný, aplikácia pred ďalším pokusom o platbu chce, aby ste ho najprv overili.",
  "landing.terminal.edge.column.situation": "Situácia",
  "landing.terminal.edge.column.see": "Čo uvidíte",
  "landing.terminal.edge.column.do": "Čo urobiť",
  "landing.terminal.edge.column.records": "Čo sa uloží",
  "landing.terminal.edge.declined.situation":
    "Karta je zamietnutá alebo banka zákazníka platbu odmietne.",
  "landing.terminal.edge.declined.see": "Hlásenie na záložke Platobná karta:",
  "landing.terminal.edge.declined.do":
    "Skúste platbu kartou znova, alebo nech zákazník zaplatí inak.",
  "landing.terminal.edge.declined.records": "Nič, platba zostáva nezaplatená.",
  "landing.terminal.edge.canceled.situation": "Platba je zrušená na termináli.",
  "landing.terminal.edge.canceled.see":
    "Podľa odpovede SwitchioPay platba buď neprebehla, alebo má neznámy výsledok. Toto správanie ešte overujeme na vývojovom termináli Comgate.",
  "landing.terminal.edge.canceled.do":
    "Skúste platbu znova; pri neznámom výsledku najprv skontrolujte SwitchioPay.",
  "landing.terminal.edge.canceled.records":
    "Nič, kým SwitchioPay platbu neschváli.",
  "landing.terminal.edge.unknown.situation":
    "SwitchioPay nevráti zrozumiteľný výsledok, napríklad keď spadne alebo ho ukončí Android.",
  "landing.terminal.edge.unknown.see":
    "Upozornenie, že výsledok nie je známy. Aplikácia sa potom na transakciu sama opýta SwitchioPay.",
  "landing.terminal.edge.unknown.do":
    "Počkajte na odpoveď. Ak SwitchioPay schválenie nepotvrdí, skontrolujte transakciu priamo v SwitchioPay.",
  "landing.terminal.edge.unknown.records":
    "Platbu ako zaplatenú, až keď SwitchioPay schválenie potvrdí. Pri akejkoľvek inej odpovedi zostane výsledok neznámy.",
  "landing.terminal.edge.chargeAgain.situation":
    "Chcete zaplatiť kartou znova, hoci výsledok predchádzajúceho pokusu nie je známy.",
  "landing.terminal.edge.chargeAgain.see":
    "Potvrdzovacie okno s varovaním, že platba z karty už mohla prebehnúť:",
  "landing.terminal.edge.chargeAgain.do":
    "Potvrďte až potom, čo v SwitchioPay overíte, že predchádzajúci pokus neprešiel.",
  "landing.terminal.edge.chargeAgain.records":
    "Nový pokus s novým ID transakcie.",
  "landing.terminal.edge.busy.situation":
    "SwitchioPay je zaneprázdnený inou operáciou alebo sa nespustí.",
  "landing.terminal.edge.busy.see":
    "Upozornenie, že SwitchioPay je zaneprázdnený a máte to skúsiť znova.",
  "landing.terminal.edge.busy.do":
    "Dokončite rozpracovanú operáciu v SwitchioPay a spustite platbu znova.",
  "landing.terminal.edge.busy.records": "Nič, terminál sa vôbec nespustil.",
  "landing.terminal.edge.notInstalled.situation":
    "Na termináli nie je nainštalovaný SwitchioPay.",
  "landing.terminal.edge.notInstalled.see":
    "Upozornenie pri platobnej karte v nastaveniach a pri platení:",
  "landing.terminal.edge.notInstalled.do":
    "Nechajte SwitchioPay na terminál nainštalovať a nastaviť.",
  "landing.terminal.edge.notInstalled.records": "Nič.",
  "landing.terminal.edge.restored.situation":
    "Android aplikáciu {appName} ukončí vo chvíli, keď je na obrazovke SwitchioPay.",
  "landing.terminal.edge.restored.see": "Po návrate do aplikácie:",
  "landing.terminal.edge.restored.do":
    "Nič. Výsledok z terminálu sa nestratí a spracuje sa, hneď ako sa aplikácia znova otvorí.",
  "landing.terminal.edge.restored.records":
    "Platbu podľa toho, čo SwitchioPay ohlásil.",
  "landing.terminal.edge.otherAccount.situation":
    "Uložený výsledok patrí inému účtu na tomto termináli.",
  "landing.terminal.edge.otherAccount.see":
    "Nič, kým sa na ten účet neprepnete.",
  "landing.terminal.edge.otherAccount.do":
    "Prepnite sa na účet, v ktorom platba vznikla. Dovtedy terminál ďalšiu platbu nespustí.",
  "landing.terminal.edge.otherAccount.records":
    "Výsledok sa uloží iba do účtu, ku ktorému patrí.",
  "landing.terminal.edge.canceledButPaid.situation":
    "Platba zrušená na inom zariadení bola napriek tomu zaplatená kartou.",
  "landing.terminal.edge.canceledButPaid.see": "V detaile platby:",
  "landing.terminal.edge.canceledButPaid.do":
    "Označte platbu ako zaplatenú, alebo peniaze vráťte.",
  "landing.terminal.edge.canceledButPaid.records":
    "Platbu kartou – peniaze z karty odišli, takže sa započítajú.",
  "landing.terminal.edge.reversalDeclined.situation":
    "Storno po uzávierke, ktorá prebehla mimo aplikácie {appName}.",
  "landing.terminal.edge.reversalDeclined.see": "Na obrazovke vrátenia peňazí:",
  "landing.terminal.edge.reversalDeclined.do":
    "Vráťte peniaze namiesto toho na kartu.",
  "landing.terminal.edge.reversalDeclined.records":
    "Vrátenie, hneď ako ho terminál schváli. Ak už platba stornovaná je, nič sa neuloží dvakrát.",
  "landing.terminal.edge.refundUnknown.situation":
    "Výsledok vrátenia peňazí na kartu nie je známy.",
  "landing.terminal.edge.refundUnknown.see": "Pri vrátení v detaile platby:",
  "landing.terminal.edge.refundUnknown.do":
    "Nechajte aplikáciu opýtať sa SwitchioPay, alebo vrátenie skontrolujte v SwitchioPay sami a upozornenie zatvorte.",
  "landing.terminal.edge.refundUnknown.records":
    "Vrátenie, až keď ho SwitchioPay potvrdí. Dovtedy sa z tejto platby nedá vracať nič ďalšie.",
  "landing.terminal.edge.refundElsewhere.situation":
    "Vrátenie čaká na SwitchioPay na inom zariadení.",
  "landing.terminal.edge.refundElsewhere.see": "Pri vrátení v detaile platby:",
  "landing.terminal.edge.refundElsewhere.do":
    "Počkajte. Ak už to zariadenie nie je k dispozícii, skontrolujte vrátenie v SwitchioPay a upozornenie zatvorte.",
  "landing.terminal.edge.refundElsewhere.records":
    "Čokoľvek, čo SwitchioPay na tom zariadení schváli, aj po zatvorení upozornenia.",
  "landing.terminal.edge.closureUnknown.situation":
    "Výsledok uzávierky nie je známy.",
  "landing.terminal.edge.closureUnknown.see": "Na obrazovke uzávierok:",
  "landing.terminal.edge.closureUnknown.do":
    "Skontrolujte v SwitchioPay, či sa dávka uzavrela.",
  "landing.terminal.edge.closureUnknown.records":
    "Nič, ukladá sa iba uzávierka so zrozumiteľnými súčtami.",
  "landing.terminal.edge.demo.situation": "Demo účet.",
  "landing.terminal.edge.demo.see": "Pri platení:",
  "landing.terminal.edge.demo.do": "Platby kartou prijímajte v skutočnom účte.",
  "landing.terminal.edge.demo.records":
    "Nič, demo účet SwitchioPay nikdy nespustí.",
  "landing.terminal.edge.offline.situation":
    "Terminál nie je pripojený na internet.",
  "landing.terminal.edge.offline.see":
    "Aplikácia {appName} funguje ďalej, pretože so SwitchioPay komunikuje priamo na termináli. SwitchioPay však internet na autorizáciu karty potrebuje.",
  "landing.terminal.edge.offline.do": "Obnovte pripojenie.",
  "landing.terminal.edge.offline.records":
    "Všetko sa uloží na termináli a ostatné zariadenia podniku to uvidia, hneď ako bude znova online.",

  "landing.terminal.testing.eyebrow": "Testovanie",
  "landing.terminal.testing.title": "Testovanie v prostredí Comgate",
  "landing.terminal.testing.body":
    "V testovacom prostredí Comgate určuje výsledok platby jej suma a fungujú iba bezkontaktné platby. Zadajte na klávesnici tieto sumy:",
  "landing.terminal.testing.column.amount": "Suma",
  "landing.terminal.testing.column.simulator": "Odpoveď simulátora",
  "landing.terminal.testing.column.app": "Čo ukáže {appName}",
  "landing.terminal.testing.approved.amount": "1,01 Kč",
  "landing.terminal.testing.approved.simulator": "Potvrdené",
  "landing.terminal.testing.approved.app": "Platba je prijatá a zaplatená.",
  "landing.terminal.testing.partial.amount": "2,01 Kč",
  "landing.terminal.testing.partial.simulator": "Potvrdené – čiastočne",
  "landing.terminal.testing.partial.app":
    "Overujeme na vývojovom termináli; {appName} o čiastočné schválenie nežiada.",
  "landing.terminal.testing.duplicate.amount": "1,10 Kč",
  "landing.terminal.testing.duplicate.simulator": "Duplicitná transakcia",
  "landing.terminal.testing.insufficientFunds.amount": "6,02 Kč",
  "landing.terminal.testing.insufficientFunds.simulator":
    "Nedostatok prostriedkov",
  "landing.terminal.testing.expiredCard.amount": "6,05 Kč",
  "landing.terminal.testing.expiredCard.simulator":
    "Karta s uplynutou platnosťou",
  "landing.terminal.testing.authorizationTimeout.amount": "7,09 Kč",
  "landing.terminal.testing.authorizationTimeout.simulator":
    "Vypršal časový limit autorizácie",
  "landing.terminal.testing.cardTimeout.amount": "31,09 Kč",
  "landing.terminal.testing.cardTimeout.simulator":
    "Vypršal časový limit na priloženie karty",
  "landing.terminal.testing.other.amount": "Akákoľvek iná suma",
  "landing.terminal.testing.other.simulator": "Potvrdené",
  "landing.terminal.testing.declined":
    "Platba zostane nezaplatená a môžete ju skúsiť kartou znova.",
  "landing.terminal.testing.operations":
    "Storno, vrátenie na kartu a uzávierku vyskúšate podľa návodu vyššie: zaplaťte 1,01 Kč a platbu stornujte, potom zaplaťte ďalšiu platbu, urobte uzávierku a túto platbu vráťte na kartu.",
  "landing.terminal.testing.source":
    "Sumy sú prevzaté z dokumentácie simulátora Comgate, overené 13. 11. 2026.",
  "landing.terminal.testing.sourceLink": "apidoc.comgate.cz",

  "landing.terminal.limits.eyebrow": "Obmedzenia",
  "landing.terminal.limits.title": "Čo {appName} nevie",
  "landing.terminal.limits.receipts":
    "Netlačí účtenky – tlačí ich SwitchioPay na tlačiarni terminálu podľa svojich nastavení.",
  "landing.terminal.limits.operations":
    "Nepodporuje predautorizácie, platby MOTO ani cashback.",
  "landing.terminal.limits.unlinkedRefund":
    "Nevracia peniaze bez pôvodnej platby – každé vrátenie na kartu patrí k platbe prijatej v aplikácii.",
  "landing.terminal.limits.autoClosure":
    "Nespúšťa uzávierku automaticky – musí ju spustiť obsluha.",
  "landing.terminal.limits.reconciliation":
    "Zatiaľ neporovnáva súčty z uzávierky so svojimi platbami.",

  "landing.terminal.faq.otherTerminal.question":
    "Môžem vrátiť platbu, ktorá prebehla na inom termináli?",
  "landing.terminal.faq.otherTerminal.answer":
    "Áno, na kartu. Stornovať platbu môže iba terminál, na ktorom prebehla. Na ktoromkoľvek inom termináli podniku vráti {appName} peniaze na kartu, ktorou zákazník platil.",
  "landing.terminal.faq.forgotClosure.question":
    "Čo ak zabudnem urobiť uzávierku?",
  "landing.terminal.faq.forgotClosure.answer":
    "Urobte ju, hneď ako na to prídete – dávka obsahuje všetky platby kartou od poslednej uzávierky. Ak dávku uzavrie SwitchioPay sám, {appName} o tom nevie. Storno, ktoré potom terminál odmietne, aplikácia ponúkne ako vrátenie na kartu.",
  "landing.terminal.faq.cardNumber.question": "Vidí {appName} číslo karty?",
  "landing.terminal.faq.cardNumber.answer":
    "Nie. Kartu číta SwitchioPay a {appName} od neho dostane iba maskované číslo karty, typ karty, autorizačný kód a ID transakcie, ktoré uloží k platbe.",
  "landing.terminal.faq.receipts.question": "Kto tlačí účtenku?",
  "landing.terminal.faq.receipts.answer":
    "SwitchioPay, na tlačiarni terminálu podľa svojich nastavení. {appName} sám nič netlačí.",
  "landing.terminal.faq.login.question":
    "Potrebujem na testovanie účet alebo prihlasovacie údaje?",
  "landing.terminal.faq.login.answer":
    "Nie. {appName} nemá žiadne prihlasovanie: nainštalujte ho, prejdite prvým spustením a zapnite platby kartou. Bez nastaveného PINu môže obsluha robiť všetko.",

  "landing.terminal.shot.settings-payments.alt":
    "Nastavenia aplikácie {appName} s položkou Platobné metódy v sekcii Platby",
  "landing.terminal.shot.payment-methods-off.alt":
    "Platobné metódy s vypnutou platobnou kartou",
  "landing.terminal.shot.payment-methods-on.alt":
    "Platobné metódy so zapnutou platobnou kartou ako predvolenou metódou",
  "landing.terminal.shot.card-settings.alt":
    "Nastavenia platobnej karty s odkazom na uzávierky terminálov",
  "landing.terminal.shot.pay-amount.alt":
    "Klávesnica so zadanou sumou a tlačidlom Zaplatiť",
  "landing.terminal.shot.pay-tip.alt": "Výber prepitného",
  "landing.terminal.shot.pay-card-tab.alt":
    "Platobná obrazovka na záložke Platobná karta",
  "landing.terminal.shot.pay-waiting.alt": "Čakanie na terminál",
  "landing.terminal.shot.pay-received.alt": "Prijatá platba",
  "landing.terminal.shot.pay-detail.alt":
    "Detail platby kartou s maskovaným číslom karty, autorizačným kódom a ID terminálu",
  "landing.terminal.shot.refund-button.alt":
    "Detail platby kartou s tlačidlom Vrátiť peniaze",
  "landing.terminal.shot.refund-reversal.alt":
    "Vrátenie celej platby stornom v SwitchioPay",
  "landing.terminal.shot.refund-running.alt":
    "Vrátenie peňazí čaká na SwitchioPay",
  "landing.terminal.shot.refund-reversed-detail.alt":
    "Detail vrátenia stornom na termináli",
  "landing.terminal.shot.refund-referral.alt":
    "Po uzávierke aplikácia ponúka vrátenie peňazí na kartu",
  "landing.terminal.shot.refund-partial.alt": "Vrátenie časti platby",
  "landing.terminal.shot.refund-tip-only.alt": "Vrátenie iba prepitného",
  "landing.terminal.shot.refund-referral-detail.alt":
    "Detail vrátenia peňazí na kartu",
  "landing.terminal.shot.reversal-declined.alt":
    "Terminál odmietol storno a aplikácia ponúka vrátenie na kartu",
  "landing.terminal.shot.closure-row.alt":
    "Nastavenia s položkou Uzávierky terminálov",
  "landing.terminal.shot.closure-page.alt":
    "Uzávierky terminálov s poslednou uzávierkou tohto terminálu",
  "landing.terminal.shot.closure-confirm.alt": "Potvrdenie uzávierky",
  "landing.terminal.shot.closure-detail.alt":
    "Detail uzávierky so súhrnom, číslom dávky a číslom zmeny",
  "landing.terminal.shot.edge-declined.alt":
    "Záložka Platobná karta po zamietnutí karty",
  "landing.terminal.shot.edge-unknown.alt":
    "Záložka Platobná karta s neznámym výsledkom platby",
  "landing.terminal.shot.edge-unknown-resolved.alt":
    "Prijatá platba po tom, čo ju SwitchioPay dodatočne potvrdil",
  "landing.terminal.shot.edge-charge-again.alt":
    "Potvrdenie pred ďalším pokusom o platbu kartou",
  "landing.terminal.shot.edge-busy.alt":
    "Záložka Platobná karta, keď je SwitchioPay zaneprázdnený",
  "landing.terminal.shot.edge-not-installed.alt":
    "Upozornenie, že SwitchioPay nie je nainštalovaný",
  "landing.terminal.shot.edge-restored.alt":
    "Oznámenie, že platba kartou bola spracovaná po reštarte aplikácie",
  "landing.terminal.shot.edge-canceled-but-paid.alt":
    "Zrušená platba zaplatená kartou s možnosťou označiť ju ako zaplatenú alebo peniaze vrátiť",
  "landing.terminal.shot.edge-refund-unknown.alt":
    "Vrátenie s neznámym výsledkom a tlačidlom na otázku pre SwitchioPay",
  "landing.terminal.shot.edge-closure-unknown.alt":
    "Uzávierky terminálov s uzávierkou, ktorej výsledok nie je známy",
  "landing.terminal.shot.edge-demo.alt":
    "Oznámenie, že v demo účte nie je možné prijať skutočnú platbu kartou",
} as const satisfies Record<keyof typeof enTerminal, string>
