<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div
    class="relative flex w-full flex-col justify-between bg-primary p-12 text-white overflow-hidden bg-grid-pattern"
  >
    <!-- 环境光晕装饰 -->
    <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div
        class="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-white opacity-10 blur-[120px]"
      />
      <div
        class="absolute bottom-[10%] right-[5%] w-[40%] h-[40%] rounded-full bg-violet-600 opacity-20 blur-[100px]"
      />
    </div>

    <!-- 品牌 Logo -->
    <div class="relative z-10">
      <NuxtLink to="/" class="group inline-flex items-center gap-2">
        <span
          class="material-symbols-outlined text-3xl text-white transition-transform duration-300 group-hover:scale-110"
          :style="{ fontVariationSettings: '\'FILL\' 1' }"
          >auto_fix_high</span
        >
        <span
          class="font-headline text-2xl font-black tracking-tight text-white"
          >PixelSwift</span
        >
      </NuxtLink>
    </div>

    <!-- 主营销文案 -->
    <div class="relative z-10 max-w-2xl mt-24 mb-auto">
      <h1 class="text-[3.5rem] leading-[1.15] font-black tracking-tight mb-10">
        {{ t("auth.login.heroTitle") }}
      </h1>
      <p class="text-xl leading-relaxed font-medium max-w-xl text-primary-100">
        {{ t("auth.login.heroSubtitle") }}
      </p>
    </div>

    <!-- 底部浮动卡片组 -->
    <div class="relative z-10 w-full h-64 mt-12 flex items-end">
      <div class="relative w-full h-full flex items-end gap-6 opacity-90">
        <!-- 卡片 1：图片处理 -->
        <div
          class="w-1/3 bg-white/10 backdrop-blur-md border border-white/20 rounded-t-2xl h-48 p-6 flex flex-col gap-4 translate-y-4 hover:translate-y-0 transition-transform duration-500 shadow-2xl"
        >
          <div
            class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"
          >
            <span class="material-symbols-outlined text-white">image</span>
          </div>
          <div class="h-2 w-2/3 bg-white/30 rounded-full mt-auto" />
          <div class="h-2 w-1/2 bg-white/20 rounded-full" />
        </div>

        <!-- 卡片 2：AI 处理（主卡片，最高） -->
        <div
          class="w-1/3 bg-white/15 backdrop-blur-xl border border-white/30 rounded-t-2xl h-64 p-6 flex flex-col gap-4 shadow-2xl z-10"
        >
          <div
            class="w-12 h-12 bg-white text-primary rounded-full flex items-center justify-center"
          >
            <span
              class="material-symbols-outlined"
              :style="{ fontVariationSettings: '\'FILL\' 1' }"
              >bolt</span
            >
          </div>
          <div class="h-3 w-3/4 bg-white/40 rounded-full mt-auto" />
          <div class="h-2 w-full bg-white/20 rounded-full" />
          <div class="h-2 w-5/6 bg-white/20 rounded-full" />
        </div>

        <!-- 卡片 3：验证完成 -->
        <div
          class="w-1/3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-t-2xl h-32 p-6 flex flex-col gap-4 translate-y-8 shadow-xl"
        >
          <div
            class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
          >
            <span class="material-symbols-outlined text-white/70"
              >check_circle</span
            >
          </div>
          <div class="h-2 w-1/2 bg-white/20 rounded-full mt-auto" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 网格纹背景：Tailwind 无法直接表达，用 scoped CSS */
.bg-grid-pattern {
  background-size: 40px 40px;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
}
</style>
