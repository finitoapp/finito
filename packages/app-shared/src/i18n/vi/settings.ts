import type { enSettings } from "../en/settings.ts"

export const viSettings = {
  "settings.about.app.title": "{appName}",
  "settings.about.description": "Phiên bản, điều khoản và liên hệ",
  "settings.about.github.description": "Tham gia phát triển và theo dõi dự án",
  "settings.about.github.title": "Mã nguồn trên GitHub",
  "settings.about.privacy.body": `{appName} - CHÍNH SÁCH QUYỀN RIÊNG TƯ

1. THU THẬP DỮ LIỆU
{appName} không bán dữ liệu cá nhân và được thiết kế để giữ dữ liệu ứng dụng trên thiết bị của bạn. Ứng dụng lưu cài đặt máy thu tiền, danh mục mặt hàng, hồ sơ thanh toán và các hồ sơ vận hành liên quan trên thiết bị và đồng bộ dữ liệu ứng dụng qua Evolu.

2. DỮ LIỆU THANH TOÁN
Dữ liệu thanh toán và máy thu tiền có thể gồm số tiền, thời gian, tên mặt hàng, trạng thái thanh toán, thông tin ví Spark, mã thiết bị và các hồ sơ khác cần để vận hành máy thu tiền Bitcoin. Hãy giữ an toàn thiết bị, thông tin đăng nhập, bản sao lưu và dữ liệu truy cập ví, đặc biệt là cụm từ khôi phục.

3. KẾT NỐI MẠNG
Ứng dụng có thể kết nối với:
- Hạ tầng đồng bộ Evolu để đồng bộ dữ liệu ứng dụng local-first
- Các nhà vận hành và nhà cung cấp dịch vụ Spark để chạy ví Spark và gửi hoặc nhận thanh toán Bitcoin
- Các dịch vụ Lightning hoặc ví dùng để tạo hoặc hoàn tất thanh toán
- API giá hoặc tỷ giá khi bật quy đổi tiền pháp định
- Open Food Facts và Open Beauty Facts để tra mã vạch đã quét, nếu bật tra cứu sản phẩm
- Máy chủ của {appName} và nhà cung cấp AI của nó để trả lời trong trợ lý AI, nếu bật: câu hỏi của bạn, câu trả lời của trợ lý và, nếu bạn cho phép, các đơn và khoản thanh toán mà trợ lý đọc
- Ngân hàng của bạn (Fio banka hoặc MONETA Money Bank) để kiểm tra tiền đến, nếu đã thiết lập đối chiếu thanh toán: token truy cập ngân hàng của bạn và các yêu cầu lấy giao dịch của tài khoản
- Máy chủ của {appName} tại EU (Frankfurt) làm proxy cho các dịch vụ đã kết nối, nếu bạn cho phép trên thiết bị: phiên bản web gửi yêu cầu đến Fio banka và MONETA Money Bank qua máy chủ này, nên nó thấy token truy cập ngân hàng của bạn và phản hồi của ngân hàng (IBAN và các giao dịch của tài khoản, gồm số tiền, tài khoản đối ứng, tên người trả, các mã và lời nhắn cho người nhận). Máy chủ không lưu gì cả, chỉ chuyển tiếp. Ứng dụng di động gọi trực tiếp đến ngân hàng

Các dịch vụ này có thể có chính sách quyền riêng tư, nhật ký và quy định lưu giữ riêng.

4. PHÂN TÍCH VÀ BÁO LỖI
{appName} không dùng dịch vụ phân tích hay theo dõi. Có thể bật báo lỗi qua Sentry để giúp tìm nguyên nhân sự cố và lỗi. Tính năng này mặc định tắt và chỉ hoạt động khi bạn bật trong Cài đặt > Giới thiệu > Dữ liệu và quyền riêng tư. Khi bật, báo cáo lỗi có thể gồm thông tin thiết bị và ứng dụng, thông báo lỗi và stack trace; cụm từ khôi phục và số tài khoản ngân hàng được tự động che trước khi gửi.

5. MẠNG SPARK
Các khoản thanh toán qua ví Spark do các nhà vận hành và nhà cung cấp dịch vụ Spark xử lý; họ có thể thấy số tiền, thời gian giao dịch, mã ví và siêu dữ liệu liên quan.

6. SAO LƯU VÀ ĐỒNG BỘ
Nếu bật đồng bộ hoặc sao lưu, dữ liệu ứng dụng có thể được truyền đến hạ tầng đồng bộ. Hãy coi dữ liệu đã đồng bộ là dữ liệu kinh doanh và bảo vệ mọi thiết bị có thể truy cập.

7. XÓA DỮ LIỆU CỦA BẠN
{appName} không có tài khoản người dùng trên máy chủ để nhà vận hành có thể xem hoặc xóa dữ liệu thay bạn. Dữ liệu thuộc về một tài khoản nằm trên các thiết bị của bạn và gắn với cụm từ khôi phục.
- Để xóa dữ liệu trên thiết bị, hãy xóa tài khoản trong Cài đặt > Tài khoản ứng dụng, hoặc xóa dữ liệu ứng dụng và gỡ cài đặt (trong trình duyệt, xóa dữ liệu của trang). Hãy làm vậy trên mọi thiết bị có tài khoản.
- Dữ liệu đã đồng bộ được lưu ở dạng mã hóa trên các relay Evolu, vốn không đọc được dữ liệu. Dữ liệu có thể còn ở đó sau khi xóa tài khoản, nhưng không ai giải mã được nếu không có cụm từ khôi phục: khi bạn đã xóa tài khoản khỏi mọi thiết bị và hủy cụm từ, không ai còn đọc được nữa.
- Các báo cáo lỗi bạn đã chọn gửi được Sentry giữ trong thời hạn lưu giữ rồi xóa.
- Các khoản thanh toán đã thực hiện trên mạng Bitcoin, Lightning hoặc Spark, và dữ liệu đã gửi đến các dịch vụ bên thứ ba nêu trên, thì {appName} hoặc nhà vận hành không thể xóa.
Tài khoản đã xóa không thể khôi phục nếu không có cụm từ khôi phục.

8. LIÊN HỆ
Nếu có câu hỏi về quyền riêng tư hoặc dữ liệu của bạn, hãy viết cho chúng tôi qua biểu mẫu liên hệ tại {websiteUrl}/en#contact.

Cập nhật lần cuối: tháng 11 năm 2026`,
  "settings.about.privacy.description":
    "Dữ liệu ứng dụng được lưu trên thiết bị và đồng bộ qua Evolu.",
  "settings.about.privacy.heading": "Chính sách quyền riêng tư của {appName}",
  "settings.about.privacy.summary":
    "Soạn riêng cho máy thu tiền Bitcoin local-first.",
  "settings.about.privacy.title": "Dữ liệu và quyền riêng tư",
  "settings.about.terms.body": `{appName} - ĐIỀU KHOẢN DỊCH VỤ

1. CHẤP NHẬN
Khi dùng ứng dụng máy thu tiền này, bạn đồng ý với các điều khoản này.

2. BẢN CHẤT DỊCH VỤ
{appName} là máy thu tiền Bitcoin local-first dùng giao thức Spark cho thanh toán Bitcoin và Lightning cùng hạ tầng thanh toán liên quan. Bạn chịu trách nhiệm về cách cấu hình ứng dụng, các dịch vụ bạn dùng và cách xử lý số tiền đã nhận.

3. TRUY CẬP VÀ KHÔI PHỤC
Hãy giữ an toàn thiết bị, thông tin đăng nhập, bản sao lưu và mọi dữ liệu truy cập ví, đặc biệt là cụm từ khôi phục. {appName} không thể khôi phục thông tin đăng nhập đã mất, cụm từ khôi phục đã mất hoặc tiền gửi nhầm nơi nhận.

4. KHÔNG BẢO ĐẢM
Phần mềm này được cung cấp "nguyên trạng", không có bất kỳ bảo đảm nào. Bạn tự chịu rủi ro khi sử dụng.

5. GIỚI HẠN TRÁCH NHIỆM
Chúng tôi không chịu trách nhiệm về mất tiền, gián đoạn kinh doanh, thanh toán không thành công, lỗi phần mềm, lỗi người dùng hoặc sự cố của mạng hay dịch vụ bên thứ ba.

6. VÍ SPARK
Ví Spark do bạn tự quản: khóa được tạo trên thiết bị từ cụm từ khôi phục của bạn. Việc chuyển tiền dựa vào các nhà vận hành và nhà cung cấp dịch vụ Spark; họ có thể gặp sự cố, ngừng hoạt động hoặc thay đổi điều khoản. Chỉ giữ số dư mà bạn chấp nhận có thể mất.

7. QUYỀN RIÊNG TƯ
{appName} được thiết kế để lưu dữ liệu ứng dụng trên thiết bị và đồng bộ qua Evolu. Các khoản thanh toán vẫn có thể được xử lý qua mạng Spark, dịch vụ Lightning hoặc hạ tầng bên thứ ba khác, vốn có thể có chính sách quyền riêng tư và nhật ký riêng.

8. CẬP NHẬT
Các điều khoản này có thể được cập nhật. Tiếp tục dùng {appName} nghĩa là bạn chấp nhận điều khoản đã cập nhật.

Cập nhật lần cuối: tháng 10 năm 2026`,
  "settings.about.terms.description":
    "Đọc các điều khoản áp dụng khi dùng {appName}.",
  "settings.about.terms.heading": "Điều khoản dịch vụ của {appName}",
  "settings.about.terms.summary":
    "Soạn riêng cho máy thu tiền Bitcoin local-first.",
  "settings.about.terms.title": "Điều khoản dịch vụ",
  "settings.about.title": "Giới thiệu",
  "settings.accountAndSync": "TÀI KHOẢN VÀ ĐỒNG BỘ",
  "settings.accounts.add.title": "Thêm tài khoản",
  "settings.accounts.list.active": "Đang dùng",
  "settings.accounts.list.remove": "Xóa",
  "settings.accounts.list.switch": "Chuyển sang",
  "settings.accounts.nav.description": "Các tài khoản trên thiết bị này",
  "settings.accounts.nav.title": "Tài khoản",
  "settings.accounts.remove.confirm.cancel": "Giữ tài khoản",
  "settings.accounts.remove.confirm.confirm": "Xóa tài khoản",
  "settings.accounts.remove.confirm.description":
    "Thiết bị này sẽ quên tài khoản và dữ liệu của nó. Chỉ cụm từ khôi phục mới lấy lại được — nếu không có, mọi thứ trong tài khoản sẽ mất vĩnh viễn.",
  "settings.accounts.remove.confirm.title": "Xóa {name}?",
  "settings.accounts.restore.failed":
    "Không khôi phục được tài khoản. Vui lòng thử lại.",
  "settings.accounts.restore.mnemonic.checksum":
    "Các từ hợp lệ nhưng cụm từ thì không. Hãy kiểm tra thứ tự và lỗi gõ.",
  "settings.accounts.restore.mnemonic.foreign":
    "Đây có vẻ là seed của ví khác. {appName} chỉ khôi phục cụm từ 20 từ của chính nó.",
  "settings.accounts.restore.mnemonic.invalid":
    "Nhập 20 từ của cụm từ khôi phục {appName}.",
  "settings.accounts.restore.mnemonic.label": "Cụm từ khôi phục",
  "settings.accounts.restore.mnemonic.required": "Cần nhập cụm từ khôi phục.",
  "settings.accounts.restore.mnemonic.wordCount": "Cụm từ khôi phục có 20 từ.",
  "settings.accounts.title": "Tài khoản",
  "settings.appVersion": "Phiên bản ứng dụng:",
  "settings.appVersionCode": "Mã phiên bản:",
  "settings.appearance": "GIAO DIỆN VÀ NGÔN NGỮ",
  "settings.cashRegisterAccount.enabled.label": "Bật két tiền",
  "settings.cardSwitchioAccount.enabled.label": "Bật máy POS thẻ",
  "settings.qerkoTerminal.advanced": "Tùy chọn khác",
  "settings.qerkoTerminal.code.back": "Quay lại",
  "settings.qerkoTerminal.code.confirm": "Xác nhận",
  "settings.qerkoTerminal.code.expired": "Mã đã hết hạn. Hãy yêu cầu mã mới.",
  "settings.qerkoTerminal.code.instructions":
    "Nhập mã 4 chữ số mà Qerko đã gửi qua e-mail cho chủ công ty bạn đã nhập. Nếu không nhận được e-mail, hãy liên hệ hỗ trợ kỹ thuật Qerko.",
  "settings.qerkoTerminal.code.invalid": "Mã sai. Số lần còn lại: {count}.",
  "settings.qerkoTerminal.code.label": "Mã xác nhận",
  "settings.qerkoTerminal.code.maxAttempts":
    "Nhập sai mã quá nhiều lần. Hãy yêu cầu mã mới.",
  "settings.qerkoTerminal.code.resend": "Gửi lại mã",
  "settings.qerkoTerminal.code.resendIn": "Bạn có thể gửi lại mã sau {time}.",
  "settings.qerkoTerminal.code.title": "Nhập mã",
  "settings.qerkoTerminal.company.country.label": "Quốc gia",
  "settings.qerkoTerminal.company.identificationNumber.invalid":
    "Nhập mã số công ty (IČO).",
  "settings.qerkoTerminal.company.identificationNumber.label":
    "Mã số công ty (IČO)",
  "settings.qerkoPayment.title": "Thanh toán Qerko",
  "settings.qerkoPayment.unpaired.description":
    "Kết nối tài khoản Qerko của công ty để khách thanh toán bằng cách quét mã QR trong ứng dụng Qerko. Qerko gửi mã xác nhận đến e-mail của công ty.",
  "settings.qerkoPayment.confirm.description":
    "Thanh toán Qerko của mọi thiết bị chỉ đi qua một thiết bị của tài khoản tại một thời điểm. Hãy giữ thiết bị đó bật và mở ứng dụng khi khách thanh toán.",
  "settings.qerkoPayment.confirm.thisDevice":
    "Thiết bị này nhận thanh toán Qerko",
  "settings.qerkoPayment.confirm.finish": "Hoàn tất",
  "settings.qerkoPayment.paired.title": "Đã kết nối Qerko",
  "settings.qerkoPayment.paired.description":
    "Khách thanh toán bằng cách quét mã QR trong ứng dụng Qerko.",
  "settings.qerkoPayment.paired.device": "Nhận thanh toán",
  "settings.qerkoPayment.paired.connection": "Kết nối",
  "settings.qerkoPayment.device.none": "Không có thiết bị",
  "settings.qerkoPayment.device.this": "{name} (thiết bị này)",
  "settings.qerkoPayment.device.other": "Thiết bị khác",
  "settings.qerkoPayment.acceptHere": "Nhận trên thiết bị này",
  "settings.qerkoPayment.stopHere": "Ngừng nhận ở đây",
  "settings.qerkoPayment.sandbox": "Môi trường thử",
  "settings.qerkoPayment.connection.idle": "Chưa kết nối",
  "settings.qerkoPayment.connection.connecting": "Đang kết nối…",
  "settings.qerkoPayment.connection.connected": "Đã kết nối",
  "settings.qerkoPayment.connection.reconnecting":
    "Mất kết nối, đang kết nối lại…",
  "settings.qerkoPayment.connection.stolen":
    "Một kết nối khác đã tiếp quản thanh toán Qerko. Hãy chọn lại thiết bị này để lấy lại.",
  "settings.qerkoPayment.connection.unauthorized":
    "Qerko không còn chấp nhận kết nối này. Hãy hủy ghép nối rồi ghép nối lại.",
  "settings.qerkoPayment.status.noDevice":
    "Không có thiết bị nào nhận thanh toán Qerko",
  "settings.qerkoPayment.unpair.confirm.description":
    "Thanh toán Qerko sẽ dừng trên mọi thiết bị. Các khoản đã nhận giữ nguyên.",
  "settings.qerkoPayment.location.title": "Chọn địa điểm",
  "settings.qerkoPayment.location.description":
    "Thanh toán Qerko sẽ về địa điểm bạn chọn ở đây. Để đổi sau này, hãy hủy ghép nối rồi ghép nối lại.",
  "settings.qerkoPayment.location.label": "Địa điểm",
  "settings.qerkoPayment.location.empty":
    "Qerko không có địa điểm đang hoạt động nào của công ty này.",
  "settings.qerkoPayment.location.failed":
    "Không tải được các địa điểm. Hãy kiểm tra kết nối rồi thử lại.",
  "settings.qerkoPayment.location.keyRejected":
    "Qerko không còn chấp nhận kết nối này. Hãy hủy ghép nối rồi ghép nối lại.",
  "settings.qerkoPayment.location.notFound":
    "Qerko không còn biết địa điểm này. Hãy chọn địa điểm khác.",
  "settings.qerkoPayment.location.retry": "Thử lại",
  "settings.qerkoPayment.location.use": "Dùng địa điểm này",
  "settings.qerkoPayment.location.none": "Chưa chọn địa điểm",
  "settings.qerkoPayment.paired.company": "Công ty",
  "settings.qerkoPayment.readiness.active": "Đang hoạt động",
  "settings.qerkoPayment.readiness.connecting": "Đang kết nối…",
  "settings.qerkoPayment.readiness.notAccepting": "Không nhận thanh toán",
  "settings.qerkoPayment.paired.enabled": "Phương thức đang bật",
  "settings.qerkoPayment.paired.success.title": "Thanh toán Qerko đã bật",
  "settings.qerkoPayment.paired.success.description":
    "Khách thanh toán bằng cách quét mã QR trên màn hình thanh toán, trong thẻ Qerko.",
  "settings.qerkoPayment.paired.success.noDevice":
    "Chưa có thiết bị nào nhận. Hãy chọn một thiết bị bên dưới.",
  "settings.qerkoPayment.enabled.label": "Bật thanh toán Qerko",
  "settings.qerkoPayment.status.notPaired": "Chưa ghép nối với Qerko",
  "settings.qerkoTerminal.enabled.label": "Bật máy POS Qerko",
  "settings.qerkoTerminal.environment.description":
    "Môi trường thử dùng dữ liệu thử và không trừ tiền thẻ thật. Chỉ chọn để thử kết nối.",
  "settings.qerkoTerminal.environment.label": "Môi trường Qerko",
  "settings.qerkoTerminal.environment.production": "Chính thức",
  "settings.qerkoTerminal.environment.sandbox": "Môi trường thử",
  "settings.qerkoTerminal.error.unreachable":
    "Không kết nối được Qerko. Hãy kiểm tra kết nối rồi thử lại.",
  "settings.qerkoTerminal.paired.company": "Công ty",
  "settings.qerkoTerminal.paired.description":
    "Thanh toán thẻ trên thiết bị này đi đến máy POS chọn bên dưới.",
  "settings.qerkoTerminal.paired.environmentReadOnly":
    "Để đổi môi trường, hãy hủy ghép nối rồi ghép nối lại.",
  "settings.qerkoTerminal.paired.keyName": "Tên kết nối",
  "settings.qerkoTerminal.paired.title": "Đã kết nối Qerko",
  "settings.qerkoTerminal.requestCode": "Gửi mã",
  "settings.qerkoTerminal.status.noTerminal":
    "Chưa chọn máy POS trên thiết bị này",
  "settings.qerkoTerminal.status.notPaired": "Chưa ghép nối với Qerko",
  "settings.cardSwitchioAccount.info.contract":
    "hợp đồng đã ký với nhà cung cấp giải pháp thanh toán, ví dụ Comgate.",
  "settings.cardSwitchioAccount.info.description":
    "Để nhận thanh toán thẻ, bạn cần:",
  "settings.cardSwitchioAccount.info.switchioPay":
    "ứng dụng SwitchioPay trên thiết bị này,",
  "settings.cardSwitchioAccount.info.switchioPayLink": "Về SwitchioPay",
  "settings.cardSwitchioAccount.info.title": "Thanh toán thẻ",
  "settings.cardSwitchioAccount.notInstalledWarning":
    "Ứng dụng SwitchioPay chưa được cài trên thiết bị này.",
  "settings.cardSwitchioAccount.nativeRuntimeWarning":
    "Máy POS thẻ chỉ có trong ứng dụng gốc.",
  "catalog.categories.add": "Thêm danh mục",
  "catalog.categories.delete": "Xóa danh mục",
  "catalog.categories.delete.confirm.cancel": "Hủy",
  "catalog.categories.delete.confirm.confirm": "Xóa",
  "catalog.categories.delete.confirm.description":
    "Các mặt hàng thuộc {name} sẽ hiện là chưa phân loại sau khi xóa.",
  "catalog.categories.delete.confirm.title": "Xóa {name}?",
  "catalog.categories.description": "Nhóm sản phẩm và dịch vụ của bạn",
  "catalog.categories.empty.description":
    "Thêm danh mục để nhóm sản phẩm và dịch vụ, rồi gán trong biểu mẫu mặt hàng.",
  "catalog.categories.empty.title": "Chưa có danh mục nào",
  "catalog.categories.emptySearch": "Không có danh mục nào khớp.",
  "catalog.categories.form.card.description":
    "Tên hiện khi nhóm mặt hàng và lọc trên màn hình đơn.",
  "catalog.categories.form.card.title": "Chi tiết",
  "catalog.categories.form.invalidId": "Mã danh mục không hợp lệ.",
  "catalog.categories.form.name.invalid": "Nhập tên.",
  "catalog.categories.form.name.label": "Tên",
  "catalog.categories.form.name.placeholder": "vd. Đồ uống",
  "catalog.categories.form.notFound": "Danh mục này không còn tồn tại.",
  "catalog.categories.form.save.create": "Thêm danh mục",
  "catalog.categories.form.saved.create": "Đã thêm danh mục.",
  "catalog.categories.form.title.create": "Thêm danh mục",
  "catalog.categories.form.title.edit": "Sửa danh mục",
  "catalog.categories.search": "Tìm danh mục...",
  "catalog.categories.search.clear.aria": "Xóa tìm kiếm",
  "catalog.categories.title": "Danh mục",
  "settings.cashuAccount.title": "Ví Linky",
  "settings.cashuAccount.wallet.title": "Ví dùng chung với Linky",
  "settings.cashuAccount.wallet.description":
    "Thanh toán Cashu vào cùng ví ecash mà ứng dụng Linky của bạn hiển thị. Số dư gồm cả tiền nhận trong Linky.",
  "settings.cashuAccount.defaultMint": "Mint mặc định",
  "settings.cashuAccount.syncing": "Đang đồng bộ ví với Linky...",
  "settings.cashuAccount.empty": "Ví chưa có ecash.",
  "settings.cashuMints.title": "Mint",
  "settings.cashuMints.known": "Mint của bạn",
  "settings.cashuMints.suggested": "Mint gợi ý",
  "settings.cashuMints.empty": "Ví chưa biết mint nào.",
  "settings.cashuMints.default": "Mặc định",
  "settings.cashuMints.add": "Thêm mint",
  "settings.cashuMints.url": "URL của mint",
  "settings.cashuMints.addDescription":
    "Mint được kiểm tra trước khi thêm. Việc thêm không đổi mint mặc định cũng như loại token dùng để trả các khoản thanh toán của bạn.",
  "settings.cashuMints.addError.invalid": "Đây không phải URL của mint.",
  "settings.cashuMints.addError.unreachable": "Mint không phản hồi.",
  "settings.cashuMints.addError.rejected":
    "Mint bị từ chối: không tải được hoặc liệt kê khóa của mint khác.",
  "settings.cashuMints.invalid": "URL của mint này không hợp lệ.",
  "settings.cashuMints.infoUnavailable": "Mint không phản hồi.",
  "settings.cashuMints.balance": "Số dư: {amount}",
  "settings.cashuMints.defaultWarning":
    "Các khoản Cashu mới sẽ dùng mint này, cả trong Linky. Địa chỉ Lightning của Linky vẫn nhận tiền vào mint cũ cho đến khi bạn đổi mặc định trong Linky.",
  "settings.cashuMints.setDefault": "Đặt làm mặc định",
  "settings.cashuMints.remove": "Xóa mint",
  "settings.cashuMints.removeError.inUse":
    "Mint vẫn còn ecash nên không thể xóa.",
  "settings.cashuMints.move.title": "Chuyển tiền",
  "settings.cashuMints.move.description":
    "Chuyển ecash từ mint này sang mint mặc định {mint} qua Lightning.",
  "settings.cashuMints.move.amount": "Số tiền theo sat",
  "settings.cashuMints.move.amountDescription": "Để trống để chuyển tất cả.",
  "settings.cashuMints.move.estimate": "Ước tính chi phí",
  "settings.cashuMints.move.estimateResult":
    "{amount} sẽ đến; tối đa {total} rời mint này.",
  "settings.cashuMints.move.confirm": "Chuyển",
  "settings.cashuMints.movePinDetail": "{amount} đến {mint}",
  "settings.cashuMints.moveError.unreachable":
    "Một mint không phản hồi. Hãy thử lại sau.",
  "settings.cashuMints.moveError.rejected": "Một mint từ chối việc chuyển.",
  "settings.cashuMints.moveError.nothing": "Không có gì để chuyển.",
  "settings.cashuMints.moveError.insufficient":
    "Số dư không đủ cho số tiền này và phí.",
  "settings.cashuMints.moveError.pending":
    "Đang chuyển; việc chuyển sẽ tự hoàn tất.",
  "settings.cashuAccount.mints": "Mint",
  "settings.cashuAccount.mintsDescription": "Mint mặc định, số dư, chuyển tiền",
  "settings.cashuAccount.withdraw": "Rút tiền",
  "settings.cashuAccount.withdrawDescription":
    "Gửi ecash ra ngoài qua Lightning",
  "settings.cashuAccount.enabled.label": "Nhận Cashu",
  "settings.debugConsole.cashu.title": "Ví Cashu Linky (phát triển)",
  "settings.debugConsole.cashu.activeShard": "Shard đang dùng: {index}",
  "settings.debugConsole.cashu.hydrated": "Đã nạp: {hydrated}",
  "settings.debugConsole.cashu.noBalance": "Không có proof khả dụng.",
  "settings.debugConsole.cashu.writeTestSetting": "Ghi cài đặt thử cho Linky",
  "settings.debugConsole.clear": "Xóa",
  "settings.debugConsole.description": "Xem đầu ra console của ứng dụng",
  "settings.debugConsole.empty": "Chưa ghi được mục console nào.",
  "settings.debugConsole.history.title": "Lịch sử đầu ra console",
  "settings.debugConsole.pause": "Tạm dừng",
  "settings.debugConsole.resume": "Tiếp tục",
  "settings.debugConsole.title": "Console gỡ lỗi",
  "settings.debugConsole.copy": "Sao chép",
  "settings.debugConsole.copied": "Đã sao chép vào bộ nhớ tạm",
  "settings.debugConsole.copyFailed": "Không thể sao chép vào bộ nhớ tạm",
  "settings.debugConsole.copyEntry": "Sao chép mục",
  "settings.debugConsole.export": "Xuất",
  "settings.debugConsole.exported": "Đã xuất nhật ký",
  "settings.debugConsole.exportFailed": "Không thể xuất nhật ký",
  "settings.debugConsole.filter.level": "Mức độ",
  "settings.debugConsole.filter.level.all": "Tất cả",
  "settings.debugConsole.filter.level.info": "Info+",
  "settings.debugConsole.filter.level.warn": "Cảnh báo+",
  "settings.debugConsole.filter.level.error": "Lỗi",
  "settings.debugConsole.filter.levelWithCount": "{level} ({count})",
  "settings.debugConsole.filter.sources": "Nguồn",
  "settings.debugConsole.filter.source.other": "Khác",
  "settings.debugConsole.filter.search": "Tìm trong nhật ký",
  "settings.debugConsole.filter.noMatches": "Không có mục nào khớp với bộ lọc.",
  "settings.debugConsole.filter.clear": "Xóa bộ lọc",
  "settings.debugConsole.filter.counter": "{shown} / {total}",
  "settings.debugConsole.sendToSupport": "Gửi cho bộ phận hỗ trợ",
  "settings.debugConsole.sendToSupport.confirm.title":
    "Gửi nhật ký cho bộ phận hỗ trợ?",
  "settings.debugConsole.sendToSupport.confirm.description":
    "Nhật ký đang hiển thị, đã ẩn các thông tin bí mật, sẽ được gửi cho đội hỗ trợ dưới dạng tin nhắn trò chuyện. Nhật ký dài sẽ được rút gọn còn các mục mới nhất.",
  "settings.debugConsole.sendToSupport.confirm.action": "Gửi",
  "settings.debugConsole.sendToSupport.confirm.cancel": "Hủy",
  "settings.debugConsole.sendToSupport.message.intro":
    "Nhật ký console gỡ lỗi ({count} mục):",
  "settings.debugConsole.sendToSupport.message.truncated":
    "(rút gọn còn {count} mục mới nhất trên tổng số {total})",
  "settings.debugConsole.sent": "Đã gửi nhật ký cho bộ phận hỗ trợ",
  "settings.debugConsole.sendFailed": "Không thể gửi nhật ký",
  "settings.demoData.accountName": "Quán cà phê demo",
  "settings.demoData.action": "Tạo tài khoản demo",
  "settings.demoData.action.pending": "Đang tạo…",
  "settings.demoData.confirm.cancel": "Hủy",
  "settings.demoData.confirm.confirm": "Tạo và sinh dữ liệu",
  "settings.demoData.confirm.description":
    "Ứng dụng chuyển sang tài khoản demo mới và điền dữ liệu giả lập. Cách duy nhất để quay lại là xóa tài khoản demo.",
  "settings.demoData.confirm.title": "Tạo tài khoản demo?",
  "settings.demoData.current.description":
    "Mọi thứ trong đó là giả lập và không bao giờ đồng bộ. Hãy chuyển về tài khoản thật trong mục Tài khoản.",
  "settings.demoData.current.title": "Bạn đang ở tài khoản demo",
  "settings.demoData.description":
    "Điền doanh số giả lập vào một tài khoản demo riêng",
  "settings.demoData.title": "Dữ liệu demo",
  "settings.demoData.warning.duration":
    "Việc tạo bắt đầu từ hôm nay và lùi từng ngày. Ba tháng mất khoảng nửa giờ, lâu hơn trên điện thoại, nhưng bạn có thể dừng bất cứ lúc nào: ngày đang tạo sẽ được hoàn tất và lịch sử đến lúc đó được giữ lại.",
  "settings.demoData.warning.irreversible":
    "Tài khoản demo được điền tối đa ba tháng mặt hàng, bàn, thanh toán và hoàn tiền giả lập, không thể hoàn tác. Không thể xóa từng mục, chỉ xóa được cùng toàn bộ tài khoản demo.",
  "settings.demoData.warning.newAccount":
    "Một tài khoản mới “{name}” được tạo trên thiết bị này và trở thành tài khoản đang dùng. Tài khoản hiện tại và dữ liệu của nó không bị ảnh hưởng; hãy chuyển lại trong mục Tài khoản.",
  "settings.demoData.warning.relays":
    "Các relay đồng bộ bị tắt cho tài khoản demo và không thể bật, nên dữ liệu giả lập không bao giờ đến relay hay thiết bị khác.",
  "settings.demoData.warning.services":
    "Không có gì được gửi đến ngân hàng, máy POS thẻ hay mạng Lightning: mọi dịch vụ bên ngoài đều được mô phỏng. EET luôn tắt.",
  "settings.demoData.warning.title": "Đọc trước khi tạo",
  "settings.developers": "NHÀ PHÁT TRIỂN",
  "settings.donations.amount.invalid": "Nhập số sat nguyên dương.",
  "settings.donations.amount.range": "Số tiền nằm ngoài mức ủng hộ cho phép.",
  "settings.donations.amount.required": "Nhập số tiền ủng hộ.",
  "settings.donations.create": "Tạo hóa đơn",
  "settings.donations.create.pending": "Đang tạo hóa đơn...",
  "settings.donations.description": "Ủng hộ phát triển {appName}",
  "settings.donations.fiat.description": "Dùng loại tiền pháp định đang chọn.",
  "settings.donations.fiat.label": "Số tiền",
  "settings.donations.form.description":
    "Nhập một trong hai số tiền. Ô còn lại được tính theo tỷ giá BTC hiện tại.",
  "settings.donations.form.title": "Số tiền ủng hộ",
  "settings.donations.history.amount": "{amount} sat",
  "settings.donations.history.empty.description":
    "Các khoản ủng hộ sẽ hiện ở đây khi nhận được.",
  "settings.donations.history.empty.title": "Chưa có khoản ủng hộ nào",
  "settings.donations.history.error": "Không tải được lịch sử ủng hộ.",
  "settings.donations.history.more": "Xem thêm",
  "settings.donations.history.retry": "Thử lại",
  "settings.donations.history.title": "Các khoản ủng hộ gần đây",
  "settings.donations.invoice.backToSettings": "Quay lại cài đặt",
  "settings.donations.invoice.copied": "Đã sao chép hóa đơn.",
  "settings.donations.invoice.copy": "Sao chép hóa đơn",
  "settings.donations.invoice.copyFailed": "Không sao chép được hóa đơn.",
  "settings.donations.invoice.description":
    "Quét hóa đơn Lightning này để trả.",
  "settings.donations.invoice.error": "Không tạo được hóa đơn ủng hộ.",
  "settings.donations.invoice.missing": "Thiếu hóa đơn ủng hộ.",
  "settings.donations.invoice.openWallet": "Mở trong ví",
  "settings.donations.invoice.title": "Hóa đơn Lightning",
  "settings.donations.invoice.verify.error": "Không kiểm tra được thanh toán.",
  "settings.donations.invoice.verify.paid": "Đã nhận thanh toán",
  "settings.donations.invoice.verify.paid.description":
    "Cảm ơn bạn đã ủng hộ phát triển ứng dụng này.",
  "settings.donations.invoice.verify.waiting": "Đang chờ thanh toán...",
  "settings.donations.metadata.error":
    "Không tải được địa chỉ Lightning ủng hộ.",
  "settings.donations.rate.error": "Không tải được tỷ giá BTC.",
  "settings.donations.sats.description": "Chỉ nhận số sat nguyên.",
  "settings.donations.sats.label": "Sat",
  "settings.donations.sats.range": "Mức cho phép: {min}-{max} sat.",
  "settings.donations.title": "Ủng hộ",
  "settings.eet.certificate.description":
    "Chứng thư do CA EET cấp để ký doanh thu. EIČ báo cáo lấy từ chứng thư này, và {appName} không lưu mật khẩu của nó.",
  "settings.eet.certificate.eic": "EIČ báo cáo",
  "settings.eet.certificate.error.expired": "Chứng thư đã hết hạn.",
  "settings.eet.certificate.error.fileRequired": "Chọn tệp chứng thư.",
  "settings.eet.certificate.error.notYetValid": "Chứng thư chưa có hiệu lực.",
  "settings.eet.certificate.error.unreadable":
    "Tệp không phải chứng thư máy tính tiền đọc được.",
  "settings.eet.certificate.error.withoutEic": "Chứng thư không ghi EIČ.",
  "settings.eet.certificate.error.withoutKey":
    "Tệp không có khóa riêng cho chứng thư.",
  "settings.eet.certificate.error.wrongPassword": "Sai mật khẩu.",
  "settings.eet.certificate.expired.description":
    "Không thể báo doanh thu cho đến khi nhập chứng thư mới.",
  "settings.eet.certificate.expired.title": "Chứng thư đã hết hạn",
  "settings.eet.certificate.expiresSoon.description":
    "Hãy gia hạn trên cổng EET và nhập chứng thư mới.",
  "settings.eet.certificate.expiresSoon.title": "Chứng thư sắp hết hạn",
  "settings.eet.certificate.file.description": "Tệp .p12 tải từ cổng EET.",
  "settings.eet.certificate.file.label": "Tệp chứng thư",
  "settings.eet.certificate.import": "Nhập chứng thư",
  "settings.eet.certificate.imported": "Đã nhập chứng thư",
  "settings.eet.certificate.none": "Chưa nhập chứng thư nào.",
  "settings.eet.certificate.password.label": "Mật khẩu chứng thư",
  "settings.eet.certificate.testBadge": "Chứng thư thử",
  "settings.eet.certificate.title": "Chứng thư máy tính tiền",
  "settings.eet.certificate.validTo": "Có hiệu lực đến {date}",
  "settings.eet.enabled.description":
    "Chỉ các khoản nhận sau khi bạn bật mới được báo.",
  "settings.eet.enabled.incomplete":
    "Không thể bật EET cho đến khi có chứng thư và số cơ sở kinh doanh.",
  "settings.eet.enabled.label": "Báo doanh thu cho EET",
  "settings.eet.enabled.missing": "Để bật EET, hãy thêm {missing}.",
  "settings.eet.environment.description": "Nơi {appName} gửi doanh thu.",
  "settings.eet.environment.playground.description":
    "Để thử EET. Doanh thu đi đến môi trường thử nghiệm EET và không được báo.",
  "settings.eet.environment.playground.title": "Môi trường thử",
  "settings.eet.environment.production.description":
    "Doanh thu được báo cho cơ quan thuế.",
  "settings.eet.environment.production.title": "Chính thức",
  "settings.eet.environment.productionUnavailable":
    "Phiên bản {appName} này chưa có môi trường chính thức.",
  "settings.eet.environment.sandboxConfirm.cancel": "Hủy",
  "settings.eet.environment.sandboxConfirm.confirm": "Dùng môi trường thử",
  "settings.eet.environment.sandboxConfirm.description":
    "Doanh thu sẽ chỉ được gửi đến môi trường thử nghiệm EET. Không báo cho cơ quan thuế.",
  "settings.eet.environment.sandboxConfirm.title":
    "Chuyển sang môi trường thử EET?",
  "settings.eet.environment.saved": "Đã lưu môi trường",
  "settings.eet.environment.testCertificateBlocksProduction":
    "Hãy nhập chứng thư chính thức trước khi chuyển sang môi trường chính thức.",
  "settings.eet.environment.title": "Môi trường",
  "settings.eet.establishment.description":
    "Số cơ sở kinh doanh được cấp trong MOJE daně.",
  "settings.eet.establishment.invalid": "Nhập số nguyên không có số 0 ở đầu.",
  "settings.eet.establishment.label": "Số cơ sở kinh doanh",
  "settings.eet.gap.certificate": "chứng thư máy tính tiền",
  "settings.eet.gap.certificateExpired": "chứng thư còn hiệu lực",
  "settings.eet.gap.establishment": "số cơ sở kinh doanh",
  "settings.eet.nav.off": "Tắt",
  "settings.eet.nav.production": "Bật",
  "settings.eet.nav.sandbox": "Môi trường thử",
  "settings.eet.officialTest.description":
    "Trong môi trường thử, bạn có thể dùng một chứng thư thử chính thức của cơ quan thuế thay cho tệp.",
  "settings.eet.officialTest.loading": "Đang tải các chứng thư thử chính thức…",
  "settings.eet.officialTest.show": "Dùng chứng thư thử chính thức",
  "settings.eet.officialTest.title": "Chứng thư thử chính thức",
  "settings.eet.officialTest.unavailable.description":
    "Hiện không tải được. Hãy nhập tệp chứng thư.",
  "settings.eet.officialTest.unavailable.title":
    "Không có chứng thư thử chính thức",
  "settings.eet.officialTest.use": "Dùng chứng thư thử {name}",
  "settings.eet.officialTest.useShort": "Dùng",
  "settings.eet.reporting.description":
    "Báo mọi khoản thanh toán nhận trên tài khoản này cho hệ thống EET 2.0 của Séc. Khoản thanh toán vẫn được tính là đã trả kể cả khi EET không hoạt động.",
  "settings.eet.reporting.title": "Báo doanh thu",
  "settings.eet.test.connection": "Thử kết nối",
  "settings.eet.test.description":
    "Kiểm tra cấu hình mà không nhận thanh toán. Không có gì gửi từ đây được ghi là doanh thu.",
  "settings.eet.test.errorCode": "Lỗi {code}: {message}",
  "settings.eet.test.outcome.accepted": "EET đã xác nhận lượt bán thử.",
  "settings.eet.test.outcome.failed": "EET không nhận thông điệp.",
  "settings.eet.test.outcome.verified": "EET đã nhận thông điệp thử.",
  "settings.eet.test.pok": "POK: {pok}",
  "settings.eet.test.rawRequest": "Yêu cầu",
  "settings.eet.test.rawResponse": "Phản hồi",
  "settings.eet.test.sale": "Gửi lượt bán thử",
  "settings.eet.test.title": "Thử",
  "settings.eet.test.unavailable":
    "Trước tiên hãy thiết lập chứng thư và số cơ sở kinh doanh.",
  "settings.eet.tip.business.description":
    "{appName} báo toàn bộ khoản thanh toán, gồm cả tiền tip.",
  "settings.eet.tip.business.title": "Tiền tip thuộc về cửa hàng",
  "settings.eet.tip.description":
    "Tiền tip có nằm trong doanh thu phải báo hay không tùy vào việc nó thuộc về ai. Tiền tip là thu nhập của cửa hàng thì phải báo theo luật. Tiền tip thuộc về nhân viên thì không cần. Thay đổi áp dụng cho các khoản nhận từ lúc đó.",
  "settings.eet.tip.employees.description":
    "{appName} báo khoản thanh toán không gồm tiền tip. Tiền tip vẫn được ghi trong khoản thanh toán.",
  "settings.eet.tip.employees.title": "Tiền tip thuộc về nhân viên",
  "settings.eet.tip.label": "Tiền tip thuộc về ai",
  "settings.eet.tip.note":
    "Phí phục vụ hoặc phí chỗ ngồi bắt buộc không phải là tiền tip. Hãy tính như mặt hàng bình thường trong đơn, và nó luôn nằm trong doanh thu.",
  "settings.eet.tip.title": "Tiền tip",
  "settings.eet.title": "EET",
  "settings.eet.unconfirmed.description": "Doanh thu EET chưa xác nhận.",
  "settings.eet.unconfirmed.empty": "EET đã xác nhận mọi lượt bán.",
  "settings.eet.unconfirmed.reversal": "Giao dịch đảo {amount}",
  "settings.eet.unconfirmed.title": "Doanh thu chưa xác nhận",
  "settings.evoluExport.action": "Xuất",
  "settings.evoluExport.action.pending": "Đang xuất...",
  "settings.evoluExport.confirm.description":
    "Bản xuất sẽ được lưu mà không che dữ liệu.",
  "settings.evoluExport.confirm.label":
    "Tôi hiểu rằng bản xuất có thể chứa dữ liệu nhạy cảm.",
  "settings.evoluExport.database.app": "Cơ sở dữ liệu ứng dụng",
  "settings.evoluExport.description":
    "Xuất cơ sở dữ liệu Evolu trên thiết bị để sao lưu và hỗ trợ",
  "settings.evoluExport.destination.capacitor":
    "Tệp đi đến bảng chia sẻ, nơi bạn chọn nơi gửi.",
  "settings.evoluExport.destination.web":
    "Các tệp sẽ được trình duyệt này tải xuống.",
  "settings.evoluExport.format.description":
    "Mỗi cơ sở dữ liệu đã chọn được xuất thành tệp SQLite thô.",
  "settings.evoluExport.format.sqlite": "SQLite",
  "settings.evoluExport.options.description":
    "Chọn các cơ sở dữ liệu trên thiết bị cần đưa vào.",
  "settings.evoluExport.options.format": "Định dạng",
  "settings.evoluExport.options.title": "Cài đặt xuất",
  "settings.evoluExport.status.createdAt": "Tạo lúc {createdAt}",
  "settings.evoluExport.status.error": "Xuất không thành công.",
  "settings.evoluExport.status.handedOff":
    "Bảng chia sẻ đã đóng. Hãy kiểm tra tệp đã đến nơi trước khi tin vào bản sao lưu này.",
  "settings.evoluExport.status.success": "Đã xuất xong.",
  "settings.evoluExport.status.title": "Trạng thái xuất",
  "settings.evoluExport.title": "Xuất Evolu",
  "settings.evoluExport.warning.businessData": "dữ liệu kinh doanh",
  "settings.evoluExport.warning.description":
    "Bản xuất đầy đủ có thể chứa dữ liệu cho phép truy cập tiền, các tích hợp hoặc lịch sử kinh doanh riêng tư. Hãy cất giữ tệp an toàn và chỉ chia sẻ với người đáng tin.",
  "settings.evoluExport.warning.localConfiguration":
    "cấu hình ứng dụng trên thiết bị và cài đặt đồng bộ",
  "settings.evoluExport.warning.payments": "đơn, thanh toán và giao dịch",
  "settings.evoluExport.warning.secrets":
    "mnemonic của ví, cụm từ khôi phục và token API",
  "settings.evoluExport.warning.title": "Bản xuất nhạy cảm",
  "settings.evoluExport.warning.walletMetadata":
    "siêu dữ liệu liên quan đến ví",
  "settings.fiat.czk.title": "Koruna Séc",
  "settings.fiat.eur.title": "Euro",
  "settings.fiat.usd.title": "Đô la Mỹ",
  "settings.fiatBankAccount.advanced": "Tùy chọn nâng cao",
  "settings.fiatBankAccount.currency.description":
    "Các khoản thanh toán bằng loại tiền này có thể dùng tài khoản ngân hàng này.",
  "settings.fiatBankAccount.currency.label": "Loại tiền của tài khoản",
  "settings.fiatBankAccount.enabled.label": "Bật tài khoản ngân hàng",
  "settings.fiatBankAccount.form.description":
    "Ứng dụng hiện dùng một tài khoản ngân hàng cố định.",
  "settings.fiatBankAccount.form.title": "Thông tin tài khoản ngân hàng",
  "settings.fiatBankAccount.iban.description":
    "Nhập số tài khoản Séc như 123456789/0100 hoặc IBAN. Giá trị được lưu dưới dạng IBAN.",
  "settings.fiatBankAccount.iban.format.bban": "Số tài khoản",
  "settings.fiatBankAccount.iban.format.iban": "IBAN",
  "settings.fiatBankAccount.iban.invalid":
    "Nhập IBAN hoặc số tài khoản Séc hợp lệ.",
  "settings.fiatBankAccount.iban.label": "Số tài khoản hoặc IBAN",
  "settings.fiatBankAccount.iban.required":
    "Nhập IBAN hoặc số tài khoản, hoặc tắt chuyển khoản.",
  "settings.fiatBankAccount.iban.unknownBank":
    "Ngân hàng không xác định — không nhận ra tài khoản này thuộc ngân hàng nào",
  "settings.fiatBankAccount.qrFormat.description":
    "Định dạng này được hiện đầu tiên cho thanh toán QR ngân hàng.",
  "settings.fiatBankAccount.qrFormat.label": "Định dạng QR mặc định",
  "settings.fiatBankAccount.qrFormat.payBySquare1_0_0":
    "Pay by square 1.0 (Slovakia)",
  "settings.fiatBankAccount.qrFormat.payBySquare1_2_0":
    "Pay by square 1.2 (Slovakia)",
  "settings.fiatBankAccount.qrFormat.spayd": "SPAYD (Séc)",
  "settings.fioPlugin.active.description":
    "Khi bật, plugin kiểm tra giao dịch Fio banka của tài khoản ngân hàng.",
  "settings.fioPlugin.active.label": "Bật plugin Fio",
  "settings.fioPlugin.description":
    "Thiết lập token đồng bộ giao dịch Fio banka",
  "settings.fioPlugin.form.description":
    "Plugin hiện dùng tài khoản ngân hàng cố định.",
  "settings.fioPlugin.form.title": "Cài đặt cơ bản",
  "settings.fioPlugin.interval.description":
    "Plugin kiểm tra giao dịch mới bao lâu một lần.",
  "settings.fioPlugin.interval.invalid": "Nhập số nguyên lớn hơn 0.",
  "settings.fioPlugin.interval.label": "Số giây giữa các lần kiểm tra",
  "settings.fioPlugin.lastSyncedDate.description":
    "Mốc đồng bộ trên thiết bị. Nếu chưa có mốc, dùng ngày hôm qua.",
  "settings.fioPlugin.lastSyncedDate.invalid": "Nhập ngày hợp lệ.",
  "settings.fioPlugin.lastSyncedDate.label": "Ngày đồng bộ gần nhất",
  "settings.fioPlugin.nativeRuntimeWarning.description":
    "Fio banka không cho trình duyệt gọi API nên việc kiểm tra thanh toán Fio tự động không chạy ở đây. Hãy cho phép proxy cho dịch vụ đã kết nối trong cài đặt quyền riêng tư, hoặc dùng ứng dụng di động {appName}.",
  "settings.fioPlugin.nativeRuntimeWarning.title": "Fio cần proxy ở đây",
  "settings.fioPlugin.syncLookbackDays.description":
    "Số ngày trước mốc đồng bộ gần nhất cần kiểm tra lại.",
  "settings.fioPlugin.syncLookbackDays.invalid": "Nhập số nguyên lớn hơn 0.",
  "settings.fioPlugin.syncLookbackDays.label": "Số ngày kiểm tra lại",
  "settings.fioPlugin.notFioIbanShort": "Không phải tài khoản Fio banka.",
  "settings.fioPlugin.notFioIbanWarning":
    "IBAN này không phải tài khoản Fio banka nên plugin sẽ không tìm thấy các khoản thanh toán.",
  "settings.fioPlugin.title": "Plugin Fio",
  "settings.fioPlugin.token.description":
    "Để trống nếu chỉ cập nhật cài đặt cơ bản.",
  "settings.fioPlugin.token.invalid": "Nhập token tối đa 255 ký tự.",
  "settings.fioPlugin.token.label": "Token API Fio",
  "settings.fioPlugin.token.required": "Cần token đầu tiên khi tạo plugin.",
  "settings.fioPlugin.tokens.active": "Đang dùng",
  "settings.fioPlugin.tokens.add.description":
    "Được lưu riêng nên có thể đổi các cài đặt trên mà không cần ghi lại token. Tác vụ đồng bộ dùng luân phiên mọi token đã lưu.",
  "settings.fioPlugin.tokens.add.saved": "Đã thêm token API Fio.",
  "settings.fioPlugin.tokens.add.submit": "Thêm token",
  "settings.fioPlugin.tokens.add.title": "Thêm token",
  "settings.fioPlugin.tokens.description":
    "Các token đã lưu được dùng khi kiểm tra giao dịch tài khoản.",
  "settings.fioPlugin.tokens.empty": "Chưa lưu token nào.",
  "settings.fioPlugin.tokens.item": "Token API Fio",
  "settings.fioPlugin.tokens.remove": "Xóa",
  "settings.fioPlugin.tokens.remove.confirm.title": "Xóa token?",
  "settings.fioPlugin.tokens.remove.confirm.description":
    "Việc đồng bộ sẽ ngừng dùng token {token}. Muốn dùng lại thì phải thêm lại.",
  "settings.fioPlugin.tokens.remove.confirm.confirm": "Xóa",
  "settings.fioPlugin.tokens.remove.confirm.cancel": "Hủy",
  "settings.fioPlugin.tokens.title": "Token",
  "settings.monetaPlugin.title": "Plugin MONETA",
  "settings.monetaPlugin.description":
    "Tự động xác nhận chuyển khoản đến tài khoản MONETA Money Bank",
  "settings.monetaPlugin.status.on": "Bật",
  "settings.monetaPlugin.status.off": "Tắt",
  "settings.monetaPlugin.nativeRuntimeWarning.title": "MONETA cần proxy ở đây",
  "settings.monetaPlugin.nativeRuntimeWarning.description":
    "MONETA không cho trình duyệt gọi API. Hãy cho phép proxy cho dịch vụ đã kết nối trong cài đặt quyền riêng tư, hoặc kết nối token trong ứng dụng di động {appName}; khi đó máy thu tiền này cũng thấy các khoản đã xác nhận.",
  "settings.monetaPlugin.notMonetaIbanWarning":
    "Tài khoản ngân hàng không thuộc MONETA Money Bank (mã ngân hàng 0600) nên không có gì để kết nối.",
  "settings.monetaPlugin.connect.title": "Kết nối token",
  "settings.monetaPlugin.connect.replaceTitle": "Kết nối token khác",
  "settings.monetaPlugin.connect.description":
    'Tạo token trong MONETA Internet Banka tại Nastavení › Správa API tokenů, với quyền "Pasivní – pouze náhled". {appName} kiểm tra với ngân hàng rằng token thấy tài khoản này.',
  "settings.monetaPlugin.connect.submit": "Kết nối",
  "settings.monetaPlugin.connect.saved": "Đã kết nối token MONETA.",
  "settings.monetaPlugin.connect.error.unauthorized":
    "Ngân hàng từ chối token. Hãy kiểm tra token được sao chép đầy đủ và chưa bị thu hồi.",
  "settings.monetaPlugin.connect.error.accountNotVisible":
    "Token hoạt động nhưng không thấy tài khoản {iban}. Hãy tạo token cho tài khoản đó.",
  "settings.monetaPlugin.connect.error.rateLimited":
    "Token đã dùng hết lượt yêu cầu ngân hàng hôm nay. Hãy thử lại vào ngày mai.",
  "settings.monetaPlugin.connect.error.unreachable":
    "Ngân hàng không phản hồi. Hãy kiểm tra kết nối rồi thử lại.",
  "settings.monetaPlugin.connect.error.unexpected":
    "Ngân hàng phản hồi không như mong đợi. Hãy thử lại sau.",
  "settings.monetaPlugin.token.label": "Token API MONETA",
  "settings.monetaPlugin.token.required": "Dán token từ Internet Banka.",
  "settings.monetaPlugin.connected.title": "Tài khoản đã kết nối",
  "settings.monetaPlugin.connected.iban": "Tài khoản",
  "settings.monetaPlugin.connected.token": "Token",
  "settings.monetaPlugin.connected.ibanMismatch":
    "Token được kết nối cho tài khoản {iban}, không phải tài khoản ngân hàng hiện tại. Hãy kết nối token cho tài khoản hiện tại.",
  "settings.monetaPlugin.settings.title": "Cài đặt đồng bộ",
  "settings.monetaPlugin.active.label": "Tự động xác nhận thanh toán",
  "settings.monetaPlugin.active.description":
    "Kiểm tra chuyển khoản đến trong nền và khi có khoản đang chờ.",
  "settings.monetaPlugin.interval.label": "Số giây giữa các lần kiểm tra nền",
  "settings.monetaPlugin.interval.description":
    "Khoản đang chờ luôn được kiểm tra vài giây một lần, không phụ thuộc vào giá trị này.",
  "settings.monetaPlugin.interval.invalid": "Nhập số nguyên ít nhất là 60.",
  "settings.monetaPlugin.interval.estimate":
    "Khoảng {calls} yêu cầu mỗi ngày trên một thiết bị, trong {limit} yêu cầu ngân hàng cho phép cho tất cả thiết bị.",
  "settings.monetaPlugin.lastSyncedDate.label": "Ngày đồng bộ gần nhất",
  "settings.monetaPlugin.lastSyncedDate.description":
    "Nơi đồng bộ nền tiếp tục. Nếu không có, hai tháng gần nhất sẽ được đọc.",
  "settings.monetaPlugin.lastSyncedDate.invalid": "Nhập ngày hợp lệ.",
  "settings.monetaPlugin.disconnect.action": "Ngắt kết nối",
  "settings.monetaPlugin.disconnect.confirm.title": "Ngắt kết nối MONETA?",
  "settings.monetaPlugin.disconnect.confirm.description":
    "{appName} ngừng dùng token trên mọi thiết bị và ngừng xác nhận chuyển khoản. Các khoản đã xác nhận giữ nguyên. Token vẫn còn trong lịch sử đồng bộ được mã hóa, nên hãy thu hồi cả trong MONETA Internet Banka.",
  "settings.monetaPlugin.disconnect.confirm.confirm": "Ngắt kết nối",
  "settings.monetaPlugin.disconnect.confirm.cancel": "Hủy",
  "settings.homeScreen.atLeastOneMode":
    "Hãy giữ ít nhất một chế độ bật — trang chủ cần có gì đó để hiển thị.",
  "settings.homeScreen.modes.description":
    "Chọn các chế độ có thể chuyển trên trang chủ. Nếu chỉ bật một, nút chuyển sẽ ẩn đi.",
  "settings.homeScreen.modes.title": "Chế độ",
  "settings.homeScreen.numpad.description": "Nhập số tiền và thu ngay.",
  "settings.homeScreen.pos.description":
    "Bàn và đơn đang mở, tính tiền từ danh sách mặt hàng.",
  "settings.homeScreen.title": "Trang chủ",
  "catalog.items.add": "Thêm mặt hàng",
  "catalog.items.category.all": "Tất cả",
  "catalog.items.category.uncategorized": "Chưa phân loại",
  "catalog.items.delete": "Xóa mặt hàng",
  "catalog.items.delete.confirm.cancel": "Hủy",
  "catalog.items.delete.confirm.confirm": "Xóa",
  "catalog.items.delete.confirm.description":
    "Các đơn và khoản thanh toán đã dùng {name} giữ bản sao riêng, nhưng sẽ không thể thêm vào đơn mới nữa.",
  "catalog.items.delete.confirm.title": "Xóa {name}?",
  "catalog.items.description": "Quản lý sản phẩm và dịch vụ bạn bán",
  "catalog.items.empty.description":
    "Thêm sản phẩm hoặc dịch vụ bạn bán để nhanh chóng đưa vào đơn.",
  "catalog.items.empty.title": "Chưa có mặt hàng nào",
  "catalog.items.emptySearch": "Không có mặt hàng nào khớp.",
  "catalog.items.form.card.description":
    "Tên, giá và mô tả tùy chọn hiện khi thêm mặt hàng này vào đơn.",
  "catalog.items.form.card.title": "Chi tiết",
  "catalog.items.form.category.label": "Danh mục",
  "catalog.items.form.category.none": "Không có danh mục",
  "catalog.items.form.currency.label": "Loại tiền",
  "catalog.items.form.description.invalid": "Mô tả quá dài (tối đa 255 ký tự).",
  "catalog.items.form.description.label": "Mô tả",
  "catalog.items.form.description.placeholder": "Không bắt buộc",
  "catalog.items.form.discount.description":
    "Trừ vào đơn. Không có mức VAT: được phân bổ cho hàng hóa trong đơn theo tỷ lệ giá.",
  "catalog.items.form.discount.existing":
    "Mặt hàng này là giảm giá: số tiền được trừ vào đơn. Chỉ có thể đặt là giảm giá khi thêm mặt hàng.",
  "catalog.items.form.discount.label": "Giảm giá",
  "catalog.items.form.internalDescription.invalid":
    "Mô tả nội bộ quá dài (tối đa 255 ký tự).",
  "catalog.items.form.internalDescription.label": "Mô tả nội bộ",
  "catalog.items.form.internalDescription.placeholder":
    "Không bắt buộc — chỉ nhân viên thấy",
  "catalog.items.form.internalName.hint":
    "Nhân viên thấy tên này thay cho tên công khai. Khách vẫn thấy tên và mô tả công khai trên đơn.",
  "catalog.items.form.internalName.invalid":
    "Tên nội bộ quá dài (tối đa 255 ký tự).",
  "catalog.items.form.internalName.label": "Tên nội bộ",
  "catalog.items.form.internalName.placeholder":
    "Không bắt buộc — nhân viên thấy thay cho tên công khai",
  "catalog.items.form.invalidId": "Mã mặt hàng không hợp lệ.",
  "catalog.items.form.name.invalid": "Nhập tên.",
  "catalog.items.form.name.label": "Tên",
  "catalog.items.form.name.placeholder": "vd. Cà phê",
  "catalog.items.form.notFound": "Mặt hàng này không còn tồn tại.",
  "catalog.items.form.price.discountWithTaxRate": "Giảm giá không có mức VAT.",
  "catalog.items.form.price.discountInvalid": "Nhập số tiền giảm.",
  "catalog.items.form.price.invalid": "Nhập giá hợp lệ.",
  "catalog.items.form.price.label": "Giá",
  "catalog.items.form.price.signChange":
    "Giảm giá vẫn là giảm giá và mặt hàng vẫn là mặt hàng. Hãy thêm mặt hàng mới.",
  "catalog.items.form.price.zeroWithoutTaxRate":
    "Mặt hàng miễn phí cần có mức VAT. Hãy chọn mức VAT hoặc đặt giá.",
  "catalog.items.form.save.create": "Thêm mặt hàng",
  "catalog.items.form.saved.create": "Đã thêm mặt hàng.",
  "catalog.items.form.scanCode.duplicate": "Đã gán cho {name}.",
  "catalog.items.form.scanCode.invalid": "Nhập mã hợp lệ.",
  "catalog.items.form.scanCode.label": "Mã quét",
  "catalog.items.form.scanCode.placeholder": "vd. 8594001234567",
  "catalog.items.form.scanCode.scan.aria": "Quét mã",
  "catalog.items.form.sku.invalid": "SKU quá dài (tối đa 255 ký tự).",
  "catalog.items.form.sku.label": "SKU",
  "catalog.items.form.sku.placeholder": "Không bắt buộc",
  "catalog.items.form.taxRate.description":
    "Áp dụng cho đơn và thanh toán khi dùng mặt hàng này. Quản lý trong Cài đặt › Mức thuế.",
  "catalog.items.form.taxRate.label": "Mức thuế",
  "catalog.items.form.taxRate.none": "Không có mức thuế",
  "catalog.items.form.title.create": "Thêm mặt hàng",
  "catalog.items.form.title.edit": "Sửa mặt hàng",
  "catalog.items.search": "Tìm mặt hàng...",
  "catalog.items.search.clear.aria": "Xóa tìm kiếm",
  "catalog.items.title": "Mặt hàng",
  "settings.language.locale.czech.title": "Séc",
  "settings.language.locale.description":
    "Chọn định dạng vùng cho ngày, số và tiền tệ.",
  "settings.language.locale.english.title": "Hoa Kỳ",
  "settings.language.locale.slovak.title": "Slovakia",
  "settings.language.locale.vietnamese.title": "Việt Nam",
  "settings.language.locale.title": "Định dạng vùng",
  "settings.language.mode.description": "Chọn ngôn ngữ ứng dụng sử dụng.",
  "settings.language.mode.title": "Ngôn ngữ ứng dụng",
  "settings.language.title": "Ngôn ngữ và vùng",
  "settings.legalEntity.country.label": "Quốc gia",
  "settings.legalEntity.country.placeholder": "Chọn quốc gia",
  "settings.legalEntity.currency.description":
    "Loại tiền pháp định mặc định khi tạo thanh toán.",
  "settings.legalEntity.currency.label": "Loại tiền",
  "settings.legalEntity.description":
    "Quốc gia, loại tiền và tình trạng VAT của cửa hàng.",
  "settings.legalEntity.title": "Cửa hàng",
  "settings.legalEntity.vatPayer.description":
    "Thêm mức thuế vào các mặt hàng.",
  "settings.legalEntity.vatPayer.label": "Tôi là người nộp VAT",
  "settings.paymentAccounts.default": "Mặc định",
  "settings.paymentAccounts.experimental": "Thử nghiệm",
  "settings.paymentAccounts.method.cashRegister": "Tiền mặt",
  "settings.paymentAccounts.method.iban": "Chuyển khoản",
  "settings.paymentAccounts.method.cashu": "Cashu",
  "settings.paymentAccounts.method.cardSwitchio": "Thẻ thanh toán",
  "settings.paymentAccounts.method.qerkoPayment": "Thanh toán Qerko (QR)",
  "settings.paymentAccounts.method.qerkoTerminal": "Máy POS thẻ (Qerko)",
  "settings.paymentAccounts.method.spark": "Bitcoin",
  "settings.paymentAccounts.moveDown.aria": "Chuyển {name} xuống",
  "settings.paymentAccounts.moveUp.aria": "Chuyển {name} lên",
  "settings.paymentAccounts.reorder.aria": "Sắp xếp lại {name}",
  "settings.paymentAccounts.order.description":
    "Khách thấy các phương thức thanh toán theo thứ tự này. Phương thức khả dụng đầu tiên tự động mở.",
  "settings.paymentAccounts.status.currencyMismatch":
    "Được thiết lập bằng {currency}, nhưng ứng dụng dùng {appCurrency}",
  "settings.paymentAccounts.status.unavailableHere":
    "Chưa có trong phiên bản này của ứng dụng",
  "settings.paymentAccounts.status.missingIban":
    "Thêm tài khoản ngân hàng để bật",
  "settings.paymentAccounts.title": "Phương thức thanh toán",
  "settings.paymentNumberSeries.day.default.description":
    "Đưa ngày hai chữ số vào số thanh toán",
  "settings.paymentNumberSeries.day.default.title": "Hiện ngày",
  "settings.paymentNumberSeries.day.hidden.description":
    "Không đưa ngày vào số thanh toán",
  "settings.paymentNumberSeries.day.hidden.title": "Ẩn ngày",
  "settings.paymentNumberSeries.day.label": "Định dạng ngày",
  "settings.paymentNumberSeries.description":
    "Thiết lập cách tạo số thanh toán",
  "settings.paymentNumberSeries.form.description":
    "Các giá trị này xác định dãy số thanh toán cố định mà máy thu tiền dùng.",
  "settings.paymentNumberSeries.form.title": "Định dạng dãy số",
  "settings.paymentNumberSeries.lastNumber.date.description":
    "Ngày mốc quyết định khoản thanh toán tiếp theo tiếp tục hay bắt đầu lại dãy số. Để trống để bắt đầu lại ở khoản tiếp theo.",
  "settings.paymentNumberSeries.lastNumber.date.invalid": "Nhập ngày hợp lệ.",
  "settings.paymentNumberSeries.lastNumber.date.label": "Ngày mốc",
  "settings.paymentNumberSeries.lastNumber.description":
    "Ghi đè số thứ tự đã dùng gần nhất. Số thanh toán tiếp theo sẽ tiếp tục từ giá trị này.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.description":
    "Số thứ tự đã dùng gần nhất. Ví dụ, nhập 499 nếu khoản tiếp theo cần dùng 500.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.invalid":
    "Nhập 0 hoặc số nguyên dương.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.label":
    "Số thứ tự gần nhất",
  "settings.paymentNumberSeries.lastNumber.title": "Số đã dùng gần nhất",
  "settings.paymentNumberSeries.month.default.description":
    "Đưa tháng hai chữ số vào số thanh toán",
  "settings.paymentNumberSeries.month.default.title": "Hiện tháng",
  "settings.paymentNumberSeries.month.hidden.description":
    "Không đưa tháng vào số thanh toán",
  "settings.paymentNumberSeries.month.hidden.title": "Ẩn tháng",
  "settings.paymentNumberSeries.month.label": "Định dạng tháng",
  "settings.paymentNumberSeries.prefix.description":
    "Tiền tố tùy chọn thêm trước số thanh toán.",
  "settings.paymentNumberSeries.prefix.invalid":
    "Nhập tiền tố tối đa 255 ký tự.",
  "settings.paymentNumberSeries.prefix.label": "Tiền tố",
  "settings.paymentNumberSeries.serialNumberDigits.description":
    "Số chữ số tối thiểu của phần số thứ tự tăng dần.",
  "settings.paymentNumberSeries.serialNumberDigits.invalid":
    "Nhập số nguyên lớn hơn 0.",
  "settings.paymentNumberSeries.serialNumberDigits.label":
    "Số chữ số của số thứ tự",
  "settings.paymentNumberSeries.title": "Dãy số thanh toán",
  "settings.paymentNumberSeries.year.default.description":
    "Đưa năm bốn chữ số vào số thanh toán",
  "settings.paymentNumberSeries.year.default.title": "Năm đầy đủ",
  "settings.paymentNumberSeries.year.label": "Định dạng năm",
  "settings.paymentNumberSeries.year.short.description":
    "Đưa năm hai chữ số vào số thanh toán",
  "settings.paymentNumberSeries.year.short.title": "Năm rút gọn",
  "settings.payments": "THANH TOÁN",
  "settings.privacy.errorReporting.description":
    "Gửi báo cáo sự cố và chi tiết lỗi để giúp sửa lỗi. Mặc định tắt — không có gì được gửi trừ khi bạn bật.",
  "settings.privacy.errorReporting.disable": "Tắt",
  "settings.privacy.errorReporting.disabled": "Đã tắt",
  "settings.privacy.errorReporting.enable": "Bật",
  "settings.privacy.errorReporting.enabled": "Đã bật",
  "settings.privacy.errorReporting.title": "Báo lỗi",
  "settings.privacy.productLookup.description":
    "Khi bạn quét mã vạch chưa có trong danh sách mặt hàng, tìm sản phẩm trong Open Food Facts và Open Beauty Facts rồi điền sẵn tên. Mã đã quét được gửi đến các dịch vụ đó. Mặc định tắt.",
  "settings.privacy.productLookup.disable": "Tắt",
  "settings.privacy.productLookup.disabled": "Đã tắt",
  "settings.privacy.productLookup.enable": "Bật",
  "settings.privacy.productLookup.enabled": "Đã bật",
  "settings.privacy.productLookup.title": "Tra cứu sản phẩm",
  "settings.privacy.serviceProxy.title": "Proxy cho dịch vụ đã kết nối",
  "settings.privacy.serviceProxy.description":
    "Một số dịch vụ (hiện là Fio banka và MONETA Money Bank) không cho trình duyệt gọi trực tiếp API. Khi bạn cho phép, phiên bản web gửi các yêu cầu này qua máy chủ của {appName} tại EU (Frankfurt). Proxy thấy token truy cập ngân hàng của bạn và phản hồi của ngân hàng: IBAN và các giao dịch của tài khoản, gồm số tiền, tài khoản đối ứng, tên người trả, các mã và lời nhắn cho người nhận. Proxy không lưu gì cả, chỉ chuyển tiếp. Chỉ áp dụng cho thiết bị này. Mặc định tắt.",
  "settings.privacy.serviceProxy.nativeNote":
    "Ứng dụng di động gọi trực tiếp đến ngân hàng và không dùng proxy, nên cài đặt này không thay đổi gì ở đây.",
  "settings.privacy.serviceProxy.disable": "Tắt",
  "settings.privacy.serviceProxy.disabled": "Đã tắt",
  "settings.privacy.serviceProxy.enable": "Bật",
  "settings.privacy.serviceProxy.enabled": "Đã bật",
  "settings.privacy.serviceProxy.openPrivacySettings":
    "Mở cài đặt quyền riêng tư",
  "settings.privacy.aiAssistant.title": "Trợ lý AI",
  "settings.privacy.aiAssistant.description":
    "Trợ lý trả lời qua máy chủ của {appName} và một nhà cung cấp AI, nên những gì bạn hỏi và trợ lý đọc sẽ rời thiết bị này. Mặc định tắt.",
  "settings.privacy.aiAssistant.off.title": "Tắt",
  "settings.privacy.aiAssistant.off.description":
    "Trợ lý bị ẩn và không có gì được gửi.",
  "settings.privacy.aiAssistant.public.title": "Chỉ tài liệu và mã nguồn",
  "settings.privacy.aiAssistant.public.description":
    "Trợ lý đọc tài liệu công khai và mã nguồn của {appName}. Đơn và thanh toán của bạn ở lại thiết bị này.",
  "settings.privacy.aiAssistant.all.title": "Gồm cả dữ liệu của tôi",
  "settings.privacy.aiAssistant.all.description":
    "Trợ lý đọc thêm các đơn và khoản thanh toán trên thiết bị này và gửi những gì đọc được cho nhà cung cấp AI.",
  "settings.profile.public.title": "Hồ sơ công khai",
  "settings.profile.public.description":
    "Tên và ảnh của cửa hàng. Chúng được đăng công khai nên ai cũng xem được.",
  "settings.profile.business.description":
    "Quốc gia, loại tiền và tình trạng VAT của cửa hàng. Không đăng công khai.",
  "settings.profile.description":
    "Hồ sơ Nostr của bạn, giống hồ sơ Linky hiển thị cho cụm từ khôi phục này.",
  "settings.profile.loadFailed":
    "Không kết nối được relay Nostr nào để tải hồ sơ. Hãy kiểm tra kết nối rồi thử lại.",
  "settings.profile.name.invalid": "Tên quá dài.",
  "settings.profile.name.label": "Tên",
  "settings.profile.name.placeholder": "Tên cửa hàng của bạn",
  "settings.profile.npub.copied": "Đã sao chép khóa công khai",
  "settings.profile.npub.copy": "Sao chép khóa công khai",
  "settings.profile.npub.copyFailed": "Không sao chép được khóa công khai",
  "settings.profile.npub.label": "Khóa công khai",
  "settings.profile.picture.choose": "Chọn ảnh",
  "settings.profile.picture.invalid":
    "Tệp này không phải ảnh mà trình duyệt đọc được.",
  "settings.profile.picture.label": "Ảnh",
  "settings.profile.picture.remove": "Xóa ảnh",
  "settings.profile.retry": "Thử lại",
  "settings.profile.saveFailed":
    "Không relay Nostr nào nhận hồ sơ. Hãy thử lại sau.",
  "settings.profile.setName": "Đặt tên của bạn",
  "settings.profile.title": "Hồ sơ",
  "settings.qerkoTerminal.terminal.change": "Đổi máy POS",
  "settings.qerkoTerminal.terminal.choose": "Chọn máy POS",
  "settings.qerkoTerminal.terminal.label": "Máy POS trên thiết bị này",
  "settings.qerkoTerminal.terminal.none": "Chưa chọn máy POS trên thiết bị này",
  "settings.qerkoTerminal.terminals.choose": "Dùng máy POS này",
  "settings.qerkoTerminal.terminals.description":
    "Mỗi thiết bị thanh toán trên máy POS riêng. Lựa chọn này chỉ áp dụng cho thiết bị này.",
  "settings.qerkoTerminal.terminals.empty":
    "Qerko chưa có máy POS nào được kích hoạt cho công ty này.",
  "settings.qerkoTerminal.terminals.empty.help":
    "Chỉ bộ phận hỗ trợ Qerko mới thiết lập được máy POS cho công ty của bạn. Hãy liên hệ, nhờ họ kích hoạt máy POS, rồi quay lại thử lại.",
  "settings.qerkoTerminal.terminals.failed":
    "Không tải được danh sách máy POS.",
  "settings.qerkoTerminal.terminals.keyRejected":
    "Qerko không còn chấp nhận ghép nối này. Có thể nó đã bị thu hồi trong Qerko. Hãy ghép nối lại để tiếp tục.",
  "settings.qerkoTerminal.terminals.keyRejected.action": "Ghép nối lại",
  "settings.qerkoTerminal.terminals.later": "Chọn sau",
  "settings.qerkoTerminal.terminals.platform.physical": "Máy POS",
  "settings.qerkoTerminal.terminals.platform.softPos": "SoftPOS",
  "settings.qerkoTerminal.terminals.retry": "Thử lại",
  "settings.qerkoTerminal.terminals.title": "Chọn máy POS",
  "settings.qerkoTerminal.test.action": "Thử kết nối",
  "settings.qerkoTerminal.test.bankUnreachable":
    "Máy POS đã kết nối nhưng không liên lạc được với đơn vị xử lý thanh toán.",
  "settings.qerkoTerminal.test.busy": "Máy POS đang bận thao tác khác.",
  "settings.qerkoTerminal.test.connected": "Máy POS đã kết nối.",
  "settings.qerkoTerminal.test.notActivated":
    "Máy POS chưa được kích hoạt trong Qerko.",
  "settings.qerkoTerminal.test.notConnected": "Máy POS chưa kết nối.",
  "settings.qerkoTerminal.test.running": "Đang thử…",
  "settings.qerkoTerminal.test.unknownTerminal":
    "Qerko không biết máy POS này. Hãy chọn lại.",
  "settings.qerkoTerminal.test.upstreamError":
    "Qerko không liên lạc được với máy POS.",
  "settings.qerkoTerminal.test.upstreamTimeout":
    "Máy POS không phản hồi kịp thời.",
  "settings.qerkoTerminal.title": "Máy POS Qerko",
  "settings.qerkoTerminal.unpair.action": "Hủy ghép nối",
  "settings.qerkoTerminal.unpair.confirm.cancel": "Hủy",
  "settings.qerkoTerminal.unpair.confirm.confirm": "Hủy ghép nối",
  "settings.qerkoTerminal.unpair.confirm.description":
    "Thanh toán thẻ trên máy POS Qerko sẽ dừng trên mọi thiết bị. Các khoản đã nhận giữ nguyên.",
  "settings.qerkoTerminal.unpair.confirm.title": "Hủy ghép nối với Qerko?",
  "settings.qerkoTerminal.unpaired.description":
    "Kết nối tài khoản Qerko của công ty để nhận thanh toán thẻ trên các máy POS của nó. Qerko gửi mã xác nhận đến e-mail của công ty.",
  "settings.qerkoTerminal.unpaired.title": "Ghép nối với Qerko",
  "settings.security.mnemonic.copied": "Đã sao chép cụm từ khôi phục.",
  "settings.security.mnemonic.copy": "Sao chép",
  "settings.security.mnemonic.copyError":
    "Không sao chép được cụm từ khôi phục.",
  "settings.security.mnemonic.description":
    "Đọc cụm từ khôi phục của tài khoản đang dùng trên thiết bị.",
  "settings.security.mnemonic.help":
    "Hãy giữ kín cụm từ này. Ai có nó đều khôi phục được tài khoản.",
  "settings.security.mnemonic.label": "Cụm từ khôi phục",
  "settings.security.mnemonic.title": "Khôi phục tài khoản",
  "settings.security.mnemonic.warning":
    "Nếu mất cụm từ này, tài khoản và dữ liệu sẽ không bao giờ khôi phục được — kể cả bởi chúng tôi.",
  "settings.security.mnemonic.intro":
    "20 từ này là cách duy nhất để lấy lại tài khoản trên thiết bị khác hoặc sau khi mất điện thoại này. Hãy giữ trong trình quản lý mật khẩu hoặc trên giấy — không chụp màn hình hay gửi qua tin nhắn. Không ai, kể cả {appName}, khôi phục được thay bạn.",
  "settings.security.mnemonic.nativeHint":
    "Viết các từ ra giấy theo đúng thứ tự — đừng chụp màn hình. Sau đó kiểm tra bản sao lưu.",
  "settings.security.mnemonic.savePasswords": "Lưu vào mật khẩu",
  "settings.security.mnemonic.savePasswords.saved":
    "Đã lưu cụm từ khôi phục vào trình quản lý mật khẩu.",
  "settings.security.mnemonic.savePasswords.unsupported":
    "Trình duyệt này không lưu được vào trình quản lý mật khẩu. Hãy sao chép hoặc viết cụm từ ra.",
  "settings.security.mnemonic.savePasswords.failed":
    "Không lưu được vào trình quản lý mật khẩu.",
  "settings.security.verify.action": "Kiểm tra bản sao lưu",
  "settings.security.verify.title": "Kiểm tra bản sao lưu của bạn",
  "settings.security.verify.description":
    "Nhập các từ {slots} từ bản bạn đã viết. Bước này không bắt buộc và không chặn gì cả.",
  "settings.security.verify.wordLabel": "Từ {index}",
  "settings.security.verify.submit": "Kiểm tra",
  "settings.security.verify.cancel": "Hủy",
  "settings.security.verify.wrong":
    "Các từ không khớp với cụm từ khôi phục. Hãy kiểm tra bản của bạn rồi thử lại.",
  "settings.security.verify.success": "Đã kiểm tra bản sao lưu.",
  "settings.security.verify.status.verified": "Đã kiểm tra {date}",
  "settings.security.verify.status.unverified": "Chưa kiểm tra",
  "settings.security.backup.description":
    "Cụm từ khôi phục đã được sao lưu và kiểm tra hay chưa.",
  "settings.security.backup.open": "Sao lưu",
  "settings.security.backup.view": "Xem bản sao lưu",
  "settings.security.backup.start": "Hiện cụm từ khôi phục",
  "settings.security.backup.continue": "Tôi đã viết ra — kiểm tra",
  "settings.security.verify.skip": "Bỏ qua kiểm tra",
  "settings.security.transports.add": "Thêm máy chủ",
  "settings.security.transports.demo":
    "Đây là tài khoản demo: không bao giờ đồng bộ nên các relay luôn tắt.",
  "settings.security.transports.description":
    "Thiết lập các điểm đồng bộ WebSocket Evolu cho tài khoản này trên thiết bị.",
  "settings.security.transports.empty": "Chưa lưu máy chủ nào.",
  "settings.security.transports.footer":
    "Máy chủ không hoạt động vẫn được lưu nhưng bị bỏ qua khi mở dữ liệu ứng dụng.",
  "settings.security.transports.inactive": "Không hoạt động",
  "settings.security.transports.saved": "Đã thêm máy chủ.",
  "settings.security.transports.status.synced": "Đã đồng bộ",
  "settings.security.transports.status.syncing": "Đang đồng bộ…",
  "settings.security.transports.status.connecting": "Đang kết nối…",
  "settings.security.transports.status.offline": "Ngoại tuyến",
  "settings.security.transports.status.error": "Lỗi đồng bộ",
  "settings.security.transports.status.errors.version":
    "Ứng dụng và relay dùng phiên bản không tương thích. Hãy cập nhật ứng dụng.",
  "settings.security.transports.status.errors.writeKey":
    "Relay từ chối khóa ghi của tài khoản này.",
  "settings.security.transports.status.errors.quota":
    "Dung lượng của relay cho tài khoản này đã đầy.",
  "settings.security.transports.status.errors.decrypt":
    "Không giải mã được dữ liệu từ relay.",
  "settings.security.transports.status.errors.generic":
    "Đồng bộ với relay này không thành công.",
  "settings.security.transports.status.lastSynced": "Đồng bộ gần nhất {time}",
  "settings.security.transports.status.firstSync": "Đồng bộ lần đầu",
  "settings.security.transports.status.unreachable": "Không kết nối được relay",
  "settings.security.transports.status.offlineSince": "Từ {time}",
  "settings.security.transports.accountId": "mã tài khoản",
  "settings.security.transports.toggle": "Đồng bộ qua {url}",
  "settings.security.transports.title": "Máy chủ đồng bộ Evolu",
  "settings.security.transports.url.description":
    "Chỉ nhận URL WebSocket bảo mật bắt đầu bằng wss:.",
  "settings.security.transports.url.invalid": "Nhập URL wss hợp lệ.",
  "settings.security.transports.url.label": "URL WebSocket",
  "settings.sparkAccount.enabled.label": "Bật tài khoản Spark",
  "settings.sparkAccount.advanced": "Tùy chọn nâng cao",
  "settings.sparkAccount.form.customDescription":
    "{appName} nhận thanh toán Spark vào ví của chính bạn.",
  "settings.sparkAccount.form.description":
    "{appName} tạo ví Spark này từ khóa khôi phục tài khoản của bạn.",
  "settings.sparkAccount.form.title": "Tài khoản Spark",
  "settings.sparkAccount.mnemonic.description":
    "Hãy giữ kín mnemonic này. Ai có nó đều truy cập được ví Spark.",
  "settings.sparkAccount.mnemonic.label": "Mnemonic của ví",
  "settings.sparkAccount.privacyMode.description":
    "Bật chế độ riêng tư của ví Spark cho thanh toán Lightning.",
  "settings.sparkAccount.privacyMode.label": "Bật chế độ riêng tư",
  "settings.sparkAccount.privacyMode.loadError":
    "Không tải được cài đặt chế độ riêng tư Spark.",
  "settings.sparkAccount.privacyMode.loading": "Đang tải chế độ riêng tư...",
  "settings.sparkAccount.syncPointer.description":
    "Mốc đồng bộ trên thiết bị cho việc quét lại lịch sử định kỳ. Nếu chưa có mốc, dùng ngày hôm nay; việc quét chỉ lùi lại 72 giờ từ mốc.",
  "settings.sparkAccount.syncPointer.invalid": "Nhập ngày hợp lệ.",
  "settings.sparkAccount.syncPointer.label": "Ngày đồng bộ gần nhất",
  "settings.sparkAccount.wallet.cancel": "Hủy",
  "settings.sparkAccount.wallet.change": "Đổi ví…",
  "settings.sparkAccount.wallet.changeDialog.current": "Ví này đang được dùng.",
  "settings.sparkAccount.wallet.changeDialog.description":
    "Chọn ví nhận các khoản Spark mới.",
  "settings.sparkAccount.wallet.changeDialog.inUse": "Đang dùng.",
  "settings.sparkAccount.wallet.changeDialog.invalid":
    "Đây không phải mnemonic 12 từ hợp lệ.",
  "settings.sparkAccount.wallet.changeDialog.title": "Đổi ví",
  "settings.sparkAccount.wallet.changeDialog.wordCount": "{value}/12 từ",
  "settings.sparkAccount.wallet.custom.description":
    "Ví Spark bạn mang đến bằng mnemonic 12 từ.",
  "settings.sparkAccount.wallet.custom.title": "Ví của riêng bạn",
  "settings.sparkAccount.wallet.label": "Ví",
  "settings.sparkAccount.wallet.payky.description":
    "Được tạo từ khóa khôi phục tài khoản của bạn.",
  "settings.sparkAccount.wallet.payky.title": "Ví {appName}",
  "settings.sparkAccount.wallet.switch": "Chuyển sang",
  "settings.sparkAccount.wallet.warning.funds":
    "Tiền vẫn ở ví hiện tại và không còn hiện ở đây. Hãy rút trước, hoặc giữ mnemonic của nó.",
  "settings.sparkAccount.wallet.warning.invoices":
    "Các hóa đơn chưa trả của ví hiện tại sẽ không còn được phát hiện.",
  "settings.supportChat.teamUnavailable":
    "Hiện không có hỗ trợ. Hãy kiểm tra kết nối rồi thử lại.",
  "settings.supportChat.inbox.unverified":
    "Chúng tôi không kiểm tra được nơi bộ phận hỗ trợ có thể trả lời bạn, nên có thể họ chưa trả lời được.",
  "settings.supportChat.inbox.publishFailed":
    "Bộ phận hỗ trợ chưa thể trả lời bạn: không đăng được danh sách relay nhận trả lời.",
  "settings.supportChat.inbox.publishAnyway": "Vẫn đăng",
  "settings.supportChat.inbox.confirm.title":
    "Vẫn đăng các relay nhận trả lời?",
  "settings.supportChat.inbox.confirm.description":
    "Nếu tài khoản của bạn đã có danh sách relay cho tin nhắn trực tiếp, ví dụ từ Linky, nó sẽ bị thay thế và tin nhắn gửi đến các relay trước đó có thể không còn đến bạn ở đó.",
  "settings.supportChat.inbox.confirm.confirm": "Đăng",
  "settings.supportChat.inbox.confirm.cancel": "Hủy",
  "settings.supportChat.title": "Liên hệ hỗ trợ",
  "settings.supportChat.description": "Trò chuyện với đội ngũ {appName}",
  "settings.supportChat.empty":
    "Chưa có tin nhắn. Hãy mô tả điều bạn cần giúp và đội ngũ {appName} sẽ trả lời ở đây.",
  "settings.supportChat.loadFailed":
    "Không tải được cuộc trò chuyện. Hãy kiểm tra kết nối rồi thử lại.",
  "settings.supportChat.retry": "Thử lại",
  "settings.supportChat.message.label": "Tin nhắn",
  "settings.supportChat.message.placeholder": "Viết tin nhắn…",
  "settings.supportChat.send": "Gửi",
  "settings.supportChat.sent": "Đã gửi",
  "settings.supportChat.sending": "Đang gửi…",
  "settings.supportChat.notDelivered": "Chưa gửi được. Thử lại",
  "settings.assistant.title": "Trợ lý AI",
  "settings.assistant.description":
    "Hỏi về đơn, thanh toán và cách {appName} hoạt động",
  "settings.assistant.empty":
    "Hãy hỏi về đơn và thanh toán của bạn, hoặc cách {appName} hoạt động. Trợ lý đọc dữ liệu trên thiết bị này và tài liệu của {appName}, rồi trả lời qua một nhà cung cấp AI.",
  "settings.assistant.emptyPublic":
    "Hãy hỏi cách {appName} hoạt động. Trợ lý đọc tài liệu và mã nguồn của {appName}, không đọc dữ liệu của bạn, rồi trả lời qua một nhà cung cấp AI.",
  "settings.assistant.suggestion.openBills": "Những đơn nào còn đang mở?",
  "settings.assistant.suggestion.latestPayments":
    "Các khoản thanh toán gần nhất của tôi là gì?",
  "settings.assistant.suggestion.today": "Hôm nay tôi thu được bao nhiêu?",
  "settings.assistant.suggestion.howSplit": "Tách đơn hoạt động thế nào?",
  "settings.assistant.suggestion.howRefund":
    "Làm sao để hoàn tiền một khoản thanh toán?",
  "settings.assistant.message.label": "Câu hỏi",
  "settings.assistant.message.placeholder": "Đặt câu hỏi…",
  "settings.assistant.send": "Gửi",
  "settings.assistant.stop": "Dừng",
  "settings.assistant.thinking": "Đang suy nghĩ…",
  "settings.assistant.lookingUp.data": "Đang xem dữ liệu của bạn…",
  "settings.assistant.lookingUp.docs": "Đang đọc tài liệu…",
  "settings.assistant.newConversation": "Cuộc trò chuyện mới",
  "settings.chat.scrollToLatest": "Đến tin nhắn mới nhất",
  "settings.assistant.stopped": "Đã dừng",
  "settings.assistant.failed": "Không trả lời được. Thử lại",
  "settings.support": "HỖ TRỢ VÀ THÔNG TIN",
  "catalog.tables.add": "Thêm bàn",
  "catalog.tables.delete": "Xóa bàn",
  "catalog.tables.delete.confirm.cancel": "Hủy",
  "catalog.tables.delete.confirm.confirm": "Xóa",
  "catalog.tables.delete.confirm.description":
    "Các đơn đã đóng vẫn lưu {name}, nhưng sẽ không thể gán cho đơn mới nữa.",
  "catalog.tables.delete.confirm.title": "Xóa {name}?",
  "catalog.tables.delete.hasOpenBills":
    "{name} vẫn còn đơn đang mở. Hãy đóng đơn hoặc chuyển sang bàn khác trước.",
  "catalog.tables.description": "Quản lý bàn và chỗ ngồi",
  "catalog.tables.empty.description":
    "Thêm các bàn trong quán để gán đơn cho chúng.",
  "catalog.tables.empty.title": "Chưa có bàn nào",
  "catalog.tables.emptySearch": "Không có bàn nào khớp.",
  "catalog.tables.form.card.description":
    "Tên và số chỗ tùy chọn hiện khi gán bàn này cho đơn.",
  "catalog.tables.form.card.title": "Chi tiết",
  "catalog.tables.form.code.description":
    "Chưa dùng — dành cho mã QR nhận diện bàn này trong tương lai.",
  "catalog.tables.form.code.label": "Mã",
  "catalog.tables.form.invalidId": "Mã bàn không hợp lệ.",
  "catalog.tables.form.name.invalid": "Nhập tên.",
  "catalog.tables.form.name.label": "Tên",
  "catalog.tables.form.name.placeholder": "vd. Bàn 5",
  "catalog.tables.form.notFound": "Bàn này không còn tồn tại.",
  "catalog.tables.form.save.create": "Thêm bàn",
  "catalog.tables.form.saved.create": "Đã thêm bàn.",
  "catalog.tables.form.seatCount.invalid": "Nhập số chỗ hợp lệ.",
  "catalog.tables.form.seatCount.label": "Số chỗ",
  "catalog.tables.form.seatCount.placeholder": "Không bắt buộc — vd. 4",
  "catalog.tables.form.title.create": "Thêm bàn",
  "catalog.tables.form.title.edit": "Sửa bàn",
  "catalog.tables.search": "Tìm bàn...",
  "catalog.tables.search.clear.aria": "Xóa tìm kiếm",
  "catalog.tables.seatCount": "{value} chỗ",
  "catalog.tables.title": "Bàn",
  "settings.taxRates.activate": "Kích hoạt lại {name}",
  "settings.taxRates.activate.confirm.cancel": "Hủy",
  "settings.taxRates.activate.confirm.confirm": "Kích hoạt lại",
  "settings.taxRates.activate.confirm.description":
    "{name} sẽ lại có thể chọn khi gán mức thuế cho mặt hàng.",
  "settings.taxRates.activate.confirm.title": "Kích hoạt lại {name}?",
  "settings.taxRates.active.title": "Đang dùng",
  "settings.taxRates.add": "Thêm mức thuế",
  "settings.taxRates.add.title": "Thêm mức thuế",
  "settings.taxRates.archive": "Lưu trữ {name}",
  "settings.taxRates.archive.confirm.cancel": "Hủy",
  "settings.taxRates.archive.confirm.confirm": "Lưu trữ",
  "settings.taxRates.archive.confirm.description":
    "{name} sẽ bị ẩn với mặt hàng mới. Mặt hàng hiện có vẫn giữ cho đến khi thay đổi. Bạn có thể kích hoạt lại sau.",
  "settings.taxRates.archive.confirm.title": "Lưu trữ {name}?",
  "settings.taxRates.archived.title": "Đã lưu trữ",
  "settings.taxRates.default.set": "Đặt {name} làm mặc định",
  "settings.taxRates.default.unset": "Bỏ {name} khỏi mặc định",
  "settings.taxRates.description":
    "Không thể sửa hay xóa mức thuế sau khi tạo — hãy lưu trữ thay vì đổi phần trăm, và thêm mức mới nếu mức thuế thay đổi.",
  "settings.taxRates.empty": "Chưa có mức thuế nào.",
  "settings.taxRates.keypad.description":
    "Mức VAT của số tiền nhập trên bàn phím số, được ghi trên biên lai Qerko. Nếu không có, biên lai không ghi VAT.",
  "settings.taxRates.keypad.label": "Mức VAT của số tiền nhập tay",
  "settings.taxRates.keypad.none": "Chưa đặt",
  "settings.taxRates.name.invalid": "Nhập tên.",
  "settings.taxRates.name.label": "Tên",
  "settings.taxRates.name.placeholder": "vd. Mức tiêu chuẩn",
  "settings.taxRates.rate.description":
    "Phần trăm, vd. 21 hoặc 12.5. Không thể thay đổi sau khi lưu.",
  "settings.taxRates.rate.invalid": "Nhập phần trăm từ 0 đến 100.",
  "settings.taxRates.rate.label": "Mức (%)",
  "settings.taxRates.rename": "Đổi tên {name}",
  "settings.taxRates.rename.input": "Tên mới cho {name}",
  "settings.taxRates.title": "Mức thuế",
  "settings.theme.dark.description": "Luôn dùng giao diện tối",
  "settings.theme.dark.title": "Tối",
  "settings.theme.light.description": "Luôn dùng giao diện sáng",
  "settings.theme.light.title": "Sáng",
  "settings.theme.mode.description":
    "Chọn giao diện cố định hoặc theo cài đặt thiết bị.",
  "settings.theme.mode.title": "Chế độ giao diện",
  "settings.theme.system.description": "Theo cài đặt hệ điều hành",
  "settings.theme.system.title": "Tự động",
  "settings.theme.title": "Giao diện",
  "settings.tips.enabled.description":
    "Khách có thể thêm tiền tip khi thanh toán.",
  "settings.tips.enabled.label": "Bật tiền tip",
  "settings.tips.fixedAmounts.add": "Thêm số tiền cố định",
  "settings.tips.fixedAmounts.description":
    "Khách có thể chọn các số tiền {currency} này khi thanh toán đơn.",
  "settings.tips.fixedAmounts.duplicate": "Số tiền này đã có trong danh sách.",
  "settings.tips.fixedAmounts.invalid":
    "Nhập số dương có tối đa hai chữ số thập phân.",
  "settings.tips.fixedAmounts.label": "Số tiền cố định đặt sẵn",
  "settings.tips.fixedAmounts.maximum":
    "Bạn có thể thêm tối đa bốn số tiền cố định.",
  "settings.tips.fixedAmounts.placeholder": "vd. 20.00",
  "settings.tips.form.description":
    "Thiết lập các lựa chọn tiền tip nhanh hiện khi thanh toán đơn.",
  "settings.tips.form.title": "Lựa chọn tiền tip",
  "settings.tips.percentages.add": "Thêm phần trăm",
  "settings.tips.percentages.description":
    "Khách có thể chọn các phần trăm này khi thanh toán đơn.",
  "settings.tips.percentages.duplicate": "Phần trăm này đã có trong danh sách.",
  "settings.tips.percentages.invalid": "Nhập phần trăm nguyên từ 1 đến 100.",
  "settings.tips.percentages.label": "Phần trăm đặt sẵn",
  "settings.tips.percentages.maximum": "Bạn có thể thêm tối đa bốn phần trăm.",
  "settings.tips.percentages.placeholder": "vd. 15",
  "settings.tips.percentages.value": "{value}%",
  "settings.tips.preset.remove": "Xóa {value}",
  "settings.tips.preset.removeLabel": "Xóa",
  "settings.tips.removeConfirm.title": "Xóa {value}?",
  "settings.tips.removeConfirm.description":
    "Khách sẽ không còn thấy lựa chọn này khi thanh toán.",
  "settings.tips.removeConfirm.confirm": "Xóa",
  "settings.tips.removeConfirm.cancel": "Hủy",
  "settings.tips.resetConfirm.title": "Đặt lại lựa chọn tiền tip?",
  "settings.tips.resetConfirm.description":
    "Các phần trăm và số tiền cố định của bạn sẽ được thay bằng mặc định.",
  "settings.tips.resetConfirm.confirm": "Đặt lại",
  "settings.tips.resetConfirm.cancel": "Hủy",
  "settings.tips.reset": "Đặt lại mặc định",
  "settings.tips.save": "Lưu tiền tip",
  "settings.tips.saved": "Đã lưu cài đặt tiền tip.",
  "settings.tips.title": "Tiền tip",
  "settings.title": "Cài đặt",
  "settings.withdrawals.description":
    "Gửi bitcoin từ tài khoản Spark qua on-chain hoặc Lightning",
  "settings.withdrawals.title": "Rút tiền",
  "settings.taxesGroup": "THUẾ VÀ CHỨNG TỪ",
  "settings.tips.nav.on": "Bật",
  "settings.tips.nav.off": "Tắt",
  "settings.paymentAccounts.nav.none": "Không có",
  "settings.taxRates.nav.description": "Mức VAT cho các mặt hàng",
  "access.action.acknowledgeExcess": "Xác nhận khoản trả thừa",
  "access.action.addDiscount": "Thêm giảm giá vào đơn",
  "access.action.moveDiscount": "Chuyển giảm giá sang đơn khác",
  "access.action.aiAccess": "Thay đổi quyền dữ liệu của AI",
  "access.action.serviceProxy": "Thay đổi proxy cho dịch vụ đã kết nối",
  "access.action.cashuMints": "Thay đổi các mint Cashu",
  "access.action.moveCashuFunds": "Chuyển tiền giữa các mint",
  "access.action.cancelPayment": "Hủy thanh toán",
  "access.action.changePin": "Đổi mã PIN",
  "access.action.confirmClosedDespiteCancellation":
    "Đánh dấu đơn đã hủy là đã đóng",
  "access.action.confirmPaidDespiteCancellation":
    "Đánh dấu khoản thanh toán đã hủy là đã trả",
  "access.action.createItem": "Tạo mặt hàng",
  "access.action.disable": "Tắt kiểm soát truy cập",
  "access.action.exportDatabase": "Xuất cơ sở dữ liệu ứng dụng",
  "access.action.revealRecoveryPhrase": "Hiện cụm từ khôi phục",
  "access.action.deletePayment": "Xóa khoản thanh toán",
  "access.action.sendLogToSupport": "Gửi nhật ký cho bộ phận hỗ trợ",
  "access.action.discardBill": "Hủy đơn",
  "access.action.enable": "Bật kiểm soát truy cập bằng mã PIN hiện tại",
  "access.action.finishBill": "Hoàn tất đơn không cần thanh toán",
  "access.action.markCashPaid": "Xác nhận đã nhận tiền mặt",
  "access.action.markIbanPaid": "Xác nhận chuyển khoản đã đến",
  "access.action.removeAccount": "Xóa tài khoản khỏi thiết bị này",
  "access.action.removeLines": "Xóa mặt hàng khỏi đơn",
  "access.action.switchAccount": "Chuyển tài khoản",
  "access.action.unblock": "Bỏ chặn thiết bị",
  "access.action.withdraw": "Rút tiền",
  "access.attempts.continue": "Tiếp tục",
  "access.attempts.title":
    "Số lần nhập sai PIN trên thiết bị này kể từ lần đúng gần nhất: {count}",
  "access.cancel": "Hủy",
  "access.changePin": "Đổi mã PIN",
  "access.description":
    "Một mã PIN của chủ khóa cài đặt và các thao tác rủi ro. Mỗi thiết bị giữ các quyền bạn cấp; mã PIN mở khóa mọi thứ khác. Cách này ngăn nhân viên và khách ở quầy — không phải là bảo vệ trước kẻ tấn công.",
  "access.device.adminWarning":
    "Với quyền Chủ, thiết bị này không cần mã PIN cho việc gì, trừ đổi mã PIN, tắt kiểm soát truy cập và bỏ chặn thiết bị.",
  "access.device.blocked": "Mã PIN bị chặn",
  "access.device.name": "Tên thiết bị",
  "access.device.permissions": "Quyền",
  "access.device.permissions.description":
    "Thiết bị này được làm gì mà không cần mã PIN. Chọn mẫu có sẵn rồi điều chỉnh.",
  "access.device.preset": "Quyền của {name}",
  "access.device.remove": "Xóa",
  "access.device.remove.confirm": "Xóa thiết bị",
  "access.device.remove.description":
    "Thiết bị sẽ bị đăng xuất khỏi tài khoản ngay khi kết nối lại và các quyền của nó bị xóa.",
  "access.device.remove.title": "Xóa {name}?",
  "access.device.rename": "Đổi tên",
  "access.device.this": "Thiết bị này",
  "access.device.unblock": "Bỏ chặn",
  "access.devices.add": "Thêm thiết bị",
  "access.devices.description":
    "Các thiết bị của tài khoản này và những gì mỗi thiết bị được làm mà không cần mã PIN. Thiết bị hiện ra sau khi đã đồng bộ.",
  "access.devices.title": "Thiết bị",
  "access.newPin.description":
    "4–8 chữ số. Đừng dùng lại mã PIN của thẻ ngân hàng hay điện thoại: mã băm của nó được lưu trên mọi thiết bị của tài khoản này và trong mọi bản xuất cơ sở dữ liệu.",
  "access.newPin.label": "Mã PIN mới",
  "access.newPin.mismatch": "Hai mã PIN không khớp.",
  "access.newPin.repeat": "Nhập lại mã PIN",
  "access.permission.activity": "Lịch sử",
  "access.permission.activity.description":
    "Lịch sử thanh toán và đơn, chi tiết thanh toán, gửi lại EET, trợ lý AI",
  "access.permission.admin": "Quản trị",
  "access.permission.admin.description":
    "Tài khoản thanh toán, tài khoản, hồ sơ, bảo mật, EET, xuất dữ liệu, console gỡ lỗi, quyền dữ liệu của AI, kiểm soát truy cập",
  "access.permission.catalog": "Danh sách hàng",
  "access.permission.catalog.description":
    "Mặt hàng, danh mục và bàn, cùng việc tạo mặt hàng từ đơn",
  "access.permission.confirm": "Xác nhận thanh toán",
  "access.permission.confirm.description":
    "Xác nhận thủ công đã nhận tiền mặt hoặc chuyển khoản",
  "access.permission.discard": "Hủy bỏ",
  "access.permission.discard.description":
    "Hủy đơn, xóa mặt hàng khỏi đơn, hủy thanh toán",
  "access.permission.refund": "Hoàn tiền",
  "access.permission.refund.description":
    "Hoàn tiền và xác nhận khoản trả thừa",
  "access.permission.sell": "Bán hàng",
  "access.permission.sell.description":
    "Trang chủ, đơn, tách đơn, thanh toán và tiền tip",
  "access.permission.settings": "Cài đặt",
  "access.permission.settings.description":
    "Thông tin cửa hàng, thuế, dãy số, tiền tip, trang chủ, trò chuyện hỗ trợ",
  "access.permission.stats": "Thống kê",
  "access.permission.stats.description":
    "Thống kê doanh số: doanh thu, phương thức thanh toán, mặt hàng bán chạy, tiền mặt dự kiến",
  "access.phrase.back": "Quay lại mã PIN",
  "access.phrase.description":
    "Cụm từ khôi phục của tài khoản mở khóa mọi thứ trên thiết bị này và gỡ chặn mã PIN.",
  "access.phrase.label": "Cụm từ khôi phục",
  "access.phrase.setNewPin": "Đặt mã PIN mới",
  "access.phrase.submit": "Mở khóa",
  "access.phrase.warning":
    "Nhập cụm từ khôi phục ở quầy có thể để lộ trước camera và người xung quanh. Nó mở toàn bộ tài khoản. Tốt hơn là bỏ chặn từ thiết bị khác trong Cài đặt → Thiết bị.",
  "access.phrase.wrong": "Đây không phải cụm từ khôi phục của tài khoản này.",
  "access.pin.blocked.description":
    "Nhập sai mã PIN quá nhiều lần. Chủ có thể bỏ chặn thiết bị này từ thiết bị khác trong Cài đặt → Thiết bị, hoặc bằng cụm từ khôi phục tại đây. Trong lúc đó thiết bị vẫn giữ các quyền riêng.",
  "access.pin.blocked.title": "Thiết bị này bị chặn nhập mã PIN",
  "access.pin.cancel": "Hủy",
  "access.pin.entered": "Số chữ số đã nhập: {count}",
  "access.pin.erase": "Xóa chữ số",
  "access.pin.forgot": "Quên mã PIN",
  "access.pin.help":
    "Không biết mã PIN? Hãy nhờ chủ nhập, hoặc cho phép {permission} trên thiết bị này.",
  "access.pin.submit": "OK",
  "access.pin.title": "Nhập mã PIN",
  "access.pin.why.action": "{action} cần mã PIN",
  "access.pin.why.route": "Màn hình này cần quyền {permission}",
  "access.pin.wrong":
    "Sai mã PIN. Số lần còn lại trước khi thiết bị bị chặn: {count}",
  "access.preset.basic": "Cơ bản",
  "access.preset.custom": "Tùy chỉnh",
  "access.preset.manager": "Quản lý",
  "access.preset.none": "Không có",
  "access.preset.owner": "Chủ",
  "access.preset.shiftLead": "Trưởng ca",
  "access.preset.staff": "Nhân viên",
  "access.save": "Lưu",
  "access.status.off": "Kiểm soát truy cập đang tắt",
  "access.status.on": "Kiểm soát truy cập đang bật",
  "access.turnOff": "Tắt",
  "access.turnOn": "Bật",
  "access.webWarning":
    "Trong trình duyệt máy tính, khóa này chỉ mang tính hình thức: ai mở công cụ nhà phát triển đều vượt qua được. Nó chỉ có ý nghĩa trong ứng dụng Android, tốt nhất ở chế độ kiosk.",
  "access.wizard.back": "Quay lại",
  "access.wizard.devices.description":
    "Mỗi thiết bị được làm gì mà không cần mã PIN. Thiết bị chưa đồng bộ không có trong danh sách và bắt đầu không có quyền nào.",
  "access.wizard.devices.title": "Quyền mặc định của thiết bị",
  "access.wizard.keepPin": "Dùng mã PIN hiện tại",
  "access.wizard.next": "Tiếp",
  "access.wizard.noPin": "Hãy đặt mã PIN mới; hiện chưa có.",
  "access.wizard.pin.description":
    "Mã PIN của chủ mở khóa mọi thứ. Chỉ chủ nên biết.",
  "access.wizard.pin.title": "Mã PIN của chủ",
  "settings.paymentAccounts.method.lightningAddress": "Địa chỉ Lightning",
  "settings.paymentAccounts.status.missingLightningAddress":
    "Chưa đặt địa chỉ Lightning",
  "settings.lightningAddress.enabled.label":
    "Nhận thanh toán vào địa chỉ Lightning",
  "settings.lightningAddress.form.title": "Ví của riêng bạn",
  "settings.lightningAddress.form.description":
    "Tiền về thẳng ví đứng sau địa chỉ. {appName} chỉ xin ví hóa đơn và theo dõi hóa đơn đã được trả chưa; không giữ khóa hay tiền.",
  "settings.lightningAddress.address.label": "Địa chỉ Lightning",
  "settings.lightningAddress.address.placeholder": "ten@wallet.com",
  "settings.lightningAddress.address.description":
    "Ví phải hỗ trợ LUD-21 verify và cung cấp bằng chứng thanh toán (preimage). Nếu không, {appName} không biết được khoản thanh toán đã được trả.",
  "settings.lightningAddress.address.required": "Nhập địa chỉ Lightning.",
  "settings.lightningAddress.address.invalid":
    "Đây không phải địa chỉ Lightning. Địa chỉ có dạng ten@wallet.com.",
  "settings.lightningAddress.submit": "Kiểm tra và lưu",
  "settings.lightningAddress.saved": "Đã lưu.",
  "settings.lightningAddress.error.verifyUnsupported":
    "Ví này không cho {appName} kiểm tra hóa đơn đã được trả chưa (LUD-21 verify). Hãy dùng ví khác.",
  "settings.lightningAddress.error.rejected":
    "Ví từ chối yêu cầu. Hãy kiểm tra địa chỉ.",
  "settings.lightningAddress.error.unreachable":
    "Không kết nối được ví. Hãy kiểm tra địa chỉ và kết nối.",
  "settings.lightningAddress.error.invalid":
    "Ví phản hồi nội dung mà {appName} không dùng được.",
  "settings.paymentAccounts.method.bitcoin": "Bitcoin",
  "settings.bitcoin.enabled.label": "Nhận Bitcoin",
  "settings.bitcoin.wallet.spark": "Spark",
  "settings.bitcoin.wallet.linky": "Ví Linky",
  "settings.salesGroup": "BÁN HÀNG",
  "catalog.items.form.category.search": "Tìm hoặc thêm danh mục",
  "catalog.items.form.category.add": "Thêm “{name}”",
  "catalog.items.form.category.edit.aria": "Sửa danh mục {name}",
  "catalog.items.form.category.edit.name": "Tên danh mục",
  "catalog.categories.form.name.taken": "Danh mục khác đã có tên này.",
  "catalog.categories.form.save.edit": "Lưu",
  "catalog.categories.form.cancel": "Hủy",
  "catalog.library.suggestionsLabel": "Gợi ý từ thư viện sản phẩm",
  "catalog.library.addAlso": "Thêm cả",
  "catalog.library.addAlso.description":
    "Mở mặt hàng mới điền sẵn từ thư viện; giá do bạn đặt.",
  "catalog.library.linked": "Từ thư viện: {name}",
  "catalog.library.unlink": "Bỏ liên kết với thư viện",
  "catalog.library.dismiss": "Bỏ qua",
  "settings.paymentAccounts.status.nativeOnly": "Chỉ có trong ứng dụng gốc",
  "settings.cashuAccount.balance.switchUnit": "Đổi đơn vị",
  "settings.fiat.czk.symbol": "Kč",
  "settings.fiat.eur.symbol": "€",
  "settings.fiat.usd.symbol": "$",
  "settings.profile.vatPayer": "Người nộp VAT",
  "settings.bitcoin.mainMethod": "Phương thức chính",
  "settings.cashuAccount.qr.title": "Mã QR thanh toán",
  "settings.cashuAccount.qr.both": "Cả hai",
  "settings.cashuAccount.qr.cashu": "Cashu",
  "settings.cashuAccount.qr.lightning": "Lightning",
  "accountShare.title": "Yêu cầu tài khoản",
  "accountShare.caller": "{caller} yêu cầu tài khoản này",
  "accountShare.claimed": "Ứng dụng tự gọi là “{claimed}”.",
  "accountShare.mismatch.title": "Tên không khớp",
  "accountShare.mismatch.description":
    "Android cho biết đây là {caller}, nhưng yêu cầu tự nhận đến từ “{claimed}”. Chỉ chấp thuận yêu cầu do chính bạn bắt đầu, trong ứng dụng bạn tin tưởng.",
  "accountShare.code.instructions": "Hãy kiểm tra {caller} hiện cùng một mã:",
  "accountShare.account": "Tài khoản chia sẻ: {name}",
  "accountShare.warning.title": "Toàn quyền truy cập tài khoản",
  "accountShare.warning.description":
    "Khi chấp thuận, bạn cho ứng dụng này toàn quyền truy cập tài khoản và tiền trong đó. Bộ phận hỗ trợ {appName} không bao giờ yêu cầu bạn việc này.",
  "accountShare.validFor": "Còn hiệu lực {time}",
  "accountShare.approve": "Chấp thuận",
  "accountShare.reject": "Từ chối",
  "accountShare.expired":
    "Yêu cầu đã hết hạn hoặc bị thay bằng yêu cầu khác. Hãy bắt đầu lại trong ứng dụng đã yêu cầu.",
  "accountShare.none": "Không có yêu cầu tài khoản nào cần trả lời.",
  "settings.cardClosure.title": "Chốt sổ máy POS",
  "settings.cardClosure.action": "Chốt sổ",
  "access.action.closeCardBatch": "Chốt sổ máy POS",
  "settings.cardClosure.confirm.title": "Chốt sổ máy POS?",
  "settings.cardClosure.confirm.description":
    "Các khoản thanh toán thẻ kể từ lần chốt trước sẽ được gửi đi quyết toán.",
  "settings.cardClosure.confirm.cancel": "Hủy",
  "settings.cardClosure.thisTerminal.title": "Máy POS này",
  "settings.cardClosure.thisTerminal.description":
    "Chốt sổ sẽ gửi các khoản thanh toán thẻ nhận trên máy POS này đi quyết toán. Hãy chốt mỗi ngày sau khi hết ca.",
  "settings.cardClosure.thisTerminal.last": "Lần chốt gần nhất",
  "settings.cardClosure.thisTerminal.never": "Chưa chốt lần nào",
  "settings.cardClosure.result.title": "Tóm tắt",
  "settings.cardClosure.result.payments": "Thanh toán (gồm tiền tip)",
  "settings.cardClosure.result.refunds": "Thanh toán đã hoàn",
  "settings.cardClosure.result.adjustments": "Điều chỉnh thanh toán",
  "settings.cardClosure.result.countAndAmount": "{count}× · {amount}",
  "settings.cardClosure.result.batch": "Số lô",
  "settings.cardClosure.result.shift": "Số ca",
  "settings.cardClosure.result.terminalTime": "Giờ trên máy POS",
  "settings.cardClosure.result.batchAndShift": "Lô {batch}, ca {shift}",
  "settings.cardClosure.terminals.title": "Tất cả máy POS",
  "settings.cardClosure.terminals.description":
    "Chỉ có thể chốt sổ ngay trên chính máy POS.",
  "settings.cardClosure.terminals.notClosedToday": "Hôm nay chưa chốt",
  "settings.cardClosure.terminals.closedToday": "Hôm nay đã chốt",
  "settings.cardClosure.terminals.thisDevice": "Thiết bị này",
  "settings.cardClosure.terminals.unknownDevice": "Thiết bị không xác định",
  "settings.cardClosure.terminals.empty": "Chưa có lần chốt sổ nào.",
  "settings.cardClosure.detail.title": "Chi tiết chốt sổ",
  "settings.cardClosure.detail.notFound": "Không tìm thấy lần chốt sổ.",
  "settings.cardClosure.result.device": "Máy POS",
  "settings.cardClosure.history.title": "Lịch sử chốt sổ",
  "settings.cardClosure.history.empty": "Chưa có lần chốt sổ nào",
  "settings.cardClosure.error.failed":
    "Chốt sổ không thành công. Hãy thử lại hoặc kiểm tra trong ứng dụng SwitchioPay.",
  "settings.cardClosure.error.busy":
    "Máy POS đang xử lý thao tác khác. Hãy hoàn tất rồi thử lại.",
  "settings.cardClosure.error.demo":
    "Không thể chốt sổ máy POS thật trong tài khoản demo.",
  "settings.cardClosure.error.unavailable":
    "Ứng dụng SwitchioPay không có trên thiết bị này.",
  "settings.cardClosure.error.accountMissing": "Thanh toán thẻ chưa được bật.",
  "settings.cardClosure.error.unknown":
    "Chúng tôi không biết việc chốt sổ có thành công không. Hãy kiểm tra trong ứng dụng SwitchioPay.",
  "settings.cardClosure.restored.closed": "Đã chốt sổ máy POS.",
  "settings.cardClosure.restored.unanswered":
    "Lần chốt sổ máy POS không nhận được phản hồi từ SwitchioPay. Hãy kiểm tra trong ứng dụng SwitchioPay xem lô đã được chốt chưa.",
  "settings.cardClosure.restored.unresolved":
    "Không đọc được kết quả chốt sổ. Hãy kiểm tra trong ứng dụng SwitchioPay.",
  "settings.cardSwitchioAccount.closureLink": "Chốt sổ máy POS",
  "devices.title": "Thiết bị",
  "devices.nav.description":
    "Các thiết bị của tài khoản này và những gì mỗi thiết bị được làm mà không cần mã PIN",
  "devices.removedHere": "Thiết bị này đã bị xóa khỏi {name}.",
  "access.action.removeDevice": "Xóa thiết bị",
  "settings.backup.title": "Sao lưu",
  "settings.backup.description": "Cụm từ khôi phục của tài khoản này",
  "settings.backends.title": "Máy chủ đồng bộ",
  "settings.backends.description": "Các máy chủ mà tài khoản này đồng bộ qua",
  "settings.accounts.add.description":
    "Mở cửa hàng mới hoặc mở tài khoản bạn đã có",
  "settings.accounts.remove.confirm.otherDevices":
    "Thiết bị này sẽ quên tài khoản. Tài khoản vẫn còn trên các thiết bị khác.",
  "settings.accounts.remove.backupFirst.title":
    "Hãy sao lưu cụm từ khôi phục trước",
  "settings.accounts.remove.backupFirst.description":
    "{name} không có trên thiết bị nào khác và cụm từ khôi phục chưa được sao lưu. Nếu xóa bây giờ, tài khoản sẽ mất vĩnh viễn.",
  "settings.accounts.remove.backupFirst.confirm": "Sao lưu",
} satisfies Record<keyof typeof enSettings, string>
