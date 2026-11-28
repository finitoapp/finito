package fit.finito.qr

import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import com.google.zxing.qrcode.encoder.Encoder
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * A QR's dark modules as one SVG path, encoded by ZXing: version, mode and
 * mask, the mask scored over all eight as the standard asks, in compiled
 * code. In Hermes the same mask search took a PAX A920Pro's JS thread
 * 0.85-1.4 s for a Lightning invoice; ZXing takes 30-45 ms.
 *
 * Each run of dark modules in a row is one rectangle (`M x y h w v1 H x z`),
 * so the path the SVG parses is about half as long as one square a module.
 */
class FinitoQrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FinitoQr")

    Function("qrPath") { text: String ->
      // No CHARACTER_SET hint: with one ZXing writes an ECI header, which
      // the JS encoder never did. JS sends only ASCII text here.
      val matrix = Encoder.encode(text, ErrorCorrectionLevel.M).matrix
      val size = matrix.width
      val path = StringBuilder()
      for (y in 0 until size) {
        var x = 0
        while (x < size) {
          if (matrix.get(x, y).toInt() != 1) {
            x++
            continue
          }
          var end = x
          while (end < size && matrix.get(end, y).toInt() == 1) end++
          path.append('M').append(x).append(' ').append(y)
            .append('h').append(end - x).append("v1H").append(x).append('z')
          x = end
        }
      }
      mapOf("size" to size, "path" to path.toString())
    }
  }
}
