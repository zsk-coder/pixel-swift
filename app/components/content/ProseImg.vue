<script setup lang="ts">
/**
 * 自定义 ProseImg 组件
 * 将 Nuxt Content markdown 中的 /images/blog/ 路径映射到 ~/assets/images/blog/
 * 这样 markdown 中写 ![alt](/images/blog/xxx.png) 就能从 assets 加载
 */
const props = defineProps<{
  src?: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
}>();

// 将所有 assets/images/blog 下的图片做 glob import
const blogImages = import.meta.glob(
  "~/assets/images/blog/*.{png,jpg,jpeg,webp,svg}",
  {
    eager: true,
    import: "default",
  },
);

const resolvedSrc = computed(() => {
  if (!props.src) return "";

  // 如果是 /images/blog/ 开头的路径，从 assets 中查找
  if (props.src.startsWith("/images/blog/")) {
    const filename = props.src.replace("/images/blog/", "");
    // glob import 的 key 格式是 /assets/images/blog/xxx.png
    const assetKey = Object.keys(blogImages).find((key) =>
      key.endsWith(`/${filename}`),
    );
    if (assetKey) {
      return blogImages[assetKey] as string;
    }
  }

  // 其他路径直接返回
  return props.src;
});
</script>

<template>
  <img
    v-if="resolvedSrc"
    :src="resolvedSrc"
    :alt="alt || ''"
    :width="width"
    :height="height"
    loading="lazy"
  />
</template>
