<template>
  <!-- 登录页分栏布局：左 55% 品牌区 + 右 45% 表单区 -->
  <div
    class="flex h-screen w-full overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-white"
  >
    <!-- 左侧品牌面板（移动端隐藏） -->
    <aside class="hidden w-[55%] lg:flex">
      <LoginBrandPanel />
    </aside>

    <!-- 右侧表单区 -->
    <div
      class="relative flex w-full flex-col items-center justify-center p-8 pb-[8vh] sm:p-12 sm:pb-[10vh] lg:w-[45%] lg:p-16 lg:pb-[12vh]"
    >
      <!-- 移动端 Logo（仅小屏可见） -->
      <div class="absolute left-8 top-8 flex items-center gap-2 lg:hidden">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white shadow-sm"
        >
          <span
            class="material-symbols-outlined text-sm"
            :style="{ fontVariationSettings: '\'FILL\' 1' }"
            >auto_fix_high</span
          >
        </div>
        <span class="text-xl font-black tracking-tight">PixelSwift</span>
      </div>

      <!-- 表单插槽 -->
      <slot />

      <!-- 底部链接 -->
      <div
        class="absolute bottom-8 flex gap-4 text-xs font-medium text-slate-400"
      >
        <NuxtLink
          :to="localePath('/privacy')"
          class="transition-colors hover:text-primary"
        >
          {{ t("footer.privacy") }}
        </NuxtLink>
        <span>·</span>
        <NuxtLink
          :to="localePath('/terms')"
          class="transition-colors hover:text-primary"
        >
          {{ t("footer.terms") }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
</script>
