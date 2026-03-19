import { useColorScheme } from "react-native";
import { Theme } from "./index";

export function useThemedColors() {
  const scheme = useColorScheme();
  return scheme === "dark" ? Theme.dark : Theme.light;
}
