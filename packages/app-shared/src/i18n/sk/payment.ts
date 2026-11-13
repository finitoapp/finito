import type { enPayment } from "../en/payment.ts"

export const skPayment = {
  "payment.create.billTotalNotPositive":
    "Účet vychádza na nulu alebo pod ňu, nie je čo zaplatiť.",
  "payment.create.error": "Platbu sa nepodarilo vytvoriť.",
  "payment.status.canceled": "Zrušené",
  "payment.status.expired": "Vypršalo",
  "payment.status.paid": "Zaplatené",
  "payment.status.pending": "Čaká",
  "paymentDetail.card.title": "Platba kartou",
  "paymentDetail.card.brand": "Karta",
  "paymentDetail.card.maskedPan": "Číslo karty",
  "paymentDetail.card.authCode": "Autorizačný kód",
  "paymentDetail.card.transactionId": "ID transakcie terminálu",
  "paymentDetail.card.terminalId": "Terminál (TID)",
  "paymentDetail.cashReceived": "Prijaté v hotovosti {amount}",
  "paymentDetail.eet.amount": "Odoslaná suma",
  "paymentDetail.eet.cashRegister": "Označenie pokladnice",
  "paymentDetail.eet.eic": "EIČ",
  "paymentDetail.eet.errorCode": "Chyba EET {code}: {message}",
  "paymentDetail.eet.establishment": "Evidenčná jednotka",
  "paymentDetail.eet.extra.description":
    "Peniaze, ktoré prišli po prvom zaplatení alebo nad sumu platby, sú v EET ako samostatná tržba a ich vrátenie stornuje len ju.",
  "paymentDetail.eet.extra.title": "Dodatočná platba v EET {amount}",
  "paymentDetail.eet.lastError": "Posledná chyba",
  "paymentDetail.eet.overdue": "Nepotvrdené do 48 hodín od tržby.",
  "paymentDetail.eet.pok": "POK",
  "paymentDetail.eet.receivedAt": "Prijaté do EET",
  "paymentDetail.eet.retry": "Odoslať do EET znova",
  "paymentDetail.eet.retry.alreadyConfirmed": "EET už túto tržbu potvrdila.",
  "paymentDetail.eet.retry.busy": "Tržba sa práve odosiela.",
  "paymentDetail.eet.waitingForDevice":
    "Do {time} ju odošle len zariadenie, ktoré platbu prijalo.",
  "paymentDetail.eet.retry.confirmed": "EET tržbu potvrdila.",
  "paymentDetail.eet.retry.failed": "Tržbu sa nepodarilo odoslať.",
  "paymentDetail.eet.retry.noCertificate":
    "Najprv v nastaveniach EET importujte certifikát pokladnice.",
  "paymentDetail.eet.retry.pending":
    "EET neodpovedala. Tržba sa odošle znova automaticky.",
  "paymentDetail.eet.retry.rejected": "EET tržbu znova odmietla.",
  "paymentDetail.eet.retry.unsupported":
    "Túto tržbu nie je možné do EET odoslať.",
  "paymentDetail.eet.reversal.retry.confirmed": "EET storno potvrdila.",
  "paymentDetail.eet.reversal.retry.rejected": "EET storno znova odmietla.",
  "paymentDetail.eet.reversal.title": "Storno v EET {amount}",
  "paymentDetail.eet.reversal.unsupported.disabled":
    "Pri vrátení bola EET vypnutá, storno sa preto neodošle.",
  "paymentDetail.eet.reversal.unsupported.environment":
    "EET teraz beží v inom prostredí než tržba, storno sa preto neodošle.",
  "paymentDetail.eet.reversal.unsupported.taxpayer":
    "EET teraz eviduje za iného platiteľa než tržbu, storno sa preto neodošle.",
  "paymentDetail.eet.reversal.waiting": "Čaká, kým EET potvrdí pôvodnú tržbu.",
  "paymentDetail.eet.reversal.waitingForDevice":
    "Do {time} ho odošle len zariadenie, ktoré vrátenie zaznamenalo.",
  "paymentDetail.eet.saleAt": "Dátum a čas tržby",
  "paymentDetail.eet.sequenceNumber": "Poradové číslo",
  "paymentDetail.eet.test":
    "Odoslané len do testovacieho prostredia EET. U finančnej správy sa neeviduje.",
  "paymentDetail.eet.title": "EET",
  "paymentDetail.eet.transactionId": "ID transakcie EET",
  "paymentDetail.eet.unsupported":
    "EET prijíma len tržby v českých korunách, preto táto tržba nebola odoslaná.",
  "paymentDetail.eet.warning": "Varovanie EET {code}",
  "paymentDetail.number": "Platba č. {number}",
  "paymentDetail.refunds.action": "Vrátiť peniaze",
  "paymentDetail.refunds.method.cashRegister": "Z pokladne",
  "paymentDetail.refunds.method.outside": "Mimo {appNameGen}",
  "paymentDetail.refunds.method.qerkoPayment": "V Qerku",
  "refund.qerkoPayment.done": "Qerko platbu vrátilo.",
  "refund.qerkoPayment.error.notAvailable":
    "Túto platbu nejde vrátiť v Qerku: nebola v ňom zaplatená, alebo je už časť vrátená.",
  "refund.qerkoPayment.error.notCancelled":
    "Qerko platbu nevrátilo. Skúste to neskôr.",
  "refund.qerkoPayment.error.unreachable":
    "Qerko nie je dostupné. Skontrolujte pripojenie a skúste to znova.",
  "paymentDetail.refunds.method.qerkoTerminal": "Na kartu",
  "paymentDetail.refunds.method.cardSwitchio": "Na kartu",
  "paymentDetail.refunds.title": "Vrátenia",
  "paymentDetail.refunds.tip": "Sprepitné",
  "paymentDetail.tipIncluded": "Z toho tringelt {amount}",
  "paymentDetail.canceledAtValue": "Zrušené {date}",
  "paymentDetail.expiresAt": "Vyprší o {time}",
  "paymentDetail.technical": "Technické údaje",
  "paymentDetail.id": "ID platby",
  "paymentDetail.reconciliation.id": "ID spárovania",
  "paymentDetail.copy": "Kopírovať {label}",
  "paymentDetail.copied": "Skopírované.",
  "paymentDetail.copyError": "Nepodarilo sa skopírovať.",
  "paymentDetail.bill.noTable": "Bez stola",
  "paymentDetail.bill.open": "Otvoriť účet",
  "paymentDetail.backToPayment": "Späť na platbu",
  "paymentDetail.bill.coverage.changesTitle": "Zmeny od vzniku platby",
  "paymentDetail.bill.coverage.delta.overpaid":
    "Zaplatené o {amount} viac, než účet stojí",
  "paymentDetail.bill.coverage.delta.underpaid": "Ešte chýba {amount}",
  "paymentDetail.bill.coverage.expectedAmount": "Očakávané",
  "paymentDetail.bill.coverage.overpaid.fact":
    "Tento účet bol zaplatený za viac, než aktuálne stojí.",
  "paymentDetail.bill.coverage.overpaid.factWithReason":
    "Tento účet bol zaplatený za viac, než aktuálne stojí. {reason}",
  "paymentDetail.bill.coverage.overpaid.title": "Preplatené",
  "paymentDetail.bill.coverage.paidAmount": "Zaplatené",
  "paymentDetail.bill.coverage.reason.billLinesChanged":
    "Pravdepodobne iné zariadenie zmenilo položky účtu, zatiaľ čo táto platba už prebiehala.",
  "paymentDetail.bill.coverage.reason.multiplePayments":
    "Tento účet zahŕňa viac než jednu platbu — pozrite sa na tie ostatné nižšie.",
  "paymentDetail.bill.coverage.underpaid.fact":
    "Tento účet zatiaľ nie je plne pokrytý potvrdenými platbami.",
  "paymentDetail.bill.coverage.underpaid.factWithReason":
    "Tento účet zatiaľ nie je plne pokrytý potvrdenými platbami. {reason}",
  "paymentDetail.bill.coverage.underpaid.title": "Nie je doplatené",
  "paymentDetail.bill.empty": "Tento účet nemá žiadne položky.",
  "paymentDetail.bill.table": "Stôl",
  "paymentDetail.bill.title": "Účet",
  "paymentDetail.bill.total": "Spolu",
  "paymentDetail.collision.description":
    "Táto platba bola zrušená, ale existuje k nej nárok na úhradu — peniaze sa stále počítajú do účtu. Vyriešte kolíziu nižšie.",
  "paymentDetail.collision.markPaid": "Označiť ako zaplatené",
  "paymentDetail.collision.markPaid.error":
    "Platbu sa nepodarilo označiť ako zaplatenú. Skúste to znova.",
  "paymentDetail.collision.refund": "Vrátiť platbu",
  "paymentDetail.collision.title": "Zrušené, ale peniaze dorazili",
  "paymentDetail.deviceId": "Zariadenie",
  "paymentDetail.emptyValue": "—",
  "paymentDetail.excessCollision.acknowledge": "Označiť ako vyriešené",
  "paymentDetail.excessCollision.acknowledge.error":
    "Kolíziu sa nepodarilo označiť ako vyriešenú. Skúste to znova.",
  "paymentDetail.excessCollision.description":
    "Táto platba bola vysporiadaná viackrát — pravdepodobne dve offline zariadenia nezávisle potvrdili iný spôsob úhrady. Vyriešte kolíziu nižšie.",
  "paymentDetail.excessCollision.title": "Zaplatené viackrát",
  "paymentDetail.invalidId": "Neplatné ID platby.",
  "paymentDetail.notFound": "Platba sa nenašla.",
  "paymentDetail.paymentMethod.card": "Platobnou kartou",
  "paymentDetail.qerkoAttempts.title": "V Qerku",
  "paymentDetail.qerkoAttempts.state.started": "Začatá",
  "paymentDetail.qerkoAttempts.state.processing": "Potvrdzuje sa",
  "paymentDetail.qerkoAttempts.state.paid": "Zaplatené",
  "paymentDetail.qerkoAttempts.state.failed": "Neprešla",
  "paymentDetail.qerkoProvider.card": "kartou",
  "paymentDetail.qerkoProvider.mealTicket": "stravenkou",
  "paymentDetail.qerkoProvider.voucher": "poukážkou",
  "paymentDetail.qerkoProvider.bankTransfer": "prevodom",
  "paymentDetail.qerkoProvider.invoice": "na faktúru",
  "paymentDetail.paymentMethod.qerkoPayment": "Qerko",
  "paymentDetail.paymentMethod.qerkoTerminal": "Platobnou kartou (terminál)",
  "paymentDetail.paymentMethod.qerkoTerminalTid":
    "Platobnou kartou (terminál {tid})",
  "paymentDetail.paymentMethod.cashu": "Cashu",
  "paymentDetail.paymentMethod.cash": "Hotovosť",
  "paymentDetail.paymentMethod.iban": "IBAN",
  "paymentDetail.paymentMethod.onchain": "On-chain",
  "paymentDetail.paymentMethod.spark": "Lightning",
  "paymentDetail.reconciliation.source.auto": "Automaticky",
  "paymentDetail.reconciliation.source.manual": "Ručne",
  "paymentDetail.reconciliations": "Spárovania",
  "paymentDetail.reconciliations.empty":
    "S touto platbou zatiaľ nie je spárovaná žiadna transakcia.",
  "paymentDetail.tipAmount": "Tringelt",
  "paymentDetail.title": "Detail platby",
  "paymentDetail.transaction.account": "Účet",
  "paymentDetail.transaction.amount": "Suma transakcie",
  "paymentDetail.transaction.bankReference": "Referencia banky",
  "paymentDetail.transaction.id": "Transakcia",
  "paymentDetail.transaction.note": "Poznámka",
  "paymentDetail.transaction.occurredAt": "Prebehlo",
  "paymentDetail.transaction.paymentHash": "Payment hash",
  "paymentDetail.transaction.recordedAt": "Zaznamenané",
  "paymentDetail.transaction.source": "Zdroj transakcie",
  "paymentDetail.transaction.sparkTransferId": "Spark transfer",
  "paymentDetail.transaction.variableSymbol": "Variabilný symbol",
  "paymentDetail.updatedAt": "Upravené",
  "paymentHistory.billOverpaid": "Účet preplatený",
  "paymentHistory.billUnderpaid": "Účet nedoplatený",
  "paymentHistory.empty.description":
    "Vytvorené platobné žiadosti sa zobrazia tu.",
  "paymentHistory.empty.title": "Zatiaľ žiadne platby",
  "paymentHistory.payment": "Platba",
  "paymentHistory.paymentNumber": "Platba č. {number}",
  "paymentHistory.tip": "vr. prepitného {amount}",
  "paymentHistory.title": "História platieb",
  "paymentTip.continue": "Pokračovať k platbe",
  "paymentTip.creating": "Vytváram platbu...",
  "paymentTip.custom.actionDescription": "Zadať sumu",
  "paymentTip.custom.label": "Vlastné prepitné",
  "paymentTip.custom.orderTotal": "Cena objednávky {amount}",
  "paymentTip.fixedAmounts": "Prepitné pevnou sumou",
  "paymentTip.invalidLink": "Neplatný odkaz na prepitné.",
  "paymentTip.none": "Bez prepitného",
  "paymentTip.orderTotal": "Cena objednávky",
  "paymentTip.percentages": "Prepitné v percentách",
  "paymentTip.title": "Chcete pridať prepitné?",
  "paymentWait.back": "Späť na terminál",
  "paymentWait.boltCard.awaitingSettlement":
    "Karta prijatá, čakám na platbu...",
  "paymentWait.boltCard.disabled":
    "NFC je vypnuté. Zapnite ho, aby ste mohli prijímať Bolt Card.",
  "paymentWait.boltCard.enable": "Zapnúť NFC",
  "paymentWait.boltCard.error.amountOutOfRange":
    "Suma je mimo limitu tejto karty.",
  "paymentWait.boltCard.error.generic":
    "Platba kartou zlyhala. Priložte ju znova.",
  "paymentWait.boltCard.error.network":
    "Nepodarilo sa spojiť so službou karty. Skontrolujte pripojenie a priložte kartu znova.",
  "paymentWait.boltCard.error.notPayable":
    "Túto platbu už nie je možné zaplatiť.",
  "paymentWait.boltCard.error.rejected": "Karta bola odmietnutá: {reason}",
  "paymentWait.boltCard.error.timeout":
    "Karta platbu včas nedokončila. Priložte ju znova alebo zvoľte inú metódu.",
  "paymentWait.boltCard.error.unsupportedCard": "Táto karta nie je Bolt Card.",
  "paymentWait.boltCard.processing": "Čítam kartu...",
  "paymentWait.boltCard.ready": "Alebo priložte Bolt Card",
  "paymentWait.cancel": "Zrušiť platbu",
  "paymentWait.cancelError": "Platbu sa nepodarilo zrušiť.",
  "paymentWait.canceled": "Táto platba bola zrušená.",
  "paymentWait.cardPaid.action": "Zaplatiť platobnou kartou",
  "paymentWait.cardPaid.check": "Opýtať sa SwitchioPay",
  "paymentWait.cardPaid.check.paid":
    "SwitchioPay potvrdil platbu kartou, ktorej výsledok nebol známy.",
  "paymentWait.cardPaid.check.unresolved":
    "SwitchioPay platbu nepotvrdil. Predtým, než to skúsite znova, skontrolujte transakciu v SwitchioPay.",
  "paymentWait.cardPaid.check.otherDevice":
    "Opýtať sa SwitchioPay môže len zariadenie, ktoré platbu spustilo.",
  "paymentWait.cardPaid.error.busy":
    "SwitchioPay je zaneprázdnený. Nič sa nestiahlo, skúste to o chvíľu znova.",
  "paymentWait.cardPaid.error.declined": "Platba platobnou kartou neprebehla.",
  "paymentWait.cardPaid.error.generic":
    "Platbu platobnou kartou nie je možné vykonať.",
  "paymentWait.cardPaid.error.demo":
    "V demo účte nemožno prijať skutočnú platbu kartou.",
  "paymentWait.cardPaid.error.unavailable":
    "Aplikácia terminálu SwitchioPay nie je na tomto zariadení dostupná.",
  "paymentWait.cardPaid.error.unreadable":
    "Terminál nevrátil čitateľný výsledok. Predtým, než to skúsite znova, skontrolujte transakciu v SwitchioPay.",
  "paymentWait.cardPaid.error.notPayable":
    "Túto platbu už nie je možné zaplatiť kartou.",
  "paymentWait.cardPaid.pending": "Čakám na terminál...",
  "paymentWait.cardPaid.prompt": "Prijmite platbu platobnou kartou",
  "paymentWait.cardPaid.unavailable":
    "K tejto platbe nie je pripojený platobný terminál.",
  "paymentWait.cardPaid.restored.paid":
    "Platba kartou bola po reštarte aplikácie zaznamenaná.",
  "paymentWait.cardPaid.restored.unresolved":
    "Výsledok platby kartou z obdobia pred reštartom aplikácie sa nepodarilo spracovať. Skontrolujte transakciu v SwitchioPay.",
  "paymentWait.cardPaid.retryUnresolved.cancel": "Späť",
  "paymentWait.cardPaid.retryUnresolved.confirm": "Strhnúť znova",
  "paymentWait.cardPaid.retryUnresolved.description":
    "Výsledok posledného pokusu ({transactionId}) nie je známy a karta už mohla byť stiahnutá. Strhnite znova, až keď v SwitchioPay overíte, že platba neprebehla.",
  "paymentWait.cardPaid.retryUnresolved.title": "Strhnúť kartu znova?",
  "paymentWait.cardPaid.unresolved":
    "Výsledok posledného pokusu ({transactionId}) nie je známy. Predtým, než to skúsite znova, skontrolujte transakciu v SwitchioPay.",
  "paymentWait.cashPaid.action": "Označiť ako zaplatené",
  "paymentWait.cashPaid.difference": "Rozdiel oproti útrate: {amount}",
  "paymentWait.cashPaid.error": "Platbu sa nepodarilo označiť ako zaplatenú.",
  "paymentWait.cashPaid.notPayable":
    "Túto platbu nie je možné zaplatiť v hotovosti: po zaokrúhlení pre hotovosť vychádza na nulu.",
  "paymentWait.cashPaid.pending": "Označujem ako zaplatené...",
  "paymentWait.cashPaid.prompt": "Prijmite hotovostnú platbu",
  "paymentWait.cashPaid.received": "Prijatá hotovosť",
  "paymentWait.cashPaid.receivedTooLow": "Zadajte aspoň {amount}.",
  "paymentWait.cashPaid.unavailable":
    "K tejto platbe nie je pripojená pokladnica.",
  "paymentWait.copyQr": "Skopírovať obsah QR kódu",
  "paymentWait.detail": "Detail platby",
  "paymentWait.eetSandbox": "Odoslané len do testovacieho prostredia EET.",
  "paymentWait.ibanDetails.more": "Viac informácií",
  "paymentWait.ibanDetails.title": "Platobné údaje",
  "paymentWait.bankWatch.waiting": "Čakám na platbu…",
  "paymentWait.ibanDetails.account.label": "Účet",
  "paymentWait.ibanDetails.recipient.label": "Príjemca",
  "paymentWait.ibanDetails.hide": "Skryť bankové údaje",
  "paymentWait.ibanDetails.iban.copied": "IBAN skopírovaný.",
  "paymentWait.ibanDetails.iban.copy": "Kopírovať IBAN",
  "paymentWait.ibanDetails.iban.copyError": "IBAN sa nepodarilo skopírovať.",
  "paymentWait.ibanDetails.iban.label": "IBAN",
  "paymentWait.ibanDetails.show": "Zobraziť bankové údaje",
  "paymentWait.ibanDetails.variableSymbol.copied":
    "Variabilný symbol skopírovaný.",
  "paymentWait.ibanDetails.variableSymbol.copy": "Kopírovať variabilný symbol",
  "paymentWait.ibanDetails.variableSymbol.copyError":
    "Variabilný symbol sa nepodarilo skopírovať.",
  "paymentWait.ibanDetails.variableSymbol.label": "Variabilný symbol",
  "paymentWait.ibanPaid.action": "Prijal som prevod",
  "paymentWait.ibanPaid.error": "Prevod sa nepodarilo potvrdiť.",
  "paymentWait.ibanPaid.pending": "Potvrdzujem...",
  "paymentWait.invalidId": "Neplatné ID platby.",
  "paymentWait.method.cashu": "Cashu",
  "paymentWait.method.qerkoPayment": "Qerko",
  "paymentWait.preparing.qerkoPayment": "Pripravujem platbu cez Qerko…",
  "paymentWait.qerkoPayment.scan": "Zákazník naskenuje kód v aplikácii Qerko.",
  "paymentWait.qerkoPayment.tipChosenInQerko":
    "Prepitné vyberá zákazník v Qerku a nahradí to zadané tu.",
  "paymentWait.qerkoPayment.started": "Zákazník platí v Qerku…",
  "paymentWait.qerkoPayment.processing": "Qerko potvrdzuje platbu…",
  "paymentWait.qerkoPayment.failed":
    "Platba v Qerku neprešla. Zákazník to môže skúsiť znova.",
  "paymentWait.qerkoPayment.noDevice":
    "Žiadne zariadenie neprijíma platby cez Qerko. Zvoľte ho v nastaveniach.",
  "paymentWait.qerkoPayment.disconnected":
    "Toto zariadenie nie je pripojené ku Qerku, zákazníci zatiaľ nemôžu platiť.",
  "paymentWait.method.qerko": "Terminál",
  "paymentWait.preparing.cashu": "Pripravujem Cashu platbu...",
  "paymentWait.cashu.quoteExpired":
    "Faktúra mintu vypršala skôr, než bola zaplatená.",
  "paymentWait.cashu.arrival.receiving":
    "Prišiel token na {amount} sat z {mint}. Prijímam ho...",
  "paymentWait.cashu.arrival.withFee":
    "Prišiel token na {amount} sat z {mint}. Mint si nechá {fee} sat ako poplatok.",
  "paymentWait.cashu.arrival.waitingForMint":
    "Prišiel token na {amount} sat. Čakám, kým odpovie mint {mint}...",
  "paymentWait.cashu.arrival.untrustedMint":
    "Token na {amount} sat prišiel z {mint}, čo nie je predvolený mint. Nebol prijatý a túto platbu nezaplatí.",
  "paymentWait.cashu.failure.mintUnreachable":
    "Mint neodpovedal. Token skúsim znova.",
  "paymentWait.cashu.failure.mintRejected":
    "Mint token odmietol. Platba zostáva nezaplatená.",
  "paymentWait.cashu.failure.locked":
    "Token je zamknutý pre niekoho iného. Platba zostáva nezaplatená.",
  "paymentWait.cashu.failure.undecodable":
    "Token sa nepodarilo prečítať. Platba zostáva nezaplatená.",
  "paymentWait.cashu.failure.alreadyKnown":
    "Peňaženka už tento token má. Platba zostáva nezaplatená.",
  "paymentWait.cashu.failure.fee":
    "Poplatok mintu by zobral celý token. Platba zostáva nezaplatená.",
  "paymentWait.cashu.failure.spent":
    "Token už bol minutý. Platba zostáva nezaplatená.",
  "paymentWait.cashu.newQuote": "Nová faktúra",
  "paymentWait.method.card": "Platobná karta",
  "paymentWait.method.cash": "Hotovosť",
  "paymentWait.method.iban": "Prevod",
  "paymentWait.method.lightning": "Bitcoin",
  "paymentWait.missingRequest": "Táto platba nemá žiadosť na skenovanie.",
  "paymentWait.notFound": "Platba sa nenašla.",
  "paymentWait.paid": "Platba prijatá",
  "paymentWait.pay": "Zaplatiť",
  "paymentWait.prepareError": "Túto platobnú metódu sa nepodarilo pripraviť.",
  "paymentWait.prepareRetry": "Skúsiť platobnú metódu znova",
  "paymentWait.preparing.card": "Pripravujem platbu platobnou kartou...",
  "paymentWait.preparing.cash": "Pripravujem hotovostnú platbu...",
  "paymentWait.preparing.iban": "Pripravujem bankovú QR platbu...",
  "paymentWait.preparing.qerko": "Pripravujem terminál…",
  "paymentWait.preparing.spark": "Pripravujem Lightning žiadosť...",
  "paymentWait.qerko.action": "Zaplatiť na termináli",
  "paymentWait.qerko.cancel": "Zrušiť na termináli",
  "paymentWait.qerko.cancel.notCancellable": "Platbu už nie je možné zrušiť.",
  "paymentWait.qerko.error.attemptRunning": "Na termináli už platba beží.",
  "paymentWait.qerko.error.generic":
    "Platbu sa nepodarilo uskutočniť. Skúste to znova.",
  "paymentWait.qerko.error.keyRejected":
    "Qerko už spárovanie neprijíma. Spárujte terminál znova v nastaveniach.",
  "paymentWait.qerko.error.keyRejected.link": "Otvoriť nastavenia Qerko",
  "paymentWait.qerko.error.notPaired": "Terminál Qerko nie je spárovaný.",
  "paymentWait.qerko.error.notPayable": "Túto platbu už nie je možné zaplatiť.",
  "paymentWait.qerko.error.unreachable":
    "Qerko sa nepodarilo zastihnúť. Skontrolujte pripojenie.",
  "paymentWait.qerko.failed.cancelled": "Platba bola zrušená na termináli.",
  "paymentWait.qerko.failed.declined": "Karta bola zamietnutá.",
  "paymentWait.qerko.failed.reversed": "Platba bola stornovaná.",
  "paymentWait.qerko.noTerminal": "Na tomto zariadení nie je vybraný terminál.",
  "paymentWait.qerko.noTerminal.link": "Vybrať terminál",
  "paymentWait.qerko.notStarted.busy":
    "Terminál je zaneprázdnený. Skúste to o chvíľu.",
  "paymentWait.qerko.notStarted.notActivated":
    "Terminál nie je v Qerku aktivovaný.",
  "paymentWait.qerko.notStarted.notConnected": "Terminál nie je pripojený.",
  "paymentWait.qerko.notStarted.timeout":
    "Terminál neodpovedal včas. Pred ďalším pokusom ho skontrolujte.",
  "paymentWait.qerko.notStarted.unknownTerminal":
    "Qerko tento terminál nepozná. Vyberte ho znova v nastaveniach.",
  "paymentWait.qerko.retry": "Zaplatiť na termináli znova",
  "paymentWait.qerko.retryUnresolved.cancel": "Zrušiť",
  "paymentWait.qerko.retryUnresolved.confirm":
    "Skontroloval(a) som, zaplatiť znova",
  "paymentWait.qerko.retryUnresolved.description":
    "Posledný pokus skončil s neznámym výsledkom a karta mohla byť stiahnutá. Skontrolovali ste terminál a Qerko?",
  "paymentWait.qerko.retryUnresolved.title": "Zaplatiť znova?",
  "paymentWait.qerko.step.authorizing": "Autorizujem platbu…",
  "paymentWait.qerko.step.connecting": "Pripájam sa k terminálu…",
  "paymentWait.qerko.step.finishing": "Dokončujem platbu…",
  "paymentWait.qerko.step.waitingForCard": "Čakám na kartu…",
  "paymentWait.qerko.step.waitingForCustomer": "Čakám na zákazníka…",
  "paymentWait.qerko.step.waitingForPin": "Zákazník zadáva PIN…",
  "paymentWait.qerko.unresolved":
    "Výsledok posledného pokusu nie je známy, karta teda mohla byť stiahnutá. Pred ďalším pokusom skontrolujte terminál a históriu platieb v Qerku.",
  "paymentWait.qrCopied": "Obsah QR kódu skopírovaný.",
  "paymentWait.qrCopyFailed": "Obsah QR kódu sa nepodarilo skopírovať.",
  "paymentWait.qrFormat.payBySquare1_0_0": "Pay by square 1.0 (Slovensko)",
  "paymentWait.qrFormat.payBySquare1_2_0": "Pay by square 1.2 (Slovensko)",
  "paymentWait.qrFormat.spayd": "SPAYD (Česko)",
  "paymentWait.qrFormatShort.payBySquare1_0_0": "SK 1.0",
  "paymentWait.qrFormatShort.payBySquare1_2_0": "SK 1.2",
  "paymentWait.qrFormatShort.spayd": "CZ",
  "paymentWait.scanOrTap": "Naskenujte a zaplaťte",
  "paymentWait.wakeLockUnsupported":
    "Tento prehliadač nevie automaticky udržať obrazovku zapnutú.",
  "refund.created": "Vrátenie je zaznamenané.",
  "refund.dialog.method.qerkoTerminal": "Späť na kartu cez terminál",
  "refund.dialog.method.qerkoTerminalTid": "Späť na kartu na terminále {tid}",
  "refund.dialog.method.cardSwitchio": "Späť na kartu cez SwitchioPay",
  "refund.outcome.reversal":
    "Terminál vezme platbu späť celú, karta nie je potrebná.",
  "refund.outcome.card": "Peniaze sa vrátia na kartu, ktorou zákazník platil.",
  "refund.outcome.qerkoPayment": "Qerko vráti zákazníkovi celú platbu.",
  "refund.outcome.cashRegister": "Vydajte zákazníkovi {amount} z pokladne.",
  "refund.outcome.cashRegisterRounded":
    "Vydajte zákazníkovi {amount} z pokladne, zaokrúhlené na celé koruny.",
  "refund.outcome.outside": "Vrátenie len zaznamenáme, peniaze vraciate inde.",
  "refund.page.title": "Vrátiť peniaze",
  "refund.page.empty": "Z tejto platby sa už nedá nič vrátiť.",
  "refund.page.choice.whole": "Celú platbu",
  "refund.page.choice.whole.tipIncluded": "vrátane sprepitného {amount}",
  "refund.page.choice.part": "Časť",
  "refund.page.choice.part.left": "zostáva {amount}",
  "refund.page.choice.tip": "Len sprepitné",
  "refund.page.amount.label": "Koľko",
  "refund.page.method.qerkoPayment": "Späť cez Qerko",
  "refund.page.qerko.done": "Peniaze sa vrátili na kartu.",
  "refund.page.switchio.waiting": "Dokončite vrátenie v SwitchioPay.",
  "refund.switchio.done": "Peniaze sa vrátili na kartu.",
  "refund.switchio.pending": "Vraciam na kartu cez SwitchioPay",
  "refund.switchio.pendingElsewhere":
    "Čaká sa na SwitchioPay na inom zariadení. Ak to zariadenie nie je k dispozícii, skontrolujte SwitchioPay a vrátenie zatvorte.",
  "refund.switchio.unresolved":
    "Výsledok vrátenia na kartu nie je známy, karta teda mohla byť vrátená. Pred ďalším vrátením skontrolujte SwitchioPay.",
  "refund.switchio.failed": "Terminál vrátenie na kartu zamietol.",
  "refund.switchio.check": "Zistiť stav v SwitchioPay",
  "refund.switchio.dismissPending.title": "Zatvoriť vrátenie?",
  "refund.switchio.dismissPending.description":
    "Druhé zariadenie ho môže ešte nahlásiť. Ak sa peniaze vrátili, vrátenie sa potom zapíše aj tak.",
  "refund.switchio.dismissPending.confirm": "Zatvoriť",
  "refund.switchio.dismissPending.cancel": "Späť",
  "refund.switchio.error.notAvailable":
    "Túto platbu nemožno vrátiť na kartu: terminál k nej nevydal identifikátor, ktorý vrátenie potrebuje.",
  "refund.switchio.error.running":
    "Iné vrátenie tejto platby na kartu ešte nie je vybavené.",
  "refund.switchio.error.notStarted":
    "SwitchioPay je zaneprázdnený alebo nie je pripravený. Nič sa nevrátilo, skúste to znova.",
  "refund.switchio.error.otherDevice":
    "Stav v SwitchioPay môže zistiť len zariadenie, ktoré vrátenie spustilo.",
  "refund.switchio.restored.unusable":
    "Výsledok vrátenia na kartu z doby pred reštartom aplikácie sa nepodarilo spracovať. Skontrolujte vrátenie v SwitchioPay.",
  "refund.switchio.reversalDeclined.title":
    "Terminál už platbu nemôže vziať späť",
  "refund.switchio.reversalDeclined.description":
    "Jeho dávka bola najskôr uzavretá. Peniaze sa však dajú vrátiť na kartu, ktorou zákazník platil. Vrátiť ich?",
  "refund.switchio.reversalDeclined.confirm": "Vrátiť na kartu",
  "refund.switchio.reversalDeclined.cancel": "Späť",
  "refund.qerko.dismiss": "Zavrieť",
  "refund.qerko.dismissUnresolved": "Skontroloval(a) som, zavrieť",
  "refund.qerko.error.notAvailable":
    "Táto platba nebola prijatá na termináli Qerko, takže ju nie je možné vrátiť na kartu.",
  "refund.qerko.error.running":
    "Ďalšie vrátenie tejto platby na kartu stále čaká na terminál.",
  "refund.qerko.error.terminalNotActivated":
    "Terminál, na ktorom platba prebehla, nie je v Qerku aktivovaný. Refund na kartu možno urobiť len na ňom, požiadajte preto podporu Qerko o jeho opätovnú aktiváciu.",
  "refund.qerko.error.terminalNotConnected":
    "Terminál, na ktorom platba prebehla, nie je pripojený. Refund na kartu možno urobiť len na ňom, pripojte ho a skúste to znova.",
  "refund.qerko.error.unknownTerminal":
    "Qerko terminál, na ktorom platba prebehla, nepozná. Refund na kartu možno urobiť len na ňom, kontaktujte preto podporu Qerko.",
  "refund.qerko.failed.cancelled":
    "Vrátenie na kartu bolo zrušené na termináli.",
  "refund.qerko.failed.declined": "Terminál vrátenie na kartu zamietol.",
  "refund.qerko.pending": "Vraciam na kartu",
  "refund.qerko.unresolved":
    "Výsledok vrátenia na kartu nie je známy, karta teda mohla byť vrátená. Pred ďalším vrátením skontrolujte terminál a Qerko.",
  "refund.tipCreated": "Sprepitné vrátené.",
  "refund.error.tip": "Sprepitné tejto platby je už vrátené.",
  "refund.dialog.tipHint": "Bez sprepitného {amount}, to sa vracia zvlášť.",
  "refund.dialog.amount.invalid": "Zadajte sumu najviac {amount}.",
  "refund.dialog.amount.label": "Vrátená suma",
  "refund.dialog.confirm": "Vrátiť {amount}",
  "refund.dialog.confirmEmpty": "Vrátiť",
  "refund.dialog.items.available": "Najviac {quantity}",
  "refund.dialog.items.decrease": "Menej: {name}",
  "refund.dialog.items.increase": "Viac: {name}",
  "refund.dialog.method.cashRegister": "V hotovosti z pokladne",
  "refund.dialog.method.label": "Ako peniaze vraciate",
  "refund.dialog.method.outside":
    "Mimo {appNameGen}, napríklad na platobnom termináli",
  "refund.dialog.mode.amount": "Suma",
  "refund.dialog.mode.items": "Položky",
  "refund.dialog.mode.label": "Čo vraciate",
  "refund.error.amount": "Suma je vyššia, než koľko zostáva vrátiť.",
  "refund.error.cashRegister": "Pre túto menu tu nie je pokladňa.",
  "refund.error.items": "Tieto položky sa už nedajú vrátiť.",
  "refund.error.notPaid": "Vrátiť sa dá iba zaplatená platba.",
  "refund.state.full": "Vrátené {amount}",
  "refund.state.partial": "Čiastočne vrátené {amount}",
  "paymentDetail.paymentMethod.lightningAddress": "Lightning adresa",
  "paymentWait.method.lightningAddress": "Lightning",
  "paymentWait.preparing.lightningAddress": "Žiadam peňaženku o invoice...",
  "paymentWait.lightningAddress.unverified":
    "Peňaženka hlási invoice zaplatený, ale neposlala dôkaz platby. Než vydáte tovar, skontrolujte peňaženku.",
  "paymentWait.monetaWatch.watching": "Čakám na platbu z banky…",
  "paymentWait.monetaWatch.unreachable":
    "Banka neodpovedá. {appName} to skúša ďalej.",
  "paymentWait.monetaWatch.unauthorized":
    "Banka odmietla token MONETA, prevod sa automaticky nekontroluje.",
  "paymentWait.monetaWatch.openSettings": "Nastavenia MONETA",
  "paymentWait.monetaWatch.rateLimited":
    "Dnešné dopyty do banky sú vyčerpané. Potvrďte prevod ručne.",
  "paymentDetail.transaction.preimage": "Dôkaz platby (preimage)",
  "paymentWait.method.bitcoin": "Bitcoin",
  "refundDetail.title": "Vrátenie",
  "refundDetail.notFound": "Vrátenie sa nenašlo.",
  "refundDetail.payment": "Platba",
  "refundDetail.what": "Čo",
  "refundDetail.what.goods": "Tovar",
  "refundDetail.device": "Zariadenie",
  "refundDetail.id": "ID vrátenia",
  "refundDetail.cash.title": "Hotovosť",
  "refundDetail.cash.handed": "Vydané z pokladne",
  "refundDetail.cash.rounding": "Zaokrúhlenie",
  "refundDetail.card.title": "Na kartu",
  "refundDetail.card.kind": "Spôsob",
  "refundDetail.card.kind.reversal": "Platba stornovaná na termináli",
  "refundDetail.card.kind.referralRefund": "Vrátené na kartu",
  "refundDetail.card.transactionId": "ID transakcie terminálu",
  "refundDetail.card.authCode": "Autorizačný kód",
  "refundDetail.card.sequenceNumber": "Poradové číslo",
  "refundDetail.card.terminalId": "Terminál (TID)",
  "refundDetail.qerko.title": "Cez Qerko",
  "refundDetail.qerko.description":
    "Platbu zrušilo Qerko a peniaze vrátilo zákazníkovi.",
  "refundDetail.lines.title": "Položky",
} satisfies Record<keyof typeof enPayment, string>
