package me.payky.switchio

import android.content.Context

/**
 * The one durable copy of a SwitchioPay batch closure, kept apart from
 * [SwitchioResultStore] so a closure can never be settled as a payment.
 *
 * SwitchioPay closes the batch even when Android kills this app meanwhile;
 * `MainActivity.onActivityResult` writes the result here before React or the
 * module are involved, so JS can still record the closure afterwards. JS
 * clears it (`acknowledgeClosureResult`), never native code.
 */
object SwitchioClosureStore {
  /** The activity-result request code of the closure intent. */
  const val REQUEST_CODE = 53702
  const val RESULT_KEY = "transaction_result"

  private const val PREFS = "payky_switchio_closure"
  private const val PENDING = "pending"
  /** The account the closure was started in; null for one stored before it was kept. */
  private const val ACCOUNT_ID = "accountId"
  private const val HAS_RESULT = "hasResult"
  private const val RESULT_CODE = "resultCode"
  private const val RESULT_JSON = "transactionResult"

  class Result(val resultCode: Int, val transactionResult: String?, val accountId: String?)

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Called before the terminal is launched. Replaces any earlier result. */
  fun begin(context: Context, accountId: String) {
    prefs(context).edit()
      .putBoolean(PENDING, true)
      .putString(ACCOUNT_ID, accountId)
      .remove(HAS_RESULT).remove(RESULT_CODE).remove(RESULT_JSON)
      .commit()
  }

  /** Called with every closure activity result; synchronous on purpose. */
  fun save(context: Context, resultCode: Int, transactionResult: String?): Result {
    val p = prefs(context)
    p.edit()
      .remove(PENDING)
      .putBoolean(HAS_RESULT, true)
      .putInt(RESULT_CODE, resultCode)
      .putString(RESULT_JSON, transactionResult)
      .commit()
    return Result(resultCode, transactionResult, p.getString(ACCOUNT_ID, null))
  }

  /** The stored result, or null when none is waiting. Does not clear it. */
  fun peek(context: Context): Result? {
    val p = prefs(context)
    if (!p.getBoolean(HAS_RESULT, false)) return null
    return Result(
      p.getInt(RESULT_CODE, 0),
      p.getString(RESULT_JSON, null),
      p.getString(ACCOUNT_ID, null)
    )
  }

  /** Forgets the stored result, or an attempt that never reached the terminal. */
  fun clear(context: Context) {
    prefs(context).edit()
      .remove(PENDING).remove(ACCOUNT_ID).remove(HAS_RESULT).remove(RESULT_CODE).remove(RESULT_JSON)
      .commit()
  }
}
