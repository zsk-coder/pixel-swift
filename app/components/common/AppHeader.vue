<script setup lang="ts">
import { buildLoginUrl } from "~/utils/authRedirect";

const { t, locale, locales, setLocale } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const colorMode = useColorMode();
const route = useRoute();
const isMobileMenuOpen = ref(false);
const { user } = useAccountStatus();

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
  { label: t("nav.compressor"), to: localePath("/compress-image") },
  { label: t("nav.converter"), to: localePath("/converter") },
  { label: t("nav.resizer"), to: localePath("/resize-image") },
  { label: t("nav.copilot"), to: localePath("/workflow-copilot"), isNew: true },
  { label: t("nav.pricing"), to: localePath("/pricing") },
  { label: t("nav.blog"), to: localePath("/blog") },
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

const authLoginUrl = computed(() => {
  const url = buildLoginUrl(route.fullPath);
  return localePath(url);
});
const authCopy = computed(() => ({
  signIn: t("auth.menu.signIn"),
}));
</script>

<template>
  <header
    class="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md"
  >
    <div
      class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 relative"
    >
      <!-- Left: Logo + Nav -->
      <div class="flex items-center">
        <NuxtLink
          :to="localePath('/')"
          class="flex items-center gap-2 shrink-0"
          @click="closeMobileMenu"
        >
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white"
          >
            <span
              aria-hidden="true"
              class="material-symbols-outlined text-[20px]"
              >auto_fix</span
            >
          </div>
          <span
            class="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
            >PixelSwift</span
          >
        </NuxtLink>

        <!-- Divider -->
        <div
          class="hidden md:block w-px h-5 bg-slate-200 dark:bg-slate-700 mx-6"
        />

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-8">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="text-sm font-medium transition-colors relative flex items-center gap-1"
            :class="[
              item.isNew
                ? 'text-primary dark:text-primary hover:text-primary-dark dark:hover:text-primary-100'
                : 'text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary',
            ]"
            active-class="!text-primary"
          >
            <!-- AI 图标（仅 isNew 项） -->
            <span
              v-if="item.isNew"
              class="material-symbols-outlined text-[16px]"
              style="font-variation-settings: &quot;FILL&quot; 1"
              >auto_awesome</span
            >
            {{ item.label }}
            <!-- NEW 角标 -->
            <span v-if="item.isNew" class="copilot-new-badge">NEW</span>
          </NuxtLink>
        </nav>
      </div>

      <!-- Actions (right) -->
      <div class="flex items-center gap-3">
        <!-- Language -->
        <ElDropdown trigger="click" @command="selectLocale">
          <button
            aria-label="Language"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <span
              aria-hidden="true"
              class="material-symbols-outlined text-[20px]"
              >language</span
            >
          </button>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem
                v-for="loc in availableLocales"
                :key="loc.code"
                :command="loc.code"
                :class="[locale === loc.code ? 'is-active' : '', '!px-0 !py-0']"
              >
                <NuxtLink
                  :to="switchLocalePath(loc.code as any)"
                  class="w-full h-full px-4 py-1.5 flex items-center outline-none hover:no-underline text-inherit"
                >
                  {{ loc.name }}
                </NuxtLink>
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
          <span
            aria-hidden="true"
            class="material-symbols-outlined text-[20px]"
            >{{ isDark ? "light_mode" : "dark_mode" }}</span
          >
        </button>

        <NuxtLink v-if="!user" :to="authLoginUrl" class="hidden sm:inline-flex">
          <ElButton type="primary" class="!rounded-lg">
            {{ authCopy.signIn }}
          </ElButton>
        </NuxtLink>

        <AccountStatusMenu v-else />

        <!-- Mobile Hamburger -->
        <button
          class="md:hidden w-10 h-10 flex items-center justify-center rounded-lg"
          aria-label="Menu"
          @click="toggleMobileMenu"
        >
          <span
            aria-hidden="true"
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
            v-if="!user"
            :to="authLoginUrl"
            class="px-4 py-3 rounded-lg text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            @click="closeMobileMenu"
          >
            {{ authCopy.signIn }}
          </NuxtLink>

          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="px-4 py-3 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
            @click="closeMobileMenu"
          >
            <span
              v-if="item.isNew"
              class="material-symbols-outlined text-[16px] text-primary"
              style="font-variation-settings: &quot;FILL&quot; 1"
              >auto_awesome</span
            >
            {{ item.label }}
            <span v-if="item.isNew" class="copilot-new-badge-mobile">NEW</span>
          </NuxtLink>
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

/* AI Copilot NEW 角标 — 桌面端（右上角绝对定位） */
.copilot-new-badge {
  position: absolute;
  top: -13px;
  right: -15px;
  transform: translateX(calc(100% + 10px));
  padding: 1px 4px;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  letter-spacing: 0.04em;
  border-radius: 4px;
  color: white;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  animation: badge-pulse 2s ease-in-out infinite;
  pointer-events: none;
  white-space: nowrap;
}

/* AI Copilot NEW 角标 — 移动端（内联流式） */
.copilot-new-badge-mobile {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  letter-spacing: 0.04em;
  border-radius: 4px;
  color: white;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  vertical-align: middle;
}

@keyframes badge-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.05);
  }
}
</style>
