<script setup lang="ts">
import { normalizeReturnTo } from "~/utils/authRedirect";

// 移除了 i18n: false，允许页面按照多语言前缀（如 /zh/login）正常生成
definePageMeta({
  layout: "login",
});

const { t } = useI18n();
const route = useRoute();
const user = useSupabaseUser();
const { signInWithGoogle, isConfigured } = useAuthFlow();

const isSubmitting = ref(false); // 标记登录进行中的骨架态
const errorMessage = ref<string | null>(null);
const hasRedirected = ref(false); // 防止网络慢导致多次触发 watch 跳转的锁

useHead(() => ({
  title: t("auth.login.pageTitle"),
}));

/**
 * 处理原生的 Google 登录点击事件
 */
async function handleGoogleLogin() {
  errorMessage.value = null;
  isSubmitting.value = true;

  try {
    // 启动 OAuth 鉴权，带着用户最初想去的地方（或默认首页）去发请求
    await signInWithGoogle(
      typeof route.query.returnTo === "string" ? route.query.returnTo : null,
    );
  } catch (error) {
    // 处理如超限、未配置环境变量、网络丢包等各种底层错误情况，直接在 UI 打出来
    errorMessage.value =
      error instanceof Error ? error.message : t("auth.login.authError");
  } finally {
    isSubmitting.value = false;
  }
}

/**
 * 这里负责监听全局 user 对象的变化（只要登录成功拿到了有效的 JWT cookie，
 * 各种 Nuxt/Supabase 底层组件库就会推平更新它）。
 *
 * 若监听到 user.id 已存在，证明其实在当前浏览器已经处于“已登录成功状态”，
 * 那我们不用再展示登录面板，直接给它导向回想去的地方。
 */
watch(
  () => user.value?.id,
  async (currentUserId) => {
    // 还没登录完或者已经被标记为处理过
    if (!currentUserId || hasRedirected.value) {
      return;
    }

    hasRedirected.value = true;
    const returnTo =
      typeof route.query.returnTo === "string" ? route.query.returnTo : "/";

    // 使用统一的安全检验拦截器清洗最终的目标跳转路径
    await navigateTo(normalizeReturnTo(returnTo), { replace: true });
  },
  { immediate: true }, // 一进页面（可能是刚打开浏览器）检查一遍是不是原本就有 cookie
);
</script>

<template>
  <section class="flex w-full max-w-sm flex-col items-center">
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

    <div class="mt-4 text-center">
      <p
        v-if="!isConfigured || errorMessage"
        class="text-sm text-rose-600 dark:text-rose-300"
      >
        {{ errorMessage || t("auth.login.configError") }}
      </p>
    </div>
  </section>
</template>
