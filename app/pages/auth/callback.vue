<script setup lang="ts">
import { normalizeReturnTo } from "~/utils/authRedirect";

definePageMeta({
  i18n: false,
});

const { t, te } = useI18n();
const route = useRoute();
const { isConfigured } = useAuthConfig();
const { refreshStatus } = useAccountStatus();
const { consumeReturnTo } = useAuthFlow();

function tt(key: string, fallback: string) {
  return te(key) ? String(t(key)) : fallback;
}

const copy = computed(() => ({
  title: tt("auth.callback.title", "Finishing sign-in"),
  description: tt(
    "auth.callback.description",
    "We are preparing your account and free trial status.",
  ),
  failed: tt(
    "auth.callback.failed",
    "We could not finish your sign-in. Please try again.",
  ),
  retry: tt("auth.callback.retry", "Try Google sign-in again"),
  home: tt("auth.callback.home", "Return home"),
  unavailable: tt(
    "auth.callback.unavailable",
    "Supabase is not configured yet. Add the required environment variables to enable sign-in.",
  ),
}));

const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

useHead(() => ({
  title: copy.value.title,
}));

async function waitForAuthenticatedUser() {
  const client = useSupabaseClient();
  const user = useSupabaseUser();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    if (data.session?.user || user.value) {
      return data.session?.user || user.value;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  return null;
}

onMounted(async () => {
  try {
    if (!isConfigured.value) {
      throw new Error(copy.value.unavailable);
    }

    const authenticatedUser = await waitForAuthenticatedUser();

    if (!authenticatedUser) {
      throw new Error(copy.value.failed);
    }

    await refreshStatus();

    const target = consumeReturnTo(
      typeof route.query.returnTo === "string" ? route.query.returnTo : null,
    );

    await navigateTo(normalizeReturnTo(target), { replace: true });
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : copy.value.failed;
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100vh-12rem)] max-w-3xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
    <div class="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900">
      <div
        class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-200"
      >
        <span
          class="material-symbols-outlined text-[28px]"
          :class="{ 'animate-spin': isLoading }"
        >
          {{ isLoading ? "progress_activity" : errorMessage ? "error" : "check_circle" }}
        </span>
      </div>

      <h1 class="mt-6 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
        {{ copy.title }}
      </h1>
      <p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
        {{ errorMessage || copy.description }}
      </p>

      <div v-if="errorMessage" class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <NuxtLink
          to="/login"
          class="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {{ copy.retry }}
        </NuxtLink>
        <NuxtLink
          to="/"
          class="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          {{ copy.home }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
