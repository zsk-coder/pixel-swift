# CSDN 发帖文章（图片缩放篇）

> **发布说明**：复制分隔线以后的内容到 CSDN 编辑器。标签：`前端` `Canvas` `OffscreenCanvas` `图片处理` `Vue.js`
> **系列**：本文是 PixelSwift 技术实现系列第三篇（[第一篇：图片压缩](https://blog.csdn.net/qq_43318990/article/details/159354547) · [第二篇：格式转换](https://blog.csdn.net/qq_43318990/article/details/TODO)）

---

# Nuxt 4 实战：浏览器端图片缩放、旋转、翻转的完整实现——OffscreenCanvas Transform 矩阵详解

> 图片缩放看起来只是改个宽高，但真正要做好，得处理锁定宽高比、百分比缩放、预设比例、旋转、翻转、CSS 实时预览等一堆细节。本文用完整代码讲清楚纯前端图片缩放工具的实现，重点是 OffscreenCanvas 的 transform 矩阵在旋转/翻转场景下的应用。

> **📚 PixelSwift 技术实现系列**
> - 第一篇：[浏览器端图片压缩实战](https://blog.csdn.net/qq_43318990/article/details/159354547)
> - 第二篇：[浏览器端图片格式转换实战](https://blog.csdn.net/qq_43318990/article/details/TODO)
> - **第三篇：浏览器端图片缩放、旋转、翻转实战**（本文）

## 前言

浏览器端的图片缩放，听起来简单——`drawImage(bitmap, 0, 0, newWidth, newHeight)` 一行就搞定了。但真正做成产品级工具，需要处理大量细节：

- 锁定宽高比时修改宽度，高度怎么自动跟着变？
- 百分比缩放和像素缩放怎么统一？
- 旋转 90° 后 Canvas 尺寸要交换宽高，transform 矩阵怎么算？
- 水平/垂直翻转和旋转组合怎么处理？
- 怎么做零开销的实时预览（不触发实际处理）？

本文完整走一遍 [PixelSwift](https://pixelswift.site/) 图片缩放功能的实现，技术栈是 Nuxt 4 + Vue 3 + OffscreenCanvas。

## 一、整体架构

整个缩放功能全程用 Canvas API 实现，分为 UI 层和处理层：

```
┌─────────────────────────────────────────────────────────┐
│  UI 层（主线程）                                          │
│  resize-image.vue                                        │
│  - 单图上传                                               │
│  - 像素/百分比 双模式切换                                   │
│  - 宽高输入 + 锁定比例                                     │
│  - 宽高比预设（1:1 / 4:3 / 16:9 / 9:16 / 封面）           │
│  - 旋转/翻转工具栏                                         │
│  - CSS 实时预览（零处理开销）                               │
│  - 一键缩放并下载                                          │
└──────────────┬──────────────────────────────────────────┘
               │ 点击「调整并下载」
               ▼
┌─────────────────────────────────────────────────────────┐
│  处理层                                                   │
│  1. applyTransforms()：旋转/翻转 → OffscreenCanvas        │
│  2. processImage()：缩放 → Canvas drawImage               │
│  3. convertToBlob() → 输出文件                             │
└─────────────────────────────────────────────────────────┘
```

缩放不涉及压缩率优化，`drawImage` 缩放 + `convertToBlob` 编码，浏览器内置实现完全够用。

## 二、尺寸计算：锁定宽高比的实现

这是整个缩放功能最基础也最重要的逻辑。用户修改宽度时，如果锁定了宽高比，高度必须自动同步——反之亦然。

### 2.1 核心算法

```typescript
const originalWidth = ref(0);   // 上传时读取的原始宽度
const originalHeight = ref(0);  // 上传时读取的原始高度
const width = ref(1920);        // 用户设定的目标宽度
const height = ref(1080);       // 用户设定的目标高度
const keepRatio = ref(true);    // 是否锁定宽高比

function onWidthChange(val: number) {
  width.value = val;
  if (keepRatio.value && originalWidth.value) {
    // 关键：基于原图的宽高比计算新高度
    // 不是用 width/height 当前值算，而是用 original 值算
    // 这样避免了连续调整时的精度累积误差
    height.value = Math.round(
      (val / originalWidth.value) * originalHeight.value
    );
  }
}

function onHeightChange(val: number) {
  height.value = val;
  if (keepRatio.value && originalHeight.value) {
    width.value = Math.round(
      (val / originalHeight.value) * originalWidth.value
    );
  }
}
```

**一个关键设计决策**：比例计算始终基于**原始尺寸**（`originalWidth / originalHeight`），而不是当前的 `width / height`。

为什么？假设一张 1920×1080 的图：
1. 用户改宽度为 1000 → 高度自动算出 562.5，四舍五入为 563
2. 如果基于 `1000/563` 反算，用户改高度为 500 → 宽度 = `500 / 563 * 1000 = 888`
3. 再改宽度为 900 → 高度 = `900 / 888 * 500 = 507`

每次四舍五入都会引入误差，连续操作后宽高比越来越偏。而始终基于原始尺寸计算，宽高比永远是精确的 `1920/1080 = 16/9`。

### 2.2 百分比模式

百分比模式更简单——一个滑块控制缩放比例，宽高都按比例计算：

```typescript
const scale = ref(100);  // 1-500%

const targetWidth = computed(() => {
  if (mode.value === "percent")
    return Math.round((originalWidth.value * scale.value) / 100);
  return width.value;
});

const targetHeight = computed(() => {
  if (mode.value === "percent")
    return Math.round((originalHeight.value * scale.value) / 100);
  return height.value;
});
```

用 `computed` 统一 `targetWidth` / `targetHeight`，下游代码（预览、处理）不需要关心当前是像素模式还是百分比模式。

### 2.3 预设比例

提供 5 个常用预设，点击后自动计算目标尺寸：

```typescript
const quickPresets = [
  { label: "1:1",   value: "1:1"   },  // 头像、社交媒体方形图
  { label: "4:3",   value: "4:3"   },  // 传统照片、PPT
  { label: "16:9",  value: "16:9"  },  // 视频封面、网页横幅
  { label: "9:16",  value: "9:16"  },  // 手机壁纸、短视频封面
  { label: "封面",  value: "cover" },  // 社交封面 1200×630
];

function applyPreset(presetValue: string) {
  // 切换选中状态（再次点击取消选中）
  selectedPreset.value =
    selectedPreset.value === presetValue ? "" : presetValue;
  if (!selectedPreset.value) return;

  if (presetValue === "cover") {
    // 社交封面：固定 1200×630（Open Graph 标准尺寸）
    width.value = 1200;
    height.value = 630;
    mode.value = "pixel";
    return;
  }

  // 解析比例字符串 "16:9" → [16, 9]
  const [rw, rh] = presetValue.split(":").map(Number);
  if (!rw || !rh || !originalWidth.value) return;

  // 以原图宽度为基准，计算新高度
  width.value = originalWidth.value;
  height.value = Math.round(originalWidth.value * (rh / rw));
  mode.value = "pixel";  // 预设自动切换到像素模式
}
```

**设计细节**：预设以原图宽度为基准计算高度，而不是硬编码固定尺寸。这样一张 4000px 宽的照片选 16:9，得到的是 4000×2250，而不是某个固定的 1920×1080。`cover` 是例外——Open Graph 推荐的社交封面尺寸是固定的 1200×630。

## 三、旋转与翻转：OffscreenCanvas Transform 矩阵

缩放工具不仅改尺寸，还支持旋转（±90°）和翻转（水平/垂直）。这部分是本文最核心的技术内容。

### 3.1 状态管理

```typescript
const rotation = ref(0);     // 0, 90, 180, 270
const flipH = ref(false);    // 水平翻转
const flipV = ref(false);    // 垂直翻转

function rotateLeft() {
  rotation.value = (rotation.value - 90 + 360) % 360;
}
function rotateRight() {
  rotation.value = (rotation.value + 90) % 360;
}
function toggleFlipH() {
  flipH.value = !flipH.value;
}
function toggleFlipV() {
  flipV.value = !flipV.value;
}
```

`(rotation - 90 + 360) % 360` 保证结果始终在 0-359 范围内。加 360 是为了避免 JavaScript 对负数取模的行为（`-90 % 360 = -90`，不是 270）。

### 3.2 applyTransforms：核心变换函数

这是整个缩放功能最复杂的一段代码。用 OffscreenCanvas 的 2D context 做坐标变换，需要理解 transform 矩阵的工作原理。

```typescript
async function applyTransforms(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let w = bitmap.width;
  let h = bitmap.height;

  // ⚠️ 关键：90° 或 270° 旋转时，Canvas 的宽高要交换
  // 一张 1920×1080 的横图旋转 90° 后变成 1080×1920 的竖图
  const isRotated90 = rotation.value === 90 || rotation.value === 270;
  const canvasW = isRotated90 ? h : w;
  const canvasH = isRotated90 ? w : h;

  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d")!;

  // 变换步骤（顺序很重要！）：
  // 1. 把坐标原点移到 Canvas 中心
  ctx.translate(canvasW / 2, canvasH / 2);
  // 2. 旋转（角度转弧度）
  ctx.rotate((rotation.value * Math.PI) / 180);
  // 3. 翻转（scale -1 就是镜像）
  if (flipH.value) ctx.scale(-1, 1);
  if (flipV.value) ctx.scale(1, -1);
  // 4. 从中心偏移画图（注意用的是原始宽高 w/h，不是 canvas 宽高）
  ctx.drawImage(bitmap, -w / 2, -h / 2);

  // 输出
  const mimeType =
    originalFormat.value === "png"
      ? "image/png"
      : originalFormat.value === "webp"
        ? "image/webp"
        : "image/jpeg";
  return await canvas.convertToBlob({ type: mimeType, quality: 0.92 });
}
```

### 3.3 为什么要先 translate 到中心

这是理解 Canvas transform 的关键。Canvas 2D context 的所有变换操作（translate、rotate、scale）都是基于**当前坐标原点**的。默认原点在左上角 `(0, 0)`。

如果不移到中心直接旋转：

```
旋转前（原点在左上角）:        旋转 90° 后:
┌──────────┐                  原图整体绕左上角旋转
│          │                  大部分内容跑到 Canvas 外面去了
│  image   │                  ↗ (看不见)
│          │                 /
└──────────┘               (0,0)
```

先 translate 到中心再旋转：

```
translate 后（原点在中心）:     旋转 90° 后:
┌──────────┐                  ┌──────┐
│          │                  │      │
│    ⊕     │    →             │  ⊕   │  内容在 Canvas 范围内
│  (原点)  │                  │      │
└──────────┘                  └──────┘
```

然后用 `drawImage(bitmap, -w/2, -h/2)` 从负偏移开始画，让图片中心对齐坐标原点。这样旋转是绕图片中心旋转的，不会跑出画布。

### 3.4 变换顺序为什么是 translate → rotate → scale → drawImage

Canvas 的 transform 是**从后往前应用**的（类似矩阵乘法的右乘）。实际执行顺序是：

1. `drawImage` 把图片放在 `(-w/2, -h/2)`
2. `scale` 对图片做镜像翻转
3. `rotate` 旋转图片
4. `translate` 把结果移到画布中心

这个「后进先出」的顺序保证了翻转发生在旋转之前（否则翻转轴会跟着旋转走，结果就不对了）。

> **踩坑**：我最初把 scale 放在 rotate 前面，发现旋转 90° 后水平翻转变成了垂直翻转。原因就是变换顺序搞反了——代码里写在前面的 transform，实际上是最后执行的。

## 四、CSS 实时预览——零开销的交互体验

缩放工具一个很重要的交互是：用户调整宽高或点预设时，预览区域要实时响应。但不能每次调整都触发 Canvas 处理——那会卡死。

### 4.1 纯 CSS 预览

解决方案：**预览完全用 CSS 实现，不触发任何图片处理**。

```typescript
// CSS transform 字符串，用于预览
const previewTransform = computed(() => {
  const transforms: string[] = [];
  if (rotation.value) transforms.push(`rotate(${rotation.value}deg)`);
  if (flipH.value) transforms.push("scaleX(-1)");
  if (flipV.value) transforms.push("scaleY(-1)");
  return transforms.length ? transforms.join(" ") : "none";
});

// CSS aspect-ratio，模拟缩放后的宽高比
const previewAspectStyle = computed(() => {
  const tw = targetWidth.value;
  const th = targetHeight.value;
  if (!tw || !th) return {};
  return { aspectRatio: `${tw} / ${th}` };
});
```

模板中只用 CSS 属性：

```vue
<img
  :src="previewUrl"
  :style="{
    transform: previewTransform,
    aspectRatio: `${targetWidth} / ${targetHeight}`,
  }"
/>
```

**效果**：用户拖滑块时图片实时变形，旋转/翻转即时响应，但不做任何像素级处理。只有点击「调整并下载」按钮时，才触发真正的 Canvas 处理。

### 4.2 尺寸信息实时反馈

预览区底部有一个浮动徽章，实时显示目标尺寸和处理后的文件大小：

```typescript
const hasDimensionChanged = computed(() => {
  return (
    targetWidth.value !== originalWidth.value ||
    targetHeight.value !== originalHeight.value ||
    rotation.value !== 0 ||
    flipH.value ||
    flipV.value
  );
});
```

当尺寸发生变化时，徽章从黑色变为品牌蓝色，给用户一个明确的视觉提示：「当前设置和原图不同，可以处理了」。

## 五、处理管线：从点击到下载

当用户点击「调整并下载」，`doResize` 函数执行两步处理：

```typescript
async function doResize() {
  if (!rawFile.value || isBusy.value) return;
  isBusy.value = true;

  try {
    const file = rawFile.value;
    const outFormat = detectOutputFormat(originalFormat.value);

    // ── 步骤 1：应用变换（旋转/翻转）──
    let sourceFile: File | Blob = file;
    if (rotation.value !== 0 || flipH.value || flipV.value) {
      sourceFile = await applyTransforms(file);
    }

    const tw = targetWidth.value;
    const th = targetHeight.value;

    // ── 步骤 2：缩放 ──
    const result = await processImage(sourceFile as File, {
      action: "resize",
      width: tw,
      height: th,
      keepAspectRatio: false,  // 我们已经在 UI 层算好了精确尺寸
      outputFormat: outFormat,
      quality: 92,
    });

    processedBlob.value = result.blob;
    processedSize.value = result.processedSize;
    isDone.value = true;

    // ── 步骤 3：自动下载 ──
    const filename = generateFileName(file.name, "resize", {
      format: outFormat,
      width: tw,
      height: th,
    });
    downloadFile(result.blob, filename);
  } catch (e) {
    console.error("Resize failed:", e);
  } finally {
    isBusy.value = false;
  }
}
```

**几个设计决策**：

1. **两步分离**：先 `applyTransforms` 做旋转/翻转，再 `processImage` 做缩放。而不是在一次 Canvas 操作中同时处理。原因是 `processImage` 是通用函数（压缩/转换/缩放共用），不应该耦合旋转逻辑。

2. **keepAspectRatio: false**：UI 层已经用 `onWidthChange` / `onHeightChange` 精确计算了目标尺寸，处理层不需要再做比例计算。

3. **自动下载**：处理完直接触发浏览器下载，不需要用户再点一次「下载」按钮。这是 resize 和 compress 的交互差异——压缩需要用户先预览对比再决定下载，缩放不需要。

4. **文件命名**：`photo_1920x1080.jpg`，后缀包含目标尺寸，方便用户区分不同版本。

## 六、性能数据

测试环境：Ryzen 5 笔记本，Chrome 130，16GB 内存

| 操作 | 文件大小 | 耗时 | 说明 |
|------|---------|------|------|
| 缩放 3840×2160 → 1920×1080 | 5MB JPG | ~60ms | drawImage + convertToBlob |
| 缩放 + 旋转 90° | 5MB JPG | ~120ms | 两次 Canvas 操作 |
| 缩放 + 旋转 + 翻转 | 5MB JPG | ~130ms | 翻转几乎无额外开销 |
| 放大 1920 → 3840（200%） | 3MB JPG | ~150ms | 放大比缩小慢（像素更多） |
| 预览响应时间 | 任意 | 0ms | 纯 CSS，没有图片处理 |

**和在线工具对比：**

| 指标 | PixelSwift | iLoveIMG |
|------|-----------|----------|
| 缩放 5MB 图片 | ~60ms | 3-10s（含上传下载） |
| 旋转+缩放 | ~130ms | 需要分开操作 |
| 隐私 | 不离开浏览器 | 上传到服务器 |
| 批量 | 单张（设计选择） | 支持批量 |

## 七、踩坑备忘

1. **旋转 90° 后 Canvas 宽高要交换**：1920×1080 旋转 90° 后应该是 1080×1920，如果不交换就会画变形
2. **transform 顺序反直觉**：Canvas 的 translate/rotate/scale 是「后写先执行」，和直觉相反
3. **负数取模**：JS 中 `-90 % 360 = -90`，不是 270。需要先加 360 再取模
4. **CSS 预览 vs Canvas 处理的同步**：CSS `transform: rotate(90deg)` 的旋转方向和 Canvas `ctx.rotate(Math.PI/2)` 是一致的（都是顺时针），不需要额外换算
5. **keepAspectRatio 双层问题**：UI 层已经算好了精确尺寸，传给 processImage 时要设 `false`，否则处理层会再算一次导致尺寸偏差
6. **放大时的质量问题**：`drawImage` 放大图片时浏览器默认用双线性插值，质量可接受。不需要额外的锐化处理

## 八、总结

图片缩放功能的核心设计：

- **纯 Canvas API**：`drawImage` 缩放 + `convertToBlob` 编码，浏览器内置实现完全够用
- **锁定比例基于原图算**：避免连续操作的精度累积误差
- **CSS 预览零开销**：用 `transform` 和 `aspect-ratio` 实时反馈，不触发像素处理
- **变换处理两步分离**：先 `applyTransforms`（旋转/翻转）再 `processImage`（缩放），保持通用处理函数的独立性
- **自动下载**：缩放不需要对比预览，处理完直接触发下载

## 项目地址

- 在线使用：[pixelswift.site](https://pixelswift.site/)
- 图片压缩：[pixelswift.site/compress-image](https://pixelswift.site/compress-image)
- 格式转换：[pixelswift.site/converter](https://pixelswift.site/converter)
- 调整大小：[pixelswift.site/resize-image](https://pixelswift.site/resize-image)

欢迎体验和评论区交流！

往期文章：
- [第一篇：浏览器端图片压缩实战](https://blog.csdn.net/qq_43318990/article/details/159354547)
- [第二篇：浏览器端图片格式转换实战](https://blog.csdn.net/qq_43318990/article/details/TODO)
