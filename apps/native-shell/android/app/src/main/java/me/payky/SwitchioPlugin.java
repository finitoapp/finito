package me.payky;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Drives the SwitchioPay terminal app through its ECR v8 intent API.
 *
 * The protocol has no HTTP or local-socket interface: a request is an intent
 * carrying a JSON payload, and the result comes back as a JSON string in the
 * activity result bundle. See "SwitchioPay - ECR API" sections 3.1 - 3.3.
 *
 * {@link #isInstalled} probes with the same action and URI {@link #pay}
 * launches, declared in the manifest's {@code <queries>} so package
 * visibility filtering (Android 11+) lets it resolve. It only drives a
 * settings warning: {@link #pay} still handles
 * {@link ActivityNotFoundException} rather than trusting the probe.
 */
@CapacitorPlugin(name = "Switchio")
public class SwitchioPlugin extends Plugin {

    private static final String ECR_ACTION = "switchio.pay.ECR";
    private static final String URI_SCHEME = "app";
    private static final String URI_AUTHORITY = "switchiopay";
    private static final String URI_PATH_PAYMENT = "api/main/v8/payment";
    private static final String RESULT_KEY = "transaction_result";
    // Matched by `src/core/native/switchio.ts`: the one rejection known to
    // happen before anything could have been charged.
    private static final String NOT_INSTALLED_CODE = "SWITCHIO_NOT_INSTALLED";
    // Matched by `src/platform/switchio.ts`: the launch threw before
    // SwitchioPay started (payment/0021), so nothing was charged either.
    private static final String LAUNCH_FAILED_CODE = "SWITCHIO_LAUNCH_FAILED";

    @PluginMethod
    public void isInstalled(PluginCall call) {
        boolean installed = paymentIntent("{}")
                .resolveActivity(getContext().getPackageManager()) != null;
        JSObject result = new JSObject();
        result.put("installed", installed);
        call.resolve(result);
    }

    private static Intent paymentIntent(String data) {
        Uri uri = new Uri.Builder()
                .scheme(URI_SCHEME)
                .authority(URI_AUTHORITY)
                .path(URI_PATH_PAYMENT)
                .appendQueryParameter("data", data)
                .build();
        return new Intent(ECR_ACTION, uri);
    }

    @PluginMethod
    public void pay(PluginCall call) {
        String transactionId = call.getString("transactionId");
        Integer amount = call.getInt("amount");
        Integer currencyCode = call.getInt("currencyCode");

        if (transactionId == null || amount == null || currencyCode == null) {
            call.reject("transactionId, amount and currencyCode are required");
            return;
        }

        JSONObject data = new JSONObject();
        try {
            data.put("transactionId", transactionId);
            data.put("amount", amount.intValue());
            data.put("currencyCode", currencyCode.intValue());

            Integer tipAmount = call.getInt("tipAmount");
            if (tipAmount != null) {
                data.put("tipAmount", tipAmount.intValue());
            }

            String invoiceNumber = call.getString("invoiceNumber");
            if (invoiceNumber != null && !invoiceNumber.isEmpty()) {
                data.put("invoiceNumber", invoiceNumber);
            }
        } catch (JSONException exception) {
            call.reject("Could not build the SwitchioPay request", exception);
            return;
        }

        Intent intent = paymentIntent(data.toString());
        // Recommended by the ECR docs to keep SwitchioPay from opening a
        // second instance of itself.
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);

        // A launch throws before SwitchioPay starts, so whatever it threw,
        // the terminal never saw the request.
        try {
            startActivityForResult(call, intent, "payResult");
        } catch (ActivityNotFoundException exception) {
            call.reject("SwitchioPay is not installed", NOT_INSTALLED_CODE, exception);
        } catch (RuntimeException exception) {
            call.reject("SwitchioPay could not be launched", LAUNCH_FAILED_CODE, exception);
        }
    }

    /**
     * If Android killed this app while SwitchioPay was in the foreground,
     * Capacitor restores the call from its saved options and resolves it as
     * an {@code appRestoredResult} event instead of a promise. Echoing the
     * request's {@code transactionId} is what lets the JS side match that
     * event to its payment.
     */
    @ActivityCallback
    private void payResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;

        Intent data = activityResult.getData();

        JSObject result = new JSObject();
        result.put("transactionId", call.getString("transactionId"));
        result.put("resultCode", activityResult.getResultCode());
        result.put(
                "transactionResult",
                data == null ? null : data.getStringExtra(RESULT_KEY)
        );
        call.resolve(result);
    }
}
