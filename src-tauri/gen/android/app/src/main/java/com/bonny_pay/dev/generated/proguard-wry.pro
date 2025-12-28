# THIS FILE IS AUTO-GENERATED. DO NOT MODIFY!!

# Copyright 2020-2023 Tauri Programme within The Commons Conservancy
# SPDX-License-Identifier: Apache-2.0
# SPDX-License-Identifier: MIT

-keep class com.finito.dev.* {
  native <methods>;
}

-keep class com.finito.dev.WryActivity {
  public <init>(...);

  void setWebView(com.finito.dev.RustWebView);
  java.lang.Class getAppClass(...);
  java.lang.String getVersion();
}

-keep class com.finito.dev.Ipc {
  public <init>(...);

  @android.webkit.JavascriptInterface public <methods>;
}

-keep class com.finito.dev.RustWebView {
  public <init>(...);

  void loadUrlMainThread(...);
  void loadHTMLMainThread(...);
  void evalScript(...);
}

-keep class com.finito.dev.RustWebChromeClient,com.finito.dev.RustWebViewClient {
  public <init>(...);
}
