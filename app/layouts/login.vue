<template>
  <div class="relative min-h-screen w-full bg-white text-slate-900">
    <NuxtLink
      to="/"
      class="absolute left-6 top-6 inline-flex items-center gap-2 sm:left-8 sm:top-8"
    >
      <span
        class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm"
      >
        <span
          class="material-symbols-outlined text-[20px]"
          :style="{ fontVariationSettings: '\'FILL\' 1' }"
          >auto_fix_high</span
        >
      </span>
      <span class="text-lg font-semibold tracking-tight text-slate-950">
        PixelSwift
      </span>
    </NuxtLink>

    <div class="flex min-h-screen w-full items-center justify-center px-6 py-20 sm:px-8">
      <div
        class="flex w-full justify-center -translate-y-[8vh] sm:-translate-y-[9vh] lg:-translate-y-[10vh]"
      >
        <slot />
      </div>
    </div>

    <div
      class="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-4 text-xs font-medium text-slate-400"
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
</template>

<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();
</script>
