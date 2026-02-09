<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: t("seo.resizer.title"),
  meta: [{ name: "description", content: t("seo.resizer.description") }],
});

type ResizeMode = "pixel" | "percent" | "ratio";

const mode = ref<ResizeMode>("pixel");
const width = ref(1920);
const height = ref(1080);
const scale = ref(100);
const keepRatio = ref(true);
const selectedRatio = ref("");
const files = ref<File[]>([]);

// Original dimensions (would be set from loaded image)
const originalWidth = ref(3840);
const originalHeight = ref(2160);

const hasFiles = computed(() => files.value.length > 0);

const ratioPresets = computed(() => [
  { label: t("resizer.presets.1:1"), value: "1:1" },
  { label: t("resizer.presets.4:3"), value: "4:3" },
  { label: t("resizer.presets.16:9"), value: "16:9" },
  { label: t("resizer.presets.3:2"), value: "3:2" },
  { label: t("resizer.presets.9:16"), value: "9:16" },
  { label: t("resizer.presets.custom"), value: "custom" },
]);

function onFilesAdded(newFiles: File[]) {
  files.value = [...files.value, ...newFiles];
}

function onWidthChange(val: number) {
  width.value = val;
  if (keepRatio.value && originalWidth.value) {
    height.value = Math.round(
      (val / originalWidth.value) * originalHeight.value,
    );
  }
}

function onHeightChange(val: number) {
  height.value = val;
  if (keepRatio.value && originalHeight.value) {
    width.value = Math.round(
      (val / originalHeight.value) * originalWidth.value,
    );
  }
}

function onProcess() {
  // TODO: trigger resizing
  console.log("Resize clicked");
}

const outputPercent = computed(() => {
  if (mode.value === "percent") return scale.value;
  return Math.round((width.value / originalWidth.value) * 100);
});
</script>

<template>
  <div class="py-8 md:py-12">
    <div class="content-wrapper">
      <h1
        class="text-page-title font-bold text-text-primary dark:text-dark-text mb-2"
      >
        {{ t("resizer.title") }}
      </h1>
      <p class="text-text-secondary mb-8">
        {{ t("seo.resizer.description") }}
      </p>

      <!-- Upload Area -->
      <FileUploader @files="onFilesAdded" />

      <!-- Resize Controls — always visible -->
      <div class="mt-8 space-y-6">
        <!-- Mode Selector -->
        <div class="card p-6">
          <div class="flex flex-wrap gap-4 mb-6">
            <label
              v-for="m in ['pixel', 'percent', 'ratio'] as ResizeMode[]"
              :key="m"
              class="flex items-center gap-2 cursor-pointer"
            >
              <input
                v-model="mode"
                type="radio"
                name="resize-mode"
                :value="m"
                class="text-brand"
              />
              <span class="font-medium text-text-primary dark:text-dark-text">
                {{ t(`resizer.mode.${m}`) }}
              </span>
            </label>
          </div>

          <!-- Pixel Mode -->
          <div v-if="mode === 'pixel'" class="space-y-4">
            <div
              class="flex flex-col sm:flex-row items-start sm:items-center gap-4"
            >
              <div class="flex-1">
                <label class="block text-caption text-text-secondary mb-1"
                  >{{ t("resizer.width") }} (px)</label
                >
                <input
                  :value="width"
                  type="number"
                  min="1"
                  max="10000"
                  class="w-full border border-surface-border dark:border-dark-border rounded-input px-3 py-2 bg-transparent"
                  @input="
                    onWidthChange(
                      Number(($event.target as HTMLInputElement).value),
                    )
                  "
                />
              </div>

              <button
                class="mt-5 text-xl"
                :class="keepRatio ? 'text-brand' : 'text-text-secondary'"
                :title="t('resizer.keepRatio')"
                @click="keepRatio = !keepRatio"
              >
                {{ keepRatio ? "🔗" : "🔓" }}
              </button>

              <div class="flex-1">
                <label class="block text-caption text-text-secondary mb-1"
                  >{{ t("resizer.height") }} (px)</label
                >
                <input
                  :value="height"
                  type="number"
                  min="1"
                  max="10000"
                  class="w-full border border-surface-border dark:border-dark-border rounded-input px-3 py-2 bg-transparent"
                  @input="
                    onHeightChange(
                      Number(($event.target as HTMLInputElement).value),
                    )
                  "
                />
              </div>
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="keepRatio"
                type="checkbox"
                class="rounded text-brand"
              />
              <span class="text-sm text-text-secondary">{{
                t("resizer.keepRatio")
              }}</span>
            </label>
          </div>

          <!-- Percent Mode -->
          <div v-if="mode === 'percent'" class="space-y-4">
            <label class="block text-caption text-text-secondary mb-1"
              >{{ t("resizer.scale") }}: {{ scale }}%</label
            >
            <QualitySlider v-model="scale" :min="1" :max="500" />
          </div>

          <!-- Ratio Mode -->
          <div v-if="mode === 'ratio'" class="flex flex-wrap gap-3">
            <button
              v-for="preset in ratioPresets"
              :key="preset.value"
              class="px-4 py-2 rounded-btn text-sm font-medium border transition-all"
              :class="[
                selectedRatio === preset.value
                  ? 'bg-brand text-white border-brand'
                  : 'text-text-secondary border-surface-border dark:border-dark-border hover:border-brand',
              ]"
              @click="selectedRatio = preset.value"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <!-- Output Preview -->
        <div class="text-center text-caption text-text-secondary">
          {{
            t("resizer.outputPreview", {
              width,
              height,
              percent: outputPercent,
            })
          }}
        </div>

        <!-- Process -->
        <div class="flex flex-col sm:flex-row gap-3">
          <DownloadButton
            class="flex-1"
            :label="t('common.process')"
            :disabled="!hasFiles"
            @click="onProcess"
          />
        </div>

        <!-- Hint when no files -->
        <p
          v-if="!hasFiles"
          class="text-center text-caption text-text-secondary/60"
        >
          ↑ {{ t("upload.dragText") }}
        </p>
      </div>
    </div>
  </div>
</template>
