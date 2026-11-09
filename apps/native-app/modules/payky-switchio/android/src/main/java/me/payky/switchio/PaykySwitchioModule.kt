package me.payky.switchio

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

private const val ECR_ACTION = "switchio.pay.ECR"
private const val URI_SCHEME = "app"
private const val URI_AUTHORITY = "switchiopay"
private const val URI_PATH_PAYMENT = "api/main/v8/payment"
private const val URI_PATH_CLOSURE = "api/main/v8/closure"
private const val URI_PATH_REFERRAL_REFUND = "api/main/v8/referral_refund"
private const val URI_PATH_REVERSAL = "api/main/v8/reversal"
private const val URI_PATH_GET_TRANSACTION = "api/light/v8/get_transaction"

/**
 * The request code of `get_transaction`. It changes nothing, so it has no
 * store: a lookup lost with the process is simply asked again.
 */
private const val LOOKUP_REQUEST_CODE = 53704

/** Matched by `src/platform/switchio.ts`: the one rejection known to happen before anything could be charged. */
private const val NOT_INSTALLED_CODE = "SWITCHIO_NOT_INSTALLED"

private fun dataIntent(path: String, data: String): Intent {
  val uri = Uri.Builder()
    .scheme(URI_SCHEME)
    .authority(URI_AUTHORITY)
    .path(path)
    .appendQueryParameter("data", data)
    .build()
  return Intent(ECR_ACTION, uri)
}

private fun paymentIntent(data: String): Intent = dataIntent(URI_PATH_PAYMENT, data)

/** The batch closure request carries no data (ECR section 4.1). */
private fun closureIntent(): Intent {
  val uri = Uri.Builder()
    .scheme(URI_SCHEME)
    .authority(URI_AUTHORITY)
    .path(URI_PATH_CLOSURE)
    .build()
  return Intent(ECR_ACTION, uri)
}

/**
 * Drives the SwitchioPay terminal app through its ECR v8 intent API: a request
 * is an intent carrying a JSON payload, and the result comes back as a JSON
 * string in the activity result bundle. Port of the Capacitor `SwitchioPlugin`.
 *
 * `pay` resolves with `{ transactionId, resultCode, transactionResult }`. The
 * same result is also written to [SwitchioResultStore] (by `MainActivity`, so
 * it survives the app being killed meanwhile) until JS acknowledges it.
 *
 * `close` closes the terminal's batch and resolves with
 * `{ resultCode, transactionResult }`. It has its own request code, promise
 * and [SwitchioClosureStore], so a closure result never reaches the payment
 * path and its recovery.
 *
 * `reversal` takes a payment back (ECR 5.13) and `referralRefund` refunds to
 * the card (ECR 5.17); both resolve like `pay` and share their own request
 * code, promise and [SwitchioRefundStore].
 * `lookupTransaction` asks the terminal about one of its transactions
 * (`get_transaction`, ECR 5.12) and resolves like `close`; it stores nothing.
 */
class PaykySwitchioModule : Module() {
  private var pendingPromise: Promise? = null
  private var pendingClosurePromise: Promise? = null
  private var pendingRefundPromise: Promise? = null
  private var pendingLookupPromise: Promise? = null

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  /** Launches a reversal or a referral refund, its id stored before the terminal can act. */
  private fun launchRefund(intent: Intent, transactionId: String, accountId: String, promise: Promise) {
    intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    SwitchioRefundStore.begin(context, transactionId, accountId)
    pendingRefundPromise = promise
    try {
      appContext.throwingActivity.startActivityForResult(intent, SwitchioRefundStore.REQUEST_CODE)
    } catch (exception: ActivityNotFoundException) {
      pendingRefundPromise = null
      SwitchioRefundStore.clearAttempt(context)
      promise.reject(CodedException(NOT_INSTALLED_CODE, "SwitchioPay is not installed", exception))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("PaykySwitchio")

    Function("isInstalled") {
      paymentIntent("{}").resolveActivity(context.packageManager) != null
    }

    AsyncFunction("pay") { transactionId: String, amount: Int, tipAmount: Int, currencyCode: Int, invoiceNumber: String?, accountId: String, promise: Promise ->
      val data = JSONObject()
      data.put("transactionId", transactionId)
      data.put("amount", amount)
      data.put("currencyCode", currencyCode)
      data.put("tipAmount", tipAmount)
      if (!invoiceNumber.isNullOrEmpty()) data.put("invoiceNumber", invoiceNumber)

      val intent = paymentIntent(data.toString())
      // Recommended by the ECR docs to keep SwitchioPay from opening a second instance of itself.
      intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)

      // Durable before the terminal can take the card.
      SwitchioResultStore.begin(context, transactionId, accountId)
      pendingPromise = promise
      try {
        appContext.throwingActivity.startActivityForResult(intent, SwitchioResultStore.REQUEST_CODE)
      } catch (exception: ActivityNotFoundException) {
        pendingPromise = null
        SwitchioResultStore.clearAttempt(context)
        promise.reject(CodedException(NOT_INSTALLED_CODE, "SwitchioPay is not installed", exception))
      }
    }

    AsyncFunction("close") { accountId: String, promise: Promise ->
      val intent = closureIntent()
      intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)

      SwitchioClosureStore.begin(context, accountId)
      pendingClosurePromise = promise
      try {
        appContext.throwingActivity.startActivityForResult(intent, SwitchioClosureStore.REQUEST_CODE)
      } catch (exception: ActivityNotFoundException) {
        pendingClosurePromise = null
        SwitchioClosureStore.clear(context)
        promise.reject(CodedException(NOT_INSTALLED_CODE, "SwitchioPay is not installed", exception))
      }
    }

