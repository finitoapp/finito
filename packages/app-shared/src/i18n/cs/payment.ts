import type { enPayment } from "../en/payment.ts"

export const csPayment = {
  "payment.create.error": "Platbu se nepodařilo vytvořit.",
  "payment.status.canceled": "Zrušeno",
  "payment.status.expired": "Vypršelo",
  "payment.status.paid": "Zaplaceno",
  "payment.status.pending": "Čeká",
  "paymentDetail.cashReceived": "Přijato v hotovosti {amount}",
  "paymentDetail.eet.amount": "Odeslaná částka",
  "paymentDetail.eet.cashRegister": "Označení pokladny",
  "paymentDetail.eet.eic": "EIČ",
  "paymentDetail.eet.errorCode": "Chyba EET {code}: {message}",
  "paymentDetail.eet.establishment": "Evidenční jednotka",
  "paymentDetail.eet.extra.description":
    "Peníze, které přišly po prvním zaplacení nebo nad částku platby, jsou v EET jako samostatná tržba a jejich vrácení stornuje jen ji.",
  "paymentDetail.eet.extra.title": "Dodatečná platba v EET {amount}",
  "paymentDetail.eet.lastError": "Poslední chyba",
  "paymentDetail.eet.overdue": "Nepotvrzeno do 48 hodin od tržby.",
  "paymentDetail.eet.pok": "POK",
  "paymentDetail.eet.receivedAt": "Přijato do EET",
  "paymentDetail.eet.retry": "Odeslat do EET znovu",
  "paymentDetail.eet.retry.alreadyConfirmed": "EET už tuto tržbu potvrdila.",
  "paymentDetail.eet.retry.busy": "Tržba se právě odesílá.",
  "paymentDetail.eet.waitingForDevice":
    "Do {time} ji odešle jen zařízení, které platbu přijalo.",
  "paymentDetail.eet.retry.confirmed": "EET tržbu potvrdila.",
  "paymentDetail.eet.retry.failed": "Tržbu se nepodařilo odeslat.",
  "paymentDetail.eet.retry.noCertificate":
    "Nejdřív v nastavení EET importujte certifikát pokladny.",
  "paymentDetail.eet.retry.pending":
    "EET neodpověděla. Tržba se odešle znovu automaticky.",
  "paymentDetail.eet.retry.rejected": "EET tržbu znovu odmítla.",
  "paymentDetail.eet.retry.unsupported": "Tuto tržbu nelze do EET odeslat.",
  "paymentDetail.eet.reversal.retry.confirmed": "EET storno potvrdila.",
  "paymentDetail.eet.reversal.retry.rejected": "EET storno znovu odmítla.",
  "paymentDetail.eet.reversal.title": "Storno v EET {amount}",
  "paymentDetail.eet.reversal.unsupported.disabled":
    "Při vratce byla EET vypnutá, storno se proto neodešle.",
  "paymentDetail.eet.reversal.unsupported.environment":
    "EET teď běží v jiném prostředí než tržba, storno se proto neodešle.",
  "paymentDetail.eet.reversal.unsupported.taxpayer":
    "EET teď eviduje za jiného poplatníka než tržbu, storno se proto neodešle.",
  "paymentDetail.eet.reversal.waiting": "Čeká, až EET potvrdí původní tržbu.",
  "paymentDetail.eet.reversal.waitingForDevice":
    "Do {time} ho odešle jen zařízení, které vrácení zaznamenalo.",
  "paymentDetail.eet.saleAt": "Datum a čas tržby",
  "paymentDetail.eet.sequenceNumber": "Pořadové číslo",
  "paymentDetail.eet.test":
    "Odesláno jen do testovacího prostředí EET. U finanční správy se neeviduje.",
  "paymentDetail.eet.title": "EET",
  "paymentDetail.eet.transactionId": "ID transakce EET",
  "paymentDetail.eet.unsupported":
    "EET přijímá jen tržby v korunách, proto tato tržba nebyla odeslána.",
  "paymentDetail.eet.warning": "Varování EET {code}",
  "paymentDetail.number": "Platba č. {number}",
  "paymentDetail.refunds.action": "Vrátit peníze",
  "paymentDetail.refunds.method.cashRegister": "Z pokladny",
  "paymentDetail.refunds.method.outside": "Mimo {appName}",
  "paymentDetail.refunds.method.qerkoTerminal": "Na kartu",
  "paymentDetail.refunds.title": "Vratky",
  "paymentDetail.refunds.tipAction": "Vrátit spropitné ({amount})",
  "paymentDetail.refunds.tip": "Spropitné",
  "paymentDetail.tipIncluded": "Z toho spropitné {amount}",
  "paymentDetail.canceledAtValue": "Zrušeno {date}",
  "paymentDetail.expiresAt": "Vyprší v {time}",
  "paymentDetail.technical": "Technické údaje",
  "paymentDetail.id": "ID platby",
  "paymentDetail.reconciliation.id": "ID spárování",
  "paymentDetail.copy": "Kopírovat {label}",
  "paymentDetail.copied": "Zkopírováno.",
  "paymentDetail.copyError": "Nepodařilo se zkopírovat.",
  "paymentDetail.bill.noTable": "Bez stolu",
  "paymentDetail.bill.open": "Otevřít účet",
  "paymentDetail.backToPayment": "Zpět na platbu",
  "paymentDetail.bill.coverage.changesTitle": "Změny od vzniku platby",
  "paymentDetail.bill.coverage.delta.overpaid":
    "Zaplaceno o {amount} víc, než účet stojí",
  "paymentDetail.bill.coverage.delta.underpaid": "Ještě chybí {amount}",
  "paymentDetail.bill.coverage.expectedAmount": "Očekáváno",
  "paymentDetail.bill.coverage.overpaid.fact":
    "Tento účet byl zaplacen za víc, než aktuálně stojí.",
  "paymentDetail.bill.coverage.overpaid.factWithReason":
    "Tento účet byl zaplacen za víc, než aktuálně stojí. {reason}",
  "paymentDetail.bill.coverage.overpaid.title": "Přeplaceno",
  "paymentDetail.bill.coverage.paidAmount": "Zaplaceno",
  "paymentDetail.bill.coverage.reason.billLinesChanged":
    "Pravděpodobně jiné zařízení změnilo položky účtu, zatímco tato platba už probíhala.",
  "paymentDetail.bill.coverage.reason.multiplePayments":
    "Tento účet zahrnuje víc než jednu platbu — podívejte se na ty ostatní níže.",
  "paymentDetail.bill.coverage.underpaid.fact":
    "Tento účet zatím není plně pokrytý potvrzenými platbami.",
  "paymentDetail.bill.coverage.underpaid.factWithReason":
    "Tento účet zatím není plně pokrytý potvrzenými platbami. {reason}",
  "paymentDetail.bill.coverage.underpaid.title": "Není doplaceno",
  "paymentDetail.bill.empty": "Tento účet nemá žádné položky.",
  "paymentDetail.bill.table": "Stůl",
  "paymentDetail.bill.title": "Účet",
  "paymentDetail.bill.total": "Celkem",
  "paymentDetail.collision.description":
    "Tato platba byla zrušena, ale existuje k ní nárok na úhradu — peníze se stále počítají do účtenky. Vyřešte kolizi níže.",
  "paymentDetail.collision.markPaid": "Označit jako zaplaceno",
  "paymentDetail.collision.markPaid.error":
    "Platbu se nepodařilo označit jako zaplacenou. Zkuste to znovu.",
  "paymentDetail.collision.refund": "Vrátit platbu",
  "paymentDetail.collision.refund.comingSoon":
    "Vracení plateb zatím není podporováno.",
  "paymentDetail.collision.title": "Zrušeno, ale peníze dorazily",
  "paymentDetail.deviceId": "Zařízení",
  "paymentDetail.emptyValue": "—",
  "paymentDetail.excessCollision.acknowledge": "Označit jako vyřešeno",
  "paymentDetail.excessCollision.acknowledge.error":
    "Kolizi se nepodařilo označit jako vyřešenou. Zkuste to znovu.",
  "paymentDetail.excessCollision.description":
    "Tato platba byla vypořádána vícekrát — pravděpodobně dvě offline zařízení nezávisle potvrdila jiný způsob úhrady. Vyřešte kolizi níže.",
  "paymentDetail.excessCollision.title": "Zaplaceno vícekrát",
  "paymentDetail.invalidId": "Neplatné id platby.",
  "paymentDetail.notFound": "Platba nebyla nalezena.",
  "paymentDetail.paymentMethod.card": "Platební kartou",
  "paymentDetail.paymentMethod.qerkoTerminal": "Platební kartou (terminál)",
  "paymentDetail.paymentMethod.qerkoTerminalTid":
    "Platební kartou (terminál {tid})",
  "paymentDetail.paymentMethod.cashu": "Cashu",
  "paymentDetail.paymentMethod.cash": "Hotově",
  "paymentDetail.paymentMethod.iban": "IBAN",
  "paymentDetail.paymentMethod.onchain": "On-chain",
  "paymentDetail.paymentMethod.spark": "Lightning",
  "paymentDetail.reconciliation.source.auto": "Automaticky",
  "paymentDetail.reconciliation.source.manual": "Ručně",
  "paymentDetail.reconciliations": "Spárování",
  "paymentDetail.reconciliations.empty":
    "S touto platbou zatím není spárovaná žádná transakce.",
  "paymentDetail.tipAmount": "Spropitné",
  "paymentDetail.title": "Detail platby",
  "paymentDetail.transaction.account": "Účet",
  "paymentDetail.transaction.amount": "Částka transakce",
  "paymentDetail.transaction.bankReference": "Reference banky",
  "paymentDetail.transaction.id": "Transakce",
  "paymentDetail.transaction.note": "Poznámka",
  "paymentDetail.transaction.occurredAt": "Proběhlo",
  "paymentDetail.transaction.paymentHash": "Payment hash",
  "paymentDetail.transaction.recordedAt": "Zaznamenáno",
  "paymentDetail.transaction.source": "Zdroj transakce",
  "paymentDetail.transaction.sparkTransferId": "Spark transfer",
  "paymentDetail.transaction.variableSymbol": "Variabilní symbol",
  "paymentDetail.updatedAt": "Upraveno",
  "paymentHistory.billOverpaid": "Účet přeplacen",
  "paymentHistory.billUnderpaid": "Účet nedoplacen",
  "paymentHistory.empty.description":
    "Vytvořené platební žádosti se zobrazí tady.",
  "paymentHistory.empty.title": "Zatím žádné platby",
  "paymentHistory.payment": "Platba",
  "paymentHistory.paymentNumber": "Platba č. {number}",
  "paymentHistory.tip": "vč. spropitného {amount}",
  "paymentHistory.title": "Historie plateb",
  "paymentTip.continue": "Pokračovat k platbě",
  "paymentTip.creating": "Vytvářím platbu...",
  "paymentTip.custom.actionDescription": "Zadat částku",
  "paymentTip.custom.description":
    "Zadejte částku, kterou chce zákazník přidat.",
  "paymentTip.custom.invalid":
    "Zadejte kladnou částku s nejvýše dvěma desetinnými místy.",
  "paymentTip.custom.label": "Vlastní spropitné",
  "paymentTip.custom.placeholder": "např. 20,00",
  "paymentTip.fixedAmounts": "Spropitné pevnou částkou",
  "paymentTip.invalidLink": "Neplatný odkaz na spropitné.",
  "paymentTip.none": "Bez spropitného",
  "paymentTip.orderTotal": "Cena objednávky",
  "paymentTip.percentages": "Spropitné v procentech",
  "paymentTip.title": "Chcete přidat spropitné?",
  "paymentWait.back": "Zpět na terminál",
  "paymentWait.boltCard.awaitingSettlement":
    "Karta přijata, čekám na platbu...",
  "paymentWait.boltCard.disabled":
    "NFC je vypnuté. Zapněte ho, abyste mohli přijímat Bolt Card.",
  "paymentWait.boltCard.enable": "Zapnout NFC",
  "paymentWait.boltCard.error.amountOutOfRange":
    "Částka je mimo limit této karty.",
  "paymentWait.boltCard.error.generic":
    "Platba kartou se nezdařila. Přiložte ji znovu.",
  "paymentWait.boltCard.error.network":
    "Nepodařilo se spojit se službou karty. Zkontrolujte připojení a přiložte kartu znovu.",
  "paymentWait.boltCard.error.notPayable": "Tuto platbu už nelze zaplatit.",
  "paymentWait.boltCard.error.rejected": "Karta byla odmítnuta: {reason}",
  "paymentWait.boltCard.error.timeout":
    "Karta platbu včas nedokončila. Přiložte ji znovu nebo zvolte jinou metodu.",
  "paymentWait.boltCard.error.unsupportedCard": "Tato karta není Bolt Card.",
  "paymentWait.boltCard.processing": "Čtu kartu...",
  "paymentWait.boltCard.ready": "Nebo přiložte Bolt Card",
  "paymentWait.cancel": "Zrušit platbu",
  "paymentWait.cancelError": "Platbu se nepodařilo zrušit.",
  "paymentWait.canceled": "Tato platba byla zrušena.",
  "paymentWait.cardPaid.action": "Zaplatit platební kartou",
  "paymentWait.cardPaid.error.declined": "Platba platební kartou neproběhla.",
  "paymentWait.cardPaid.error.generic": "Platbu platební kartou nelze provést.",
  "paymentWait.cardPaid.error.unavailable":
    "Aplikace terminálu SwitchioPay není na tomto zařízení dostupná.",
  "paymentWait.cardPaid.error.unreadable":
    "Terminál nevrátil čitelný výsledek. Než to zkusíte znovu, zkontrolujte transakci v SwitchioPay.",
  "paymentWait.cardPaid.error.notPayable":
    "Tuto platbu už nelze zaplatit kartou.",
  "paymentWait.cardPaid.pending": "Čekám na terminál...",
  "paymentWait.cardPaid.prompt": "Přijměte platbu platební kartou",
  "paymentWait.cardPaid.unavailable":
    "K této platbě není připojen platební terminál.",
  "paymentWait.cardPaid.restored.paid":
    "Platba kartou byla po restartu aplikace zaznamenána.",
  "paymentWait.cardPaid.restored.unresolved":
    "Výsledek platby kartou z doby před restartem aplikace se nepodařilo zpracovat. Zkontrolujte transakci v SwitchioPay.",
  "paymentWait.cardPaid.retryUnresolved.cancel": "Zpět",
  "paymentWait.cardPaid.retryUnresolved.confirm": "Strhnout znovu",
  "paymentWait.cardPaid.retryUnresolved.description":
    "Výsledek posledního pokusu ({transactionId}) není známý a karta už mohla být stržena. Strhněte znovu, až když v SwitchioPay ověříte, že platba neproběhla.",
  "paymentWait.cardPaid.retryUnresolved.title": "Strhnout kartu znovu?",
  "paymentWait.cardPaid.unresolved":
    "Výsledek posledního pokusu ({transactionId}) není známý. Než to zkusíte znovu, zkontrolujte transakci v SwitchioPay.",
  "paymentWait.cashPaid.action": "Označit jako zaplaceno",
  "paymentWait.cashPaid.difference": "Rozdíl proti útratě: {amount}",
  "paymentWait.cashPaid.error": "Platbu se nepodařilo označit jako zaplacenou.",
  "paymentWait.cashPaid.pending": "Označuji jako zaplaceno...",
  "paymentWait.cashPaid.prompt": "Přijměte hotovostní platbu",
  "paymentWait.cashPaid.received": "Přijatá hotovost",
  "paymentWait.cashPaid.receivedTooLow": "Zadejte alespoň {amount}.",
  "paymentWait.cashPaid.unavailable": "K této platbě není připojená pokladna.",
  "paymentWait.copyQr": "Zkopírovat obsah QR kódu",
  "paymentWait.detail": "Detail platby",
  "paymentWait.eetSandbox": "Odesláno jen do testovacího prostředí EET.",
  "paymentWait.ibanDetails.hide": "Skrýt bankovní údaje",
  "paymentWait.ibanDetails.iban.copied": "IBAN zkopírován.",
  "paymentWait.ibanDetails.iban.copy": "Kopírovat IBAN",
  "paymentWait.ibanDetails.iban.copyError": "IBAN se nepodařilo zkopírovat.",
  "paymentWait.ibanDetails.iban.label": "IBAN",
  "paymentWait.ibanDetails.show": "Zobrazit bankovní údaje",
  "paymentWait.ibanDetails.variableSymbol.copied":
    "Variabilní symbol zkopírován.",
  "paymentWait.ibanDetails.variableSymbol.copy": "Kopírovat variabilní symbol",
  "paymentWait.ibanDetails.variableSymbol.copyError":
    "Variabilní symbol se nepodařilo zkopírovat.",
  "paymentWait.ibanDetails.variableSymbol.label": "Variabilní symbol",
  "paymentWait.ibanPaid.action": "Přijal jsem převod",
  "paymentWait.ibanPaid.error": "Převod se nepodařilo potvrdit.",
  "paymentWait.ibanPaid.pending": "Potvrzuji...",
  "paymentWait.invalidId": "Neplatné id platby.",
  "paymentWait.method.cashu": "Cashu",
  "paymentWait.method.qerko": "Terminál",
  "paymentWait.preparing.cashu": "Připravuji Cashu platbu...",
  "paymentWait.cashu.quoteExpired":
    "Faktura mintu vypršela dřív, než byla zaplacena.",
  "paymentWait.cashu.arrival.receiving":
    "Přišel token na {amount} sat z {mint}. Přijímám ho...",
  "paymentWait.cashu.arrival.withFee":
    "Přišel token na {amount} sat z {mint}. Mint si nechá {fee} sat jako poplatek.",
  "paymentWait.cashu.arrival.waitingForMint":
    "Přišel token na {amount} sat. Čekám, až odpoví mint {mint}...",
  "paymentWait.cashu.arrival.untrustedMint":
    "Token na {amount} sat přišel z {mint}, což není výchozí mint. Nebyl přijat a tuto platbu nezaplatí.",
  "paymentWait.cashu.failure.mintUnreachable":
    "Mint neodpověděl. Token zkusím znovu.",
  "paymentWait.cashu.failure.mintRejected":
    "Mint token odmítl. Platba zůstává nezaplacená.",
  "paymentWait.cashu.failure.locked":
    "Token je zamčený pro někoho jiného. Platba zůstává nezaplacená.",
  "paymentWait.cashu.failure.undecodable":
    "Token se nepodařilo přečíst. Platba zůstává nezaplacená.",
  "paymentWait.cashu.failure.alreadyKnown":
    "Peněženka už tento token má. Platba zůstává nezaplacená.",
  "paymentWait.cashu.failure.fee":
    "Poplatek mintu by vzal celý token. Platba zůstává nezaplacená.",
  "paymentWait.cashu.failure.spent":
    "Token už byl utracen. Platba zůstává nezaplacená.",
  "paymentWait.cashu.newQuote": "Nová faktura",
  "paymentWait.method.card": "Platební karta",
  "paymentWait.method.cash": "Hotovost",
  "paymentWait.method.iban": "Převod",
  "paymentWait.method.lightning": "Bitcoin",
  "paymentWait.missingRequest": "Tato platba nemá žádost ke skenování.",
  "paymentWait.notFound": "Platba nebyla nalezena.",
  "paymentWait.paid": "Platba přijata",
  "paymentWait.pay": "Zaplatit",
  "paymentWait.prepareError": "Tuto platební metodu se nepodařilo připravit.",
  "paymentWait.prepareRetry": "Zkusit platební metodu znovu",
  "paymentWait.preparing.card": "Připravuji platbu platební kartou...",
  "paymentWait.preparing.cash": "Připravuji hotovostní platbu...",
  "paymentWait.preparing.iban": "Připravuji bankovní QR platbu...",
  "paymentWait.preparing.qerko": "Připravuji terminál…",
  "paymentWait.preparing.spark": "Připravuji Lightning žádost...",
  "paymentWait.qerko.action": "Zaplatit na terminálu",
  "paymentWait.qerko.cancel": "Zrušit na terminálu",
  "paymentWait.qerko.cancel.notCancellable": "Platbu už nelze zrušit.",
  "paymentWait.qerko.error.attemptRunning": "Na terminálu už platba běží.",
  "paymentWait.qerko.error.generic":
    "Platbu se nepodařilo provést. Zkuste to znovu.",
  "paymentWait.qerko.error.keyRejected":
    "Qerko už spárování nepřijímá. Spárujte terminál znovu v nastavení.",
  "paymentWait.qerko.error.keyRejected.link": "Otevřít nastavení Qerko",
  "paymentWait.qerko.error.notPaired": "Terminál Qerko není spárovaný.",
  "paymentWait.qerko.error.notPayable": "Tuto platbu už nelze zaplatit.",
  "paymentWait.qerko.error.unreachable":
    "Qerko se nepodařilo zastihnout. Zkontrolujte připojení.",
  "paymentWait.qerko.failed.cancelled": "Platba byla zrušena na terminálu.",
  "paymentWait.qerko.failed.declined": "Karta byla zamítnuta.",
  "paymentWait.qerko.failed.reversed": "Platba byla stornována.",
  "paymentWait.qerko.noTerminal": "Na tomto zařízení není vybraný terminál.",
  "paymentWait.qerko.noTerminal.link": "Vybrat terminál",
  "paymentWait.qerko.notStarted.busy":
    "Terminál je zaneprázdněný. Zkuste to za chvíli.",
  "paymentWait.qerko.notStarted.notActivated":
    "Terminál není v Qerku aktivovaný.",
  "paymentWait.qerko.notStarted.notConnected": "Terminál není připojený.",
  "paymentWait.qerko.notStarted.timeout":
    "Terminál neodpověděl včas. Před dalším pokusem ho zkontrolujte.",
  "paymentWait.qerko.notStarted.unknownTerminal":
    "Qerko tento terminál nezná. Vyberte ho znovu v nastavení.",
  "paymentWait.qerko.retry": "Zaplatit na terminálu znovu",
  "paymentWait.qerko.retryUnresolved.cancel": "Zrušit",
  "paymentWait.qerko.retryUnresolved.confirm":
    "Zkontroloval(a) jsem, zaplatit znovu",
  "paymentWait.qerko.retryUnresolved.description":
    "Poslední pokus skončil s neznámým výsledkem a karta mohla být strhnutá. Zkontrolovali jste terminál a Qerko?",
  "paymentWait.qerko.retryUnresolved.title": "Zaplatit znovu?",
  "paymentWait.qerko.step.authorizing": "Autorizuji platbu…",
  "paymentWait.qerko.step.connecting": "Připojuji se k terminálu…",
  "paymentWait.qerko.step.finishing": "Dokončuji platbu…",
  "paymentWait.qerko.step.waitingForCard": "Čekám na kartu…",
  "paymentWait.qerko.step.waitingForCustomer": "Čekám na zákazníka…",
  "paymentWait.qerko.step.waitingForPin": "Zákazník zadává PIN…",
  "paymentWait.qerko.unresolved":
    "Výsledek posledního pokusu není znám, karta tedy mohla být strhnutá. Před dalším pokusem zkontrolujte terminál a historii plateb v Qerku.",
  "paymentWait.qrCopied": "Obsah QR kódu zkopírován.",
  "paymentWait.qrCopyFailed": "Obsah QR kódu se nepodařilo zkopírovat.",
  "paymentWait.qrFormat.payBySquare1_0_0": "Pay by square 1.0 (Slovensko)",
  "paymentWait.qrFormat.payBySquare1_2_0": "Pay by square 1.2 (Slovensko)",
  "paymentWait.qrFormat.spayd": "SPAYD (Česko)",
  "paymentWait.qrFormatShort.payBySquare1_0_0": "SK 1.0",
  "paymentWait.qrFormatShort.payBySquare1_2_0": "SK 1.2",
  "paymentWait.qrFormatShort.spayd": "CZ",
  "paymentWait.scanOrTap": "Naskenujte a zaplaťte",
  "paymentWait.wakeLockUnsupported":
    "Tento prohlížeč neumí automaticky udržet obrazovku zapnutou.",
  "refund.created": "Vratka je zaznamenaná.",
  "refund.dialog.method.qerkoTerminal": "Zpět na kartu přes terminál",
  "refund.dialog.method.qerkoTerminalTid": "Zpět na kartu na terminálu {tid}",
  "refund.qerko.dismiss": "Zavřít",
  "refund.qerko.dismissUnresolved": "Zkontroloval(a) jsem, zavřít",
  "refund.qerko.error.notAvailable":
    "Tato platba nebyla přijata na terminálu Qerko, takže ji nelze vrátit na kartu.",
  "refund.qerko.error.running":
    "Další vrácení této platby na kartu stále čeká na terminál.",
  "refund.qerko.error.terminalNotActivated":
    "Terminál, na kterém platba proběhla, není v Qerku aktivovaný. Refund na kartu lze provést jen na něm, požádejte proto podporu Qerko o jeho opětovnou aktivaci.",
  "refund.qerko.error.terminalNotConnected":
    "Terminál, na kterém platba proběhla, není připojený. Refund na kartu lze provést jen na něm, připojte ho a zkuste to znovu.",
  "refund.qerko.error.unknownTerminal":
    "Qerko terminál, na kterém platba proběhla, nezná. Refund na kartu lze provést jen na něm, kontaktujte proto podporu Qerko.",
  "refund.qerko.failed.cancelled":
    "Vrácení na kartu bylo zrušeno na terminálu.",
  "refund.qerko.failed.declined": "Terminál vrácení na kartu zamítl.",
  "refund.qerko.pending": "Vracím na kartu",
  "refund.qerko.started": "Vrácení bylo odesláno na terminál.",
  "refund.qerko.unresolved":
    "Výsledek vrácení na kartu není znám, karta tedy mohla být vrácená. Před dalším vrácením zkontrolujte terminál a Qerko.",
  "refund.tipDialog.title": "Vrátit spropitné",
  "refund.tipDialog.description":
    "Vrátí celé spropitné {amount}. Vrácení zboží ho nikdy nezahrnuje.",
  "refund.tipCreated": "Spropitné vráceno.",
  "refund.error.tip": "Spropitné této platby už je vrácené.",
  "refund.dialog.tipHint": "Bez spropitného {amount}, to se vrací zvlášť.",
  "refund.dialog.amount.invalid": "Zadejte částku nejvýš {amount}.",
  "refund.dialog.amount.label": "Vracená částka",
  "refund.dialog.cancel": "Zrušit",
  "refund.dialog.confirm": "Vrátit {amount}",
  "refund.dialog.confirmEmpty": "Vrátit",
  "refund.dialog.description":
    "Vratku nejde vzít zpět. Platba zůstane zaplacená a účet uzavřený.",
  "refund.dialog.items.available": "Nejvýš {quantity}",
  "refund.dialog.items.decrease": "Méně: {name}",
  "refund.dialog.items.increase": "Více: {name}",
  "refund.dialog.items.label": "Vracené položky",
  "refund.dialog.method.cashRegister": "Hotově z pokladny",
  "refund.dialog.method.label": "Jak peníze vracíte",
  "refund.dialog.method.outside":
    "Mimo {appName}, třeba na platebním terminálu",
  "refund.dialog.mode.amount": "Částka",
  "refund.dialog.mode.items": "Položky",
  "refund.dialog.mode.label": "Co vracíte",
  "refund.dialog.title": "Vrátit peníze",
  "refund.error.amount": "Částka je vyšší, než kolik zbývá vrátit.",
  "refund.error.cashRegister": "Pro tuto měnu tu není pokladna.",
  "refund.error.items": "Tyto položky už vrátit nejde.",
  "refund.error.notPaid": "Vrátit jde jen zaplacenou platbu.",
  "refund.state.full": "Vráceno {amount}",
  "refund.state.partial": "Částečně vráceno {amount}",
  "paymentDetail.paymentMethod.lightningAddress": "Lightning adresa",
  "paymentWait.method.lightningAddress": "Lightning",
  "paymentWait.preparing.lightningAddress": "Žádám peněženku o invoice...",
  "paymentWait.lightningAddress.unverified":
    "Peněženka hlásí invoice zaplacený, ale neposlala důkaz platby. Než vydáte zboží, zkontrolujte peněženku.",
  "paymentWait.monetaWatch.watching": "Čekám na platbu z banky…",
  "paymentWait.monetaWatch.unreachable":
    "Banka neodpovídá. {appName} to zkouší dál.",
  "paymentWait.monetaWatch.unauthorized":
    "Banka odmítla token MONETA, převod se automaticky nekontroluje.",
  "paymentWait.monetaWatch.openSettings": "Nastavení MONETA",
  "paymentWait.monetaWatch.rateLimited":
    "Dnešní dotazy do banky jsou vyčerpané. Potvrďte převod ručně.",
  "paymentDetail.transaction.preimage": "Důkaz platby (preimage)",
  "paymentWait.method.bitcoin": "Bitcoin",
} satisfies Record<keyof typeof enPayment, string>
