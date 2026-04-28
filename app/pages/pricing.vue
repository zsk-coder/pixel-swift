<script setup lang="ts">
const { t, locale } = useI18n();
const localePath = useLocalePath();
const { planType } = useAccountStatus();
const isPro = computed(() => planType.value === "pro");

useHead({
  title: t("pricing.title"),
  meta: [
    {
      name: "description",
      content: t("pricing.subtitle"),
    },
  ],
});

// 升级按钮状态
const upgrading = ref(false);
// 管理订阅按钮状态
const managingSubscription = ref(false);
const route = useRoute();
const showSuccess = computed(() => route.query.success === "true");

const CHECKOUT_FLAG_KEY = "ls_checkout_initiated";
// checkout 标记有效期 30 分钟（防止用户点了升级但没付款，过了很久再手动拼 URL）
const CHECKOUT_FLAG_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * 校验 sessionStorage 中的 checkout 标记是否存在且未过期。
 * 消费后立即删除标记，防止刷新页面重复触发。
 */
function consumeCheckoutFlag(): boolean {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_FLAG_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(CHECKOUT_FLAG_KEY);
    const ts = Number(raw);
    // 标记存在但无法解析为时间戳，视为无效
    if (Number.isNaN(ts)) return false;
    // 标记已过期（超过 30 分钟）
    if (Date.now() - ts > CHECKOUT_FLAG_MAX_AGE_MS) return false;
    return true;
  } catch {
    // sessionStorage 不可用（隐私模式等极端情况），容错放行
    return false;
  }
}

const { refreshStatus } = useAccountStatus();
let pollInterval: ReturnType<typeof setInterval>;
// 持久化 pending 提示的引用，需要在确认后手动关闭
let pendingMsgClose: (() => void) | null = null;

// 取消挂载时清除轮询与未关闭的 pending 提示
onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
  if (pendingMsgClose) pendingMsgClose();
});

// 挂载后通过轮询确认 Webhook 是否已入库
onMounted(() => {
  if (!showSuccess.value) return;

  const hasCheckoutFlag = consumeCheckoutFlag();

  // 边界情况兜底：用户确实已经是 Pro（Webhook 快速入库 / 浏览器崩溃后重启导致标记丢失），
  // 无论标记是否存在，都弹成功通知。
  if (isPro.value) {
    ElNotification.success({
      title: t("pricing.successTitle") || "Welcome to Pro!",
      message: t("pricing.successDesc") || "Your subscription is active. Enjoy your Pro features!",
      duration: 5000,
    });
    return;
  }

  // 既没有 checkout 标记、也不是 Pro → 用户是手动拼的 URL，忽略
  if (!hasCheckoutFlag) return;

  // 显示「确认中」持久提示
  const msgInstance = ElNotification.info({
    title: t("pricing.pendingTitle") || "Confirming your subscription…",
    message: t("pricing.pendingDesc") || "Please wait while we verify your payment.",
    duration: 0, // 不自动关闭
    showClose: false,
  });
  pendingMsgClose = () => msgInstance.close();

  // 启动轮询：每 1.5 秒拉一次服务端状态，最多 10 轮（共 15s）
  let attempts = 0;
  pollInterval = setInterval(async () => {
    attempts++;
    await refreshStatus();
    if (isPro.value) {
      clearInterval(pollInterval);
      if (pendingMsgClose) { pendingMsgClose(); pendingMsgClose = null; }
      ElNotification.success({
        title: t("pricing.successTitle") || "Welcome to Pro!",
        message: t("pricing.successDesc") || "Your subscription is active. Enjoy your Pro features!",
        duration: 5000,
      });
    } else if (attempts >= 10) {
      clearInterval(pollInterval);
      if (pendingMsgClose) { pendingMsgClose(); pendingMsgClose = null; }
      ElNotification.warning({
        title: t("pricing.timeoutTitle") || "Subscription verification pending",
        message: t("pricing.timeoutDesc") || "It may take a few minutes. Please refresh this page shortly, or contact support if the issue persists.",
        duration: 0, // 不自动消失，让用户自己关
      });
    }
  }, 1500);
});

// 点击 "立即升级" → 创建 Checkout Session → 跳转 LemonSqueezy
async function handleUpgrade() {
  upgrading.value = true;
  try {
    const { url } = await $fetch<{ url: string }>("/api/billing/checkout", {
      method: "POST",
      body: { locale: locale.value },
    });
    // 写入 checkout 标记（带时间戳），用于回跳后校验
    try { sessionStorage.setItem(CHECKOUT_FLAG_KEY, String(Date.now())); } catch { /* 容错 */ }
    // 跳转到 LemonSqueezy 收银台
    window.location.href = url;
  } catch (err: any) {
    // 未登录时跳转登录页
    if (err?.statusCode === 401) {
      navigateTo(localePath("/login"));
      return;
    }
    ElMessage.error(
      t("pricing.upgradeError") || "Upgrade failed. Please try again.",
    );
  } finally {
    upgrading.value = false;
  }
}