    AsyncFunction("reversal") { transactionId: String, originalTransactionId: String, accountId: String, promise: Promise ->
      // Never without the original: a reversal without it takes back the
      // terminal's last transaction, whatever that is (ECR 5.13).
      if (originalTransactionId.isEmpty()) {
        promise.reject(CodedException("SWITCHIO_NO_ORIGINAL", "A reversal needs the original transaction", null))
      } else {
        val data = JSONObject()
        data.put("transactionId", transactionId)
        data.put("originalTransactionId", originalTransactionId)
        launchRefund(dataIntent(URI_PATH_REVERSAL, data.toString()), transactionId, accountId, promise)
      }
    }

    AsyncFunction("referralRefund") { transactionId: String, amount: Int, currencyCode: Int, refundId: String, accountId: String, promise: Promise ->
      val data = JSONObject()
      data.put("transactionId", transactionId)
      data.put("amount", amount)
      data.put("currencyCode", currencyCode)
      // A string, as the request documents it: the terminal's 18 digits do
      // not fit a JavaScript number, and never went through one.
      data.put("refundId", refundId)

      launchRefund(dataIntent(URI_PATH_REFERRAL_REFUND, data.toString()), transactionId, accountId, promise)
    }

    AsyncFunction("lookupTransaction") { transactionId: String, promise: Promise ->
      val data = JSONObject()
      data.put("transactionId", transactionId)

      val intent = dataIntent(URI_PATH_GET_TRANSACTION, data.toString())
      intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)

      pendingLookupPromise = promise
      try {
        appContext.throwingActivity.startActivityForResult(intent, LOOKUP_REQUEST_CODE)
      } catch (exception: ActivityNotFoundException) {
        pendingLookupPromise = null
        promise.reject(CodedException(NOT_INSTALLED_CODE, "SwitchioPay is not installed", exception))
      }
    }

    /** The result of a refund whose promise was lost with the process, or null. */
    Function("peekStoredRefundResult") {
      val stored = SwitchioRefundStore.peek(context)
      if (stored == null) null else mapOf(
        "transactionId" to stored.transactionId,
        "resultCode" to stored.resultCode,
        "transactionResult" to stored.transactionResult,
        "accountId" to stored.accountId
      )
    }

    Function("acknowledgeRefundResult") { transactionId: String? ->
      SwitchioRefundStore.acknowledge(context, transactionId)
    }

    /** The result of a closure whose promise was lost with the process, or null. */
    Function("peekStoredClosureResult") {
      val stored = SwitchioClosureStore.peek(context)
      if (stored == null) null else mapOf(
        "resultCode" to stored.resultCode,
        "transactionResult" to stored.transactionResult,
        "accountId" to stored.accountId
      )
    }

    Function("acknowledgeClosureResult") {
      SwitchioClosureStore.clear(context)
    }

    /** The result of an attempt whose promise was lost with the process, or null. */
    Function("peekStoredResult") {
      val stored = SwitchioResultStore.peek(context)
      if (stored == null) null else mapOf(
        "transactionId" to stored.transactionId,
        "resultCode" to stored.resultCode,
        "transactionResult" to stored.transactionResult,
        "accountId" to stored.accountId
      )
    }

    Function("acknowledgeResult") { transactionId: String? ->
      SwitchioResultStore.acknowledge(context, transactionId)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == SwitchioResultStore.REQUEST_CODE) {
        val stored = SwitchioResultStore.save(
          context,
          payload.resultCode,
          payload.data?.getStringExtra(SwitchioResultStore.RESULT_KEY)
        )
        pendingPromise?.resolve(
          mapOf(
            "transactionId" to stored.transactionId,
            "resultCode" to stored.resultCode,
            "transactionResult" to stored.transactionResult
          )
        )
        pendingPromise = null
      } else if (payload.requestCode == SwitchioClosureStore.REQUEST_CODE) {
        val stored = SwitchioClosureStore.save(
          context,
          payload.resultCode,
          payload.data?.getStringExtra(SwitchioClosureStore.RESULT_KEY)
        )
        pendingClosurePromise?.resolve(
          mapOf(
            "resultCode" to stored.resultCode,
            "transactionResult" to stored.transactionResult
          )
        )
        pendingClosurePromise = null
      } else if (payload.requestCode == SwitchioRefundStore.REQUEST_CODE) {
        val stored = SwitchioRefundStore.save(
          context,
          payload.resultCode,
          payload.data?.getStringExtra(SwitchioRefundStore.RESULT_KEY)
        )
        pendingRefundPromise?.resolve(
          mapOf(
            "transactionId" to stored.transactionId,
            "resultCode" to stored.resultCode,
            "transactionResult" to stored.transactionResult
          )
        )
        pendingRefundPromise = null
      } else if (payload.requestCode == LOOKUP_REQUEST_CODE) {
        pendingLookupPromise?.resolve(
          mapOf(
            "resultCode" to payload.resultCode,
            "transactionResult" to payload.data?.getStringExtra(SwitchioRefundStore.RESULT_KEY)
          )
        )
        pendingLookupPromise = null
      }
    }
  }
}
