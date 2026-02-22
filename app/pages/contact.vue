<script setup lang="ts">
const { t } = useI18n();

useHead({
  title: () => t("seo.contact.title"),
  meta: [
    {
      name: "description",
      content: () => t("seo.contact.description"),
    },
  ],
});

const email = "shuaikangzhang62@gmail.com";
const copied = ref(false);

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(email);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // fallback: select the text
    const input = document.createElement("input");
    input.value = email;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-slate-900">
    <div class="mx-auto max-w-3xl px-6 py-16 sm:py-24 lg:px-8">
      <h1
        class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl mb-4"
      >
        {{ t("footer.contact") }}
      </h1>
      <p class="text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
        {{ t("legal.contact.desc") }}
      </p>

      <!-- Email Card -->
      <div
        class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6 sm:p-8"
      >
        <div class="flex items-center gap-3 mb-4">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white"
          >
            <span class="material-symbols-outlined text-[20px]">mail</span>
          </div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ t("legal.contact.emailTitle") }}
          </h2>
        </div>

        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <a
            :href="`mailto:${email}`"
            class="text-primary hover:underline text-lg font-medium break-all"
          >
            {{ email }}
          </a>
          <button
            class="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200"
            :class="
              copied
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            "
            @click="copyEmail"
          >
            <span class="material-symbols-outlined text-[16px]">
              {{ copied ? "check" : "content_copy" }}
            </span>
            {{ copied ? t("legal.contact.copied") : t("legal.contact.copy") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
