import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nManager, LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/src/auth";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { I18nProvider } from "@/src/i18n";
import { PreferencesProvider } from "@/src/preferences";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";
import { ToastProvider } from "@/src/ui";

LogBox.ignoreAllLogs(true);

// Arabic-first: default to RTL layout. The I18nProvider corrects this
// if the user switches to a LTR locale (English).
I18nManager.allowRTL(true);
if (!I18nManager.isRTL) {
  I18nManager.forceRTL(true);
}

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <KeyboardProvider>
                <PreferencesProvider>
                  <AuthProvider>
                    <ToastProvider>
                      <ThemedStatusBar />
                      <Stack screenOptions={{ headerShown: false }} />
                    </ToastProvider>
                  </AuthProvider>
                </PreferencesProvider>
              </KeyboardProvider>
            </QueryClientProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </I18nProvider>
    </ErrorBoundary>
  );
}
