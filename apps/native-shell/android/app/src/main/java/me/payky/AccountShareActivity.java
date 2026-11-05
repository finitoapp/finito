package me.payky;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.util.Base64;
import androidx.annotation.Nullable;
import java.io.ByteArrayOutputStream;
import java.util.regex.Pattern;

/**
 * The entry point of an account request from another app (account/0008),
 * mirrored by `packages/core/src/integrations/payky-app/account-share-protocol.ts`.
 *
 * A trampoline: {@code MainActivity} is {@code singleTask}, and Android answers
 * a for-result launch of such an activity from another task with an
 * immediate {@code RESULT_CANCELED}. This activity runs in the requester's
 * task instead ({@code launchMode="standard"}, no UI), holds the request in
 * {@link AccountShareRequests}, brings {@code MainActivity} forward to ask the
 * user, and sets the result once {@link AccountSharePlugin} answers.
 *
 * {@link #getCallingPackage()} is set by the system and only for a launch
 * for a result, so a plain {@code startActivity} is dropped without a word:
 * Payky must show the user who really asks, not who the extras say asks.
 */
public class AccountShareActivity extends Activity {

    static final String ACTION = "me.payky.action.SHARE_ACCOUNT";
    static final int VERSION = 1;

    static final String EXTRA_VERSION = "v";
    static final String EXTRA_REQUEST_ID = "requestId";
    static final String EXTRA_CODE = "code";
    static final String EXTRA_REQUESTER_NAME = "requesterName";
    static final String EXTRA_ACCOUNT = "account";
    static final String EXTRA_ERROR = "error";

    static final String ERROR_REJECTED = "rejected";
    static final String ERROR_BUSY = "busy";
    static final String ERROR_EXPIRED = "expired";
    static final String ERROR_UNSUPPORTED_VERSION = "unsupportedVersion";
    static final String ERROR_INVALID_REQUEST = "invalidRequest";

    private static final int REQUESTER_NAME_MAX_LENGTH = 64;
    private static final int ICON_SIZE_PX = 96;
    private static final Pattern REQUEST_ID = Pattern.compile("^[0-9a-f]{32}$");
    private static final Pattern CODE = Pattern.compile("^[0-9]{6}$");

    private boolean delivered = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Recreated: the request goes on when it is still open in this
        // process, and ends when Android killed the process meanwhile (the
        // request died with it, and the requester starts again).
        if (savedInstanceState != null) {
            String saved = savedInstanceState.getString(EXTRA_REQUEST_ID);
            if (saved == null || !AccountShareRequests.rebind(saved, this)) {
                deliver(RESULT_CANCELED, null, null);
            }
            return;
        }

        String caller = getCallingPackage();
        Intent intent = getIntent();
        if (caller == null || intent == null || !ACTION.equals(intent.getAction())) {
            delivered = true;
            finish();
            return;
        }

        if (intent.getIntExtra(EXTRA_VERSION, -1) != VERSION) {
            deliver(RESULT_CANCELED, null, ERROR_UNSUPPORTED_VERSION);
            return;
        }
        String requestId = intent.getStringExtra(EXTRA_REQUEST_ID);
        String code = intent.getStringExtra(EXTRA_CODE);
        String requesterName = intent.getStringExtra(EXTRA_REQUESTER_NAME);
        if (requestId == null
                || !REQUEST_ID.matcher(requestId).matches()
                || code == null
                || !CODE.matcher(code).matches()
                || (requesterName != null && requesterName.trim().length() > REQUESTER_NAME_MAX_LENGTH)) {
            deliver(RESULT_CANCELED, null, ERROR_INVALID_REQUEST);
            return;
        }

        AccountShareRequests.Request request = new AccountShareRequests.Request(
                requestId,
                code,
                requesterName,
                caller,
                callerLabel(caller),
                callerIcon(caller),
                System.currentTimeMillis()
        );
        if (!AccountShareRequests.open(request, this)) return;

        Intent main = new Intent(this, MainActivity.class);
        main.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(main);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        AccountShareRequests.Request pending = AccountShareRequests.getPending();
        if (pending != null) outState.putString(EXTRA_REQUEST_ID, pending.requestId);
    }

    /** Sets the requester's result and closes; called once. */
    void deliver(int resultCode, @Nullable String account, @Nullable String error) {
        if (delivered) return;
        delivered = true;
        setResult(resultCode, AccountShareRequests.resultIntent(account, error));
        finish();
    }

    /** Back over the trampoline (the user came back to the requester): cancelled. */
    @Override
    public void onBackPressed() {
        AccountShareRequests.abandon(this);
        deliver(RESULT_CANCELED, null, null);
    }

    @Override
    protected void onDestroy() {
        // Destroyed only to be recreated keeps the request for the new instance.
        if (!delivered && !isChangingConfigurations()) AccountShareRequests.abandon(this);
        super.onDestroy();
    }

    /** The name Android shows for the caller; its package when it has none. */
    private String callerLabel(String caller) {
        PackageManager packageManager = getPackageManager();
        try {
            ApplicationInfo info = packageManager.getApplicationInfo(caller, 0);
            CharSequence label = packageManager.getApplicationLabel(info);
            return label == null ? caller : label.toString();
        } catch (PackageManager.NameNotFoundException exception) {
            return caller;
        }
    }

    /** The caller's launcher icon as a small PNG data URI, or null. */
    @Nullable
    private String callerIcon(String caller) {
        try {
            Drawable drawable = getPackageManager().getApplicationIcon(caller);
            Bitmap bitmap = Bitmap.createBitmap(ICON_SIZE_PX, ICON_SIZE_PX, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, ICON_SIZE_PX, ICON_SIZE_PX);
            drawable.draw(canvas);
            ByteArrayOutputStream png = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, png);
            bitmap.recycle();
            return "data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP);
        } catch (PackageManager.NameNotFoundException exception) {
            return null;
        }
    }
}
