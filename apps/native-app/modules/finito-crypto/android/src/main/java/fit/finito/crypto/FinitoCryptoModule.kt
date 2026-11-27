package fit.finito.crypto

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.os.Build
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.RSAKeyGenParameterSpec
import java.security.spec.X509EncodedKeySpec
import java.math.BigInteger
import javax.crypto.Mac
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * The cryptography Finito needs natively, from Android's own provider
 * (Conscrypt, BoringSSL underneath), so the app ships no crypto library of
 * its own for it: hashes, HMAC, PBKDF2 and RSA PKCS#1 v1.5 signatures with
 * SHA-256, and base64 decoding. `src/platform/native-subtle.ts` builds the global
 * `crypto.subtle` from it and `src/platform/eet-crypto.ts` EET's backend.
 *
 * Hash names are Web Crypto's: SHA-1, SHA-256, SHA-384 and SHA-512. Every
 * function but `pbkdf2Async` is synchronous, and each throws for input the
 * provider rejects.
 */
class FinitoCryptoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FinitoCrypto")

    Function("digest") { hash: String, data: ByteArray ->
      digests.get()!!.getOrPut(hash) { MessageDigest.getInstance(digestName(hash)) }.digest(data)
    }

    Function("hmac") { hash: String, key: ByteArray, data: ByteArray ->
      mac(hash, key).doFinal(data)
    }

    Function("pbkdf2") { hash: String, password: ByteArray, salt: ByteArray, iterations: Int, length: Int ->
      pbkdf2(hash, password, salt, iterations, length)
    }

    // The same off the JS thread, for Web Crypto's asynchronous deriveBits:
    // the PIN hash's 30 000 iterations take ~0.45 s on a payment terminal.
    AsyncFunction("pbkdf2Async") { hash: String, password: ByteArray, salt: ByteArray, iterations: Int, length: Int ->
      pbkdf2(hash, password, salt, iterations, length)
    }

    // Standard base64 (RFC 4648, whitespace and missing padding tolerated) to
    // bytes; throws for any other character, URL-safe ones included. The
    // Spark SDK's gRPC answers arrive base64-encoded, and decoding them in JS
    // took ~100 times as long on a payment terminal.
    Function("base64Decode") { text: String ->
      android.util.Base64.decode(text, android.util.Base64.DEFAULT)
    }

    // RSASSA-PKCS1-v1_5 with SHA-256.
    Function("rsaSign") { pkcs8: ByteArray, data: ByteArray ->
      Signature.getInstance("SHA256withRSA").run {
        initSign(KeyFactory.getInstance("RSA").generatePrivate(PKCS8EncodedKeySpec(pkcs8)))
        update(data)
        sign()
      }
    }

    Function("rsaVerify") { spki: ByteArray, data: ByteArray, signature: ByteArray ->
      Signature.getInstance("SHA256withRSA").run {
        initVerify(KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(spki)))
        update(data)
        verify(signature)
      }
    }

    // Throws unless the DER is an RSA key of the format given.
    Function("rsaCheckKey") { format: String, der: ByteArray ->
      val factory = KeyFactory.getInstance("RSA")
      when (format) {
        "pkcs8" -> factory.generatePrivate(PKCS8EncodedKeySpec(der))
        "spki" -> factory.generatePublic(X509EncodedKeySpec(der))
        else -> throw IllegalArgumentException("Unknown key format $format")
      }
      Unit
    }

    Function("rsaGenerate") { modulusLength: Int, publicExponent: ByteArray ->
      val pair = KeyPairGenerator.getInstance("RSA").run {
        initialize(RSAKeyGenParameterSpec(modulusLength, BigInteger(1, publicExponent)))
        generateKeyPair()
      }
      mapOf("pkcs8" to pair.private.encoded, "spki" to pair.public.encoded)
    }
  }

  // Looking an algorithm up in the provider costs about a millisecond on a
  // payment terminal, more than computing a short hash or HMAC, so each
  // thread keeps one instance per algorithm, reset by every use.
  private val digests = ThreadLocal.withInitial { HashMap<String, MessageDigest>() }
  private val macs = ThreadLocal.withInitial { HashMap<String, Mac>() }

  private fun digestName(hash: String) = when (hash) {
    "SHA-1", "SHA-256", "SHA-384", "SHA-512" -> hash
    else -> throw IllegalArgumentException("Unsupported hash $hash")
  }

  // HMAC pads its key with zeros, so an empty key, which SecretKeySpec
  // rejects, is the same as a single zero byte.
  private fun mac(hash: String, key: ByteArray): Mac =
    macs.get()!!.getOrPut(hash) { Mac.getInstance(macName(hash)) }.apply {
      init(SecretKeySpec(if (key.isEmpty()) ByteArray(1) else key, algorithm))
    }

  private fun macName(hash: String) = "Hmac" + digestName(hash).replace("-", "")

  // RFC 8018's PBKDF2. The provider's SecretKeyFactory runs it natively, but
  // takes the password as chars, which match its bytes only for ASCII, and
  // offers SHA-2 only from API 26; anything else runs the loop here, which
  // calls into the provider for every iteration.
  private fun pbkdf2(hash: String, password: ByteArray, salt: ByteArray, iterations: Int, length: Int): ByteArray {
    require(iterations > 0 && length > 0)
    val ascii = password.isNotEmpty() && password.all { it in 1..127 }
    if (ascii && (Build.VERSION.SDK_INT >= 26 || hash == "SHA-1")) {
      val spec = PBEKeySpec(CharArray(password.size) { password[it].toInt().toChar() }, salt, iterations, length * 8)
      try {
        return SecretKeyFactory.getInstance("PBKDF2With" + macName(hash)).generateSecret(spec).encoded
      } finally {
        spec.clearPassword()
      }
    }
    val mac = mac(hash, password)
    val size = mac.macLength
    val out = ByteArray(length)
    val u = ByteArray(size)
    val t = ByteArray(size)
    var block = 1
    var offset = 0
    while (offset < length) {
      mac.update(salt)
      mac.update(byteArrayOf((block ushr 24).toByte(), (block ushr 16).toByte(), (block ushr 8).toByte(), block.toByte()))
      mac.doFinal(u, 0)
      u.copyInto(t)
      for (i in 1 until iterations) {
        mac.update(u)
        mac.doFinal(u, 0)
        for (j in 0 until size) t[j] = (t[j].toInt() xor u[j].toInt()).toByte()
      }
      t.copyInto(out, offset, 0, minOf(size, length - offset))
      offset += size
      block++
    }
    return out
  }
}