// 点击 "管理订阅" → 获取 Customer Portal URL → 跳转 LemonSqueezy 自助管理
async function handleManageSubscription() {
  managingSubscription.value = true;
  try {
    const { url } = await $fetch<{ url: string }>("/api/billing/portal", {
      method: "POST",
    });
    window.location.href = url;
  } catch (err: any) {
    if (err?.statusCode === 401) {
      navigateTo(localePath("/login"));
      return;
    }
    ElMessage.error(
      t("pricing.manageError") || "Failed to open subscription portal.",
    );
  } finally {
    managingSubscription.value = false;
  }
}
</script>

<template>
  <main
    class="flex-grow py-12 lg:py-16 px-6 md:px-12 max-w-7xl mx-auto w-full relative"
  >

    <!-- Ambient Background Glow -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[500px] bg-primary/10 blur-[100px] rounded-full pointer-events-none -z-10"
    ></div>

    <!-- Header Section -->
    <header class="text-center mb-16 md:mb-20 max-w-3xl mx-auto">
      <h1
        class="font-sans font-black text-4xl md:text-5xl lg:text-6xl tracking-tight text-slate-900 dark:text-white mb-6"
      >
        {{ t("pricing.title") }}
      </h1>
      <p
        class="font-sans text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed"
      >
        {{ t("pricing.subtitle") }}
      </p>
    </header>

    <!-- Pricing Cards Grid -->
    <div
      class="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch relative"
    >
      <!-- Free Plan Card -->
      <div
        class="bg-white dark:bg-slate-800 rounded-2xl p-8 md:p-10 flex flex-col border border-slate-200 dark:border-slate-700 shadow-sm hover:-translate-y-1 hover:shadow-xl dark:shadow-slate-900/50 transition-all duration-300 relative z-10 group"
      >
        <div class="mb-8">
          <h2
            class="font-sans font-bold text-2xl text-slate-900 dark:text-white mb-2"
          >
            {{ t("pricing.free.name") }}
          </h2>
          <div class="flex items-baseline gap-2">
            <span
              class="font-sans font-black text-5xl text-slate-900 dark:text-white"
              >{{ t("pricing.free.price") }}</span
            >
            <span
              class="font-sans text-slate-500 dark:text-slate-400 font-medium"
              >{{ t("pricing.free.period") }}</span
            >
          </div>
          <p class="font-sans text-sm text-slate-500 dark:text-slate-400 mt-4">
            {{ t("pricing.free.desc") }}
          </p>
        </div>
        <div>
          <ul class="space-y-5">
            <li
              class="flex items-start gap-3 font-sans text-slate-700 dark:text-slate-200"
            >
              <span
                class="material-symbols-outlined text-primary/80 text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >check_circle</span
              >
              <span>{{ t("pricing.free.features.compress") }}</span>
            </li>
            <li
              class="flex items-start gap-3 font-sans text-slate-700 dark:text-slate-200"
            >
              <span
                class="material-symbols-outlined text-primary/80 text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >check_circle</span
              >
              <span>{{ t("pricing.free.features.convert") }}</span>
            </li>
            <li
              class="flex items-start gap-3 font-sans text-slate-700 dark:text-slate-200"
            >
              <span
                class="material-symbols-outlined text-primary/80 text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >check_circle</span
              >
              <span>{{ t("pricing.free.features.resize") }}</span>
            </li>
            <li
              class="flex items-start gap-3 font-sans text-slate-700 dark:text-slate-200"
            >
              <span
                class="material-symbols-outlined text-primary/80 text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >check_circle</span
              >
              <span>{{ t("pricing.free.features.batch") }}</span>
            </li>
            <li
              class="flex items-start gap-3 font-sans text-slate-700 dark:text-slate-200"
            >
              <span
                class="material-symbols-outlined text-primary/80 text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >check_circle</span
              >
              <span>{{ t("pricing.free.features.size") }}</span>
            </li>
            <li
              class="flex items-start gap-3 font-sans text-slate-700 dark:text-slate-200"
            >
              <span
                class="material-symbols-outlined text-primary/80 text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >auto_awesome</span
              >
              <span>{{ t("pricing.free.features.copilot") }}</span>
            </li>
            <li
              class="flex items-start gap-3 font-sans text-slate-400 dark:text-slate-500"
            >
              <span
                class="material-symbols-outlined text-slate-300 dark:text-slate-600 text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >cancel</span
              >
              <span>{{ t("pricing.free.notIncluded.support") }}</span>
            </li>
          </ul>
        </div>
        <div class="mt-auto pt-10">
          <NuxtLink
            :to="localePath('/')"
            class="block text-center w-full py-3 px-5 rounded-xl border border-slate-200 dark:border-slate-700 font-sans font-medium text-primary bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-primary/30 transition-all active:scale-95 group-hover:shadow-sm"
          >
            {{ t("pricing.free.cta") }}
          </NuxtLink>
          <!-- 占位：与 Pro 卡片的 manageSubscriptionDesc 等高，保持按钮对齐 -->
          <p class="font-sans text-xs text-center mt-2 invisible">&nbsp;</p>
        </div>
      </div>

      <!-- Pro Plan Card -->
      <div
        class="bg-white dark:bg-slate-800 rounded-2xl p-8 md:p-10 flex flex-col border border-primary/30 shadow-[0_8px_30px_rgb(36,99,235,0.12)] dark:shadow-[0_8px_30px_rgb(36,99,235,0.2)] hover:-translate-y-1 hover:shadow-[0_20px_40px_rgb(36,99,235,0.15)] transition-all duration-300 relative z-20"
      >
        <!-- Most Popular Badge -->
        <div
          class="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-purple-600 text-white font-sans text-xs font-bold px-4 py-1.5 rounded-full tracking-wider uppercase shadow-md whitespace-nowrap"
        >
          {{ t("pricing.pro.badge") }}
        </div>
        <div class="mb-8">
          <h2
            class="font-sans font-bold text-2xl text-primary flex items-center gap-2 mb-2"
          >
            {{ t("pricing.pro.name") }}
            <span
              class="material-symbols-outlined text-primary"
              style="font-variation-settings: &quot;FILL&quot; 1"
              >workspace_premium</span
            >
          </h2>
          <div class="flex items-baseline gap-2">
            <span
              class="font-sans font-black text-5xl text-slate-900 dark:text-white"
              >{{ t("pricing.pro.price") }}</span
            >
            <span
              class="font-sans text-slate-500 dark:text-slate-400 font-medium"
              >{{ t("pricing.pro.period") }}</span
            >
          </div>
          <p class="font-sans text-sm text-slate-500 dark:text-slate-400 mt-4">
            {{ t("pricing.pro.desc") }}
          </p>
        </div>
        <div>
          <ul class="space-y-5">
            <li
              class="flex items-start gap-3 font-sans text-slate-900 dark:text-white font-medium"
            >
              <span
                class="material-symbols-outlined text-primary text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >check_circle</span
              >
              <span>{{ t("pricing.pro.features.everything") }}</span>
            </li>
            <div class="h-px w-full bg-slate-200 dark:bg-slate-700 my-4"></div>
            <li
              class="flex items-start gap-3 font-sans text-slate-900 dark:text-white"
            >
              <span
                class="material-symbols-outlined text-primary text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >all_inclusive</span
              >
              <span class="font-medium text-primary">{{
                t("pricing.pro.features.copilot")
              }}</span>
            </li>
            <li
              class="flex items-start gap-3 font-sans text-slate-900 dark:text-white"
            >
              <span
                class="material-symbols-outlined text-purple-600 dark:text-purple-400 text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >psychology</span
              >
              <span>{{ t("pricing.pro.features.nl") }}</span>
            </li>
            <li
              class="flex items-start gap-3 font-sans text-slate-900 dark:text-white"
            >
              <span
                class="material-symbols-outlined text-purple-600 dark:text-purple-400 text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >account_tree</span
              >
              <span>{{ t("pricing.pro.features.pipeline") }}</span>
            </li>
            <li
              class="flex items-start gap-3 font-sans text-slate-900 dark:text-white"
            >
              <span
                class="material-symbols-outlined text-primary text-xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
                >support_agent</span
              >
              <span>{{ t("pricing.pro.features.support") }}</span>
            </li>
          </ul>
        </div>
        <div class="mt-auto pt-10">
          <!-- Pro: manage subscription button -->
          <button
            v-if="isPro"
            :disabled="managingSubscription"
            class="w-full py-3 px-5 rounded-xl font-sans font-medium text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            @click="handleManageSubscription"
          >
            <span
              v-if="managingSubscription"
              class="material-symbols-outlined animate-spin text-[18px]"
              >progress_activity</span
            >
            <span
              v-else
              class="material-symbols-outlined text-[18px]"
              style="font-variation-settings: &quot;FILL&quot; 1"
              >settings</span
            >
            {{
              managingSubscription
                ? t("pricing.processing") || "Processing..."
                : t("pricing.pro.manageSubscription")
            }}
          </button>
          <!-- Non-Pro: upgrade button -->
          <button
            v-else
            :disabled="upgrading"
            class="w-full py-3 px-5 rounded-xl font-sans font-medium text-white bg-primary hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200 active:scale-95 shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            @click="handleUpgrade"
          >
            <span
              v-if="upgrading"
              class="material-symbols-outlined animate-spin text-[18px] mr-1"
              >progress_activity</span
            >
            {{
              upgrading
                ? t("pricing.processing") || "Processing..."
                : t("pricing.pro.cta")
            }}
          </button>
          <!-- 描述文本：isPro 时显示管理说明，否则用 invisible 占位保持对齐 -->
          <p
            class="font-sans text-xs text-center mt-2"
            :class="isPro ? 'text-slate-400 dark:text-slate-500' : 'invisible'"
          >
            {{ isPro ? t("pricing.pro.manageSubscriptionDesc") : "&nbsp;" }}
          </p>
        </div>
      </div>
    </div>

    <!-- Trust Footer Info -->
    <div class="mt-16 text-center max-w-2xl mx-auto">
      <p
        class="font-sans text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 flex-wrap"
      >
        <span class="material-symbols-outlined text-[16px]">verified_user</span>
        {{ t("pricing.trust") }}
      </p>
    </div>
  </main>
</template>


