import type { enWithdraw } from "../en/withdraw.ts"

export const skWithdraw = {
  "withdraw.all.description": "Odoslať celý dostupný zostatok.",
  "withdraw.all.label": "Vybrať všetko",
  "withdraw.all.unavailableInvoice": "Sumu určuje faktúra.",
  "withdraw.amount.available": "Dostupné: {amount} satov",
  "withdraw.amount.fromInvoice": "Sumu určuje faktúra.",
  "withdraw.amount.invalid": "Zadajte sumu väčšiu ako 0.",
  "withdraw.amount.label": "Suma",
  "withdraw.amount.onchainMinimum":
    "On-chain výber je najmenej {amount} satov.",
  "withdraw.amount.placeholder": "Suma v satoch",
  "withdraw.amount.placeholderFiat": "Suma v {currency}",
  "withdraw.amount.range": "Od {min} do {max} satov.",
  "withdraw.amount.unit": "Jednotka sumy",
  "withdraw.amount.unitSats": "saty",
  "withdraw.cashu.destinationPlaceholder":
    "Meno v Linky, npub, Lightning adresa alebo faktúra",
  "withdraw.cashu.error.address":
    "Lightning adresa neodpovedala podľa očakávania.",
  "withdraw.cashu.error.amountlessInvoice":
    "Faktúra nemá sumu. Požiadajte o faktúru so sumou, alebo použite Lightning adresu.",
  "withdraw.cashu.error.destination":
    "Zadajte Lightning faktúru alebo Lightning adresu.",
  "withdraw.cashu.error.expired": "Faktúra vypršala.",
  "withdraw.cashu.error.insufficient":
    "Zostatok mintu nepokryje sumu a poplatky.",
  "withdraw.cashu.error.onchain":
    "Z tejto peňaženky sa dá vyberať len cez Lightning: zadajte Lightning faktúru alebo adresu.",
  "withdraw.cashu.error.rejected":
    "Mint platbu odmietol. Z peňaženky nič neodišlo.",
  "withdraw.cashu.error.toSelf":
    "Toto je jedna z vašich vlastných platobných faktúr.",
  "withdraw.cashu.error.unreachable": "Mint neodpovedal. Nič nebolo odoslané.",
  "withdraw.cashu.form.description":
    "Zadajte Lightning adresu, faktúru alebo meno či profil v Linky.",
  "withdraw.cashu.mint": "Z ktorého mintu",
  "withdraw.cashu.noAccount.description":
    "Pred výberom zapnite Bitcoin v platobných účtoch.",
  "withdraw.cashu.noAccount.title": "Bitcoin je vypnutý",
  "withdraw.cashu.noFunds": "V peňaženke nie sú žiadne dostupné prostriedky.",
  "withdraw.cashu.review.feeReserve": "Rezerva na poplatok mintu",
  "withdraw.cashu.review.inputFee": "Vstupný poplatok mintu",
  "withdraw.cashu.review.remainder":
    "Čo rezerva nevyužije, vráti sa do zostatku mintu.",
  "withdraw.cashu.title": "Výber prostriedkov",
  "withdraw.clipboard.use": "Použiť zo schránky: {value}",
  "withdraw.comment.hint": "Uvidíte ju iba vy, v histórii výberov.",
  "withdraw.comment.label": "Poznámka pre vás",
  "withdraw.continue": "Pokračovať",
  "withdraw.destination.checkingAddress": "Overujem Lightning adresu…",
  "withdraw.destination.invalid":
    "Zadajte bitcoinovú adresu, Lightning faktúru alebo Lightning adresu.",
  "withdraw.destination.kind.lightningAddress": "Lightning adresa",
  "withdraw.destination.kind.lightningInvoice": "Lightning faktúra",
  "withdraw.destination.kind.onchain": "Bitcoinová adresa (on-chain)",
  "withdraw.destination.label": "Kam poslať",
  "withdraw.destination.paste": "Vložiť",
  "withdraw.destination.pasteError": "Nepodarilo sa prečítať schránku.",
  "withdraw.destination.placeholder":
    "Adresa, Lightning faktúra alebo meno@domena",
  "withdraw.destination.scan": "Naskenovať",
  "withdraw.detail.amount": "Suma",
  "withdraw.detail.balanceNow":
    "V peňaženke je teraz {balance} satov; tento výber by odpísal {amount} satov.",
  "withdraw.detail.cancel": "Zrušiť",
  "withdraw.detail.cashuQuoteId": "ID melt quote",
  "withdraw.detail.comment": "Poznámka",
  "withdraw.detail.copied": "Skopírované",
  "withdraw.detail.copy": "Kopírovať",
  "withdraw.detail.copyError": "Nepodarilo sa skopírovať.",
  "withdraw.detail.date": "Dátum",
  "withdraw.detail.destination": "Cieľ",
  "withdraw.detail.device": "Zariadenie",
  "withdraw.detail.failed.manual": "Peniaze neodišli.",
  "withdraw.detail.failed.notCreated": "Platba neodišla.",
  "withdraw.detail.failed.notCreatedHint":
    "Skontrolujte zostatok. Ak sú peniaze v peňaženke, založte nový výber z histórie výberov.",
  "withdraw.detail.failed.rejected": "Peniaze neodišli.",
  "withdraw.detail.failed.returned": "Peniaze sa vrátili do peňaženky.",
  "withdraw.detail.fee": "Poplatok",
  "withdraw.detail.invoice": "Faktúra",
  "withdraw.detail.invoiceRenewHint":
    "Lightning faktúru možno zaplatiť len raz. Požiadajte príjemcu o novú.",
  "withdraw.detail.manualConfirmed":
    "Potvrdené ručne, transakcia nie je dohľadaná.",
  "withdraw.detail.markNotSent": "Peniaze neodišli",
  "withdraw.detail.markNotSent.description":
    "Len ak zostatok peňaženky stále obsahuje {amount} satov.",
  "withdraw.detail.markNotSent.title": "Označiť výber ako neodoslaný?",
  "withdraw.detail.markSent": "Peniaze odišli",
  "withdraw.detail.markSent.description":
    "Zapíše odchod {amount} satov z peňaženky.",
  "withdraw.detail.markSent.title": "Označiť výber ako odoslaný?",
  "withdraw.detail.maxFee": "Najvyšší poplatok",
  "withdraw.detail.mint": "Mint",
  "withdraw.detail.movementDeleted": "Pohyb na účte bol zmazaný.",
  "withdraw.detail.newWithdrawal": "Nový výber",
  "withdraw.detail.notFound": "Tento výber sa nepodarilo nájsť.",
  "withdraw.detail.onchainUncertain":
    "Výsledok nie je istý, skontrolujte zostatok.",
  "withdraw.detail.pending.cashu":
    "Výber bol odoslaný, mint ho zatiaľ nepotvrdil. Dokončí sa sám.",
  "withdraw.detail.pending.otherDevice":
    "Čaká sa na výsledok. Výber založilo zariadenie {device}; ak platba neodíde, označí sa ako neodoslaný najneskôr do 24 hodín.",
  "withdraw.detail.pending.ownDevice":
    "Čaká sa na výsledok. Ak platba do 10 minút neodíde, výber sa sám označí ako neodoslaný.",
  "withdraw.detail.pending.processing":
    "Platba sa ešte spracúva. Čaká na dokončenie, prípadne na vyzdvihnutie príjemcom.",
  "withdraw.detail.pending.unknown":
    "Výsledok sa nepodarilo zistiť. Skontrolujte zostatok a pohyby na účte.",
  "withdraw.detail.pending.unknownDevice":
    "Čaká sa na výsledok. Výber založilo iné zariadenie; ak platba neodíde, označí sa ako neodoslaný najneskôr do 24 hodín.",
  "withdraw.detail.preimage": "Preimage",
  "withdraw.detail.sparkTransferId": "ID Spark prevodu",
  "withdraw.detail.technical": "Technické údaje",
  "withdraw.detail.title": "Výber",
  "withdraw.detail.total": "Spolu odpísané",
  "withdraw.detail.txid": "ID transakcie",
  "withdraw.detail.txidError": "Transakciu sa nepodarilo načítať.",
  "withdraw.detail.txidPending": "Transakcia ešte nie je v sieti.",
  "withdraw.detail.type": "Typ",
  "withdraw.detail.viewOnExplorer": "Zobraziť na mempool.space",
  "withdraw.error.accountNotFound": "Spark účet sa nenašiel.",
  "withdraw.error.amountOutOfRange":
    "Táto Lightning adresa prijíma {min} až {max} satov.",
  "withdraw.error.belowMinimum":
    "On-chain výber musí byť aspoň {amount} satov.",
  "withdraw.error.insufficientBalance":
    "Táto suma presahuje váš dostupný zostatok.",
  "withdraw.error.insufficientBalanceMax":
    "Suma s poplatkom presahuje zostatok. Poslať sa dá najviac {amount} satov.",
  "withdraw.error.lightningAddressMismatch":
    "Lightning adresa vrátila faktúru, ktorá nezodpovedá. Nič sa nezaplatilo.",
  "withdraw.error.lightningAddressUnavailable":
    "Lightning adresu sa nepodarilo kontaktovať. Skontrolujte ju a skúste to znova.",
  "withdraw.error.lightningInvoiceExpired":
    "Faktúra vypršala. Získajte nový odhad alebo si od príjemcu vyžiadajte novú faktúru.",
  "withdraw.error.lightningInvoiceWrongNetwork":
    "Táto faktúra nie je pre bitcoinový mainnet.",
  "withdraw.error.lnurlNotSupported":
    "Použite Lightning adresu meno@domena alebo faktúru.",
  "withdraw.error.quoteExpired": "Odhad poplatku vypršal. Získajte nový odhad.",
  "withdraw.error.selfWithdrawal":
    "Peniaze by sa poslali späť do tejto peňaženky.",
  "withdraw.error.sparkDestinationNotSupported":
    "Požiadajte príjemcu o Lightning faktúru alebo Lightning adresu.",
  "withdraw.form.description":
    "Odoslať bitcoin zo Spark peňaženky na on-chain adresu, Lightning faktúru alebo Lightning adresu.",
  "withdraw.form.title": "Nový výber",
  "withdraw.history.balance": "Zostatok: {amount} satov",
  "withdraw.history.empty": "Zatiaľ žiadne výbery.",
  "withdraw.history.new": "Nový výber",
  "withdraw.history.olderNote": "Staršie výbery nájdete v pohyboch na účte.",
  "withdraw.history.title": "Výbery",
  "withdraw.history.transactionsLink": "Pohyby na účte",
  "withdraw.kind.cashu": "Lightning (Cashu)",
  "withdraw.kind.lightning": "Lightning",
  "withdraw.kind.onchain": "On-chain",
  "withdraw.noAccount.action": "Prejsť na platobné účty",
  "withdraw.noAccount.description":
    "Pred výberom nastavte Spark peňaženku v Platobných účtoch.",
  "withdraw.noAccount.title": "Nie je nastavený žiadny Spark účet",
  "withdraw.options.label": "Ďalšie možnosti",
  "withdraw.quoteError.generic":
    "Nepodarilo sa získať odhad poplatku. Skúste to znova.",
  "withdraw.quotePending": "Zisťujem odhad poplatku...",
  "withdraw.recipientComment.hint": "Príjemca ju uvidí. Najviac {max} znakov.",
  "withdraw.recipientComment.label": "Správa pre príjemcu",
  "withdraw.review.amount": "Suma výberu",
  "withdraw.review.back": "Späť",
  "withdraw.review.comment": "Poznámka",
  "withdraw.review.confirm": "Potvrdiť výber",
  "withdraw.review.confirming": "Odosielam...",
  "withdraw.review.destination": "Cieľ",
  "withdraw.review.error.generic":
    "Výber sa nepodarilo začať. Skúste to znova.",
  "withdraw.review.error.interrupted":
    "Výber bol prerušený pred dokončením. Skúste to znova.",
  "withdraw.review.error.uncertain":
    "Výber mohol, ale nemusel byť odoslaný. Pred ďalším pokusom skontrolujte zoznam výberov; kým to neviete iste, neposielajte ho znova.",
  "withdraw.review.expiresIn": "Faktúra platí ešte",
  "withdraw.review.fee": "Odhadovaný sieťový poplatok",
  "withdraw.review.feeEstimate": "~{estimate} satov (najviac {max} satov)",
  "withdraw.review.invoiceDescription": "Popis faktúry",
  "withdraw.review.lightningFee": "Poplatok",
  "withdraw.review.maxFeeSpark":
    "Zvyčajne bez poplatku (cez Spark), najviac {amount} satov",
  "withdraw.review.maxTotal": "Odpíše sa najviac",
  "withdraw.review.newQuote": "Nový odhad",
  "withdraw.review.pinDetail": "{amount} satov → {destination}",
  "withdraw.review.recipientComment": "Správa pre príjemcu",
  "withdraw.review.recipientText": "Text od príjemcu",
  "withdraw.review.remainder": "Čo poplatok nevyčerpá, zostane v peňaženke.",
  "withdraw.review.showInvoice": "Zobraziť faktúru",
  "withdraw.review.speed.fast": "Rýchly",
  "withdraw.review.speed.fast.hint": "Najvyššia priorita",
  "withdraw.review.speed.medium": "Stredný",
  "withdraw.review.speed.medium.hint": "Vyvážená",
  "withdraw.review.speed.slow": "Pomalý",
  "withdraw.review.speed.slow.hint": "Najnižší poplatok",
  "withdraw.review.title": "Kontrola výberu",
  "withdraw.review.total": "Celková odpočítaná suma",
  "withdraw.review.warning":
    "Bitcoinové transakcie nemožno vrátiť. Pred potvrdením cieľ dôkladne skontrolujte.",
  "withdraw.sats": "{amount} satov",
  "withdraw.scan.title": "Naskenovať cieľ",
  "withdraw.status.done": "Dokončené",
  "withdraw.status.failed": "Zlyhalo",
  "withdraw.status.pending": "Prebieha",
  "withdraw.status.sent": "Odoslané",
  "withdraw.transactions.empty": "Zatiaľ žiadne pohyby.",
  "withdraw.transactions.kind.spark": "Spark",
  "withdraw.transactions.title": "Pohyby na účte",
  "withdraw.destination.kind.linkyContact": "Kontakt z Linky",
  "withdraw.contact.checking": "Hľadám kontakt v Linky…",
  "withdraw.contact.notFound": "V Linky nie je nikto s menom {address}.",
  "withdraw.contact.unreachable":
    "Linky sa nepodarilo kontaktovať. Skontrolujte pripojenie.",
  "withdraw.kind.cashuSend": "Platba kontaktu z Linky",
  "withdraw.cashu.send.error.notDelivered":
    "Token sa nepodarilo odovzdať. Z peňaženky nič neodišlo.",
  "withdraw.cashu.send.error.consumedByFee":
    "Suma by nepokryla poplatok mintu.",
  "withdraw.cashu.send.review.fee": "Poplatok mintu, najviac",
  "withdraw.cashu.send.review.note":
    "Platba sa príjemcovi automaticky zobrazí v Linky.",
  "withdraw.detail.pending.cashuSend": "Token je na ceste k príjemcovi.",
  "withdraw.detail.cashuOperationId": "Operácia v peňaženke",
} satisfies Record<keyof typeof enWithdraw, string>
