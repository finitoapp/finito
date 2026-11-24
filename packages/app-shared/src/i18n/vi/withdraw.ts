import type { enWithdraw } from "../en/withdraw.ts"

export const viWithdraw = {
  "withdraw.all.description": "Gửi toàn bộ số dư khả dụng.",
  "withdraw.all.label": "Rút tất cả",
  "withdraw.all.unavailableInvoice": "Số tiền do hóa đơn quy định.",
  "withdraw.amount.available": "Khả dụng: {amount} sat",
  "withdraw.amount.fromInvoice": "Số tiền do hóa đơn quy định.",
  "withdraw.amount.invalid": "Nhập số tiền lớn hơn 0.",
  "withdraw.amount.label": "Số tiền",
  "withdraw.amount.onchainMinimum": "Rút on-chain tối thiểu {amount} sat.",
  "withdraw.amount.placeholder": "Số tiền theo sat",
  "withdraw.amount.placeholderFiat": "Số tiền theo {currency}",
  "withdraw.amount.range": "Từ {min} đến {max} sat.",
  "withdraw.amount.unit": "Đơn vị số tiền",
  "withdraw.amount.unitSats": "sat",
  "withdraw.cashu.destinationPlaceholder":
    "Tên Linky, npub, địa chỉ Lightning hoặc hóa đơn",
  "withdraw.cashu.error.address":
    "Địa chỉ Lightning không phản hồi như mong đợi.",
  "withdraw.cashu.error.amountlessInvoice":
    "Hóa đơn không có số tiền. Hãy xin hóa đơn có số tiền hoặc dùng địa chỉ Lightning.",
  "withdraw.cashu.error.destination":
    "Nhập hóa đơn Lightning hoặc địa chỉ Lightning.",
  "withdraw.cashu.error.expired": "Hóa đơn đã hết hạn.",
  "withdraw.cashu.error.insufficient":
    "Số dư tại mint không đủ cho số tiền và phí.",
  "withdraw.cashu.error.onchain":
    "Ví này chỉ rút được qua Lightning: hãy nhập hóa đơn hoặc địa chỉ Lightning.",
  "withdraw.cashu.error.rejected": "Mint từ chối thanh toán. Ví chưa mất tiền.",
  "withdraw.cashu.error.toSelf": "Đây là hóa đơn của chính bạn.",
  "withdraw.cashu.error.unreachable":
    "Mint không phản hồi. Chưa có gì được gửi.",
  "withdraw.cashu.form.description":
    "Nhập địa chỉ Lightning, hóa đơn hoặc tên/hồ sơ Linky.",
  "withdraw.cashu.mint": "Từ mint nào",
  "withdraw.cashu.noAccount.description":
    "Hãy bật Bitcoin trong Tài khoản thanh toán trước khi rút.",
  "withdraw.cashu.noAccount.title": "Bitcoin đang tắt",
  "withdraw.cashu.noFunds": "Ví không có tiền khả dụng.",
  "withdraw.cashu.review.feeReserve": "Phí dự trữ của mint",
  "withdraw.cashu.review.inputFee": "Phí đầu vào của mint",
  "withdraw.cashu.review.remainder":
    "Phần dự trữ không dùng sẽ trở lại số dư tại mint.",
  "withdraw.cashu.title": "Rút tiền",
  "withdraw.clipboard.use": "Dùng từ bộ nhớ tạm: {value}",
  "withdraw.comment.hint": "Chỉ mình bạn thấy, trong lịch sử rút tiền.",
  "withdraw.comment.label": "Ghi chú cho bạn",
  "withdraw.continue": "Tiếp tục",
  "withdraw.destination.checkingAddress": "Đang kiểm tra địa chỉ Lightning…",
  "withdraw.destination.invalid":
    "Nhập địa chỉ Bitcoin, hóa đơn Lightning hoặc địa chỉ Lightning.",
  "withdraw.destination.kind.lightningAddress": "Địa chỉ Lightning",
  "withdraw.destination.kind.lightningInvoice": "Hóa đơn Lightning",
  "withdraw.destination.kind.onchain": "Địa chỉ Bitcoin (on-chain)",
  "withdraw.destination.label": "Gửi đến",
  "withdraw.destination.paste": "Dán",
  "withdraw.destination.pasteError": "Không đọc được bộ nhớ tạm.",
  "withdraw.destination.placeholder":
    "Địa chỉ, hóa đơn Lightning hoặc tên@miền",
  "withdraw.destination.scan": "Quét",
  "withdraw.detail.amount": "Số tiền",
  "withdraw.detail.balanceNow":
    "Ví hiện có {balance} sat; lần rút này sẽ trừ {amount} sat.",
  "withdraw.detail.cancel": "Hủy",
  "withdraw.detail.cashuQuoteId": "Mã báo giá melt",
  "withdraw.detail.comment": "Ghi chú",
  "withdraw.detail.copied": "Đã sao chép",
  "withdraw.detail.copy": "Sao chép",
  "withdraw.detail.copyError": "Không sao chép được.",
  "withdraw.detail.date": "Ngày",
  "withdraw.detail.destination": "Nơi nhận",
  "withdraw.detail.device": "Thiết bị",
  "withdraw.detail.failed.manual": "Tiền chưa rời ví.",
  "withdraw.detail.failed.notCreated": "Khoản thanh toán chưa được gửi đi.",
  "withdraw.detail.failed.notCreatedHint":
    "Hãy kiểm tra số dư. Nếu tiền vẫn còn trong ví, hãy tạo lệnh rút mới từ lịch sử rút tiền.",
  "withdraw.detail.failed.rejected": "Tiền chưa rời ví.",
  "withdraw.detail.failed.returned": "Tiền đã trở lại ví.",
  "withdraw.detail.fee": "Phí",
  "withdraw.detail.invoice": "Hóa đơn",
  "withdraw.detail.invoiceRenewHint":
    "Một hóa đơn Lightning chỉ trả được một lần. Hãy xin người nhận hóa đơn mới.",
  "withdraw.detail.manualConfirmed":
    "Đã xác nhận thủ công; không truy được giao dịch.",
  "withdraw.detail.markNotSent": "Tiền chưa rời ví",
  "withdraw.detail.markNotSent.description":
    "Chỉ làm việc này nếu số dư ví vẫn còn gồm {amount} sat.",
  "withdraw.detail.markNotSent.title": "Đánh dấu lệnh rút là chưa gửi?",
  "withdraw.detail.markSent": "Tiền đã rời ví",
  "withdraw.detail.markSent.description":
    "Việc này ghi nhận {amount} sat đã rời ví.",
  "withdraw.detail.markSent.title": "Đánh dấu lệnh rút là đã gửi?",
  "withdraw.detail.maxFee": "Phí tối đa",
  "withdraw.detail.mint": "Mint",
  "withdraw.detail.movementDeleted": "Giao dịch tài khoản đã bị xóa.",
  "withdraw.detail.newWithdrawal": "Lệnh rút mới",
  "withdraw.detail.notFound": "Không tìm thấy lệnh rút này.",
  "withdraw.detail.onchainUncertain":
    "Kết quả chưa chắc chắn. Hãy kiểm tra số dư.",
  "withdraw.detail.pending.cashu":
    "Lệnh rút đã gửi; mint chưa xác nhận. Lệnh sẽ tự hoàn tất.",
  "withdraw.detail.pending.otherDevice":
    "Đang chờ kết quả. Thiết bị {device} đã bắt đầu lệnh rút này; nếu khoản thanh toán không được gửi đi, lệnh sẽ được đánh dấu là chưa gửi trong vòng 24 giờ.",
  "withdraw.detail.pending.ownDevice":
    "Đang chờ kết quả. Nếu khoản thanh toán không được gửi đi trong 10 phút, lệnh rút sẽ tự đánh dấu là chưa gửi.",
  "withdraw.detail.pending.processing":
    "Khoản thanh toán vẫn đang được xử lý. Đang chờ hoàn tất hoặc chờ người nhận lĩnh.",
  "withdraw.detail.pending.unknown":
    "Không xác định được kết quả. Hãy kiểm tra số dư và các giao dịch tài khoản.",
  "withdraw.detail.pending.unknownDevice":
    "Đang chờ kết quả. Thiết bị khác đã bắt đầu lệnh rút này; nếu khoản thanh toán không được gửi đi, lệnh sẽ được đánh dấu là chưa gửi trong vòng 24 giờ.",
  "withdraw.detail.preimage": "Preimage",
  "withdraw.detail.sparkTransferId": "Mã chuyển Spark",
  "withdraw.detail.technical": "Chi tiết kỹ thuật",
  "withdraw.detail.title": "Rút tiền",
  "withdraw.detail.total": "Tổng đã trừ",
  "withdraw.detail.txid": "Mã giao dịch",
  "withdraw.detail.txidError": "Không tải được giao dịch.",
  "withdraw.detail.txidPending": "Giao dịch chưa có trên mạng.",
  "withdraw.detail.type": "Loại",
  "withdraw.detail.viewOnExplorer": "Xem trên mempool.space",
  "withdraw.error.accountNotFound": "Không tìm thấy tài khoản Spark.",
  "withdraw.error.amountOutOfRange":
    "Địa chỉ Lightning này nhận từ {min} đến {max} sat.",
  "withdraw.error.belowMinimum": "Rút on-chain phải ít nhất {amount} sat.",
  "withdraw.error.insufficientBalance": "Số tiền này vượt quá số dư khả dụng.",
  "withdraw.error.insufficientBalanceMax":
    "Số tiền này và phí vượt quá số dư. Bạn có thể gửi tối đa {amount} sat.",
  "withdraw.error.lightningAddressMismatch":
    "Địa chỉ Lightning trả về hóa đơn không khớp. Chưa có gì được trả.",
  "withdraw.error.lightningAddressUnavailable":
    "Không kết nối được địa chỉ Lightning. Hãy kiểm tra rồi thử lại.",
  "withdraw.error.lightningInvoiceExpired":
    "Hóa đơn đã hết hạn. Hãy lấy ước tính mới hoặc xin người nhận hóa đơn mới.",
  "withdraw.error.lightningInvoiceWrongNetwork":
    "Hóa đơn này không thuộc mạng Bitcoin chính (mainnet).",
  "withdraw.error.lnurlNotSupported":
    "Hãy dùng địa chỉ Lightning (tên@miền) hoặc hóa đơn.",
  "withdraw.error.quoteExpired":
    "Ước tính phí đã hết hạn. Hãy lấy ước tính mới.",
  "withdraw.error.selfWithdrawal": "Việc này sẽ gửi tiền trở lại chính ví này.",
  "withdraw.error.sparkDestinationNotSupported":
    "Hãy xin người nhận hóa đơn Lightning hoặc địa chỉ Lightning.",
  "withdraw.form.description":
    "Gửi bitcoin từ ví Spark của bạn đến địa chỉ on-chain, hóa đơn Lightning hoặc địa chỉ Lightning.",
  "withdraw.form.title": "Lệnh rút mới",
  "withdraw.history.balance": "Số dư: {amount} sat",
  "withdraw.history.empty": "Chưa có lệnh rút nào.",
  "withdraw.history.new": "Lệnh rút mới",
  "withdraw.history.olderNote":
    "Các lệnh rút cũ hơn nằm trong giao dịch của tài khoản Spark.",
  "withdraw.history.title": "Rút tiền",
  "withdraw.history.transactionsLink": "Giao dịch tài khoản",
  "withdraw.kind.cashu": "Lightning (Cashu)",
  "withdraw.kind.lightning": "Lightning",
  "withdraw.kind.onchain": "On-chain",
  "withdraw.noAccount.action": "Đến tài khoản thanh toán",
  "withdraw.noAccount.description":
    "Hãy thiết lập ví Spark trong Tài khoản thanh toán trước khi rút.",
  "withdraw.noAccount.title": "Chưa thiết lập tài khoản Spark",
  "withdraw.options.label": "Tùy chọn khác",
  "withdraw.quoteError.generic": "Không lấy được ước tính phí. Hãy thử lại.",
  "withdraw.quotePending": "Đang lấy ước tính phí...",
  "withdraw.recipientComment.hint": "Người nhận sẽ thấy. Tối đa {max} ký tự.",
  "withdraw.recipientComment.label": "Lời nhắn cho người nhận",
  "withdraw.review.amount": "Số tiền rút",
  "withdraw.review.back": "Quay lại",
  "withdraw.review.comment": "Ghi chú",
  "withdraw.review.confirm": "Xác nhận rút",
  "withdraw.review.confirming": "Đang gửi...",
  "withdraw.review.destination": "Nơi nhận",
  "withdraw.review.error.generic": "Không bắt đầu được lệnh rút. Hãy thử lại.",
  "withdraw.review.error.interrupted":
    "Lệnh rút bị gián đoạn trước khi hoàn tất. Hãy thử lại.",
  "withdraw.review.error.uncertain":
    "Lệnh rút có thể đã hoặc chưa được gửi. Hãy kiểm tra danh sách rút tiền trước khi thử lại; đừng gửi lại cho đến khi biết chắc.",
  "withdraw.review.expiresIn": "Hóa đơn còn hiệu lực",
  "withdraw.review.fee": "Phí mạng ước tính",
  "withdraw.review.feeEstimate": "~{estimate} sat (tối đa {max} sat)",
  "withdraw.review.invoiceDescription": "Mô tả hóa đơn",
  "withdraw.review.lightningFee": "Phí",
  "withdraw.review.maxFeeSpark":
    "Thường miễn phí (qua Spark), tối đa {amount} sat",
  "withdraw.review.maxTotal": "Trừ tối đa",
  "withdraw.review.newQuote": "Ước tính mới",
  "withdraw.review.pinDetail": "{amount} sat → {destination}",
  "withdraw.review.recipientComment": "Lời nhắn cho người nhận",
  "withdraw.review.recipientText": "Nội dung từ người nhận",
  "withdraw.review.remainder": "Phần phí không dùng sẽ ở lại ví của bạn.",
  "withdraw.review.showInvoice": "Hiện hóa đơn",
  "withdraw.review.speed.fast": "Nhanh",
  "withdraw.review.speed.fast.hint": "Ưu tiên cao nhất",
  "withdraw.review.speed.medium": "Trung bình",
  "withdraw.review.speed.medium.hint": "Cân bằng",
  "withdraw.review.speed.slow": "Chậm",
  "withdraw.review.speed.slow.hint": "Phí thấp nhất",
  "withdraw.review.title": "Kiểm tra lệnh rút",
  "withdraw.review.total": "Tổng số tiền bị trừ",
  "withdraw.review.warning":
    "Giao dịch Bitcoin không thể đảo ngược. Hãy kiểm tra kỹ nơi nhận trước khi xác nhận.",
  "withdraw.sats": "{amount} sat",
  "withdraw.scan.title": "Quét nơi nhận",
  "withdraw.status.done": "Hoàn tất",
  "withdraw.status.failed": "Không thành công",
  "withdraw.status.pending": "Đang xử lý",
  "withdraw.status.sent": "Đã gửi",
  "withdraw.transactions.empty": "Chưa có giao dịch nào.",
  "withdraw.transactions.kind.spark": "Spark",
  "withdraw.transactions.title": "Giao dịch tài khoản",
  "withdraw.destination.kind.linkyContact": "Liên hệ Linky",
  "withdraw.contact.checking": "Đang tìm liên hệ Linky…",
  "withdraw.contact.notFound": "Không có ai trong Linky tên {address}.",
  "withdraw.contact.unreachable":
    "Không kết nối được Linky. Hãy kiểm tra kết nối.",
  "withdraw.kind.cashuSend": "Thanh toán cho liên hệ Linky",
  "withdraw.cashu.send.error.notDelivered":
    "Không chuyển được token. Ví chưa mất tiền.",
  "withdraw.cashu.send.error.consumedByFee":
    "Số tiền không đủ trả phí của mint.",
  "withdraw.cashu.send.review.fee": "Phí của mint, tối đa",
  "withdraw.cashu.send.review.note":
    "Khoản thanh toán tự động hiện trong Linky của người nhận.",
  "withdraw.detail.pending.cashuSend": "Token đang trên đường đến người nhận.",
  "withdraw.detail.cashuOperationId": "Thao tác ví",
} satisfies Record<keyof typeof enWithdraw, string>
