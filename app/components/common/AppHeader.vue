<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n();
const localePath = useLocalePath();
const colorMode = useColorMode();
const isMobileMenuOpen = ref(false);

const isDark = computed(() => colorMode.value === "dark");

async function toggleTheme(event: MouseEvent) {
  // Fallback for browsers that don't support View Transition API
  if (
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    colorMode.preference = isDark.value ? "light" : "dark";
    return;
  }

  // Get click coordinates for the circle origin
  const x = event.clientX;
  const y = event.clientY;
  // Calculate the max radius to cover the entire viewport
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = document.startViewTransition(() => {
    colorMode.preference = isDark.value ? "light" : "dark";
  });

  await transition.ready;

  document.documentElement.animate(
    {
      clipPath: [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ],
    },
    {
      duration: 500,
      easing: "ease-in-out",
      pseudoElement: "::view-transition-new(root)",
    },
  );
}

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false;
}

const navItems = computed(() => [
  { label: t("nav.converter"), to: localePath("/converter") },
  { label: t("nav.compressor"), to: localePath("/compress-image") },
  { label: t("nav.resizer"), to: localePath("/resize-image") },
]);

const availableLocales = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).map((l) => ({
    code: l.code,
    name: l.name,
  })),
);

function selectLocale(code: string) {
  setLocale(code);
}
</script>

<template>
  <header
    class="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md"
  >
    <div
      class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 relative"
    >
      <!-- Logo (left) -->
      <NuxtLink
        :to="localePath('/')"
        class="flex items-center gap-2 shrink-0"
        @click="closeMobileMenu"
      >
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white"
        >
          <span class="material-symbols-outlined text-[20px]">auto_fix</span>
        </div>
        <span
          class="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
          >PixelSwift</span
        >
      </NuxtLink>

      <!-- Desktop Nav (center) -->
      <nav
        class="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2"
      >
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- Actions (right) -->
      <div class="flex items-center gap-3">
        <!-- Language -->
        <ElDropdown trigger="click" @command="selectLocale">
          <button
            aria-label="Language"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <span class="material-symbols-outlined text-[20px]">language</span>
          </button>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem
                v-for="loc in availableLocales"
                :key="loc.code"
                :command="loc.code"
                :class="locale === loc.code ? 'is-active' : ''"
              >
                {{ loc.name }}
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>

        <!-- Theme Toggle -->
        <button
          aria-label="Toggle Dark Mode"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          @click="toggleTheme"
        >
          <span class="material-symbols-outlined text-[20px]">{{
            isDark ? "light_mode" : "dark_mode"
          }}</span>
        </button>

        <!-- Mobile Hamburger -->
        <button
          class="md:hidden w-10 h-10 flex items-center justify-center rounded-lg"
          aria-label="Menu"
          @click="toggleMobileMenu"
        >
          <span
            class="material-symbols-outlined text-[24px] text-slate-700 dark:text-slate-300"
          >
            {{ isMobileMenuOpen ? "close" : "menu" }}
          </span>
        </button>
      </div>
    </div>

    <!-- Mobile Menu Overlay -->
    <Transition name="fade">
      <div
        v-if="isMobileMenuOpen"
        class="md:hidden fixed inset-0 top-16 z-40 bg-black/30"
        @click="closeMobileMenu"
      />
    </Transition>
    <Transition name="slide">
      <div
        v-if="isMobileMenuOpen"
        class="md:hidden fixed left-0 right-0 top-16 z-50 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
      >
        <nav class="flex flex-col p-4 gap-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="px-4 py-3 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            @click="closeMobileMenu"
          >
            {{ item.label }}
          </NuxtLink>
          <hr class="my-2 border-slate-200 dark:border-slate-700" />
          <div class="px-4 py-2">
            <p class="text-xs text-slate-500 mb-2">{{ t("nav.language") }}</p>
            <ElSelect
              :model-value="locale"
              class="w-full"
              @change="
                (val: string) => {
                  selectLocale(val);
                  closeMobileMenu();
                }
              "
            >
              <ElOption
                v-for="loc in availableLocales"
                :key="loc.code"
                :value="loc.code"
                :label="loc.name"
              />
            </ElSelect>
          </div>
        </nav>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-enter-active,
.slide-leave-active {
  transition:
    transform 200ms ease,
    opacity 200ms ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateY(-8px);
  opacity: 0;
}
</style>
