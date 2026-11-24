import type { enPayment } from "../en/payment.ts"

export const viPayment = {
  "payment.create.billTotalNotPositive":
    "Tổng đơn này bằng 0 hoặc thấp hơn nên không có gì để thu.",
  "payment.create.error": "Không tạo được khoản thanh toán.",
  "payment.status.canceled": "Đã hủy",
  "payment.status.expired": "Đã hết hạn",
  "payment.status.paid": "Đã thanh toán",
  "payment.status.pending": "Đang chờ",
  "paymentDetail.card.title": "Thanh toán thẻ",
  "paymentDetail.card.brand": "Thẻ",
  "paymentDetail.card.maskedPan": "Số thẻ",
  "paymentDetail.card.authCode": "Mã chuẩn chi",
  "paymentDetail.card.transactionId": "Mã giao dịch trên máy POS",
  "paymentDetail.card.terminalId": "Máy POS (TID)",
  "paymentDetail.cashReceived": "Đã nhận tiền mặt {amount}",
  "paymentDetail.eet.amount": "Số tiền đã gửi",
  "paymentDetail.eet.cashRegister": "Mã máy tính tiền",
  "paymentDetail.eet.eic": "EIČ",
  "paymentDetail.eet.errorCode": "Lỗi EET {code}: {message}",
  "paymentDetail.eet.establishment": "Cơ sở kinh doanh",
  "paymentDetail.eet.extra.description":
    "Tiền đến sau lần thanh toán đầu tiên, hoặc vượt số tiền phải trả, được báo như một lượt bán riêng; hoàn lại tiền đó chỉ đảo lượt bán đó.",
  "paymentDetail.eet.extra.title": "Tiền thừa trong EET {amount}",
  "paymentDetail.eet.lastError": "Lỗi gần nhất",
  "paymentDetail.eet.overdue":
    "Chưa được xác nhận trong vòng 48 giờ kể từ khi bán.",
  "paymentDetail.eet.pok": "POK",
  "paymentDetail.eet.receivedAt": "EET nhận lúc",
  "paymentDetail.eet.retry": "Gửi lại đến EET",
  "paymentDetail.eet.retry.alreadyConfirmed": "EET đã xác nhận lượt bán này.",
  "paymentDetail.eet.retry.busy": "Lượt bán này đang được gửi.",
  "paymentDetail.eet.waitingForDevice":
    "Đến {time}, chỉ thiết bị đã nhận thanh toán mới gửi.",
  "paymentDetail.eet.retry.confirmed": "EET đã xác nhận lượt bán.",
  "paymentDetail.eet.retry.failed": "Không gửi được lượt bán.",
  "paymentDetail.eet.retry.noCertificate":
    "Trước tiên hãy nhập chứng thư máy tính tiền trong cài đặt EET.",
  "paymentDetail.eet.retry.pending":
    "EET không phản hồi. Lượt bán sẽ tự động được gửi lại.",
  "paymentDetail.eet.retry.rejected": "EET lại từ chối lượt bán.",
  "paymentDetail.eet.retry.unsupported": "Không thể báo lượt bán này cho EET.",
  "paymentDetail.eet.reversal.retry.confirmed":
    "EET đã xác nhận giao dịch đảo.",
  "paymentDetail.eet.reversal.retry.rejected": "EET lại từ chối giao dịch đảo.",
  "paymentDetail.eet.reversal.title": "Giao dịch đảo EET {amount}",
  "paymentDetail.eet.reversal.unsupported.disabled":
    "EET đã tắt khi hoàn tiền nên giao dịch đảo không được gửi.",
  "paymentDetail.eet.reversal.unsupported.environment":
    "EET hiện chạy ở môi trường khác với lúc bán nên giao dịch đảo không được gửi.",
  "paymentDetail.eet.reversal.unsupported.taxpayer":
    "EET hiện báo cáo cho người nộp thuế khác với lúc bán nên giao dịch đảo không được gửi.",
  "paymentDetail.eet.reversal.waiting": "Đang chờ EET xác nhận lượt bán gốc.",
  "paymentDetail.eet.reversal.waitingForDevice":
    "Đến {time}, chỉ thiết bị đã ghi hoàn tiền mới gửi.",
  "paymentDetail.eet.saleAt": "Thời điểm bán",
  "paymentDetail.eet.sequenceNumber": "Số lượt bán",
  "paymentDetail.eet.test":
    "Chỉ gửi đến môi trường thử nghiệm EET. Không báo cho cơ quan thuế.",
  "paymentDetail.eet.title": "EET",
  "paymentDetail.eet.transactionId": "Mã giao dịch EET",
  "paymentDetail.eet.unsupported":
    "EET chỉ nhận doanh thu bằng koruna Séc nên lượt bán này không được gửi.",
  "paymentDetail.eet.warning": "Cảnh báo EET {code}",
  "paymentDetail.number": "Thanh toán #{number}",
  "paymentDetail.refunds.action": "Hoàn tiền",
  "paymentDetail.refunds.method.cashRegister": "Từ két tiền",
  "paymentDetail.refunds.method.outside": "Ngoài {appName}",
  "paymentDetail.refunds.method.qerkoPayment": "Trong Qerko",
  "refund.qerkoPayment.done": "Qerko đã hoàn khoản thanh toán.",
  "refund.qerkoPayment.error.notAvailable":
    "Không thể hoàn khoản này trong Qerko: nó không được trả ở đó hoặc đã được hoàn một phần.",
  "refund.qerkoPayment.error.notCancelled":
    "Qerko chưa hoàn khoản thanh toán. Hãy thử lại sau.",
  "refund.qerkoPayment.error.unreachable":
    "Không kết nối được Qerko. Hãy kiểm tra kết nối rồi thử lại.",
  "paymentDetail.refunds.method.qerkoTerminal": "Về thẻ",
  "paymentDetail.refunds.method.cardSwitchio": "Về thẻ",
  "paymentDetail.refunds.title": "Hoàn tiền",
  "paymentDetail.refunds.tip": "Tiền tip",
  "paymentDetail.tipIncluded": "Gồm {amount} tiền tip",
  "paymentDetail.canceledAtValue": "Hủy {date}",
  "paymentDetail.expiresAt": "Hết hạn lúc {time}",
  "paymentDetail.technical": "Chi tiết kỹ thuật",
  "paymentDetail.id": "Mã thanh toán",
  "paymentDetail.reconciliation.id": "Mã đối soát",
  "paymentDetail.copy": "Sao chép {label}",
  "paymentDetail.copied": "Đã sao chép.",
  "paymentDetail.copyError": "Không sao chép được.",
  "paymentDetail.bill.noTable": "Không có bàn",
  "paymentDetail.bill.open": "Mở đơn",
  "paymentDetail.backToPayment": "Quay lại thanh toán",
  "paymentDetail.bill.coverage.changesTitle":
    "Thay đổi kể từ khoản thanh toán này",
  "paymentDetail.bill.coverage.delta.overpaid":
    "Đã trả nhiều hơn giá trị đơn {amount}",
  "paymentDetail.bill.coverage.delta.underpaid": "Còn thiếu {amount}",
  "paymentDetail.bill.coverage.expectedAmount": "Dự kiến",
  "paymentDetail.bill.coverage.overpaid.fact":
    "Đơn này đã được trả nhiều hơn giá trị hiện tại.",
  "paymentDetail.bill.coverage.overpaid.factWithReason":
    "Đơn này đã được trả nhiều hơn giá trị hiện tại. {reason}",
  "paymentDetail.bill.coverage.overpaid.title": "Trả thừa",
  "paymentDetail.bill.coverage.paidAmount": "Đã trả",
  "paymentDetail.bill.coverage.reason.billLinesChanged":
    "Có thể thiết bị khác đã thay đổi các mặt hàng của đơn trong lúc khoản thanh toán này đang diễn ra.",
  "paymentDetail.bill.coverage.reason.multiplePayments":
    "Đơn này có nhiều khoản thanh toán — xem các khoản khác bên dưới.",
  "paymentDetail.bill.coverage.underpaid.fact":
    "Các khoản thanh toán đã xác nhận chưa đủ cho đơn này.",
  "paymentDetail.bill.coverage.underpaid.factWithReason":
    "Các khoản thanh toán đã xác nhận chưa đủ cho đơn này. {reason}",
  "paymentDetail.bill.coverage.underpaid.title": "Chưa trả đủ",
  "paymentDetail.bill.empty": "Đơn này không có mặt hàng nào.",
  "paymentDetail.bill.table": "Bàn",
  "paymentDetail.bill.title": "Đơn",
  "paymentDetail.bill.total": "Tổng cộng",
  "paymentDetail.collision.description":
    "Khoản thanh toán này đã bị hủy nhưng có ghi nhận tiền về — số tiền vẫn được tính vào đơn. Hãy xử lý xung đột bên dưới.",
  "paymentDetail.collision.markPaid": "Đánh dấu là đã trả",
  "paymentDetail.collision.markPaid.error":
    "Không đánh dấu được là đã trả. Hãy thử lại.",
  "paymentDetail.collision.refund": "Hoàn tiền",
  "paymentDetail.collision.title": "Đã hủy nhưng tiền đã về",
  "paymentDetail.delete": "Xóa khoản thanh toán",
  "paymentDetail.delete.confirm.title": "Xóa khoản thanh toán?",
  "paymentDetail.delete.confirm.description":
    "Khoản thanh toán sẽ biến mất khỏi mục Hoạt động. Nếu khách vẫn trả, tiền sẽ không được đối chiếu với khoản này.",
  "paymentDetail.delete.confirm.confirm": "Xóa",
  "paymentDetail.delete.confirm.cancel": "Giữ lại",
  "paymentDetail.delete.error.generic": "Không xóa được khoản thanh toán.",
  "paymentDetail.delete.error.notDeletable":
    "Đã có tiền về cho khoản thanh toán này nên không thể xóa.",
  "paymentDetail.delete.error.attemptOpen":
    "Một lần thanh toán có thể vẫn đang diễn ra hoặc chưa rõ kết quả nên không thể xóa.",
  "paymentDetail.deviceId": "Thiết bị",
  "paymentDetail.emptyValue": "—",
  "paymentDetail.excessCollision.acknowledge": "Đánh dấu là đã xử lý",
  "paymentDetail.excessCollision.acknowledge.error":
    "Không đánh dấu được xung đột là đã xử lý. Hãy thử lại.",
  "paymentDetail.excessCollision.description":
    "Khoản thanh toán này được trả nhiều lần — có thể hai thiết bị ngoại tuyến đã xác nhận hai phương thức khác nhau. Hãy xử lý xung đột bên dưới.",
  "paymentDetail.excessCollision.title": "Trả nhiều lần",
  "paymentDetail.invalidId": "Mã thanh toán không hợp lệ.",
  "paymentDetail.notFound": "Không tìm thấy khoản thanh toán.",
  "paymentDetail.paymentMethod.card": "Thẻ thanh toán",
  "paymentDetail.qerkoAttempts.title": "Trong Qerko",
  "paymentDetail.qerkoAttempts.state.started": "Đã bắt đầu",
  "paymentDetail.qerkoAttempts.state.processing": "Đang được xác nhận",
  "paymentDetail.qerkoAttempts.state.paid": "Đã trả",
  "paymentDetail.qerkoAttempts.state.failed": "Không thành công",
  "paymentDetail.qerkoProvider.card": "thẻ",
  "paymentDetail.qerkoProvider.mealTicket": "phiếu ăn",
  "paymentDetail.qerkoProvider.voucher": "phiếu quà tặng",
  "paymentDetail.qerkoProvider.bankTransfer": "chuyển khoản ngân hàng",
  "paymentDetail.qerkoProvider.invoice": "hóa đơn",
  "paymentDetail.paymentMethod.qerkoPayment": "Qerko",
  "paymentDetail.paymentMethod.qerkoTerminal": "Thẻ thanh toán (máy POS)",
  "paymentDetail.paymentMethod.qerkoTerminalTid":
    "Thẻ thanh toán (máy POS {tid})",
  "paymentDetail.paymentMethod.cashu": "Cashu",
  "paymentDetail.paymentMethod.cash": "Tiền mặt",
  "paymentDetail.paymentMethod.iban": "IBAN",
  "paymentDetail.paymentMethod.onchain": "On-chain",
  "paymentDetail.paymentMethod.spark": "Lightning",
  "paymentDetail.reconciliation.source.auto": "Tự động",
  "paymentDetail.reconciliation.source.manual": "Thủ công",
  "paymentDetail.reconciliations": "Đối soát",
  "paymentDetail.reconciliations.empty":
    "Chưa có giao dịch nào được đối soát với khoản thanh toán này.",
  "paymentDetail.tipAmount": "Tiền tip",
  "paymentDetail.title": "Chi tiết thanh toán",
  "paymentDetail.transaction.account": "Tài khoản",
  "paymentDetail.transaction.amount": "Số tiền giao dịch",
  "paymentDetail.transaction.bankReference": "Mã tham chiếu ngân hàng",
  "paymentDetail.transaction.id": "Giao dịch",
  "paymentDetail.transaction.note": "Ghi chú",
  "paymentDetail.transaction.occurredAt": "Diễn ra lúc",
  "paymentDetail.transaction.paymentHash": "Hash thanh toán",
  "paymentDetail.transaction.recordedAt": "Ghi nhận lúc",
  "paymentDetail.transaction.source": "Nguồn giao dịch",
  "paymentDetail.transaction.sparkTransferId": "Chuyển Spark",
  "paymentDetail.transaction.variableSymbol": "Mã VS (variabilní symbol)",
  "paymentDetail.updatedAt": "Cập nhật lúc",
  "paymentHistory.billOverpaid": "Đơn trả thừa",
  "paymentHistory.billUnderpaid": "Đơn trả thiếu",
  "paymentHistory.empty.description":
    "Các yêu cầu thanh toán đã tạo sẽ hiện ở đây.",
  "paymentHistory.empty.title": "Chưa có khoản thanh toán nào",
  "paymentHistory.payment": "Thanh toán",
  "paymentHistory.paymentNumber": "Thanh toán #{number}",
  "paymentHistory.tip": "gồm {amount} tiền tip",
  "paymentHistory.title": "Lịch sử thanh toán",
  "paymentTip.continue": "Tiếp tục thanh toán",
  "paymentTip.creating": "Đang tạo thanh toán...",
  "paymentTip.custom.actionDescription": "Nhập số tiền",
  "paymentTip.custom.label": "Tiền tip tùy chọn",
  "paymentTip.custom.orderTotal": "Tổng đơn {amount}",
  "paymentTip.fixedAmounts": "Tiền tip theo số tiền cố định",
  "paymentTip.invalidLink": "Liên kết tiền tip không hợp lệ.",
  "paymentTip.none": "Không tip",
  "paymentTip.orderTotal": "Tổng đơn",
  "paymentTip.percentages": "Tiền tip theo phần trăm",
  "paymentTip.title": "Bạn có muốn thêm tiền tip không?",
  "paymentWait.back": "Quay lại máy thu tiền",
  "paymentWait.boltCard.awaitingSettlement":
    "Thẻ đã được chấp nhận, đang chờ thanh toán...",
  "paymentWait.boltCard.disabled": "NFC đang tắt. Hãy bật để nhận Bolt Card.",
  "paymentWait.boltCard.enable": "Bật NFC",
  "paymentWait.boltCard.error.amountOutOfRange":
    "Số tiền nằm ngoài hạn mức của thẻ này.",
  "paymentWait.boltCard.error.generic":
    "Không trả được bằng thẻ. Hãy chạm lại.",
  "paymentWait.boltCard.error.network":
    "Không kết nối được dịch vụ của thẻ. Hãy kiểm tra kết nối rồi chạm lại.",
  "paymentWait.boltCard.error.notPayable":
    "Khoản này không còn thanh toán được nữa.",
  "paymentWait.boltCard.error.rejected": "Thẻ bị từ chối: {reason}",
  "paymentWait.boltCard.error.timeout":
    "Thẻ không trả kịp thời. Hãy chạm lại hoặc dùng phương thức khác.",
  "paymentWait.boltCard.error.unsupportedCard": "Thẻ này không phải Bolt Card.",
  "paymentWait.boltCard.processing": "Đang đọc thẻ...",
  "paymentWait.boltCard.ready": "Hoặc chạm Bolt Card",
  "paymentWait.cancel": "Hủy thanh toán",
  "paymentWait.cancelError": "Không hủy được thanh toán.",
  "paymentWait.cancelUnresolved.cancel": "Quay lại",
  "paymentWait.cancelUnresolved.confirm": "Hủy thanh toán",
  "paymentWait.cancelUnresolved.description":
    "Kết quả lần quẹt thẻ gần nhất ({transactionId}) chưa rõ và thẻ có thể đã bị trừ tiền. Chỉ hủy sau khi đã kiểm tra trên máy POS rằng giao dịch không thành công.",
  "paymentWait.cancelUnresolved.title": "Hủy thanh toán?",
  "paymentWait.canceled": "Khoản thanh toán này đã bị hủy.",
  "paymentWait.cardPaid.action": "Trả bằng thẻ",
  "paymentWait.cardPaid.check": "Hỏi SwitchioPay",
  "paymentWait.cardPaid.check.paid":
    "SwitchioPay đã xác nhận một khoản thanh toán thẻ chưa rõ kết quả.",
  "paymentWait.cardPaid.check.unresolved":
    "SwitchioPay chưa xác nhận khoản thanh toán. Hãy kiểm tra giao dịch trong SwitchioPay trước khi thử lại.",
  "paymentWait.cardPaid.check.otherDevice":
    "Chỉ thiết bị đã bắt đầu khoản thanh toán này mới hỏi được SwitchioPay của nó.",
  "paymentWait.cardPaid.error.busy":
    "SwitchioPay đang bận. Chưa trừ tiền; hãy thử lại sau giây lát.",
  "paymentWait.cardPaid.error.declined":
    "Thanh toán bằng thẻ không thành công.",
  "paymentWait.cardPaid.error.generic": "Không nhận được thanh toán bằng thẻ.",
  "paymentWait.cardPaid.error.demo":
    "Không thể nhận thanh toán thẻ thật trong tài khoản demo.",
  "paymentWait.cardPaid.error.unavailable":
    "Ứng dụng SwitchioPay không có trên thiết bị này.",
  "paymentWait.cardPaid.error.unreadable":
    "Máy POS không báo kết quả đọc được. Hãy kiểm tra giao dịch trong SwitchioPay trước khi thử lại.",
  "paymentWait.cardPaid.error.notPayable":
    "Khoản này không còn trả bằng thẻ được nữa.",
  "paymentWait.cardPaid.pending": "Đang chờ máy POS...",
  "paymentWait.cardPaid.prompt": "Nhận thanh toán bằng thẻ",
  "paymentWait.cardPaid.unavailable":
    "Máy POS chưa được gắn với khoản thanh toán này.",
  "paymentWait.cardPaid.restored.paid":
    "Thanh toán thẻ đã hoàn tất sau khi ứng dụng khởi động lại.",
  "paymentWait.cardPaid.restored.unresolved":
    "Không xử lý được kết quả thanh toán thẻ từ trước khi ứng dụng khởi động lại. Hãy kiểm tra giao dịch trong SwitchioPay.",
  "paymentWait.cardPaid.retryUnresolved.cancel": "Quay lại",
  "paymentWait.cardPaid.retryUnresolved.confirm": "Thu lại",
  "paymentWait.cardPaid.retryUnresolved.description":
    "Kết quả lần gần nhất ({transactionId}) chưa rõ và thẻ có thể đã bị trừ tiền. Chỉ thu lại sau khi đã kiểm tra trong SwitchioPay rằng giao dịch không thành công.",
  "paymentWait.cardPaid.retryUnresolved.title": "Thu tiền từ thẻ lần nữa?",
  "paymentWait.cardPaid.unresolved":
    "Kết quả lần gần nhất ({transactionId}) chưa rõ. Hãy kiểm tra giao dịch trong SwitchioPay trước khi thử lại.",
  "paymentWait.cashPaid.action": "Đánh dấu là đã trả",
  "paymentWait.cashPaid.difference": "Chênh lệch so với số phải thu: {amount}",
  "paymentWait.cashPaid.error": "Không đánh dấu được là đã trả.",
  "paymentWait.cashPaid.notPayable":
    "Không thể trả khoản này bằng tiền mặt: làm tròn tiền mặt thành 0.",
  "paymentWait.cashPaid.pending": "Đang đánh dấu đã trả...",
  "paymentWait.cashPaid.prompt": "Nhận thanh toán tiền mặt",
  "paymentWait.cashPaid.received": "Tiền mặt đã nhận",
  "paymentWait.cashPaid.receivedTooLow": "Nhập ít nhất {amount}.",
  "paymentWait.cashPaid.unavailable":
    "Két tiền chưa được gắn với khoản thanh toán này.",
  "paymentWait.copyQr": "Sao chép nội dung mã QR",
  "paymentWait.detail": "Chi tiết thanh toán",
  "paymentWait.eetSandbox": "Chỉ gửi đến môi trường thử nghiệm EET.",
  "paymentWait.ibanDetails.more": "Thông tin thêm",
  "paymentWait.ibanDetails.title": "Thông tin thanh toán",
  "paymentWait.bankWatch.waiting": "Đang chờ thanh toán…",
  "paymentWait.ibanDetails.account.label": "Tài khoản",
  "paymentWait.ibanDetails.recipient.label": "Người nhận",
  "paymentWait.ibanDetails.hide": "Ẩn thông tin ngân hàng",
  "paymentWait.ibanDetails.iban.copied": "Đã sao chép IBAN.",
  "paymentWait.ibanDetails.iban.copy": "Sao chép IBAN",
  "paymentWait.ibanDetails.iban.copyError": "Không sao chép được IBAN.",
  "paymentWait.ibanDetails.iban.label": "IBAN",
  "paymentWait.ibanDetails.show": "Hiện thông tin ngân hàng",
  "paymentWait.ibanDetails.variableSymbol.copied": "Đã sao chép mã VS.",
  "paymentWait.ibanDetails.variableSymbol.copy": "Sao chép mã VS",
  "paymentWait.ibanDetails.variableSymbol.copyError":
    "Không sao chép được mã VS.",
  "paymentWait.ibanDetails.variableSymbol.label": "Mã VS (variabilní symbol)",
  "paymentWait.ibanPaid.action": "Tôi đã nhận chuyển khoản",
  "paymentWait.ibanPaid.error": "Không xác nhận được chuyển khoản.",
  "paymentWait.ibanPaid.pending": "Đang xác nhận...",
  "paymentWait.invalidId": "Mã thanh toán không hợp lệ.",
  "paymentWait.method.cashu": "Cashu",
  "paymentWait.method.qerkoPayment": "Qerko",
  "paymentWait.preparing.qerkoPayment": "Đang chuẩn bị thanh toán Qerko…",
  "paymentWait.qerkoPayment.scan": "Khách quét mã trong ứng dụng Qerko.",
  "paymentWait.qerkoPayment.tipChosenInQerko":
    "Khách chọn tiền tip trong Qerko, thay cho tiền tip nhập ở đây.",
  "paymentWait.qerkoPayment.started": "Khách đang thanh toán trong Qerko…",
  "paymentWait.qerkoPayment.processing": "Qerko đang xác nhận thanh toán…",
  "paymentWait.qerkoPayment.failed":
    "Thanh toán trong Qerko không thành công. Khách có thể thử lại.",
  "paymentWait.qerkoPayment.noDevice":
    "Không có thiết bị nào nhận thanh toán Qerko. Hãy chọn một thiết bị trong cài đặt.",
  "paymentWait.qerkoPayment.disconnected":
    "Thiết bị này chưa kết nối Qerko nên khách chưa thể thanh toán.",
  "paymentWait.method.qerko": "Máy POS",
  "paymentWait.preparing.cashu": "Đang chuẩn bị yêu cầu Cashu...",
  "paymentWait.cashu.quoteExpired":
    "Hóa đơn của mint đã hết hạn trước khi được trả.",
  "paymentWait.cashu.arrival.receiving":
    "Đã nhận token {amount} sat từ {mint}. Đang nhận về ví...",
  "paymentWait.cashu.arrival.withFee":
    "Đã nhận token {amount} sat từ {mint}. Mint giữ {fee} sat làm phí.",
  "paymentWait.cashu.arrival.waitingForMint":
    "Đã nhận token {amount} sat. Đang chờ mint {mint} phản hồi...",
  "paymentWait.cashu.arrival.untrustedMint":
    "Token {amount} sat đến từ {mint}, không phải mint mặc định. Token không được nhận và không trả cho khoản này.",
  "paymentWait.cashu.failure.mintUnreachable":
    "Mint không phản hồi. Token sẽ được thử lại.",
  "paymentWait.cashu.failure.mintRejected":
    "Mint từ chối token. Khoản này vẫn chưa được trả.",
  "paymentWait.cashu.failure.locked":
    "Token bị khóa cho người khác. Khoản này vẫn chưa được trả.",
  "paymentWait.cashu.failure.undecodable":
    "Không đọc được token. Khoản này vẫn chưa được trả.",
  "paymentWait.cashu.failure.alreadyKnown":
    "Ví đã có token này. Khoản này vẫn chưa được trả.",
  "paymentWait.cashu.failure.fee":
    "Phí của mint sẽ lấy hết token. Khoản này vẫn chưa được trả.",
  "paymentWait.cashu.failure.spent":
    "Token đã được tiêu. Khoản này vẫn chưa được trả.",
  "paymentWait.cashu.newQuote": "Hóa đơn mới",
  "paymentWait.method.card": "Thẻ thanh toán",
  "paymentWait.method.cash": "Tiền mặt",
  "paymentWait.method.iban": "Chuyển khoản",
  "paymentWait.method.lightning": "Bitcoin",
  "paymentWait.missingRequest": "Khoản thanh toán này không có mã để quét.",
  "paymentWait.notFound": "Không tìm thấy khoản thanh toán.",
  "paymentWait.paid": "Đã nhận thanh toán",
  "paymentWait.pay": "Trả",
  "paymentWait.prepareError": "Không chuẩn bị được phương thức thanh toán này.",
  "paymentWait.prepareRetry": "Thử lại phương thức này",
  "paymentWait.preparing.card": "Đang chuẩn bị thanh toán bằng thẻ...",
  "paymentWait.preparing.cash": "Đang chuẩn bị thanh toán tiền mặt...",
  "paymentWait.preparing.iban": "Đang chuẩn bị mã QR ngân hàng...",
  "paymentWait.preparing.qerko": "Đang chuẩn bị máy POS…",
  "paymentWait.preparing.spark": "Đang chuẩn bị yêu cầu Lightning...",
  "paymentWait.qerko.action": "Trả trên máy POS",
  "paymentWait.qerko.cancel": "Hủy trên máy POS",
  "paymentWait.qerko.cancel.notCancellable": "Không thể hủy thanh toán nữa.",
  "paymentWait.qerko.error.attemptRunning":
    "Một thanh toán đang chạy trên máy POS.",
  "paymentWait.qerko.error.generic": "Không nhận được thanh toán. Hãy thử lại.",
  "paymentWait.qerko.error.keyRejected":
    "Qerko không còn chấp nhận ghép nối. Hãy ghép nối lại máy POS trong cài đặt.",
  "paymentWait.qerko.error.keyRejected.link": "Mở cài đặt Qerko",
  "paymentWait.qerko.error.notPaired": "Máy POS Qerko chưa được ghép nối.",
  "paymentWait.qerko.error.notPayable":
    "Khoản này không còn thanh toán được nữa.",
  "paymentWait.qerko.error.unreachable":
    "Không kết nối được Qerko. Hãy kiểm tra kết nối.",
  "paymentWait.qerko.failed.cancelled": "Thanh toán đã bị hủy trên máy POS.",
  "paymentWait.qerko.failed.declined": "Thẻ bị từ chối.",
  "paymentWait.qerko.failed.reversed": "Thanh toán đã bị đảo.",
  "paymentWait.qerko.noTerminal": "Thiết bị này chưa chọn máy POS.",
  "paymentWait.qerko.noTerminal.link": "Chọn máy POS",
  "paymentWait.qerko.notStarted.busy":
    "Máy POS đang bận. Hãy thử lại sau giây lát.",
  "paymentWait.qerko.notStarted.notActivated":
    "Máy POS chưa được kích hoạt trong Qerko.",
  "paymentWait.qerko.notStarted.notConnected": "Máy POS chưa kết nối.",
  "paymentWait.qerko.notStarted.timeout":
    "Máy POS không phản hồi kịp thời. Hãy kiểm tra trước khi thử lại.",
  "paymentWait.qerko.notStarted.unknownTerminal":
    "Qerko không biết máy POS này. Hãy chọn lại trong cài đặt.",
  "paymentWait.qerko.retry": "Trả lại trên máy POS",
  "paymentWait.qerko.retryUnresolved.cancel": "Hủy",
  "paymentWait.qerko.retryUnresolved.confirm": "Tôi đã kiểm tra, trả lại",
  "paymentWait.qerko.retryUnresolved.description":
    "Lần gần nhất kết thúc với kết quả chưa rõ và thẻ có thể đã bị trừ tiền. Bạn đã kiểm tra máy POS và Qerko chưa?",
  "paymentWait.qerko.retryUnresolved.title": "Trả lại lần nữa?",
  "paymentWait.qerko.step.authorizing": "Đang chuẩn chi thanh toán…",
  "paymentWait.qerko.step.connecting": "Đang kết nối máy POS…",
  "paymentWait.qerko.step.finishing": "Đang hoàn tất thanh toán…",
  "paymentWait.qerko.step.waitingForCard": "Đang chờ thẻ…",
  "paymentWait.qerko.step.waitingForCustomer": "Đang chờ khách…",
  "paymentWait.qerko.step.waitingForPin": "Khách đang nhập mã PIN…",
  "paymentWait.qerko.unresolved":
    "Kết quả lần gần nhất chưa rõ nên thẻ có thể đã bị trừ tiền. Hãy kiểm tra máy POS và lịch sử thanh toán trong Qerko trước khi thử lại.",
  "paymentWait.qrCopied": "Đã sao chép nội dung mã QR.",
  "paymentWait.qrCopyFailed": "Không sao chép được nội dung mã QR.",
  "paymentWait.qrFormat.payBySquare1_0_0": "Pay by square 1.0 (Slovakia)",
  "paymentWait.qrFormat.payBySquare1_2_0": "Pay by square 1.2 (Slovakia)",
  "paymentWait.qrFormat.spayd": "SPAYD (Séc)",
  "paymentWait.qrFormatShort.payBySquare1_0_0": "SK 1.0",
  "paymentWait.qrFormatShort.payBySquare1_2_0": "SK 1.2",
  "paymentWait.qrFormatShort.spayd": "CZ",
  "paymentWait.scanOrTap": "Quét và thanh toán",
  "paymentWait.wakeLockUnsupported":
    "Trình duyệt này không thể tự giữ màn hình sáng.",
  "refund.created": "Đã ghi nhận hoàn tiền.",
  "refund.dialog.method.qerkoTerminal": "Về thẻ trên máy POS",
  "refund.dialog.method.qerkoTerminalTid": "Về thẻ trên máy POS {tid}",
  "refund.dialog.method.cardSwitchio": "Về thẻ trong SwitchioPay",
  "refund.outcome.reversal":
    "Máy POS thu hồi toàn bộ thanh toán; không cần thẻ.",
  "refund.outcome.card": "Tiền trở về thẻ khách đã trả.",
  "refund.outcome.qerkoPayment": "Qerko trả lại toàn bộ thanh toán cho khách.",
  "refund.outcome.cashRegister": "Đưa khách {amount} từ két tiền.",
  "refund.outcome.cashRegisterRounded":
    "Đưa khách {amount} từ két tiền, làm tròn đến koruna.",
  "refund.outcome.outside":
    "Chúng tôi chỉ ghi nhận hoàn tiền; bạn trả tiền lại bằng cách khác.",
  "refund.page.title": "Hoàn tiền",
  "refund.page.empty": "Khoản thanh toán này không còn gì để hoàn.",
  "refund.page.choice.whole": "Toàn bộ thanh toán",
  "refund.page.choice.whole.tipIncluded": "gồm {amount} tiền tip",
  "refund.page.choice.part": "Một phần",
  "refund.page.choice.part.left": "còn {amount}",
  "refund.page.choice.tip": "Chỉ tiền tip",
  "refund.page.amount.label": "Bao nhiêu",
  "refund.page.method.qerkoPayment": "Trả lại qua Qerko",
  "refund.page.qerko.done": "Tiền đã trở về thẻ.",
  "refund.page.switchio.waiting": "Hãy hoàn tất hoàn tiền trong SwitchioPay.",
  "refund.switchio.done": "Tiền đã trở về thẻ.",
  "refund.switchio.pending": "Đang hoàn tiền về thẻ trong SwitchioPay",
  "refund.switchio.pendingElsewhere":
    "Đang chờ SwitchioPay trên thiết bị khác. Nếu không còn thiết bị đó, hãy kiểm tra SwitchioPay rồi bỏ qua lần hoàn tiền này.",
  "refund.switchio.unresolved":
    "Chưa rõ kết quả hoàn tiền nên thẻ có thể đã được hoàn. Hãy kiểm tra SwitchioPay trước khi hoàn lại.",
  "refund.switchio.failed": "Máy POS từ chối hoàn tiền về thẻ.",
  "refund.switchio.check": "Hỏi SwitchioPay",
  "refund.switchio.dismissPending.title": "Bỏ qua lần hoàn tiền?",
  "refund.switchio.dismissPending.description":
    "Thiết bị kia vẫn có thể báo kết quả. Nếu tiền đã được hoàn thì lần hoàn tiền vẫn được ghi nhận.",
  "refund.switchio.dismissPending.confirm": "Bỏ qua",
  "refund.switchio.dismissPending.cancel": "Quay lại",
  "refund.switchio.error.notAvailable":
    "Không thể hoàn khoản này về thẻ: máy POS không cung cấp mã cần cho việc hoàn tiền.",
  "refund.switchio.error.running":
    "Một lần hoàn tiền khác về thẻ của khoản này chưa xong.",
  "refund.switchio.error.notStarted":
    "SwitchioPay đang bận hoặc chưa sẵn sàng. Chưa hoàn gì; hãy thử lại.",
  "refund.switchio.error.otherDevice":
    "Chỉ thiết bị đã bắt đầu lần hoàn tiền này mới hỏi được SwitchioPay của nó.",
  "refund.switchio.restored.unusable":
    "Không xử lý được kết quả hoàn tiền từ trước khi ứng dụng khởi động lại. Hãy kiểm tra trong SwitchioPay.",
  "refund.switchio.reversalDeclined.title":
    "Máy POS không còn thu hồi được thanh toán",
  "refund.switchio.reversalDeclined.description":
    "Rất có thể lô giao dịch đã được chốt. Vẫn có thể hoàn tiền về thẻ đã trả. Hoàn tiền?",
  "refund.switchio.reversalDeclined.confirm": "Hoàn về thẻ",
  "refund.switchio.reversalDeclined.cancel": "Quay lại",
  "refund.qerko.dismiss": "Bỏ qua",
  "refund.qerko.dismissUnresolved": "Tôi đã kiểm tra, bỏ qua",
  "refund.qerko.error.notAvailable":
    "Khoản này không được nhận trên máy POS Qerko nên không thể hoàn về thẻ.",
  "refund.qerko.error.running":
    "Một lần hoàn tiền khác về thẻ của khoản này vẫn đang chờ máy POS.",
  "refund.qerko.error.terminalNotActivated":
    "Máy POS đã nhận khoản này chưa được kích hoạt trong Qerko. Chỉ có thể hoàn về thẻ qua máy POS đó, nên hãy nhờ hỗ trợ Qerko kích hoạt lại.",
  "refund.qerko.error.terminalNotConnected":
    "Máy POS đã nhận khoản này chưa kết nối. Chỉ có thể hoàn về thẻ qua máy POS đó, nên hãy kết nối rồi thử lại.",
  "refund.qerko.error.unknownTerminal":
    "Qerko không biết máy POS đã nhận khoản này. Chỉ có thể hoàn về thẻ qua máy POS đó, nên hãy liên hệ hỗ trợ Qerko.",
  "refund.qerko.failed.cancelled": "Hoàn tiền về thẻ đã bị hủy trên máy POS.",
  "refund.qerko.failed.declined": "Máy POS từ chối hoàn tiền về thẻ.",
  "refund.qerko.pending": "Đang hoàn tiền về thẻ",
  "refund.qerko.unresolved":
    "Chưa rõ kết quả hoàn tiền về thẻ nên thẻ có thể đã được hoàn. Hãy kiểm tra máy POS và Qerko trước khi hoàn lại.",
  "refund.tipCreated": "Đã hoàn tiền tip.",
  "refund.error.tip": "Tiền tip của khoản này đã được hoàn.",
  "refund.dialog.tipHint": "Không gồm {amount} tiền tip, được hoàn riêng.",
  "refund.dialog.amount.invalid": "Nhập số tiền tối đa {amount}.",
  "refund.dialog.amount.label": "Số tiền hoàn",
  "refund.dialog.confirm": "Hoàn {amount}",
  "refund.dialog.confirmEmpty": "Hoàn tiền",
  "refund.dialog.items.available": "Tối đa {quantity}",
  "refund.dialog.items.decrease": "Bớt {name}",
  "refund.dialog.items.increase": "Thêm {name}",
  "refund.dialog.method.cashRegister": "Tiền mặt từ két",
  "refund.dialog.method.label": "Cách trả lại tiền",
  "refund.dialog.method.outside": "Ngoài {appName}, ví dụ trên máy POS",
  "refund.dialog.mode.amount": "Số tiền",
  "refund.dialog.mode.items": "Mặt hàng",
  "refund.dialog.mode.label": "Hoàn những gì",
  "refund.error.amount": "Số tiền lớn hơn phần còn lại có thể hoàn.",
  "refund.error.cashRegister": "Không có két tiền cho loại tiền này.",
  "refund.error.items": "Các mặt hàng này không còn hoàn được nữa.",
  "refund.error.notPaid": "Chỉ hoàn được khoản đã thanh toán.",
  "refund.state.full": "Đã hoàn {amount}",
  "refund.state.partial": "Đã hoàn một phần {amount}",
  "paymentDetail.paymentMethod.lightningAddress": "Địa chỉ Lightning",
  "paymentWait.method.lightningAddress": "Lightning",
  "paymentWait.preparing.lightningAddress": "Đang xin hóa đơn từ ví của bạn...",
  "paymentWait.lightningAddress.unverified":
    "Ví của bạn báo hóa đơn đã được trả nhưng không gửi bằng chứng thanh toán. Hãy kiểm tra ví trước khi giao hàng.",
  "paymentWait.monetaWatch.watching":
    "Đang kiểm tra chuyển khoản tại ngân hàng…",
  "paymentWait.monetaWatch.unreachable":
    "Ngân hàng không phản hồi. {appName} vẫn tiếp tục kiểm tra.",
  "paymentWait.monetaWatch.unauthorized":
    "Ngân hàng từ chối token MONETA nên chuyển khoản không được kiểm tra tự động.",
  "paymentWait.monetaWatch.openSettings": "Cài đặt MONETA",
  "paymentWait.monetaWatch.rateLimited":
    "Đã hết lượt yêu cầu ngân hàng hôm nay. Hãy xác nhận chuyển khoản thủ công.",
  "paymentDetail.transaction.preimage": "Bằng chứng thanh toán (preimage)",
  "paymentWait.method.bitcoin": "Bitcoin",
  "refundDetail.title": "Hoàn tiền",
  "refundDetail.notFound": "Không tìm thấy lần hoàn tiền.",
  "refundDetail.payment": "Thanh toán",
  "refundDetail.what": "Nội dung",
  "refundDetail.what.goods": "Hàng hóa",
  "refundDetail.device": "Thiết bị",
  "refundDetail.id": "Mã hoàn tiền",
  "refundDetail.cash.title": "Tiền mặt",
  "refundDetail.cash.handed": "Đã đưa từ két",
  "refundDetail.cash.rounding": "Làm tròn",
  "refundDetail.card.title": "Về thẻ",
  "refundDetail.card.kind": "Cách hoàn",
  "refundDetail.card.kind.reversal": "Đảo thanh toán trên máy POS",
  "refundDetail.card.kind.referralRefund": "Hoàn về thẻ",
  "refundDetail.card.transactionId": "Mã giao dịch trên máy POS",
  "refundDetail.card.authCode": "Mã chuẩn chi",
  "refundDetail.card.sequenceNumber": "Số thứ tự",
  "refundDetail.card.terminalId": "Máy POS (TID)",
  "refundDetail.qerko.title": "Qua Qerko",
  "refundDetail.qerko.description":
    "Qerko đã hủy thanh toán và trả tiền lại cho khách.",
  "refundDetail.lines.title": "Mặt hàng",
} satisfies Record<keyof typeof enPayment, string>
