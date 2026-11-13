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
    "{appName} na kartovom termináli SwitchioPay: platba, storno, refundácia, uzávierka",
  "landing.terminal.meta.description":
    "Ako {appName} prijíma platby kartou na termináli NEXGO cez SwitchioPay: zapnutie, platba, storno, vrátenie peňazí na kartu, uzávierka, krajné situácie a testovanie v prostredí Comgate.",
  "landing.terminal.hero.eyebrow": "Kartový terminál",
  "landing.terminal.hero.title": "{appName} na kartovom termináli SwitchioPay",
  "landing.terminal.hero.body":
    "{appName} beží priamo na platobnom termináli NEXGO N92 vedľa aplikácie SwitchioPay. Pri platbe kartou odovzdá sumu SwitchioPay na tom istom termináli a údaje z karty nikdy nevidí. Účtenky tlačí SwitchioPay na tlačiarni terminálu podľa svojho nastavenia.",
  "landing.terminal.hero.note":
    "Všetky snímky obrazovky na tejto stránke pochádzajú priamo z aplikácie. Kde riadenie prevezme SwitchioPay, zastupuje jeho obrazovku sivá plocha s popisom.",
  "landing.terminal.toc.title": "Na tejto stránke",
  "landing.terminal.switchioPay.name": "SwitchioPay",

  "landing.terminal.switchioPay.cardTap": "Zákazník priloží kartu",
  "landing.terminal.switchioPay.reversal": "Storno platby",
  "landing.terminal.switchioPay.refund": "Vrátenie peňazí na kartu",
  "landing.terminal.switchioPay.closure": "Uzávierka dávky",

  "landing.terminal.requirements.eyebrow": "Skôr než začnete",
  "landing.terminal.requirements.title": "Čo je potrebné",
  "landing.terminal.requirements.terminal":
    "Platobný terminál NEXGO od Comgate so SwitchioPay a zmluva s Comgate.",
  "landing.terminal.requirements.install":
    "Aplikácia {appName} nainštalovaná na termináli zo Switchio Store a podpísaná Comgate.",
  "landing.terminal.requirements.onboarding":
    "Dokončené prvé spustenie aplikácie {appName}, ktoré za minútu založí účet podniku.",
  "landing.terminal.requirements.permissions.title": "Kto smie čo",
  "landing.terminal.requirements.permissions.body":
    "Keď majiteľ nastaví PIN, potrebuje každá akcia svoje oprávnenie:",
  "landing.terminal.requirements.permissions.activation":
    "Zapnutie platieb kartou",
  "landing.terminal.requirements.permissions.refund":
    "Storno a vrátenie peňazí na kartu",
  "landing.terminal.requirements.permissions.closure": "Uzávierka",
  "landing.terminal.requirements.tester.title": "Pre testera Comgate",
  "landing.terminal.requirements.tester.body":
    "{appName} nemá žiadne prihlásenie ani testovací účet, ktorý by bolo treba odovzdať. Nainštalujte APK, prejdite prvým spustením bez nastavenia PIN-u, takže ktokoľvek s terminálom v ruke smie všetko, a zapnite platby kartou podľa návodu nižšie.",

  "landing.terminal.activation.eyebrow": "Zapnutie",
  "landing.terminal.activation.title": "Zapnite platby kartou",
  "landing.terminal.activation.body":
    "Raz za podnik, v nastaveniach. Prepínač platí pre všetky zariadenia podniku.",
  "landing.terminal.activation.step.settings":
    "Otvorte nastavenia a platobné metódy.",
  "landing.terminal.activation.step.off":
    "Platby kartou sú vypnuté, kým ich nezapnete. Keď na termináli chýba SwitchioPay, riadok na to upozorní.",
  "landing.terminal.activation.step.on":
    "Zapnite prepínač. Platobná obrazovka sa otvorí na prvej metóde v zozname, označenej ako predvolená; poradie zmeníte presunutím riadkov.",
  "landing.terminal.activation.step.card":
    "Riadok vedie k tomu, čo platby kartou potrebujú, a k uzávierkam terminálov.",

  "landing.terminal.payment.eyebrow": "Platba",
  "landing.terminal.payment.title": "Prijmite platbu kartou",
  "landing.terminal.payment.body":
    "{appName} pošle SwitchioPay sumu, zvlášť prepitné, menu a číslo platby ako číslo dokladu.",
  "landing.terminal.payment.step.amount":
    "Na klávesnici zadajte sumu a pokračujte k platbe. Účet zo stolov alebo z katalógu sa platí rovnako.",
  "landing.terminal.payment.step.tip":
    "Keď máte zapnuté prepitné, zákazník si ho vyberie. SwitchioPay dostane prepitné oddelene od sumy.",
  "landing.terminal.payment.step.cardTab":
    "Na záložke platobnej karty spustite platbu.",
  "landing.terminal.payment.step.waiting":
    "{appName} čaká, kým SwitchioPay platbu dokončí.",
  "landing.terminal.payment.step.switchioPay":
    "Riadenie prevezme SwitchioPay: zákazník priloží kartu, a keď si to terminál vyžiada, zadá PIN.",
  "landing.terminal.payment.step.received":
    "Späť v aplikácii je platba prijatá.",
  "landing.terminal.payment.step.detail":
    "Detail platby ukazuje maskované číslo karty, značku karty, autorizačný kód, ID transakcie terminálu a ID terminálu.",
  "landing.terminal.payment.note":
    "Pri schválenej platbe si {appName} uloží, čo bude treba na jej vrátenie: ID transakcie, ID, podľa ktorého ju SwitchioPay vracia, zariadenie, ktoré ju prijalo, a čas schválenia.",

  "landing.terminal.reversal.eyebrow": "Storno",
  "landing.terminal.reversal.title": "Stornujte platbu pred uzávierkou",
  "landing.terminal.reversal.body":
    "Storno vezme na termináli späť celú platbu a karta naň nie je potrebná. Aplikácia {appName} ho zvolí sama vždy, keď platí všetko naraz:",
  "landing.terminal.reversal.rule.whole":
    "vracia sa celá platba vrátane prepitného;",
  "landing.terminal.reversal.rule.first": "z platby sa ešte nič nevracalo;",
  "landing.terminal.reversal.rule.sameTerminal":
    "ste na termináli, ktorý platbu prijal;",
  "landing.terminal.reversal.rule.noClosure":
    "na tomto termináli od platby neprebehla uzávierka v aplikácii {appName}.",
  "landing.terminal.reversal.step.button":
    "V aktivite otvorte platbu a spustite vrátenie peňazí.",
  "landing.terminal.reversal.step.choose":
    "Zvoľte celú platbu. Metóda povie, že terminál vezme späť celú platbu a karta nie je potrebná.",
  "landing.terminal.reversal.step.running":
    "Potvrďte vrátenie. {appName} čaká, kým SwitchioPay platbu stornuje.",
  "landing.terminal.reversal.step.switchioPay":
    "SwitchioPay stornuje práve tú transakciu, ktorej ID mu aplikácia odovzdá.",
  "landing.terminal.reversal.step.detail":
    "Detail vrátenia ukazuje platbu stornovanú na termináli s ID transakcie terminálu, autorizačným kódom a poradovým číslom.",

  "landing.terminal.refund.eyebrow": "Refundácia",
  "landing.terminal.refund.title": "Vráťte peniaze na kartu po uzávierke",
  "landing.terminal.refund.body":
    "Vždy, keď storno nejde, vráti {appName} peniaze na kartu, ktorou zákazník platil: po uzávierke, pri vrátení časti platby alebo len prepitného, po skoršom vrátení, alebo na inom termináli, než ktorý platbu prijal.",
  "landing.terminal.refund.step.referral":
    "Po uzávierke ponúkne tá istá obrazovka vrátenie na kartu: peniaze sa vrátia na kartu, ktorou zákazník platil.",
  "landing.terminal.refund.step.partial":
    "Časť platby: zadajte sumu, alebo vyberte položky.",
  "landing.terminal.refund.step.tip": "Samotné prepitné má vlastné vrátenie.",
  "landing.terminal.refund.step.switchioPay":
    "SwitchioPay vráti peniaze na kartu; postupujte podľa terminálu.",
  "landing.terminal.refund.step.detail":
    "Detail vrátenia ukazuje peniaze vrátené na kartu aj to, čo terminál odpovedal.",
  "landing.terminal.refund.step.declined":
    "Keď bola dávka uzavretá mimo aplikácie {appName}, terminál storno odmietne. Aplikácia sa potom opýta SwitchioPay, či platba predsa len nie je stornovaná, a ak nie, ponúkne namiesto storna vrátenie na kartu.",

  "landing.terminal.closure.eyebrow": "Uzávierka",
  "landing.terminal.closure.title": "Uzavrite dávku po každej zmene",
  "landing.terminal.closure.body":
    "Uzávierka pošle platby kartou z terminálu na zúčtovanie. Robte ju každý deň po skončení zmeny, na každom termináli zvlášť.",
  "landing.terminal.closure.step.row":
    "V nastaveniach otvorte uzávierky terminálov. Riadok tam nájdete, keď zapnete platby kartou.",
  "landing.terminal.closure.step.page":
    "Obrazovka ukazuje poslednú uzávierku tohto terminálu. Spustite uzávierku.",
  "landing.terminal.closure.step.confirm":
    "Potvrďte: platby kartou od poslednej uzávierky pôjdu na zúčtovanie.",
  "landing.terminal.closure.step.switchioPay": "SwitchioPay uzavrie dávku.",
  "landing.terminal.closure.step.detail":
    "{appName} zapíše súhrn (platby s prepitným, vrátené platby, úpravy platieb) s číslom dávky a zmeny. História a prehľad všetkých terminálov podniku ho ukážu na každom zariadení.",
  "landing.terminal.closure.note.perTerminal":
    "Každý terminál uzatvára svoju dávku, a to len sám na sebe.",
  "landing.terminal.closure.note.outside":
    "Uzávierku spustenú priamo v SwitchioPay alebo vykonanú samotným SwitchioPay aplikácia {appName} nepozná.",
  "landing.terminal.closure.note.reconciliation":
    "Súčty uzávierky aplikácia {appName} zatiaľ neporovnáva so svojimi platbami.",

  "landing.terminal.edge.eyebrow": "Krajné situácie",
  "landing.terminal.edge.title": "Keď niečo prebehne inak",
  "landing.terminal.edge.body":
    "Čo uvidíte, čo urobiť a čo {appName} zapíše. Platbu počíta ako zaplatenú, len keď ju SwitchioPay schválil, a po nejasnom výsledku chce pred ďalším strhnutím karty kontrolu.",
  "landing.terminal.edge.column.situation": "Situácia",
  "landing.terminal.edge.column.see": "Čo uvidíte",
  "landing.terminal.edge.column.do": "Čo urobiť",
  "landing.terminal.edge.column.records": "Čo {appName} zapíše",
  "landing.terminal.edge.declined.situation":
    "Karta je zamietnutá, alebo banka zákazníka platbu odmietne.",
  "landing.terminal.edge.declined.see": "Hlášku na záložke karty:",
  "landing.terminal.edge.declined.do":
    "Strhnite kartu znova, alebo nech zákazník zaplatí inak.",
  "landing.terminal.edge.declined.records": "Nič: platba zostáva nezaplatená.",
  "landing.terminal.edge.canceled.situation": "Platba je zrušená na termináli.",
  "landing.terminal.edge.canceled.see":
    "Podľa toho, čo SwitchioPay vráti, platba buď neprebehla, alebo má neznámy výsledok. Správanie sa overuje na vývojovom termináli Comgate.",
  "landing.terminal.edge.canceled.do":
    "Strhnite kartu znova; pri neznámom výsledku najprv skontrolujte SwitchioPay.",
  "landing.terminal.edge.canceled.records":
    "Žiadnu platbu, ak SwitchioPay nenahlási schválenie.",
  "landing.terminal.edge.unknown.situation":
    "SwitchioPay nevráti čitateľný výsledok, napríklad keď spadne alebo ho zavrie Android.",
  "landing.terminal.edge.unknown.see":
    "Že výsledok nie je známy. Aplikácia sa potom SwitchioPay na transakciu sama opýta.",
  "landing.terminal.edge.unknown.do":
    "Počkajte na odpoveď. Keď SwitchioPay schválenie nepotvrdí, skontrolujte transakciu v SwitchioPay.",
  "landing.terminal.edge.unknown.records":
    "Platbu ako zaplatenú, až keď SwitchioPay potvrdí schválenie; akákoľvek iná odpoveď nechá výsledok neznámy.",
  "landing.terminal.edge.chargeAgain.situation":
    "Strhávate kartu znova, hoci výsledok minulého pokusu nie je známy.",
  "landing.terminal.edge.chargeAgain.see":
    "Potvrdenie s varovaním, že karta už mohla byť strhnutá:",
  "landing.terminal.edge.chargeAgain.do":
    "Potvrďte, až keď v SwitchioPay overíte, že minulý pokus neprešiel.",
  "landing.terminal.edge.chargeAgain.records":
    "Nový pokus s novým ID transakcie.",
  "landing.terminal.edge.busy.situation":
    "SwitchioPay je zaneprázdnený inou operáciou, alebo sa odmietne spustiť.",
  "landing.terminal.edge.busy.see":
    "Že je SwitchioPay zaneprázdnený a máte to skúsiť znova.",
  "landing.terminal.edge.busy.do":
    "Dokončite, čo je v SwitchioPay rozpracované, a spustite platbu znova.",
  "landing.terminal.edge.busy.records": "Nič: terminál sa vôbec nespustil.",
  "landing.terminal.edge.notInstalled.situation":
    "Na termináli nie je nainštalovaný SwitchioPay.",
  "landing.terminal.edge.notInstalled.see":
    "Upozornenie pri platobnej karte v nastaveniach a pri platbe:",
  "landing.terminal.edge.notInstalled.do":
    "Nechajte SwitchioPay na termináli nainštalovať a nastaviť.",
  "landing.terminal.edge.notInstalled.records": "Nič.",
  "landing.terminal.edge.restored.situation":
    "Android aplikáciu {appName} zavrie, kým obrazovku drží SwitchioPay.",
  "landing.terminal.edge.restored.see": "Keď sa aplikácia vráti:",
  "landing.terminal.edge.restored.do":
    "Nič: výsledok terminálu na aplikáciu počká a vybaví sa, hneď ako sa vráti.",
  "landing.terminal.edge.restored.records":
    "Platbu tak, ako ju SwitchioPay nahlásil.",
  "landing.terminal.edge.otherAccount.situation":
    "Uložený výsledok patrí inému účtu na termináli.",
  "landing.terminal.edge.otherAccount.see":
    "Nič, kým ten účet nie je znova aktívny.",
  "landing.terminal.edge.otherAccount.do":
    "Prepnite na účet, v ktorom platba vznikla. Dovtedy terminál ďalšiu platbu nespustí.",
  "landing.terminal.edge.otherAccount.records":
    "Výsledok len v jeho vlastnom účte.",
  "landing.terminal.edge.canceledButPaid.situation":
    "Platba zrušená na inom zariadení je zaplatená kartou.",
  "landing.terminal.edge.canceledButPaid.see": "V detaile platby:",
  "landing.terminal.edge.canceledButPaid.do":
    "Označte platbu ako zaplatenú, alebo ju vráťte.",
  "landing.terminal.edge.canceledButPaid.records":
    "Platbu kartou: karta bola strhnutá, takže sa peniaze počítajú.",
  "landing.terminal.edge.reversalDeclined.situation":
    "Storno po uzávierke vykonanej mimo aplikácie {appName}.",
  "landing.terminal.edge.reversalDeclined.see": "Na obrazovke vrátenia:",
  "landing.terminal.edge.reversalDeclined.do":
    "Vráťte peniaze namiesto toho na kartu.",
  "landing.terminal.edge.reversalDeclined.records":
    "Vrátenie, až keď ho terminál schváli; nič dvakrát, ak už je platba stornovaná.",
  "landing.terminal.edge.refundUnknown.situation":
    "Výsledok vrátenia na kartu nie je známy.",
  "landing.terminal.edge.refundUnknown.see": "Vo vráteniach platby:",
  "landing.terminal.edge.refundUnknown.do":
    "Nechajte aplikáciu opýtať sa SwitchioPay, alebo SwitchioPay skontrolujte sami a vrátenie zavrite.",
  "landing.terminal.edge.refundUnknown.records":
    "Vrátenie, až keď SwitchioPay potvrdí schválenie. Dovtedy sa žiadne ďalšie vrátenie platby nespustí.",
  "landing.terminal.edge.refundElsewhere.situation":
    "Vrátenie čaká na SwitchioPay na inom zariadení.",
  "landing.terminal.edge.refundElsewhere.see": "Vo vráteniach platby:",
  "landing.terminal.edge.refundElsewhere.do":
    "Počkajte. Keď už to zariadenie nie je k dispozícii, skontrolujte SwitchioPay a vrátenie zavrite.",
  "landing.terminal.edge.refundElsewhere.records":
    "Čokoľvek, čo SwitchioPay na tom zariadení schváli, aj po zavretí.",
  "landing.terminal.edge.closureUnknown.situation":
    "Výsledok uzávierky nie je známy.",
  "landing.terminal.edge.closureUnknown.see": "Na obrazovke uzávierok:",
  "landing.terminal.edge.closureUnknown.do":
    "V SwitchioPay skontrolujte, či sa dávka uzavrela.",
  "landing.terminal.edge.closureUnknown.records":
    "Nič: zapisuje sa len uzávierka s čitateľnými súčtami.",
  "landing.terminal.edge.demo.situation": "Demo účet.",
  "landing.terminal.edge.demo.see": "Pri platbe:",
  "landing.terminal.edge.demo.do": "Platby kartou prijímajte v skutočnom účte.",
  "landing.terminal.edge.demo.records":
    "Nič: demo účet SwitchioPay nikdy nespustí.",
  "landing.terminal.edge.offline.situation":
    "Terminál nemá pripojenie na internet.",
  "landing.terminal.edge.offline.see":
    "{appName} funguje ďalej: so SwitchioPay komunikuje priamo na termináli. SwitchioPay však pripojenie na autorizáciu karty potrebuje.",
  "landing.terminal.edge.offline.do": "Obnovte pripojenie.",
  "landing.terminal.edge.offline.records":
    "Všetko na termináli; ostatné zariadenia podniku to uvidia, hneď ako bude online.",

  "landing.terminal.testing.eyebrow": "Testovanie",
  "landing.terminal.testing.title": "Testovanie v prostredí Comgate",
  "landing.terminal.testing.body":
    "Testovacie prostredie Comgate riadi výsledok sumou a prijíma len bezkontaktné platby. Na klávesnici zadajte tieto sumy:",
  "landing.terminal.testing.column.amount": "Suma",
  "landing.terminal.testing.column.simulator": "Simulátor odpovie",
  "landing.terminal.testing.column.app": "{appName} ukáže",
  "landing.terminal.testing.approved.amount": "1,01 Kč",
  "landing.terminal.testing.approved.simulator": "Potvrdené",
  "landing.terminal.testing.approved.app": "Platba je prijatá a zaplatená.",
  "landing.terminal.testing.partial.amount": "2,01 Kč",
  "landing.terminal.testing.partial.simulator": "Potvrdené – čiastočne",
  "landing.terminal.testing.partial.app":
    "Overuje sa na vývojovom termináli; {appName} o čiastočné schválenie nežiada.",
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
    "Vypršal čas autorizácie",
  "landing.terminal.testing.cardTimeout.amount": "31,09 Kč",
  "landing.terminal.testing.cardTimeout.simulator":
    "Vypršal čas na detekciu karty",
  "landing.terminal.testing.other.amount": "Akákoľvek iná suma",
  "landing.terminal.testing.other.simulator": "Potvrdené",
  "landing.terminal.testing.declined":
    "Platba zostáva nezaplatená a kartu možno strhnúť znova.",
  "landing.terminal.testing.operations":
    "Storno, vrátenie na kartu a uzávierku vyskúšate podľa návodu vyššie: schváľte platbu za 1,01 Kč a stornujte ju; potom schváľte ďalšiu platbu, vykonajte uzávierku a túto platbu vráťte na kartu.",
  "landing.terminal.testing.source":
    "Sumy podľa dokumentácie simulátora Comgate, overené 13. 11. 2026.",
  "landing.terminal.testing.sourceLink": "apidoc.comgate.cz",

  "landing.terminal.limits.eyebrow": "Obmedzenia",
  "landing.terminal.limits.title": "Čo {appName} nerobí",
  "landing.terminal.limits.receipts":
    "Netlačí účtenky: tlačí ich SwitchioPay na tlačiarni terminálu podľa svojho nastavenia.",
  "landing.terminal.limits.operations":
    "Nemá predautorizácie, platby MOTO ani cashback.",
  "landing.terminal.limits.unlinkedRefund":
    "Nevracia peniaze bez pôvodnej platby: každé vrátenie na kartu patrí k platbe prijatej v aplikácii.",
  "landing.terminal.limits.autoClosure":
    "Uzávierku nespúšťa automaticky: musí ju spustiť obsluha.",
  "landing.terminal.limits.reconciliation":
    "Zatiaľ neporovnáva súčty uzávierky so svojimi platbami.",

  "landing.terminal.faq.otherTerminal.question":
    "Môžem vrátiť platbu prijatú na inom termináli?",
  "landing.terminal.faq.otherTerminal.answer":
    "Áno, na kartu. Stornovať platbu vie len terminál, ktorý ju prijal, takže na ktoromkoľvek inom termináli podniku vráti {appName} peniaze na kartu, ktorou zákazník platil.",
  "landing.terminal.faq.forgotClosure.question":
    "Čo keď zabudnem na uzávierku?",
  "landing.terminal.faq.forgotClosure.answer":
    "Urobte ju, hneď ako si všimnete: dávka obsahuje všetky platby kartou od poslednej uzávierky. Keď dávku uzavrie SwitchioPay sám, {appName} o tom nevie; storno, ktoré potom terminál odmietne, sa ponúkne ako vrátenie na kartu.",
  "landing.terminal.faq.cardNumber.question": "Vidí {appName} číslo karty?",
  "landing.terminal.faq.cardNumber.answer":
    "Nie. Kartu číta SwitchioPay. {appName} od neho dostane len maskované číslo karty, značku karty, autorizačný kód a ID transakcií a uloží ich k platbe.",
  "landing.terminal.faq.receipts.question": "Kto tlačí účtenku?",
  "landing.terminal.faq.receipts.answer":
    "SwitchioPay, na tlačiarni terminálu podľa svojho nastavenia. {appName} netlačí nič.",
  "landing.terminal.faq.login.question":
    "Potrebujem na testovanie účet alebo prihlásenie?",
  "landing.terminal.faq.login.answer":
    "Nie. {appName} žiadne prihlásenie nemá: nainštalujte ho, prejdite prvým spustením a zapnite platby kartou. Bez PIN-u smie ktokoľvek s terminálom v ruke všetko.",

  "landing.terminal.shot.settings-payments.alt":
    "Nastavenia aplikácie {appName} s platobnými metódami v sekcii Platby",
  "landing.terminal.shot.payment-methods-off.alt":
    "Platobné metódy s vypnutou platobnou kartou",
  "landing.terminal.shot.payment-methods-on.alt":
    "Platobné metódy so zapnutou platobnou kartou označenou ako predvolená",
  "landing.terminal.shot.card-settings.alt":
    "Nastavenia platobnej karty s odkazom na uzávierky terminálov",
  "landing.terminal.shot.pay-amount.alt":
    "Klávesnica so zadanou sumou a tlačidlom Zaplatiť",
  "landing.terminal.shot.pay-tip.alt": "Výber prepitného pri platbe",
  "landing.terminal.shot.pay-card-tab.alt":
    "Platobná obrazovka na záložke platobnej karty",
  "landing.terminal.shot.pay-waiting.alt":
    "Záložka platobnej karty čaká na terminál",
  "landing.terminal.shot.pay-received.alt": "Prijatá platba",
  "landing.terminal.shot.pay-detail.alt":
    "Detail platby kartou s maskovaným číslom karty, autorizačným kódom a ID terminálu",
  "landing.terminal.shot.refund-button.alt":
    "Detail platby kartou s tlačidlom Vrátiť peniaze",
  "landing.terminal.shot.refund-reversal.alt":
    "Obrazovka vrátenia s celou platbou, ktorú SwitchioPay stornuje",
  "landing.terminal.shot.refund-running.alt":
    "Obrazovka vrátenia čaká na SwitchioPay",
  "landing.terminal.shot.refund-reversed-detail.alt":
    "Detail vrátenia stornovaného na termináli",
  "landing.terminal.shot.refund-referral.alt":
    "Obrazovka vrátenia ponúka po uzávierke vrátenie na kartu",
  "landing.terminal.shot.refund-partial.alt":
    "Obrazovka vrátenia s časťou platby",
  "landing.terminal.shot.refund-tip-only.alt":
    "Obrazovka vrátenia len s prepitným",
  "landing.terminal.shot.refund-referral-detail.alt":
    "Detail vrátenia na kartu",
  "landing.terminal.shot.reversal-declined.alt":
    "Terminál odmietol storno a aplikácia ponúka vrátenie na kartu",
  "landing.terminal.shot.closure-row.alt":
    "Nastavenia s uzávierkami terminálov",
  "landing.terminal.shot.closure-page.alt":
    "Uzávierky terminálov s poslednou uzávierkou tohto terminálu",
  "landing.terminal.shot.closure-confirm.alt": "Potvrdenie uzávierky terminálu",
  "landing.terminal.shot.closure-detail.alt":
    "Detail uzávierky so súhrnom, číslom dávky a zmeny",
  "landing.terminal.shot.edge-declined.alt":
    "Záložka platobnej karty po zamietnutej karte",
  "landing.terminal.shot.edge-unknown.alt":
    "Záložka platobnej karty s neznámym výsledkom",
  "landing.terminal.shot.edge-unknown-resolved.alt":
    "Prijatá platba po tom, čo sa aplikácia opýtala SwitchioPay",
  "landing.terminal.shot.edge-charge-again.alt":
    "Potvrdenie pred ďalším strhnutím karty",
  "landing.terminal.shot.edge-busy.alt":
    "Záložka platobnej karty so zaneprázdneným SwitchioPay",
  "landing.terminal.shot.edge-not-installed.alt":
    "Upozornenie, že SwitchioPay nie je nainštalovaný",
  "landing.terminal.shot.edge-restored.alt":
    "Hláška, že platba kartou bola doriešená po reštarte aplikácie",
  "landing.terminal.shot.edge-canceled-but-paid.alt":
    "Zrušená platba zaplatená kartou s voľbou označiť ju ako zaplatenú, alebo ju vrátiť",
  "landing.terminal.shot.edge-refund-unknown.alt":
    "Vrátenie s neznámym výsledkom a tlačidlom na otázku pre SwitchioPay",
  "landing.terminal.shot.edge-closure-unknown.alt":
    "Uzávierky terminálov s uzávierkou neznámeho výsledku",
  "landing.terminal.shot.edge-demo.alt":
    "Hláška, že demo účet skutočné platby kartou neprijíma",
} as const satisfies Record<keyof typeof enTerminal, string>
