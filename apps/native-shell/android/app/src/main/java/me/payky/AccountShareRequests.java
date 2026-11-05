package me.payky;

import android.app.Activity;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.Nullable;
import java.lang.ref.WeakReference;

/**
 * The one account request (account/0008) this process holds, from the
 * moment {@link AccountShareActivity} accepted it until it is answered.
 *
 * It lives in memory only, on purpose: the account must never reach the disk
 * outside the device database, so a request lost with the process is simply
 * started again. A second request while one is open answers both with
 * {@code busy}, and a request nobody answers expires after two minutes.
 * Everything here runs on the main thread.
 */
final class AccountShareRequests {

    /** Matches `ACCOUNT_SHARE_REQUEST_LIFETIME_MS` in `account-share-protocol.ts`. */
    static final long REQUEST_LIFETIME_MS = 120_000L;

    static final class Request {
        final String requestId;
        final String code;
        @Nullable final String requesterName;
        final String callerPackage;
        final String callerLabel;
        @Nullable final String callerIcon;
        final long receivedAt;

        Request(
                String requestId,
                String code,
                @Nullable String requesterName,
                String callerPackage,
                String callerLabel,
                @Nullable String callerIcon,
                long receivedAt
        ) {
            this.requestId = requestId;
            this.code = code;
            this.requesterName = requesterName;
            this.callerPackage = callerPackage;
            this.callerLabel = callerLabel;
            this.callerIcon = callerIcon;
            this.receivedAt = receivedAt;
        }
    }

    /** Told whenever the open request changes: a new one, or none. */
    interface Listener {
        void onChanged(@Nullable Request request);
    }

    private static final Handler handler = new Handler(Looper.getMainLooper());
    @Nullable private static Request pending;
    @Nullable private static WeakReference<AccountShareActivity> trampoline;
    @Nullable private static Listener listener;
    @Nullable private static Runnable expiry;

    private AccountShareRequests() {}

    @Nullable
    static Request getPending() {
        return pending;
    }

    static void setListener(@Nullable Listener next) {
        listener = next;
    }

    /**
     * Opens `request`, answered through `activity`. Returns false when another
     * request was open: both are then answered {@code busy}.
     */
    static boolean open(Request request, AccountShareActivity activity) {
        if (pending != null) {
            finish(Activity.RESULT_CANCELED, null, AccountShareActivity.ERROR_BUSY);
            activity.deliver(Activity.RESULT_CANCELED, null, AccountShareActivity.ERROR_BUSY);
            return false;
        }
        pending = request;
        trampoline = new WeakReference<>(activity);
        expiry = () -> finish(Activity.RESULT_CANCELED, null, AccountShareActivity.ERROR_EXPIRED);
        handler.postDelayed(expiry, REQUEST_LIFETIME_MS);
        notifyListener();
        return true;
    }

    /**
     * Answers the open request when it is `requestId`'s. Returns false for any
     * other id: a late answer to an expired or replaced request goes nowhere.
     */
    static boolean answer(
            String requestId,
            int resultCode,
            @Nullable String account,
            @Nullable String error
    ) {
        if (pending == null || !pending.requestId.equals(requestId)) return false;
        finish(resultCode, account, error);
        return true;
    }

    /** A recreated trampoline takes over the open request when it is `requestId`'s. */
    static boolean rebind(String requestId, AccountShareActivity activity) {
        if (pending == null || !pending.requestId.equals(requestId)) return false;
        trampoline = new WeakReference<>(activity);
        return true;
    }

    /** The trampoline went away unanswered (back pressed, destroyed). */
    static void abandon(AccountShareActivity activity) {
        if (trampoline == null || trampoline.get() != activity) return;
        clear();
    }

    private static void finish(int resultCode, @Nullable String account, @Nullable String error) {
        AccountShareActivity activity = trampoline == null ? null : trampoline.get();
        clear();
        if (activity != null) activity.deliver(resultCode, account, error);
    }

    private static void clear() {
        if (expiry != null) handler.removeCallbacks(expiry);
        expiry = null;
        pending = null;
        trampoline = null;
        notifyListener();
    }

    private static void notifyListener() {
        if (listener != null) listener.onChanged(pending);
    }

    /** The result intent the requester reads. */
    static Intent resultIntent(@Nullable String account, @Nullable String error) {
        Intent data = new Intent();
        if (account != null) data.putExtra(AccountShareActivity.EXTRA_ACCOUNT, account);
        if (error != null) data.putExtra(AccountShareActivity.EXTRA_ERROR, error);
        return data;
    }
}
