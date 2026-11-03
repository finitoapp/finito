import type { enWithdraw } from "../en/withdraw.ts"

export const csWithdraw = {
  "withdraw.all.description": "Odeslat celý dostupný zůstatek.",
  "withdraw.all.label": "Vybrat vše",
  "withdraw.all.unavailableInvoice": "Částku určuje faktura.",
  "withdraw.amount.available": "Dostupné: {amount} satů",
  "withdraw.amount.fromInvoice": "Částku určuje faktura.",
  "withdraw.amount.invalid": "Zadejte částku větší než 0.",
  "withdraw.amount.label": "Částka",
  "withdraw.amount.onchainMinimum": "On-chain výběr je nejméně {amount} satů.",
  "withdraw.amount.placeholder": "Částka v satech",
  "withdraw.amount.placeholderFiat": "Částka v {currency}",
  "withdraw.amount.range": "Od {min} do {max} satů.",
  "withdraw.amount.unit": "Jednotka částky",
  "withdraw.amount.unitSats": "saty",
  "withdraw.cashu.destinationPlaceholder":
    "Jméno v Linky, npub, Lightning adresa nebo faktura",
  "withdraw.cashu.error.address":
    "Lightning adresa neodpověděla podle očekávání.",
  "withdraw.cashu.error.amountlessInvoice":
    "Faktura nemá částku. Požádejte o fakturu s částkou, nebo použijte Lightning adresu.",
  "withdraw.cashu.error.destination":
    "Zadejte Lightning fakturu nebo Lightning adresu.",
  "withdraw.cashu.error.expired": "Faktura vypršela.",
  "withdraw.cashu.error.insufficient":
    "Zůstatek mintu nepokryje částku a poplatky.",
  "withdraw.cashu.error.onchain":
    "Z této peněženky lze vybírat jen přes Lightning: zadejte Lightning fakturu nebo adresu.",
  "withdraw.cashu.error.rejected":
    "Mint platbu odmítl. Z peněženky nic neodešlo.",
  "withdraw.cashu.error.toSelf":
    "Tohle je jedna z vašich vlastních platebních faktur.",
  "withdraw.cashu.error.unreachable": "Mint neodpověděl. Nic nebylo odesláno.",
  "withdraw.cashu.form.description":
    "Zadejte Lightning adresu, fakturu nebo jméno či profil v Linky.",
  "withdraw.cashu.mint": "Z kterého mintu",
  "withdraw.cashu.noAccount.description":
    "Před výběrem zapněte Bitcoin v platebních účtech.",
  "withdraw.cashu.noAccount.title": "Bitcoin je vypnutý",
  "withdraw.cashu.noFunds": "V peněžence nejsou žádné dostupné prostředky.",
  "withdraw.cashu.review.feeReserve": "Rezerva na poplatek mintu",
  "withdraw.cashu.review.inputFee": "Vstupní poplatek mintu",
  "withdraw.cashu.review.remainder":
    "Co rezerva nevyužije, vrátí se do zůstatku mintu.",
  "withdraw.cashu.title": "Výběr prostředků",
  "withdraw.clipboard.use": "Použít ze schránky: {value}",
  "withdraw.comment.hint": "Uvidíte ji jen vy, v historii výběrů.",
  "withdraw.comment.label": "Poznámka pro vás",
  "withdraw.continue": "Pokračovat",
  "withdraw.destination.checkingAddress": "Ověřuji Lightning adresu…",
  "withdraw.destination.invalid":
    "Zadejte bitcoinovou adresu, Lightning fakturu nebo Lightning adresu.",
  "withdraw.destination.kind.lightningAddress": "Lightning adresa",
  "withdraw.destination.kind.lightningInvoice": "Lightning faktura",
  "withdraw.destination.kind.onchain": "Bitcoinová adresa (on-chain)",
  "withdraw.destination.label": "Kam poslat",
  "withdraw.destination.paste": "Vložit",
  "withdraw.destination.pasteError": "Nepodařilo se přečíst schránku.",
  "withdraw.destination.placeholder":
    "Adresa, Lightning faktura nebo jmeno@domena",
  "withdraw.destination.scan": "Naskenovat",
  "withdraw.detail.amount": "Částka",
  "withdraw.detail.balanceNow":
    "V peněžence je teď {balance} satů; tento výběr by odepsal {amount} satů.",
  "withdraw.detail.cancel": "Zrušit",
  "withdraw.detail.cashuQuoteId": "ID melt quote",
  "withdraw.detail.comment": "Poznámka",
  "withdraw.detail.copied": "Zkopírováno",
  "withdraw.detail.copy": "Kopírovat",
  "withdraw.detail.copyError": "Nepodařilo se zkopírovat.",
  "withdraw.detail.date": "Datum",
  "withdraw.detail.destination": "Cíl",
  "withdraw.detail.device": "Zařízení",
  "withdraw.detail.failed.manual": "Peníze neodešly.",
  "withdraw.detail.failed.notCreated": "Platba neodešla.",
  "withdraw.detail.failed.notCreatedHint":
    "Zkontrolujte zůstatek. Pokud peníze v peněžence jsou, založte nový výběr z historie výběrů.",
  "withdraw.detail.failed.rejected": "Peníze neodešly.",
  "withdraw.detail.failed.returned": "Peníze se vrátily do peněženky.",
  "withdraw.detail.fee": "Poplatek",
  "withdraw.detail.invoice": "Faktura",
  "withdraw.detail.invoiceRenewHint":
    "Lightning fakturu lze zaplatit jen jednou. Požádejte příjemce o novou.",
  "withdraw.detail.manualConfirmed":
    "Potvrzeno ručně, transakce není dohledaná.",
  "withdraw.detail.markNotSent": "Peníze neodešly",
  "withdraw.detail.markNotSent.description":
    "Jen pokud zůstatek peněženky stále obsahuje {amount} satů.",
  "withdraw.detail.markNotSent.title": "Označit výběr jako neodeslaný?",
  "withdraw.detail.markSent": "Peníze odešly",
  "withdraw.detail.markSent.description":
    "Zapíše odchod {amount} satů z peněženky.",
  "withdraw.detail.markSent.title": "Označit výběr jako odeslaný?",
  "withdraw.detail.maxFee": "Nejvyšší poplatek",
  "withdraw.detail.mint": "Mint",
  "withdraw.detail.movementDeleted": "Pohyb na účtu byl smazán.",
  "withdraw.detail.newWithdrawal": "Nový výběr",
  "withdraw.detail.notFound": "Tento výběr se nepodařilo najít.",
  "withdraw.detail.onchainUncertain":
    "Výsledek není jistý, zkontrolujte zůstatek.",
  "withdraw.detail.pending.cashu":
    "Výběr byl odeslán, mint ho zatím nepotvrdil. Dokončí se sám.",
  "withdraw.detail.pending.otherDevice":
    "Čeká se na výsledek. Výběr založilo zařízení {device}; když platba neodejde, označí se jako neodeslaný nejpozději do 24 hodin.",
  "withdraw.detail.pending.ownDevice":
    "Čeká se na výsledek. Když platba do 10 minut neodejde, výběr se sám označí jako neodeslaný.",
  "withdraw.detail.pending.processing":
    "Platba se ještě zpracovává. Čeká na dokončení, případně na vyzvednutí příjemcem.",
  "withdraw.detail.pending.unknown":
    "Výsledek se nepodařilo zjistit. Zkontrolujte zůstatek a pohyby na účtu.",
  "withdraw.detail.pending.unknownDevice":
    "Čeká se na výsledek. Výběr založilo jiné zařízení; když platba neodejde, označí se jako neodeslaný nejpozději do 24 hodin.",
  "withdraw.detail.preimage": "Preimage",
  "withdraw.detail.sparkTransferId": "ID Spark převodu",
  "withdraw.detail.technical": "Technické údaje",
  "withdraw.detail.title": "Výběr",
  "withdraw.detail.total": "Celkem odepsáno",
  "withdraw.detail.txid": "ID transakce",
  "withdraw.detail.txidError": "Transakci se nepodařilo načíst.",
  "withdraw.detail.txidPending": "Transakce ještě není v síti.",
  "withdraw.detail.type": "Typ",
  "withdraw.detail.viewOnExplorer": "Zobrazit na mempool.space",
  "withdraw.error.accountNotFound": "Spark účet nebyl nalezen.",
  "withdraw.error.amountOutOfRange":
    "Tato Lightning adresa přijímá {min} až {max} satů.",
  "withdraw.error.belowMinimum":
    "On-chain výběr musí být alespoň {amount} satů.",
  "withdraw.error.insufficientBalance":
    "Tato částka přesahuje váš dostupný zůstatek.",
  "withdraw.error.insufficientBalanceMax":
    "Částka s poplatkem přesahuje zůstatek. Poslat jde nejvýš {amount} satů.",
  "withdraw.error.lightningAddressMismatch":
    "Lightning adresa vrátila fakturu, která neodpovídá. Nic se nezaplatilo.",
  "withdraw.error.lightningAddressUnavailable":
    "Lightning adresu se nepodařilo kontaktovat. Zkontrolujte ji a zkuste to znovu.",
  "withdraw.error.lightningInvoiceExpired":
    "Faktura vypršela. Získejte nový odhad, nebo si od příjemce vyžádejte novou fakturu.",
  "withdraw.error.lightningInvoiceWrongNetwork":
    "Tato faktura není pro bitcoinový mainnet.",
  "withdraw.error.lnurlNotSupported":
    "Použijte Lightning adresu jmeno@domena nebo fakturu.",
  "withdraw.error.quoteExpired": "Odhad poplatku vypršel. Získejte nový odhad.",
  "withdraw.error.selfWithdrawal":
    "Peníze by se poslaly zpět do této peněženky.",
  "withdraw.error.sparkDestinationNotSupported":
    "Požádejte příjemce o Lightning fakturu nebo Lightning adresu.",
  "withdraw.form.description":
    "Odeslat bitcoin ze Spark peněženky na on-chain adresu, Lightning fakturu nebo Lightning adresu.",
  "withdraw.form.title": "Nový výběr",
  "withdraw.history.balance": "Zůstatek: {amount} satů",
  "withdraw.history.empty": "Zatím žádné výběry.",
  "withdraw.history.new": "Nový výběr",
  "withdraw.history.olderNote": "Starší výběry najdete v pohybech na účtu.",
  "withdraw.history.title": "Výběry",
  "withdraw.history.transactionsLink": "Pohyby na účtu",
  "withdraw.kind.cashu": "Lightning (Cashu)",
  "withdraw.kind.lightning": "Lightning",
  "withdraw.kind.onchain": "On-chain",
  "withdraw.noAccount.action": "Přejít na platební účty",
  "withdraw.noAccount.description":
    "Před výběrem nastavte Spark peněženku v Platebních účtech.",
  "withdraw.noAccount.title": "Není nastaven žádný Spark účet",
  "withdraw.options.label": "Další možnosti",
  "withdraw.quoteError.generic":
    "Nepodařilo se získat odhad poplatku. Zkuste to znovu.",
  "withdraw.quotePending": "Zjišťuji odhad poplatku...",
  "withdraw.recipientComment.hint": "Příjemce ji uvidí. Nejvýš {max} znaků.",
  "withdraw.recipientComment.label": "Zpráva pro příjemce",
  "withdraw.review.amount": "Částka výběru",
  "withdraw.review.back": "Zpět",
  "withdraw.review.comment": "Poznámka",
  "withdraw.review.confirm": "Potvrdit výběr",
  "withdraw.review.confirming": "Odesílám...",
  "withdraw.review.destination": "Cíl",
  "withdraw.review.error.generic":
    "Výběr se nepodařilo zahájit. Zkuste to znovu.",
  "withdraw.review.error.interrupted":
    "Výběr byl přerušen před dokončením. Zkuste to znovu.",
  "withdraw.review.error.uncertain":
    "Výběr mohl, ale nemusel být odeslán. Před dalším pokusem zkontrolujte seznam výběrů; dokud to nevíte jistě, neposílejte ho znovu.",
  "withdraw.review.expiresIn": "Faktura platí ještě",
  "withdraw.review.fee": "Odhadovaný síťový poplatek",
  "withdraw.review.feeEstimate": "~{estimate} satů (nejvýš {max} satů)",
  "withdraw.review.invoiceDescription": "Popis faktury",
  "withdraw.review.lightningFee": "Poplatek",
  "withdraw.review.maxFeeSpark":
    "Obvykle bez poplatku (přes Spark), nejvýš {amount} satů",
  "withdraw.review.maxTotal": "Odepíše se nejvýš",
  "withdraw.review.newQuote": "Nový odhad",
  "withdraw.review.pinDetail": "{amount} satů → {destination}",
  "withdraw.review.recipientComment": "Zpráva pro příjemce",
  "withdraw.review.recipientText": "Text od příjemce",
  "withdraw.review.remainder": "Co poplatek nevyčerpá, zůstane v peněžence.",
  "withdraw.review.showInvoice": "Zobrazit fakturu",
  "withdraw.review.speed.fast": "Rychlý",
  "withdraw.review.speed.fast.hint": "Nejvyšší priorita",
  "withdraw.review.speed.medium": "Střední",
  "withdraw.review.speed.medium.hint": "Vyvážená",
  "withdraw.review.speed.slow": "Pomalý",
  "withdraw.review.speed.slow.hint": "Nejnižší poplatek",
  "withdraw.review.title": "Kontrola výběru",
  "withdraw.review.total": "Celková odečtená částka",
  "withdraw.review.warning":
    "Bitcoinové transakce nelze vrátit. Před potvrzením cíl pečlivě zkontrolujte.",
  "withdraw.sats": "{amount} satů",
  "withdraw.scan.title": "Naskenovat cíl",
  "withdraw.status.done": "Dokončeno",
  "withdraw.status.failed": "Selhalo",
  "withdraw.status.pending": "Probíhá",
  "withdraw.status.sent": "Odesláno",
  "withdraw.transactions.empty": "Zatím žádné pohyby.",
  "withdraw.transactions.kind.spark": "Spark",
  "withdraw.transactions.title": "Pohyby na účtu",
  "withdraw.destination.kind.linkyContact": "Kontakt z Linky",
  "withdraw.contact.checking": "Hledám kontakt v Linky…",
  "withdraw.contact.notFound": "V Linky není nikdo se jménem {address}.",
  "withdraw.contact.unreachable":
    "Linky se nepodařilo kontaktovat. Zkontrolujte připojení.",
  "withdraw.kind.cashuSend": "Platba kontaktu z Linky",
  "withdraw.cashu.send.error.notDelivered":
    "Token se nepodařilo předat. Z peněženky nic neodešlo.",
  "withdraw.cashu.send.error.consumedByFee":
    "Částka by nepokryla poplatek mintu.",
  "withdraw.cashu.send.review.fee": "Poplatek mintu, nejvýše",
  "withdraw.cashu.send.review.note":
    "Příjemci se platba objeví v Linky automaticky.",
  "withdraw.detail.pending.cashuSend": "Token je na cestě k příjemci.",
  "withdraw.detail.cashuOperationId": "Operace v peněžence",
} satisfies Record<keyof typeof enWithdraw, string>
