package fit.finito.secp256k1

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * libsecp256k1 for the Spark SDK's noble secp256k1
 * (`src/platform/spark-secp256k1.ts`): its point operations, synchronous, as
 * noble's own are. Every point comes back uncompressed (`04 ‖ x ‖ y`), and a
 * key, scalar or point libsecp256k1 rejects throws, which leaves the
 * operation to noble.
 *
 * Built here from Bitcoin Core's source (`CMakeLists.txt`) with only what
 * these three functions need, ~0.1 MB per ABI where a prebuilt library with
 * its full tables took 1.3 MB. On the PAX A920Pro each call takes under a
 * millisecond from JS, where OpenSSL through Quick Crypto took 4.8 ms for
 * `key⋅G` and 38 ms for `k⋅P`.
 */
class FinitoSecp256k1Module : Module() {
  override fun definition() = ModuleDefinition {
    Name("FinitoSecp256k1")

    // key⋅G
    Function("publicKey") { privateKey: ByteArray ->
      rejectedIfNull(FinitoSecp256k1Native.publicKey(privateKey))
    }

    // scalar⋅point
    Function("multiply") { point: ByteArray, scalar: ByteArray ->
      rejectedIfNull(FinitoSecp256k1Native.multiply(point, scalar))
    }

    Function("decompress") { point: ByteArray ->
      rejectedIfNull(FinitoSecp256k1Native.decompress(point))
    }
  }

  private fun rejectedIfNull(point: ByteArray?): ByteArray =
    point ?: throw IllegalArgumentException("libsecp256k1 rejected the input.")
}
