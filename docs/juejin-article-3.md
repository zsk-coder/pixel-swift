# 掘金发帖文章（图片缩放篇）

> **发布说明**：复制分隔线以后的内容到掘金编辑器。标签选：`前端` `Canvas` `OffscreenCanvas` `图片处理`
> **分类**：前端
> **发布时间**：建议发布后在沸点同步推广

沸点内容：

图片缩放看起来只是 drawImage 改个宽高，但做成产品级工具后发现细节太多了：

🔒 锁定宽高比连续调整时精度漂移怎么解决？
🔄 旋转 90° 后 Canvas 宽高要交换，transform 矩阵怎么算？
🪞 翻转和旋转组合后翻转轴会跟着旋转走？
👀 用 CSS 做零开销的实时预览

踩了不少坑，整理成了一篇完整实现。核心是 OffscreenCanvas 的 transform 矩阵在旋转/翻转场景下的应用。

🔗 在线体验：pixelswift.site/resize-image
📖 文章：juejin.cn/spost/7620728823731011590

---

# 浏览器端图片缩放、旋转、翻转的完整实现——OffscreenCanvas Transform 矩阵详解

图片缩放看起来只是改个宽高，但真正做成产品级工具，需要处理锁定宽高比、百分比缩放、预设比例、旋转、翻转、CSS 实时预览等一堆细节。

