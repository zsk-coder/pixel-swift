// 当插件安装时，创建一个鼠标右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pixelswift-compress",
    title: chrome.i18n.getMessage("contextMenuTitle"),
    contexts: ["image"] // 仅在右键点击图片时显示
  });
});

// 当用户点击了这个右键菜单时
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "pixelswift-compress") {
    // 获取到用户右键点击的那张网页图片的真实 URL 地址
    const imageUrl = info.srcUrl;
    
    // 审计修复 3：直接拦截 Base64 (data:image) 格式。如果把几兆的图片字符串当参数传进 URL，
    // 往往会导致 Nginx/浏览器报出 414 URI Too Long 错误甚至崩溃。
    if (imageUrl.startsWith("data:")) {
      console.warn("PixelSwift: Local base64 data images are too large to pass via URL.");
      return;
    }
    
    // 打开官方网站，并把图片 URL 作为参数挂在后面带过去
    const pixelswiftUrl = `https://pixelswift.site/compress-image?url=${encodeURIComponent(imageUrl)}`;
    
    // 自动新开一个标签页，跳去网站
    chrome.tabs.create({ url: pixelswiftUrl });
  }
});
