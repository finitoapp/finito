import type { enOnboarding } from "../en/onboarding.ts"

export const viOnboarding = {
  "accountRestore.action.addRelay": "Thêm máy chủ đồng bộ",
  "accountRestore.action.otherPhrase": "Dùng cụm từ khôi phục khác",
  "accountRestore.action.retry": "Thử lại",
  "accountRestore.action.setupNew": "Thiết lập tài khoản này như mới",
  "accountRestore.description":
    "Đang chờ đồng bộ dữ liệu tài khoản. Thường chỉ mất vài giây.",
  "accountRestore.empty.description":
    "Tất cả máy chủ đồng bộ đã đồng bộ xong nhưng không máy chủ nào có dữ liệu của cụm từ khôi phục này. Dữ liệu có thể nằm trên máy chủ không có trong danh sách, hoặc cụm từ thuộc về tài khoản khác.",
  "accountRestore.empty.title": "Không tìm thấy dữ liệu tài khoản",
  "accountRestore.failed.description":
    "Không đồng bộ được với một số máy chủ, nên dữ liệu tài khoản có thể tồn tại nhưng chưa về tới. Hãy kiểm tra danh sách rồi thử lại.",
  "accountRestore.failed.offline":
    "Thiết bị này đang ngoại tuyến. Hãy kết nối internet rồi thử lại.",
  "accountRestore.failed.title": "Không đồng bộ được tài khoản",
  "accountRestore.relays.title": "Máy chủ đồng bộ",
  "accountRestore.setupNew.confirm.cancel": "Quay lại",
  "accountRestore.setupNew.confirm.confirm": "Thiết lập như mới",
  "accountRestore.setupNew.confirm.description":
    "Các máy chủ không kết nối được vẫn có thể giữ dữ liệu của tài khoản này. Nếu sau này dữ liệu được đồng bộ, các cài đặt bạn chọn bây giờ sẽ ghi đè lên.",
  "accountRestore.setupNew.confirm.title":
    "Thiết lập mà không có dữ liệu tài khoản?",
  "accountRestore.syncing": "Đang đồng bộ dữ liệu tài khoản…",
  "accountRestore.title": "Đang khôi phục tài khoản",
  "accountTransfer.cancel": "Hủy",
  "accountTransfer.close": "Đóng",
  "accountTransfer.done": "Xong",
  "accountTransfer.source.code.confirm": "Xác nhận và chuyển",
  "accountTransfer.source.code.connected": "Một thiết bị đã kết nối.",
  "accountTransfer.source.code.instructions":
    "Nhập mã 6 chữ số hiện trên thiết bị mới.",
  "accountTransfer.source.code.label": "Mã từ thiết bị mới",
  "accountTransfer.source.code.mismatch":
    "Mã không khớp. Hãy kiểm tra rồi thử lại. Số lần còn lại: {count}.",
  "accountTransfer.source.code.warning":
    "Chỉ chép mã từ màn hình thiết bị bạn đang cầm trên tay. Nếu có người đọc mã cho bạn, hãy hủy.",
  "accountTransfer.source.done.acked":
    "Thiết bị mới đã nhận tài khoản. Hãy hoàn tất trên thiết bị mới. Thiết bị này không có gì thay đổi.",
  "accountTransfer.source.done.sent": "Đã gửi. Hãy hoàn tất trên thiết bị mới.",
  "accountTransfer.source.done.title": "Đã gửi tài khoản",
  "accountTransfer.source.failed.cancelled":
    "Việc chuyển đã bị hủy trên thiết bị mới.",
  "accountTransfer.source.failed.codeMismatch": "Mã không khớp ba lần.",
  "accountTransfer.source.failed.conflict":
    "Có nhiều thiết bị phản hồi mã nên việc chuyển đã dừng để đảm bảo an toàn. Nếu thiết bị kia không phải của bạn, có thể ai đó đã nhìn thấy màn hình của bạn.",
  "accountTransfer.source.failed.network":
    "Không kết nối được máy chủ chuyển. Hãy kiểm tra kết nối internet.",
  "accountTransfer.source.failed.nothingSent": "Chưa có gì được gửi.",
  "accountTransfer.source.failed.timeout":
    "Thiết bị mới không hoàn tất kịp thời.",
  "accountTransfer.source.failed.title": "Đã dừng chuyển",
  "accountTransfer.source.permissions":
    "Thiết bị mới bắt đầu không có quyền nào. Hãy đặt quyền trong Cài đặt → Thiết bị khi thiết bị hiện ở đó.",
  "accountTransfer.source.qr.expired": "Mã này đã hết hạn.",
  "accountTransfer.source.qr.instructions":
    "Trên thiết bị mới, mở {appName}, chọn “Chuyển từ thiết bị khác” và quét mã này.",
  "accountTransfer.source.qr.label": "Mã QR cho thiết bị mới",
  "accountTransfer.source.qr.reassurance":
    "Mã hết hạn sau hai phút và chỉ dùng được cho một thiết bị.",
  "accountTransfer.source.qr.renew": "Tạo mã mới",
  "accountTransfer.source.qr.validFor": "Còn hiệu lực {time}",
  "accountTransfer.source.qr.waiting": "Đang chờ thiết bị mới…",
  "accountTransfer.source.sending": "Đang gửi tài khoản…",
  "accountTransfer.source.start": "Hiện mã QR",
  "accountTransfer.source.startAgain": "Bắt đầu lại",
  "accountTransfer.source.step.code": "Nhập mã từ thiết bị mới vào đây.",
  "accountTransfer.source.step.scan": "Quét mã QR bằng thiết bị mới.",
  "accountTransfer.source.step.transfer":
    "Tài khoản được chuyển sang, có mã hóa.",
  "accountTransfer.source.title": "Thêm thiết bị",
  "accountTransfer.source.warning.description":
    "Thiết bị mới có toàn quyền truy cập tài khoản này, kể cả tiền trong ví Bitcoin. Chỉ tiếp tục với thiết bị bạn đang cầm. Bộ phận hỗ trợ {appName} không bao giờ yêu cầu bạn làm việc này.",
  "accountTransfer.source.warning.title": "Toàn quyền truy cập tài khoản",
  "accountTransfer.target.added":
    "Tài khoản “{name}” đã được thêm vào thiết bị này và đang được dùng. Đang tải dữ liệu của bạn…",
  "accountTransfer.target.alreadyAdded":
    "Tài khoản này đã có trên thiết bị; giờ nó đang được dùng.",
  "accountTransfer.target.code.instructions":
    "Nhập mã này trên thiết bị kia của bạn.",
  "accountTransfer.target.code.waiting": "Đang chờ xác nhận…",
  "accountTransfer.target.code.warning":
    "Mã này xác nhận tài khoản được chuyển đến thiết bị này. Đừng chia sẻ cho ai.",
  "accountTransfer.target.confirm.cancel": "Hủy",
  "accountTransfer.target.confirm.confirm": "Thêm và chuyển sang",
  "accountTransfer.target.confirm.description":
    "Thêm tài khoản “{name}” vào thiết bị này và chuyển sang dùng nó? Các khoản thanh toán bạn nhận sau đó sẽ vào tài khoản này.",
  "accountTransfer.target.confirm.title": "Thêm tài khoản “{name}”?",
  "accountTransfer.target.connecting": "Đang kết nối với thiết bị kia…",
  "accountTransfer.target.description":
    "Quét mã QR trên thiết bị bạn đã dùng {appName}.",
  "accountTransfer.target.error.InvalidPaykyUri": "Mã bị hỏng. Hãy tạo mã mới.",
  "accountTransfer.target.error.NotPaykyUri":
    "Đây không phải mã của {appName}.",
  "accountTransfer.target.error.UnknownPaykyUriType":
    "Mã {appName} này dùng cho việc khác hoặc cho phiên bản {appName} mới hơn. Hãy cập nhật ứng dụng.",
  "accountTransfer.target.error.UnsupportedPaykyUriVersion":
    "Mã này được tạo bởi phiên bản {appName} mới hơn. Hãy cập nhật ứng dụng.",
  "accountTransfer.target.error.WrongPaykyUriType":
    "Mã {appName} này dùng cho việc khác.",
  "accountTransfer.target.failed.cancelled":
    "Việc chuyển đã bị hủy trên thiết bị kia.",
  "accountTransfer.target.failed.codeMismatch":
    "Mã đã bị nhập sai ba lần trên thiết bị kia.",
  "accountTransfer.target.failed.conflict":
    "Có nhiều thiết bị phản hồi mã nên việc chuyển đã dừng để đảm bảo an toàn.",
  "accountTransfer.target.failed.invalid":
    "Thiết bị kia gửi dữ liệu mà thiết bị này không dùng được. Chưa có gì được thêm.",
  "accountTransfer.target.failed.network":
    "Không kết nối được máy chủ chuyển. Hãy kiểm tra kết nối internet.",
  "accountTransfer.target.failed.timeout":
    "Thiết bị kia không hoàn tất kịp thời.",
  "accountTransfer.target.failed.title": "Đã dừng chuyển",
  "accountTransfer.target.fallback":
    "Không quét được? Hãy khôi phục bằng cụm từ khôi phục.",
  "accountTransfer.target.instructions":
    "Trên thiết bị có tài khoản của bạn, mở Cài đặt → Thiết bị → Thêm thiết bị, rồi quét mã QR hiện ra.",
  "accountTransfer.target.scanAgain": "Quét lại",
  "accountTransfer.target.title": "Chuyển từ thiết bị khác",
  "accountTransfer.target.warning.description":
    "Chỉ quét mã từ thiết bị của chính bạn mà bạn đang nhìn thấy. Mã của người khác sẽ đưa tài khoản của họ vào thiết bị này, và tiền bạn thu sẽ về họ.",
  "accountTransfer.target.warning.title": "Chỉ thiết bị của chính bạn",
  "onboarding.accountChoice.description":
    "Tạo tài khoản mới hoặc mở tài khoản bạn đang dùng.",
  "accountChoice.new.description":
    "Tạo cụm từ khôi phục mới và bắt đầu với tài khoản trống.",
  "accountChoice.new.title": "Tạo tài khoản mới",
  "onboarding.back": "Quay lại",
  "onboarding.alreadyOnboarded": "Tài khoản này đã được thiết lập.",
  "onboarding.cancelSetup": "Hủy tạo tài khoản",
  "onboarding.cancelSetup.confirm.cancel": "Thiết lập tiếp",
  "onboarding.cancelSetup.confirm.confirm": "Hủy tạo tài khoản",
  "onboarding.cancelSetup.confirm.description":
    "Tài khoản mới này sẽ bị bỏ và bạn sẽ quay lại {name}.",
  "onboarding.cancelSetup.confirm.title": "Hủy tạo tài khoản?",
  "onboarding.businessName.placeholder": "Quán cà phê Sen",
  "onboarding.businessName.label": "Tên cửa hàng (không bắt buộc)",
  "onboarding.businessName.description":
    "Tên công khai trên hồ sơ của bạn, hiện là người nhận khi chuyển khoản.",
  "onboarding.businessName.publishFailed.title": "Không đăng được tên",
  "onboarding.businessName.publishFailed.description":
    "Biểu mẫu của bạn vẫn còn nguyên. Hãy thử lại, hoặc tiếp tục và đăng tên sau trong cài đặt hồ sơ.",
  "onboarding.businessName.retry": "Thử lại",
  "onboarding.businessName.continueWithoutPublishing":
    "Tiếp tục mà không đăng tên",
  "onboarding.finish": "Bắt đầu dùng {appName}",
  "onboarding.language.title": "Chọn ngôn ngữ",
  "onboarding.payments.description":
    "Bạn có thể thay đổi mọi thứ trong cài đặt bất cứ lúc nào.",
  "onboarding.payments.iban.description":
    "Nhập số tài khoản hoặc IBAN để nhận thanh toán bằng mã QR.",
  "onboarding.payments.iban.title": "Tài khoản ngân hàng (không bắt buộc)",
  "onboarding.payments.title": "Thiết lập cửa hàng",
  "onboarding.restore.action": "Khôi phục tài khoản",
  "onboarding.restore.counter": "{count}/{total} từ",
  "onboarding.restore.description": "Nhập 20 từ từ {appName}",
  "onboarding.restore.paste": "Dán từ bộ nhớ tạm",
  "onboarding.restore.pasteFailed":
    "Không đọc được bộ nhớ tạm. Hãy dán vào ô đầu tiên.",
  "onboarding.restore.showWords": "Hiện các từ",
  "onboarding.restore.subtitle":
    "Cụm từ trong Cài đặt → Bảo mật. Seed của ví khác (Spark, Trezor, 12 hoặc 24 từ) không dùng được ở đây.",
  "onboarding.restore.suggestions": "Gợi ý từ",
  "onboarding.restore.unknownWords": "Từ không xác định: {words}",
  "onboarding.restore.wordLabel": "Từ {index}",
  "onboarding.setup.account.label": "Số tài khoản",
  "onboarding.setup.account.placeholder": "2000145399/0800",
  "onboarding.setup.name.hint":
    "Khách hàng thấy tên này là người nhận thanh toán.",
  "onboarding.setup.name.label": "Tên cửa hàng",
  "onboarding.setup.title": "Thiết lập cửa hàng",
  "onboarding.continue": "Tiếp tục",
  "onboarding.selling.description": "Bạn có thể thay đổi sau trong Cài đặt.",
  "onboarding.selling.numpad.description": "Nhập số tiền khách trả.",
  "onboarding.selling.numpad.title": "Số tiền",
  "onboarding.selling.pos.description": "Thêm mặt hàng vào đơn.",
  "onboarding.selling.pos.title": "Đơn",
  "onboarding.selling.tips.description":
    "Khách có thể thêm tiền tip khi thanh toán.",
  "onboarding.selling.tips.label": "Tiền tip",
  "onboarding.selling.title": "Bạn bán hàng thế nào?",
  "onboarding.starterPack.description":
    "Chọn các mặt hàng có sẵn và nhập giá của bạn. Bạn có thể sửa sau.",
  "onboarding.starterPack.empty": "Bắt đầu trống",
  "onboarding.starterPack.include": "Thêm {name}",
  "onboarding.starterPack.missingPrices":
    "Hãy nhập giá cho mọi mặt hàng đã chọn, hoặc bỏ chọn những mặt hàng bạn không bán.",
  "onboarding.starterPack.priceLabel": "Giá của {name}",
  "onboarding.starterPack.pricePlaceholder": "Giá",
  "onboarding.starterPack.pricingFailed":
    "Mặt hàng giá 0 cần có mức VAT, và một mặt hàng của bạn chưa có. Hãy nhập giá hoặc bỏ chọn.",
  "onboarding.starterPack.title": "Bắt đầu với thực đơn",
  "onboarding.starterPack.unavailable":
    "Thực đơn bạn chọn không còn nữa. Hãy chọn thực đơn khác hoặc bắt đầu trống.",
  "onboarding.title": "Chào mừng đến với {appName}",
  "onboarding.welcome.new": "Cửa hàng mới",
  "onboarding.welcome.restore": "Tôi đã có tài khoản",
  "onboarding.welcome.tagline":
    "Máy thu tiền cho thanh toán QR qua ngân hàng, thẻ hoặc bitcoin.",
  "accountFromPayky.title": "Chuyển từ {sourceApp}",
  "accountFromPayky.description":
    "Lấy tài khoản từ ứng dụng {sourceApp} trên điện thoại này.",
  "accountFromPayky.intro":
    "{sourceApp} sẽ mở và cho biết ứng dụng nào yêu cầu tài khoản. Hãy kiểm tra mã, chấp thuận yêu cầu, rồi bạn sẽ quay lại đây cùng tài khoản.",
  "accountFromPayky.open": "Mở {sourceApp}",
  "accountFromPayky.waiting": "Hãy kiểm tra {sourceApp} hiện cùng một mã:",
  "accountFromPayky.waiting.hint":
    "Chỉ chấp thuận yêu cầu trong {sourceApp} khi hai mã giống nhau.",
  "accountFromPayky.waitingForAnswer": "Đang chờ phản hồi từ {sourceApp}…",
  "accountFromPayky.adding": "Đang thêm tài khoản…",
  "accountFromPayky.retry": "Thử lại",
  "accountFromPayky.failed.title": "Chưa nhận được tài khoản",
  "accountFromPayky.failed.rejected":
    "Yêu cầu đã bị từ chối trong {sourceApp}.",
  "accountFromPayky.failed.busy":
    "{sourceApp} nhận được yêu cầu khác cùng lúc nên cả hai đã bị dừng. Hãy thử lại.",
  "accountFromPayky.failed.expired":
    "Yêu cầu đã hết hạn trong {sourceApp}. Hãy thử lại.",
  "accountFromPayky.failed.noAccount":
    "{sourceApp} chưa thiết lập tài khoản nào để chuyển.",
  "accountFromPayky.failed.demo":
    "{sourceApp} đang mở tài khoản demo, không thể chuyển.",
  "accountFromPayky.failed.notInstalled":
    "{sourceApp} không còn trên điện thoại này.",
  "accountFromPayky.failed.cancelled": "Việc chuyển đã bị hủy.",
  "accountFromPayky.failed.invalid":
    "{sourceApp} gửi phản hồi không dùng được ở đây. Chưa có gì được thêm.",
  "accountFromPayky.failed.unsupportedVersion":
    "Phiên bản {sourceApp} này không hiểu yêu cầu. Hãy cập nhật cả hai ứng dụng.",
  "openAccount.title": "Mở tài khoản có sẵn",
  "openAccount.description": "Chọn nơi tài khoản đang ở.",
  "openAccount.fromPayky.title": "Từ {sourceApp} trên điện thoại này",
  "openAccount.fromPayky.description": "Không cần nhập gì, chỉ cần chấp thuận.",
  "openAccount.transfer.title": "Từ thiết bị khác",
  "openAccount.transfer.description": "Bạn quét mã QR và nhập mã.",
  "openAccount.phrase.title": "Cụm từ khôi phục",
  "openAccount.phrase.description": "Khi bạn không có thiết bị khác bên cạnh.",
  "accountChoice.existing.title": "Tôi đã có tài khoản",
  "accountChoice.existing.description": "Mở từ thiết bị khác hoặc bằng 20 từ.",
  "accountChoice.existing.descriptionWithPayky":
    "Mở từ {sourceApp}, thiết bị khác hoặc bằng 20 từ.",
  "accountTransfer.source.permissions.title":
    "Thiết bị mới được làm gì mà không cần mã PIN",
  "accountTransfer.source.permissions.description":
    "Mọi việc khác đều hỏi mã PIN. Bạn có thể thay đổi sau trong Cài đặt → Thiết bị.",
  "accountTransfer.source.permissions.saved":
    "Thiết bị được làm những việc bạn đã chọn mà không cần mã PIN.",
} satisfies Record<keyof typeof enOnboarding, string>
