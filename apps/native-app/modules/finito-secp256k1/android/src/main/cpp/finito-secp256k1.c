// The JNI half of modules/finito-secp256k1: libsecp256k1's key creation,
// point multiplication, addition and parsing, each returning the uncompressed
// point (65 bytes), or null for input libsecp256k1 rejects.
#include <jni.h>
#include <stddef.h>

#include "secp256k1.h"

static secp256k1_context *context = NULL;

static jbyteArray serialize(JNIEnv *env, const secp256k1_pubkey *point) {
  unsigned char out[65];
  size_t length = sizeof(out);
  if (!secp256k1_ec_pubkey_serialize(context, out, &length, point,
                                     SECP256K1_EC_UNCOMPRESSED))
    return NULL;
  jbyteArray result = (*env)->NewByteArray(env, (jsize)length);
  if (result != NULL)
    (*env)->SetByteArrayRegion(env, result, 0, (jsize)length,
                               (const jbyte *)out);
  return result;
}

// Copies a Java byte array of exactly `length` bytes into `out`.
static int copy(JNIEnv *env, jbyteArray array, unsigned char *out,
                jsize length) {
  if (array == NULL || (*env)->GetArrayLength(env, array) != length) return 0;
  (*env)->GetByteArrayRegion(env, array, 0, length, (jbyte *)out);
  return 1;
}

static int parse(JNIEnv *env, jbyteArray array, secp256k1_pubkey *point) {
  unsigned char bytes[65];
  if (array == NULL) return 0;
  jsize length = (*env)->GetArrayLength(env, array);
  if (length != 33 && length != 65) return 0;
  (*env)->GetByteArrayRegion(env, array, 0, length, (jbyte *)bytes);
  return secp256k1_ec_pubkey_parse(context, point, bytes, (size_t)length);
}

// Randomizes the context against side channels, once, before any other call.
JNIEXPORT jboolean JNICALL Java_fit_finito_secp256k1_FinitoSecp256k1Native_init(
    JNIEnv *env, jclass type, jbyteArray seed) {
  unsigned char bytes[32];
  if (context == NULL)
    context = secp256k1_context_create(SECP256K1_CONTEXT_NONE);
  return context != NULL && copy(env, seed, bytes, 32) &&
         secp256k1_context_randomize(context, bytes);
}

JNIEXPORT jbyteArray JNICALL
Java_fit_finito_secp256k1_FinitoSecp256k1Native_publicKey(JNIEnv *env,
                                                          jclass type,
                                                          jbyteArray key) {
  unsigned char secret[32];
  secp256k1_pubkey point;
  if (!copy(env, key, secret, 32) ||
      !secp256k1_ec_pubkey_create(context, &point, secret))
    return NULL;
  return serialize(env, &point);
}

JNIEXPORT jbyteArray JNICALL
Java_fit_finito_secp256k1_FinitoSecp256k1Native_multiply(JNIEnv *env,
                                                         jclass type,
                                                         jbyteArray point,
                                                         jbyteArray scalar) {
  unsigned char tweak[32];
  secp256k1_pubkey parsed;
  if (!parse(env, point, &parsed) || !copy(env, scalar, tweak, 32) ||
      !secp256k1_ec_pubkey_tweak_mul(context, &parsed, tweak))
    return NULL;
  return serialize(env, &parsed);
}

// a + b; null for the point at infinity too.
JNIEXPORT jbyteArray JNICALL
Java_fit_finito_secp256k1_FinitoSecp256k1Native_add(JNIEnv *env, jclass type,
                                                    jbyteArray a,
                                                    jbyteArray b) {
  secp256k1_pubkey points[2], sum;
  const secp256k1_pubkey *summands[2] = {&points[0], &points[1]};
  if (!parse(env, a, &points[0]) || !parse(env, b, &points[1]) ||
      !secp256k1_ec_pubkey_combine(context, &sum, summands, 2))
    return NULL;
  return serialize(env, &sum);
}

JNIEXPORT jbyteArray JNICALL
Java_fit_finito_secp256k1_FinitoSecp256k1Native_decompress(JNIEnv *env,
                                                           jclass type,
                                                           jbyteArray point) {
  secp256k1_pubkey parsed;
  if (!parse(env, point, &parsed)) return NULL;
  return serialize(env, &parsed);
}
