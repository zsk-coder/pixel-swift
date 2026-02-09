/**
 * Theme Composable
 *
 * Wraps @nuxtjs/color-mode for convenient theme switching.
 */

export function useTheme() {
  const colorMode = useColorMode();

  const isDark = computed(() => colorMode.value === "dark");

  function toggleTheme() {
    colorMode.preference = isDark.value ? "light" : "dark";
  }

  function setTheme(theme: "light" | "dark" | "system") {
    colorMode.preference = theme;
  }

  return {
    isDark,
    currentTheme: computed(() => colorMode.value),
    toggleTheme,
    setTheme,
  };
}
