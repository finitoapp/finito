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

/** Matched by `src/platform/switchio.ts`: the one rejection known to happen before anything could be charged. */
private const val NOT_INSTALLED_CODE = "SWITCHIO_NOT_INSTALLED"

private fun paymentIntent(data: String): Intent {
  val uri = Uri.Builder()
    .scheme(URI_SCHEME)
    .authority(URI_AUTHORITY)
    .path(URI_PATH_PAYMENT)
    .appendQueryParameter("data", data)
    .build()
  return Intent(ECR_ACTION, uri)
}

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
 */
class PaykySwitchioModule : Module() {
  private var pendingPromise: Promise? = null
  private var pendingClosurePromise: Promise? = null

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PaykySwitchio")

    Function("isInstalled") {
      paymentIntent("{}").resolveActivity(context.packageManager) != null
    }

    AsyncFunction("pay") { transactionId: String, amount: Int, tipAmount: Int, currencyCode: Int, invoiceNumber: String?, promise: Promise ->
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
      SwitchioResultStore.begin(context, transactionId)
      pendingPromise = promise
      try {
        appContext.throwingActivity.startActivityForResult(intent, SwitchioResultStore.REQUEST_CODE)
      } catch (exception: ActivityNotFoundException) {
        pendingPromise = null
        SwitchioResultStore.clearAttempt(context)
        promise.reject(CodedException(NOT_INSTALLED_CODE, "SwitchioPay is not installed", exception))
      }
    }

    AsyncFunction("close") { promise: Promise ->
      val intent = closureIntent()
      intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)

      SwitchioClosureStore.begin(context)
      pendingClosurePromise = promise
      try {
        appContext.throwingActivity.startActivityForResult(intent, SwitchioClosureStore.REQUEST_CODE)
      } catch (exception: ActivityNotFoundException) {
        pendingClosurePromise = null
        SwitchioClosureStore.clear(context)
        promise.reject(CodedException(NOT_INSTALLED_CODE, "SwitchioPay is not installed", exception))
      }
    }

    /** The result of a closure whose promise was lost with the process, or null. */
    Function("peekStoredClosureResult") {
      val stored = SwitchioClosureStore.peek(context)
      if (stored == null) null else mapOf(
        "resultCode" to stored.resultCode,
        "transactionResult" to stored.transactionResult
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
        "transactionResult" to stored.transactionResult
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
      }
    }
  }
}
