package fit.finito.secp256k1

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import fr.acinq.secp256k1.Secp256k1

/**
 * libsecp256k1 for the Spark SDK's noble secp256k1
 * (`src/platform/spark-secp256k1.ts`): its point operations, synchronous, as
 * noble's own are. Every point comes back uncompressed (`04 ‖ x ‖ y`), and a
 * key, scalar or point libsecp256k1 rejects throws, which leaves the
 * operation to noble.
 *
 * On the PAX A920Pro each call takes 0.6-0.9 ms from JS, where OpenSSL
 * through Quick Crypto took 4.8 ms for `key⋅G` and 38 ms for `k⋅P`.
 */
class FinitoSecp256k1Module : Module() {
  private val secp256k1 = Secp256k1.get()

  override fun definition() = ModuleDefinition {
    Name("FinitoSecp256k1")

    // key⋅G
    Function("publicKey") { privateKey: ByteArray ->
      secp256k1.pubkeyCreate(privateKey)
    }

    // scalar⋅point
    Function("multiply") { point: ByteArray, scalar: ByteArray ->
      secp256k1.pubKeyTweakMul(point, scalar)
    }

    Function("decompress") { point: ByteArray -> secp256k1.pubkeyParse(point) }
  }
}
