package fit.finito.secp256k1

import java.security.SecureRandom

/** The JNI functions of `src/main/cpp/finito-secp256k1.c`. */
internal object FinitoSecp256k1Native {
  init {
    System.loadLibrary("finito_secp256k1")
    check(init(ByteArray(32).also { SecureRandom().nextBytes(it) })) {
      "libsecp256k1 failed to start."
    }
  }

  @JvmStatic private external fun init(seed: ByteArray): Boolean

  @JvmStatic external fun publicKey(privateKey: ByteArray): ByteArray?

  @JvmStatic external fun multiply(point: ByteArray, scalar: ByteArray): ByteArray?

  @JvmStatic external fun add(a: ByteArray, b: ByteArray): ByteArray?

  @JvmStatic external fun decompress(point: ByteArray): ByteArray?
}
