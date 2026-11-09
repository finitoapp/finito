package me.payky.switchio

import android.content.Context

/**
 * The one durable copy of a SwitchioPay refund to the card, so its result survives Android
 * killing this app while the terminal is in the foreground. Kept apart from
 * [SwitchioResultStore] and [SwitchioClosureStore], so a refund result is never
 * settled as a payment or a closure, nor the other way round.
 *
 * The transaction id is written before the terminal is launched, and the
 * result by `MainActivity.onActivityResult` before React or the module are
 * involved at all; the module's own promise path reads the same values. JS
 * clears them (`acknowledge` / `takeRestored`), never native code, so a
 * result is not dropped before JS has seen it.
 */
object SwitchioRefundStore {
  /** The activity-result request code of the refund intent. */
  const val REQUEST_CODE = 53703
  const val RESULT_KEY = "transaction_result"

  private const val PREFS = "payky_switchio_refund"
  private const val PENDING_ID = "pendingTransactionId"
  /** The account the attempt was made in; null for one stored before it was kept. */
  private const val ACCOUNT_ID = "accountId"
  private const val RESULT_ID = "resultTransactionId"
  private const val RESULT_CODE = "resultCode"
  private const val RESULT_JSON = "transactionResult"
  private const val HAS_RESULT = "hasResult"

  class Result(
    val transactionId: String?,
    val resultCode: Int,
    val transactionResult: String?,
    val accountId: String?
  )

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Called before the terminal is launched. Replaces any earlier attempt. */
  fun begin(context: Context, transactionId: String, accountId: String) {
    prefs(context).edit()
      .putString(PENDING_ID, transactionId)
      .putString(ACCOUNT_ID, accountId)
      .remove(HAS_RESULT).remove(RESULT_ID).remove(RESULT_CODE).remove(RESULT_JSON)
      .commit()
  }

  /** Called with every refund activity result; synchronous on purpose. */
  fun save(context: Context, resultCode: Int, transactionResult: String?): Result {
    val p = prefs(context)
    val transactionId = p.getString(PENDING_ID, null)
    p.edit()
      .putBoolean(HAS_RESULT, true)
      .putString(RESULT_ID, transactionId)
      .putInt(RESULT_CODE, resultCode)
      .putString(RESULT_JSON, transactionResult)
      .commit()
    return Result(transactionId, resultCode, transactionResult, p.getString(ACCOUNT_ID, null))
  }

  /** The stored result, or null when none is waiting. Does not clear it. */
  fun peek(context: Context): Result? {
    val p = prefs(context)
    if (!p.getBoolean(HAS_RESULT, false)) return null
    return Result(
      p.getString(RESULT_ID, null),
      p.getInt(RESULT_CODE, 0),
      p.getString(RESULT_JSON, null),
      p.getString(ACCOUNT_ID, null)
    )
  }

  /** Forgets a refund that never reached the terminal. */
  fun clearAttempt(context: Context) {
    prefs(context).edit()
      .remove(PENDING_ID).remove(ACCOUNT_ID).remove(HAS_RESULT).remove(RESULT_ID).remove(RESULT_CODE).remove(RESULT_JSON)
      .commit()
  }

  /** Clears the stored result if it belongs to `transactionId`. */
  fun acknowledge(context: Context, transactionId: String?) {
    val stored = peek(context) ?: return
    if (stored.transactionId != transactionId) return
    prefs(context).edit()
      .remove(PENDING_ID).remove(ACCOUNT_ID).remove(HAS_RESULT).remove(RESULT_ID).remove(RESULT_CODE).remove(RESULT_JSON)
      .commit()
  }
}
