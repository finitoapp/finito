import type { enPayment } from "../en/payment.ts"

export const csPayment = {
  "payment.create.billTotalNotPositive":
    "Účet vychází na nulu nebo pod ni, není co zaplatit.",
  "payment.create.error": "Platbu se nepodařilo vytvořit.",
  "payment.status.canceled": "Zrušeno",
  "payment.status.expired": "Vypršelo",
  "payment.status.paid": "Zaplaceno",
  "payment.status.pending": "Čeká",
  "paymentDetail.card.title": "Platba kartou",
  "paymentDetail.card.brand": "Karta",
  "paymentDetail.card.maskedPan": "Číslo karty",
  "paymentDetail.card.authCode": "Autorizační kód",
  "paymentDetail.card.transactionId": "ID transakce terminálu",
  "paymentDetail.card.terminalId": "Terminál (TID)",
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
  "paymentDetail.refunds.method.qerkoPayment": "V Qerku",
  "refund.qerkoPayment.done": "Qerko platbu vrátilo.",
  "refund.qerkoPayment.error.notAvailable":
    "Tuto platbu nejde vrátit v Qerku: nebyla v něm zaplacena, nebo už je část vrácená.",
  "refund.qerkoPayment.error.notCancelled":
    "Qerko platbu nevrátilo. Zkuste to později.",
  "refund.qerkoPayment.error.unreachable":
    "Qerko není dostupné. Zkontrolujte připojení a zkuste to znovu.",
  "paymentDetail.refunds.method.qerkoTerminal": "Na kartu",
  "paymentDetail.refunds.method.cardSwitchio": "Na kartu",
  "paymentDetail.refunds.title": "Vratky",
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
  "paymentDetail.qerkoAttempts.title": "V Qerku",
  "paymentDetail.qerkoAttempts.state.started": "Zahájena",
  "paymentDetail.qerkoAttempts.state.processing": "Potvrzuje se",
  "paymentDetail.qerkoAttempts.state.paid": "Zaplaceno",
  "paymentDetail.qerkoAttempts.state.failed": "Neprošla",
  "paymentDetail.qerkoProvider.card": "kartou",
  "paymentDetail.qerkoProvider.mealTicket": "stravenkou",
  "paymentDetail.qerkoProvider.voucher": "poukázkou",
  "paymentDetail.qerkoProvider.bankTransfer": "převodem",
  "paymentDetail.qerkoProvider.invoice": "na fakturu",
  "paymentDetail.paymentMethod.qerkoPayment": "Qerko",
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
  "paymentTip.custom.label": "Vlastní spropitné",
  "paymentTip.custom.orderTotal": "Cena objednávky {amount}",
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
  "paymentWait.cardPaid.action": "Zaplatit kartou",
  "paymentWait.cardPaid.check": "Zeptat se SwitchioPay",
  "paymentWait.cardPaid.check.paid":
    "SwitchioPay dodatečně potvrdil platbu kartou.",
  "paymentWait.cardPaid.check.unresolved":
    "SwitchioPay platbu nepotvrdil. Než to zkusíte znovu, zkontrolujte transakci ve SwitchioPay.",
  "paymentWait.cardPaid.check.otherDevice":
    "Na SwitchioPay se může zeptat jen zařízení, na kterém platba proběhla.",
  "paymentWait.cardPaid.error.busy":
    "SwitchioPay je zaneprázdněný. Z karty se nic nestrhlo, zkuste to za chvíli znovu.",
  "paymentWait.cardPaid.error.declined": "Platba kartou neproběhla.",
  "paymentWait.cardPaid.error.generic": "Platbu kartou nelze provést.",
  "paymentWait.cardPaid.error.demo":
    "V demo účtu nelze přijmout skutečnou platbu kartou.",
  "paymentWait.cardPaid.error.unavailable":
    "Aplikace SwitchioPay není na tomto zařízení dostupná.",
  "paymentWait.cardPaid.error.unreadable":
    "Terminál nevrátil srozumitelný výsledek. Než to zkusíte znovu, zkontrolujte transakci ve SwitchioPay.",
  "paymentWait.cardPaid.error.notPayable":
    "Tuto platbu už nelze zaplatit kartou.",
  "paymentWait.cardPaid.pending": "Čekám na terminál...",
  "paymentWait.cardPaid.prompt": "Přijměte platbu kartou",
  "paymentWait.cardPaid.unavailable":
    "K této platbě není připojen platební terminál.",
  "paymentWait.cardPaid.restored.paid":
    "Platba kartou byla po restartu aplikace zpracována.",
  "paymentWait.cardPaid.restored.unresolved":
    "Výsledek platby kartou z doby před restartem aplikace se nepodařilo zpracovat. Zkontrolujte transakci ve SwitchioPay.",
  "paymentWait.cardPaid.retryUnresolved.cancel": "Zpět",
  "paymentWait.cardPaid.retryUnresolved.confirm": "Zaplatit znovu",
  "paymentWait.cardPaid.retryUnresolved.description":
    "Výsledek posledního pokusu ({transactionId}) není známý a peníze z karty už mohly odejít. Zaplaťte znovu, až když ve SwitchioPay ověříte, že platba neproběhla.",
  "paymentWait.cardPaid.retryUnresolved.title": "Zkusit platbu kartou znovu?",
  "paymentWait.cardPaid.unresolved":
    "Výsledek posledního pokusu ({transactionId}) není známý. Než to zkusíte znovu, zkontrolujte transakci ve SwitchioPay.",
  "paymentWait.cashPaid.action": "Označit jako zaplaceno",
  "paymentWait.cashPaid.difference": "Rozdíl proti útratě: {amount}",
  "paymentWait.cashPaid.error": "Platbu se nepodařilo označit jako zaplacenou.",
  "paymentWait.cashPaid.notPayable":
    "Tuto platbu nejde zaplatit hotově: po zaokrouhlení pro hotovost vychází na nulu.",
  "paymentWait.cashPaid.pending": "Označuji jako zaplaceno...",
  "paymentWait.cashPaid.prompt": "Přijměte hotovostní platbu",
  "paymentWait.cashPaid.received": "Přijatá hotovost",
  "paymentWait.cashPaid.receivedTooLow": "Zadejte alespoň {amount}.",
  "paymentWait.cashPaid.unavailable": "K této platbě není připojená pokladna.",
  "paymentWait.copyQr": "Zkopírovat obsah QR kódu",
  "paymentWait.detail": "Detail platby",
  "paymentWait.eetSandbox": "Odesláno jen do testovacího prostředí EET.",
  "paymentWait.ibanDetails.more": "Více informací",
  "paymentWait.ibanDetails.title": "Platební údaje",
  "paymentWait.bankWatch.waiting": "Čekám na platbu…",
  "paymentWait.ibanDetails.account.label": "Účet",
  "paymentWait.ibanDetails.recipient.label": "Příjemce",
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
  "paymentWait.method.qerkoPayment": "Qerko",
  "paymentWait.preparing.qerkoPayment": "Připravuji platbu přes Qerko…",
  "paymentWait.qerkoPayment.scan": "Zákazník naskenuje kód v aplikaci Qerko.",
  "paymentWait.qerkoPayment.tipChosenInQerko":
    "Spropitné vybírá zákazník v Qerku a nahradí to zadané zde.",
  "paymentWait.qerkoPayment.started": "Zákazník platí v Qerku…",
  "paymentWait.qerkoPayment.processing": "Qerko potvrzuje platbu…",
  "paymentWait.qerkoPayment.failed":
    "Platba v Qerku neprošla. Zákazník to může zkusit znovu.",
  "paymentWait.qerkoPayment.noDevice":
    "Žádné zařízení nepřijímá platby přes Qerko. Zvolte ho v nastavení.",
  "paymentWait.qerkoPayment.disconnected":
    "Toto zařízení není připojené ke Qerku, zákazníci zatím nemohou platit.",
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
  "refund.dialog.method.cardSwitchio": "Zpět na kartu přes SwitchioPay",
  "refund.outcome.reversal":
    "Terminál platbu vezme zpět celou, karta není potřeba.",
  "refund.outcome.card": "Peníze se vrátí na kartu, kterou zákazník platil.",
  "refund.outcome.qerkoPayment": "Qerko vrátí zákazníkovi celou platbu.",
  "refund.outcome.cashRegister": "Vydejte zákazníkovi {amount} z pokladny.",
  "refund.outcome.cashRegisterRounded":
    "Vydejte zákazníkovi {amount} z pokladny, zaokrouhleno na celé koruny.",
  "refund.outcome.outside": "Vrácení jen zaznamenáme, peníze vracíte jinde.",
  "refund.page.title": "Vrátit peníze",
  "refund.page.empty": "Z této platby už nejde nic vrátit.",
  "refund.page.choice.whole": "Celou platbu",
  "refund.page.choice.whole.tipIncluded": "vč. spropitného {amount}",
  "refund.page.choice.part": "Část",
  "refund.page.choice.part.left": "zbývá {amount}",
  "refund.page.choice.tip": "Jen spropitné",
  "refund.page.amount.label": "Kolik",
  "refund.page.method.qerkoPayment": "Zpět přes Qerko",
  "refund.page.qerko.done": "Peníze se vrátily na kartu.",
  "refund.page.switchio.waiting": "Dokončete vrácení ve SwitchioPay.",
  "refund.switchio.done": "Peníze se vrátily na kartu.",
  "refund.switchio.pending": "Vracím na kartu přes SwitchioPay",
  "refund.switchio.pendingElsewhere":
    "Čeká se na SwitchioPay na jiném zařízení. Pokud už to zařízení není k dispozici, zkontrolujte vrácení ve SwitchioPay a upozornění zavřete.",
  "refund.switchio.unresolved":
    "Výsledek vrácení na kartu není známý, peníze se tedy možná už vrátily. Před dalším vrácením to zkontrolujte ve SwitchioPay.",
  "refund.switchio.failed": "Terminál vrácení na kartu zamítl.",
  "refund.switchio.check": "Zjistit stav ve SwitchioPay",
  "refund.switchio.dismissPending.title": "Zavřít vrácení?",
  "refund.switchio.dismissPending.description":
    "Druhé zařízení ho ještě může ohlásit. Pokud se peníze vrátily, vrácení se pak zapíše i tak.",
  "refund.switchio.dismissPending.confirm": "Zavřít",
  "refund.switchio.dismissPending.cancel": "Zpět",
  "refund.switchio.error.notAvailable":
    "Tuto platbu nelze vrátit na kartu: terminál k ní nevrátil identifikátor potřebný pro vrácení.",
  "refund.switchio.error.running":
    "Jiné vrácení této platby na kartu ještě není vyřízené.",
  "refund.switchio.error.notStarted":
    "SwitchioPay je zaneprázdněný nebo není připravený. Nic se nevrátilo, zkuste to znovu.",
  "refund.switchio.error.otherDevice":
    "Stav ve SwitchioPay může zjistit jen zařízení, které vrácení spustilo.",
  "refund.switchio.restored.unusable":
    "Výsledek vrácení na kartu z doby před restartem aplikace se nepodařilo zpracovat. Zkontrolujte vrácení ve SwitchioPay.",
  "refund.switchio.reversalDeclined.title":
    "Terminál už platbu nemůže stornovat",
  "refund.switchio.reversalDeclined.description":
    "Dávka byla nejspíš už uzavřena. Peníze ale můžete vrátit na kartu, kterou zákazník platil. Vrátit je?",
  "refund.switchio.reversalDeclined.confirm": "Vrátit na kartu",
  "refund.switchio.reversalDeclined.cancel": "Zpět",
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
  "refund.qerko.unresolved":
    "Výsledek vrácení na kartu není znám, karta tedy mohla být vrácená. Před dalším vrácením zkontrolujte terminál a Qerko.",
  "refund.tipCreated": "Spropitné vráceno.",
  "refund.error.tip": "Spropitné této platby už je vrácené.",
  "refund.dialog.tipHint": "Bez spropitného {amount}, to se vrací zvlášť.",
  "refund.dialog.amount.invalid": "Zadejte částku nejvýš {amount}.",
  "refund.dialog.amount.label": "Vracená částka",
  "refund.dialog.confirm": "Vrátit {amount}",
  "refund.dialog.confirmEmpty": "Vrátit",
  "refund.dialog.items.available": "Nejvýš {quantity}",
  "refund.dialog.items.decrease": "Méně: {name}",
  "refund.dialog.items.increase": "Více: {name}",
  "refund.dialog.method.cashRegister": "Hotově z pokladny",
  "refund.dialog.method.label": "Jak peníze vracíte",
  "refund.dialog.method.outside":
    "Mimo {appName}, třeba na platebním terminálu",
  "refund.dialog.mode.amount": "Částka",
  "refund.dialog.mode.items": "Položky",
  "refund.dialog.mode.label": "Co vracíte",
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
  "refundDetail.title": "Vrácení",
  "refundDetail.notFound": "Vrácení nenalezeno.",
  "refundDetail.payment": "Platba",
  "refundDetail.what": "Co",
  "refundDetail.what.goods": "Zboží",
  "refundDetail.device": "Zařízení",
  "refundDetail.id": "ID vrácení",
  "refundDetail.cash.title": "Hotovost",
  "refundDetail.cash.handed": "Vydáno z pokladny",
  "refundDetail.cash.rounding": "Zaokrouhlení",
  "refundDetail.card.title": "Na kartu",
  "refundDetail.card.kind": "Způsob",
  "refundDetail.card.kind.reversal": "Platba stornována na terminálu",
  "refundDetail.card.kind.referralRefund": "Vráceno na kartu",
  "refundDetail.card.transactionId": "ID transakce terminálu",
  "refundDetail.card.authCode": "Autorizační kód",
  "refundDetail.card.sequenceNumber": "Pořadové číslo",
  "refundDetail.card.terminalId": "Terminál (TID)",
  "refundDetail.qerko.title": "Přes Qerko",
  "refundDetail.qerko.description":
    "Platbu zrušilo Qerko a peníze vrátilo zákazníkovi.",
  "refundDetail.lines.title": "Položky",
} satisfies Record<keyof typeof enPayment, string>
