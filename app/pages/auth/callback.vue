<script setup lang="ts">
import { normalizeReturnTo } from "~/utils/authRedirect";

definePageMeta({
  i18n: false,
  layout: "auth-callback",
});

const { t, te, setLocale, locale } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const { isConfigured } = useAuthConfig();
const { refreshStatus } = useAccountStatus();
const { consumeReturnTo } = useAuthFlow();
import { CircleCheck, Warning, Loading } from "@element-plus/icons-vue";

// 提前抢救语言状态：因为 /auth/callback 是没有多语言前缀的硬编码路由，
// 如果不干预，Nuxt会默认把它当成纯英文页渲染。
// 我们先尝试读取 Cookie，如果没有，就从它预备要回去的 url 参数（如 /zh/login）里抠出语种前缀
const langCookie = useCookie("i18n_lang");
if (langCookie.value && langCookie.value !== locale.value) {
  setLocale(langCookie.value as any);
} else if (typeof route.query.returnTo === "string") {
  const match = route.query.returnTo.match(/^\/([a-z]{2})(?:\/|$)/);
  if (match) {
    setLocale(match[1] as any);
  }
}

const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

useHead(() => ({
  title: t("auth.callback.title"),
}));

/**
 * 重试轮询策略保护网（防止服务端响应比浏览器慢导致的幽灵刷新）
 * 因为当第三方（Google）将用户丢回我们的 `/auth/callback` 页面时，
 * URL 里带了 token 碎步，我们要等底层 Supabase 客户端验证完毕（它在后台异步工作）。
 * 如果我们一上来就着急读状态，可能会因为网络延迟被判成未登录。
 */
async function waitForAuthenticatedUser() {
  const client = useSupabaseClient();
  const user = useSupabaseUser();

  // 我们设置最高 20 次请求轮询，每次间歇 250 毫秒（最长等待 5 秒）
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    // 第一个验证是通过底层拿到有效 session，第二个是看我们全局 composable 同步到了没
    if (data.session?.user || user.value) {
      return data.session?.user || user.value;
    }

    // 等待 250 毫秒
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  return null; // 超时，认证失败
}

/**
 * 页面挂载时立刻触发鉴定程序
 */
onMounted(async () => {
  // try {
  //   if (!isConfigured.value) {
  //     throw new Error(t("auth.callback.unavailable"));
  //   }
  //   // 1. 开始轮询等待，确保第三方登录确为成功
  //   const authenticatedUser = await waitForAuthenticatedUser();
  //   if (!authenticatedUser) {
  //     throw new Error(t("auth.callback.failed")); // 超时或拿不到状态抛异常显示错误牌
  //   }
  //   // 2. 数据新鲜度同步：强制调接口或读缓存更新配额余量
  //   await refreshStatus();
  //   // 3. 计算用户究竟要回到哪去
  //   // 有两种可能：一是 Google Redirection 时的 URL 里存的 query
  //   // 二是如果没携带，查一查我们一开始自己保存在 LocalStorage 里的痕迹
  //   const target = consumeReturnTo(
  //     typeof route.query.returnTo === "string" ? route.query.returnTo : null,
  //   );
  //   // 4. 洗衣机净化路径后完美着陆，并擦除回退记录 (`replace: true`) 不留历史记录
  //   await navigateTo(normalizeReturnTo(target), { replace: true });
  // } catch (error) {
  //   errorMessage.value =
  //     error instanceof Error ? error.message : t("auth.callback.failed");
  // } finally {
  //   isLoading.value = false;
  // }
});
</script>

<template>
  <section class="mx-auto flex w-full justify-center px-4 sm:px-6 lg:px-8">
    <div
      class="w-full max-w-lg rounded-[28px] bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"
    >
      <div
        class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary/10 dark:text-primary-100"
      >
        <!-- Unified Element Plus Icon Wrapper -->
        <el-icon :size="25" :class="{ 'is-loading': isLoading }">
          <Loading v-if="isLoading" />
          <Warning v-else-if="errorMessage" />
          <CircleCheck v-else />
        </el-icon>
      </div>

      <h1
        class="mt-6 text-2xl font-bold tracking-tight text-slate-950 dark:text-white"
      >
        {{ $t("auth.callback.title") }}
      </h1>
      <p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
        {{ errorMessage || $t("auth.callback.description") }}
      </p>

      <div
        v-if="errorMessage"
        class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"
      >
        <NuxtLink
          :to="localePath('/login')"
          class="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          {{ $t("auth.callback.retry") }}
        </NuxtLink>
        <NuxtLink
          to="/"
          class="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          {{ $t("auth.callback.home") }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
