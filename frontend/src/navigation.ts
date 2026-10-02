import { Platform } from "react-native";

// "unstable" is only the import path; NativeTabs are production-ready. Older iOS
// renders them transparent with content underlapping, so gate to iOS 26+.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
