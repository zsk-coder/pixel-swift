// 当插件安装时，创建带有三个子菜单的右键菜单
chrome.runtime.onInstalled.addListener(() => {
  // 父菜单
  chrome.contextMenus.create({
    id: "pixelswift",
    title: chrome.i18n.getMessage("contextMenuTitle"),
    contexts: ["image"],
  });

  // 子菜单：压缩图片
  chrome.contextMenus.create({
    id: "pixelswift-compress",
    parentId: "pixelswift",
    title: chrome.i18n.getMessage("contextMenuCompress"),
    contexts: ["image"],
  });

  // 子菜单：转换格式
  chrome.contextMenus.create({
    id: "pixelswift-convert",
    parentId: "pixelswift",
    title: chrome.i18n.getMessage("contextMenuConvert"),
    contexts: ["image"],
  });

  // 子菜单：调整大小
  chrome.contextMenus.create({
    id: "pixelswift-resize",
    parentId: "pixelswift",
    title: chrome.i18n.getMessage("contextMenuResize"),
    contexts: ["image"],
  });
});

// 菜单ID → 页面路径映射
const PAGE_MAP = {
  "pixelswift-compress": "/compress-image",
  "pixelswift-convert": "/converter",
  "pixelswift-resize": "/resize-image",
};

// 当用户点击了某个子菜单时
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const pagePath = PAGE_MAP[info.menuItemId];
  if (!pagePath) return;

  const imageUrl = info.srcUrl;

  // 智能检测当前浏览器的界面语言，例如 'zh-CN', 'ja', 'en-US'
  const rawLang = chrome.i18n.getUILanguage() || "en";
  const lang = rawLang.split("-")[0].toLowerCase();

  // 根据项目配置的 8 种语言进行匹配，英文是默认路由不需要加前缀
  const supportedLocales = ["zh", "es", "ja", "de", "fr", "pt", "ko"];
  const localePath = supportedLocales.includes(lang) ? `/${lang}` : "";
  const baseUrl = `https://pixelswift.site${localePath}${pagePath}`;

  // 如果是 Base64 数据则直接拦截，防止 URL 过长导致 414 错误
  if (imageUrl.startsWith("data:")) {
    chrome.tabs.create({ url: baseUrl });
    return;
  }

  // 打开官方对应的语言网站，并把图片 URL 作为参数挂在后面带过去
  const pixelswiftUrl = `${baseUrl}?url=${encodeURIComponent(imageUrl)}`;
  chrome.tabs.create({ url: pixelswiftUrl });
});