这篇完整走一遍 [PixelSwift](https://pixelswift.site/) 图片缩放功能的实现，技术栈是 Nuxt 4 + Vue 3 + OffscreenCanvas。重点讲 OffscreenCanvas 的 transform 矩阵在旋转/翻转场景下的应用。

> 📚 **系列文章**
>
> - [第一篇：用 WASM 实现纯浏览器端的图片压缩](https://juejin.cn/)
> - [第二篇：Canvas API vs WebAssembly，浏览器端图片格式转换该怎么选](https://juejin.cn/)
> - **第三篇：浏览器端图片缩放、旋转、翻转的完整实现**（本文）

## 整体架构

整个缩放功能全程用 Canvas API 实现，分为 UI 层和处理层：

```
┌─────────────────────────────────────────────────────────┐
│  UI 层（主线程）                                          │
│  resize-image.vue                                        │
│  - 像素/百分比 双模式切换                                   │
│  - 宽高输入 + 锁定比例                                     │
│  - 宽高比预设（1:1 / 4:3 / 16:9 / 9:16 / 封面）           │
│  - 旋转/翻转工具栏                                         │
│  - CSS 实时预览（零处理开销）                               │
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

## 尺寸计算：锁定宽高比的实现

这是整个缩放功能最基础也最重要的逻辑。用户修改宽度时，如果锁定了宽高比，高度必须自动同步。

### 核心算法

```typescript
const originalWidth = ref(0); // 上传时读取的原始宽度
const originalHeight = ref(0); // 上传时读取的原始高度
const width = ref(1920); // 用户设定的目标宽度
const height = ref(1080); // 用户设定的目标高度
const keepRatio = ref(true); // 是否锁定宽高比

function onWidthChange(val: number) {
  width.value = val;
  if (keepRatio.value && originalWidth.value) {
    // 关键：基于原图的宽高比计算新高度
    // 不是用 width/height 当前值算，而是用 original 值算
    // 这样避免了连续调整时的精度累积误差
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
```

**一个关键设计决策**：比例计算始终基于**原始尺寸**（`originalWidth / originalHeight`），而不是当前的 `width / height`。

为什么？假设一张 1920×1080 的图：

1. 用户改宽度为 1000 → 高度自动算出 562.5，四舍五入为 563
2. 如果基于 `1000/563` 反算，用户改高度为 500 → 宽度 = `500 / 563 * 1000 = 888`
3. 再改宽度为 900 → 高度 = `900 / 888 * 500 = 507`

每次四舍五入都会引入误差，连续操作后宽高比越来越偏。而始终基于原始尺寸计算，宽高比永远是精确的 `1920/1080 = 16/9`。

### 百分比模式

百分比模式更简单——一个滑块控制缩放比例，宽高都按比例计算：

```typescript
const scale = ref(100); // 1-500%

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

用 `computed` 统一 `targetWidth` / `targetHeight`，下游代码不需要关心当前是像素模式还是百分比模式。

### 预设比例

提供 5 个常用预设，点击后自动计算目标尺寸：

```typescript
const quickPresets = [
  { label: "1:1", value: "1:1" }, // 头像、社交媒体方形图
  { label: "4:3", value: "4:3" }, // 传统照片、PPT
  { label: "16:9", value: "16:9" }, // 视频封面、网页横幅
  { label: "9:16", value: "9:16" }, // 手机壁纸、短视频封面
  { label: "封面", value: "cover" }, // 社交封面 1200×630
];

function applyPreset(presetValue: string) {
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

  const [rw, rh] = presetValue.split(":").map(Number);
  if (!rw || !rh || !originalWidth.value) return;

  // 以原图宽度为基准，计算新高度
  width.value = originalWidth.value;
  height.value = Math.round(originalWidth.value * (rh / rw));
  mode.value = "pixel";
}
```

**设计细节**：预设以原图宽度为基准计算高度，一张 4000px 宽的照片选 16:9，得到的是 4000×2250，而不是某个固定的 1920×1080。`cover` 是例外——Open Graph 推荐的社交封面尺寸是固定的 1200×630。

## 旋转与翻转：OffscreenCanvas Transform 矩阵

缩放工具不仅改尺寸，还支持旋转（±90°）和翻转（水平/垂直）。这部分是整篇文章最核心的技术内容。

### 状态管理

```typescript
const rotation = ref(0); // 0, 90, 180, 270
const flipH = ref(false); // 水平翻转
const flipV = ref(false); // 垂直翻转

function rotateLeft() {
  rotation.value = (rotation.value - 90 + 360) % 360;
}
function rotateRight() {
  rotation.value = (rotation.value + 90) % 360;
}
```

`(rotation - 90 + 360) % 360` 保证结果始终在 0-359 范围内。加 360 是为了避免 JavaScript 对负数取模的行为（`-90 % 360 = -90`，不是 270）。

### applyTransforms：核心变换函数

这是整个缩放功能最复杂的一段代码。用 OffscreenCanvas 的 2D context 做坐标变换：

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

  const mimeType =
    originalFormat.value === "png"
      ? "image/png"
      : originalFormat.value === "webp"
        ? "image/webp"
        : "image/jpeg";
  return await canvas.convertToBlob({ type: mimeType, quality: 0.92 });
}
```

### 为什么要先 translate 到中心

Canvas 2D context 的所有变换操作都是基于**当前坐标原点**的，默认原点在左上角 `(0, 0)`。

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

### 变换顺序为什么是 translate → rotate → scale → drawImage

Canvas 的 transform 是**从后往前应用**的（类似矩阵乘法的右乘）。实际执行顺序是：

1. `drawImage` 把图片放在 `(-w/2, -h/2)`
2. `scale` 对图片做镜像翻转
3. `rotate` 旋转图片
4. `translate` 把结果移到画布中心

这个「后进先出」的顺序保证了翻转发生在旋转之前（否则翻转轴会跟着旋转走，结果就不对了）。

> **踩坑**：我最初把 scale 放在 rotate 前面，发现旋转 90° 后水平翻转变成了垂直翻转。原因就是变换顺序搞反了——代码里写在前面的 transform，实际上是最后执行的。

## CSS 实时预览——零开销的交互体验

缩放工具一个很重要的交互：用户调整宽高或点预设时，预览区域要实时响应。但不能每次调整都触发 Canvas 处理——那会卡死。

解决方案：**预览完全用 CSS 实现，不触发任何图片处理。**

```typescript
const previewTransform = computed(() => {
  const transforms: string[] = [];
  if (rotation.value) transforms.push(`rotate(${rotation.value}deg)`);
  if (flipH.value) transforms.push("scaleX(-1)");
  if (flipV.value) transforms.push("scaleY(-1)");
  return transforms.length ? transforms.join(" ") : "none";
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

预览区底部有一个浮动徽章实时显示目标尺寸，当尺寸与原图不同时从黑色变为品牌蓝色，给用户一个明确的视觉提示。

## 处理管线：从点击到下载

用户点击「调整并下载」，执行两步处理：

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

    // ── 步骤 2：缩放 ──
    const result = await processImage(sourceFile as File, {
      action: "resize",
      width: targetWidth.value,
      height: targetHeight.value,
      keepAspectRatio: false, // UI 层已经算好了精确尺寸
      outputFormat: outFormat,
      quality: 92,
    });

    // ── 步骤 3：自动下载 ──
    const filename = generateFileName(file.name, "resize", {
      format: outFormat,
      width: targetWidth.value,
      height: targetHeight.value,
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

1. **两步分离**：先 `applyTransforms` 做旋转/翻转，再 `processImage` 做缩放。`processImage` 是压缩/转换/缩放三个功能共用的通用函数，不耦合旋转逻辑。
2. **keepAspectRatio: false**：UI 层已经精确计算了目标尺寸，处理层不需要再算一次。
3. **自动下载**：缩放不需要先预览对比再下载（跟压缩不同），处理完直接触发下载。
4. **文件命名**：`photo_1920x1080.jpg`，后缀包含目标尺寸，方便用户区分不同版本。

## 性能数据

测试环境：Ryzen 5 笔记本，Chrome 130，16GB 内存

| 操作                       | 文件大小 | 耗时   | 说明                      |
| -------------------------- | -------- | ------ | ------------------------- |
| 缩放 3840×2160 → 1920×1080 | 5MB JPG  | ~60ms  | drawImage + convertToBlob |
| 缩放 + 旋转 90°            | 5MB JPG  | ~120ms | 两次 Canvas 操作          |
| 缩放 + 旋转 + 翻转         | 5MB JPG  | ~130ms | 翻转几乎无额外开销        |
| 放大 1920 → 3840（200%）   | 3MB JPG  | ~150ms | 放大比缩小慢              |
| 预览响应时间               | 任意     | 0ms    | 纯 CSS，没有图片处理      |

对比在线工具：同一张 5MB 图片缩放，PixelSwift ~60ms，iLoveIMG 3-10 秒（含上传下载）。而且图片全程不离开浏览器，没有隐私顾虑。

## 踩坑清单

1. **旋转 90° 后 Canvas 宽高要交换**：1920×1080 旋转 90° 后应该是 1080×1920，不交换就会画变形
2. **transform 顺序反直觉**：Canvas 的 translate/rotate/scale 是「后写先执行」，和直觉相反
3. **负数取模**：JS 中 `-90 % 360 = -90`，不是 270。需要先加 360 再取模
4. **CSS 预览 vs Canvas 处理的同步**：CSS `rotate(90deg)` 和 Canvas `ctx.rotate(Math.PI/2)` 旋转方向一致（都是顺时针），不需要额外换算
5. **keepAspectRatio 双层问题**：UI 层已经算好了精确尺寸，传给 processImage 时要设 `false`，否则会再算一次导致尺寸偏差
6. **放大时的质量**：`drawImage` 放大时浏览器默认用双线性插值，质量可接受，不需要额外锐化

## 小结

| 设计点   | 方案                                             |
| -------- | ------------------------------------------------ |
| 缩放引擎 | 纯 Canvas API，`drawImage` + `convertToBlob`     |
| 锁定比例 | 始终基于原图尺寸计算，避免精度累积               |
| 实时预览 | CSS `transform` + `aspect-ratio`，零处理开销     |
| 变换处理 | 先 `applyTransforms` 再 `processImage`，两步分离 |
| 交互设计 | 缩放处理完自动下载，不需要二次确认               |

## 项目地址

- 在线使用：[pixelswift.site](https://pixelswift.site/)
- 图片压缩：[pixelswift.site/compress-image](https://pixelswift.site/compress-image)
- 格式转换：[pixelswift.site/converter](https://pixelswift.site/converter)
- 调整大小：[pixelswift.site/resize-image](https://pixelswift.site/resize-image)

有问题欢迎评论区交流。
