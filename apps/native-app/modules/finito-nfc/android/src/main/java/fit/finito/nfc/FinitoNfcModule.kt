package fit.finito.nfc

import android.app.Activity
import android.content.Intent
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads the NDEF URI off a tapped tag, a Bolt Card's `lnurlw://` link, and
 * hands it to JS as an `onTagRead` event (`uri` is null for any other tag).
 * Port of the Capacitor `NfcPlugin`.
 *
 * Reader mode rather than intent dispatch on purpose: while it is on, Android
 * does not route the tag to its own dispatcher, so tapping a card does not
 * pop a browser or an app chooser over the payment screen. Reader mode only
 * works while the activity is resumed, so it is dropped when the app goes to
 * the background and restored on return for as long as JS still wants to read.
 */
class FinitoNfcModule : Module() {
  @Volatile private var reading = false

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("FinitoNfc")

    Events("onTagRead")

    Function("getStatus") {
      val adapter = NfcAdapter.getDefaultAdapter(context)
      when {
        adapter == null -> "unsupported"
        adapter.isEnabled -> "enabled"
        else -> "disabled"
      }
    }

    Function("startReading") {
      reading = true
      enableReaderMode()
    }

    Function("stopReading") {
      reading = false
      disableReaderMode()
    }

    Function("openSettings") {
      val intent = Intent(Settings.ACTION_NFC_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    OnActivityEntersForeground {
      if (reading) enableReaderMode()
    }

    OnActivityEntersBackground {
      disableReaderMode()
    }

    OnDestroy {
      reading = false
      disableReaderMode()
    }
  }

  private fun enableReaderMode() {
    val activity = appContext.currentActivity ?: return
    activity.runOnUiThread {
      val adapter = NfcAdapter.getDefaultAdapter(activity)
      if (adapter != null && adapter.isEnabled) {
        // Bolt Cards are NTAG 424 DNA, an ISO 14443-A tag.
        adapter.enableReaderMode(
          activity,
          ::onTagDiscovered,
          NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B,
          null
        )
      }
    }
  }

  private fun disableReaderMode() {
    val activity: Activity = appContext.currentActivity ?: return
    activity.runOnUiThread {
      NfcAdapter.getDefaultAdapter(activity)?.disableReaderMode(activity)
    }
  }

  private fun onTagDiscovered(tag: Tag) {
    sendEvent("onTagRead", mapOf("uri" to readUri(tag)))
  }

  /** The first URI record of the tag's NDEF message, or null for any other tag. */
  private fun readUri(tag: Tag): String? {
    val message = Ndef.get(tag)?.cachedNdefMessage ?: return null
    for (record: NdefRecord in message.records) {
      val uri = record.toUri()
      if (uri != null) return uri.toString()
    }
    return null
  }
}
