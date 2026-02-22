<script setup lang="ts">
const { t } = useI18n();

// Cookie 同意状态：null=未选择, true=同意, false=拒绝
const consentStatus = ref<boolean | null>(null);
const isVisible = ref(false);

onMounted(() => {
  const stored = localStorage.getItem("cookie_consent");
  if (stored === null) {
    // 未做过选择，显示横幅
    isVisible.value = true;
  } else {
    consentStatus.value = stored === "accepted";
    if (consentStatus.value) {
      grantConsent();
    }
  }
});

function grantConsent() {
  // 更新 Google Consent Mode，允许 analytics 存储
  useGtag().gtag("consent", "update", {
    analytics_storage: "granted",
  });
}

function accept() {
  consentStatus.value = true;
  localStorage.setItem("cookie_consent", "accepted");
  grantConsent();
  isVisible.value = false;
}

function decline() {
  consentStatus.value = false;
  localStorage.setItem("cookie_consent", "declined");
  isVisible.value = false;
}
</script>

<template>
  <Transition name="cookie-slide">
    <div
      v-if="isVisible"
      class="fixed bottom-0 left-0 right-0 z-[9999] border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
    >
      <div
        class="mx-auto max-w-5xl flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 px-4 sm:px-6 py-4"
      >
        <!-- 文案 -->
        <p
          class="flex-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
        >
          {{ t("cookie.message") }}
          <NuxtLink
            :to="useLocalePath()('/privacy')"
            class="text-primary hover:underline font-medium"
          >
            {{ t("cookie.learnMore") }}
          </NuxtLink>
        </p>

        <!-- 按钮组 -->
        <div class="flex items-center gap-2 shrink-0">
          <ElButton @click="decline">
            {{ t("cookie.decline") }}
          </ElButton>
          <ElButton type="primary" @click="accept">
            {{ t("cookie.accept") }}
          </ElButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cookie-slide-enter-active,
.cookie-slide-leave-active {
  transition:
    transform 300ms ease,
    opacity 300ms ease;
}
.cookie-slide-enter-from,
.cookie-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
