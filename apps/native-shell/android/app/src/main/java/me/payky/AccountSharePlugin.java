package me.payky;

import android.app.Activity;
import android.os.Build;
import android.webkit.WebView;
import androidx.annotation.Nullable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The web side of an account request (account/0008): which request is open,
 * an {@code accountShareRequest} event whenever that changes, the answer, and
 * the overlay protection the approval screen turns on. Mirrored by
 * `apps/web-app/src/platform/account-share.ts`.
 *
 * The account in an answer is passed straight to the requester's result and
 * never logged or stored.
 */
@CapacitorPlugin(name = "AccountShare")
public class AccountSharePlugin extends Plugin {

    static final String EVENT = "accountShareRequest";

    @Override
    public void load() {
        AccountShareRequests.setListener(
                request -> getActivity().runOnUiThread(() -> {
                    JSObject event = new JSObject();
                    event.put("request", toJs(request));
                    notifyListeners(EVENT, event, true);
                })
        );
    }

    @Override
    protected void handleOnDestroy() {
        AccountShareRequests.setListener(null);
    }

    @PluginMethod
    public void getPendingRequest(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject result = new JSObject();
            result.put("request", toJs(AccountShareRequests.getPending()));
            call.resolve(result);
        });
    }

    @PluginMethod
    public void respond(PluginCall call) {
        String requestId = call.getString("requestId");
        Boolean approved = call.getBoolean("approved");
        if (requestId == null || approved == null) {
            call.reject("requestId and approved are required");
            return;
        }
        String account = approved ? call.getString("account") : null;
        String error = approved ? null : call.getString("error", AccountShareActivity.ERROR_REJECTED);
        if (approved && account == null) {
            call.reject("an approval carries the account");
            return;
        }

        getActivity().runOnUiThread(() -> {
            boolean delivered = AccountShareRequests.answer(
                    requestId,
                    approved ? Activity.RESULT_OK : Activity.RESULT_CANCELED,
                    account,
                    error
            );
            // Back to the requester, whose task the trampoline just finished in.
            if (delivered && call.getBoolean("returnToRequester", true)) {
                getActivity().moveTaskToBack(true);
            }
            JSObject result = new JSObject();
            result.put("delivered", delivered);
            call.resolve(result);
        });
    }

    /**
     * While the approval screen is up, no other app may draw over it
     * (tapjacking): overlays are hidden from Android 12, and before that the
     * WebView drops touches that arrive through one.
     */
    @PluginMethod
    public void setOverlayProtection(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        getActivity().runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                getActivity().getWindow().setHideOverlayWindows(enabled);
            }
            WebView webView = getBridge().getWebView();
            if (webView != null) webView.setFilterTouchesWhenObscured(enabled);
            call.resolve();
        });
    }

    @Nullable
    private static JSObject toJs(@Nullable AccountShareRequests.Request request) {
        if (request == null) return null;
        JSObject js = new JSObject();
        js.put("v", AccountShareActivity.VERSION);
        js.put("requestId", request.requestId);
        js.put("code", request.code);
        js.put("requesterName", request.requesterName);
        js.put("callerPackage", request.callerPackage);
        js.put("callerLabel", request.callerLabel);
        js.put("callerIcon", request.callerIcon);
        js.put("receivedAt", request.receivedAt);
        js.put("expiresAt", request.receivedAt + AccountShareRequests.REQUEST_LIFETIME_MS);
        return js;
    }
}
