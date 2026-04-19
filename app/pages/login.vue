<script setup lang="ts">
import { normalizeReturnTo } from "~/utils/authRedirect";

definePageMeta({
  i18n: false,
  layout: "login",
});

const { t } = useI18n();
const route = useRoute();
const user = useSupabaseUser();
const { signInWithGoogle, isConfigured } = useAuthFlow();

const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const hasRedirected = ref(false);

useHead(() => ({
  title: t("auth.login.pageTitle"),
}));

async function handleGoogleLogin() {
  errorMessage.value = null;
  isSubmitting.value = true;

  try {
    await signInWithGoogle(
      typeof route.query.returnTo === "string" ? route.query.returnTo : null,
    );
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : t("auth.login.authError");
  } finally {
    isSubmitting.value = false;
  }
}

watch(
  () => user.value?.id,
  async (currentUserId) => {
    if (!currentUserId || hasRedirected.value) {
      return;
    }

    hasRedirected.value = true;
    const returnTo =
      typeof route.query.returnTo === "string" ? route.query.returnTo : "/";

    await navigateTo(normalizeReturnTo(returnTo), { replace: true });
  },
  { immediate: true },
);
</script>

<template>
  <section class="w-full">
    <div class="mx-auto w-full max-w-lg">
      <AuthLoginCard
        :badge-label="t('auth.login.badge')"
        :title="t('auth.login.title')"
        :description="t('auth.login.description')"
        :action-label="t('auth.login.google')"
        :secondary-helper-label="t('auth.login.secondaryHelper')"
        :disabled="!isConfigured"
        :loading="isSubmitting"
        @google="handleGoogleLogin"
      />

      <p
        v-if="!isConfigured || errorMessage"
        class="mt-4 text-center text-sm text-rose-600 dark:text-rose-300"
      >
        {{ errorMessage || t("auth.login.configError") }}
      </p>
    </div>
  </section>
</template>
