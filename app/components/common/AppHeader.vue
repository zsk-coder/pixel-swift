<script setup lang="ts">
import { buildLoginUrl } from "~/utils/authRedirect";

const { t, locale, locales, setLocale } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const colorMode = useColorMode();
const route = useRoute();
const isMobileMenuOpen = ref(false);
const isMobileLangOpen = ref(false);
const { user } = useAccountStatus();

const isDark = computed(() => colorMode.value === "dark");

// 主题三态切换：system / light / dark（Vercel 风格）
function setThemeMode(mode: 'system' | 'light' | 'dark') {
  colorMode.preference = mode;
}

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
  isMobileLangOpen.value = false;
}

async function onMobileLangChange(event: Event) {
  const code = (event.target as HTMLSelectElement).value;
  const path = switchLocalePath(code as any);
  if (path) {
    await navigateTo(path);
  } else {
    setLocale(code);
  }
  closeMobileMenu();
}

const navItems = computed(() => [
  { label: t("nav.compressor"), to: localePath("/compress-image") },
  { label: t("nav.converter"), to: localePath("/converter") },
  { label: t("nav.resizer"), to: localePath("/resize-image") },
  { label: t("nav.copilot"), to: localePath("/ai-workflow"), isNew: true },
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
        <!-- Language (desktop only) -->
        <div class="hidden md:flex items-center">
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
        </div>

        <!-- Theme Toggle (desktop only) -->
        <button
          aria-label="Toggle Dark Mode"
          class="hidden md:flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          @click="toggleTheme"
        >
          <span
            aria-hidden="true"
            class="material-symbols-outlined text-[20px]"
            >{{ isDark ? "light_mode" : "dark_mode" }}</span
          >
        </button>

        <!-- Login button (desktop only) -->
        <NuxtLink v-if="!user" :to="authLoginUrl" class="hidden md:inline-flex">
          <ElButton type="primary" class="!rounded-lg">
            {{ authCopy.signIn }}
          </ElButton>
        </NuxtLink>

        <AccountStatusMenu v-else />

        <!-- Mobile Hamburger / Close -->
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
        <div class="flex flex-col p-4 gap-2">
          <!-- Navigation links -->
          <nav class="flex flex-col gap-0.5 mt-1">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="px-2 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-between"
              @click="closeMobileMenu"
            >
              <span class="flex items-center gap-2">
                <span
                  v-if="item.isNew"
                  class="material-symbols-outlined text-[16px] text-primary"
                  style="font-variation-settings: &quot;FILL&quot; 1"
                  >auto_awesome</span
                >
                {{ item.label }}
                <span v-if="item.isNew" class="copilot-new-badge-mobile">NEW</span>
              </span>
            </NuxtLink>
          </nav>

          <!-- Divider -->
          <div class="border-t border-slate-200 dark:border-slate-800 my-1 mx-2" />

          <!-- Theme Toggle -->
          <div class="flex items-center justify-between px-2 py-1">
            <span class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ t('nav.theme') }}</span>
            <ClientOnly>
              <ElSwitch
                :model-value="isDark"
                style="--el-switch-on-color: #0f172a; --el-switch-off-color: #cbd5e1;"
                @change="colorMode.preference = $event ? 'dark' : 'light'"
              />
            </ClientOnly>
          </div>

          <!-- Language selector -->
          <div class="flex items-center justify-between px-2 py-1">
            <span class="text-sm font-medium text-slate-600 dark:text-slate-400">{{ t('nav.language') }}</span>
            <ElDropdown trigger="click" @command="(code) => { selectLocale(code); closeMobileMenu(); }">
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 outline-none cursor-pointer">
                {{ availableLocales.find(l => l.code === locale)?.name }}
                <span class="material-symbols-outlined text-[16px] text-slate-500">expand_more</span>
              </span>
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
                      @click="closeMobileMenu"
                    >
                      {{ loc.name }}
                    </NuxtLink>
                  </ElDropdownItem>
                </ElDropdownMenu>
              </template>
            </ElDropdown>
          </div>

          <!-- Divider before Login -->
          <div v-if="!user" class="border-t border-slate-200 dark:border-slate-800 my-1 mx-2" />

          <!-- Login CTA (Bottom) -->
          <NuxtLink
            v-if="!user"
            :to="authLoginUrl"
            class="block px-2 mb-1"
            @click="closeMobileMenu"
          >
            <button
              class="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:opacity-90 transition-opacity"
            >
              {{ authCopy.signIn }}
            </button>
          </NuxtLink>
        </div>
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

/* Language chip list collapse */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 200ms ease;
  overflow: hidden;
}
.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}
.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 200px;
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
