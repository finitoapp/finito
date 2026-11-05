package me.payky.accountrequest

import android.content.ActivityNotFoundException
import android.content.Intent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Mirrors `packages/core/src/integrations/payky-app/account-share-protocol.ts`.
private const val PAYKY_PACKAGE = "me.payky"
private const val ACTION = "me.payky.action.SHARE_ACCOUNT"
private const val EXTRA_VERSION = "v"
private const val EXTRA_REQUEST_ID = "requestId"
private const val EXTRA_CODE = "code"
private const val EXTRA_REQUESTER_NAME = "requesterName"
private const val EXTRA_ACCOUNT = "account"
private const val EXTRA_ERROR = "error"

/** The activity-result request code of the account request. */
private const val REQUEST_CODE = 53702

/** Matched by `src/platform/payky-account-request.ts`: no activity took the intent. */
private const val NOT_INSTALLED_CODE = "PAYKY_NOT_INSTALLED"

private fun shareIntent(): Intent = Intent(ACTION).setPackage(PAYKY_PACKAGE)

/**
 * Asks Payky on this phone for its active account (account/0008): an explicit
 * intent launched for a result, which Android returns to this activity alone.
 *
 * Unlike `PaykySwitchio` nothing is stored: the answer carries the account's
 * master key, which must not reach the disk outside the device database, so a
 * result lost with the process is lost and the user simply asks again.
 */
class PaykyAccountRequestModule : Module() {
  private var pendingPromise: Promise? = null

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PaykyAccountRequest")

    /**
     * Whether the installed Payky takes this request: the exact intent
     * `requestAccount` sends resolves to an activity. An older Payky without
     * it and no Payky at all both read `false`; nothing is launched.
     */
    Function("canRequestAccount") {
      shareIntent().resolveActivity(context.packageManager) != null
    }

    AsyncFunction("requestAccount") { version: Int, requestId: String, code: String, requesterName: String, promise: Promise ->
      // A request still open is cancelled from the caller's side: its result
      // will never be read.
      pendingPromise?.resolve(mapOf("resultCode" to 0, "account" to null, "error" to null))
      pendingPromise = promise

      val intent = shareIntent()
        .putExtra(EXTRA_VERSION, version)
        .putExtra(EXTRA_REQUEST_ID, requestId)
        .putExtra(EXTRA_CODE, code)
        .putExtra(EXTRA_REQUESTER_NAME, requesterName)
      try {
        appContext.throwingActivity.startActivityForResult(intent, REQUEST_CODE)
      } catch (exception: ActivityNotFoundException) {
        pendingPromise = null
        promise.reject(CodedException(NOT_INSTALLED_CODE, "Payky cannot take the account request", exception))
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      pendingPromise?.resolve(
        mapOf(
          "resultCode" to payload.resultCode,
          "account" to payload.data?.getStringExtra(EXTRA_ACCOUNT),
          "error" to payload.data?.getStringExtra(EXTRA_ERROR)
        )
      )
      pendingPromise = null
    }
  }
}
