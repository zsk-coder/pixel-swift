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
    // 智能检测当前浏览器的界面的语言，例如 'zh-CN', 'ja', 'en-US'
    const rawLang = chrome.i18n.getUILanguage() || 'en';
    const lang = rawLang.split('-')[0].toLowerCase();
    
    // 根据项目配置的 8 种语言进行匹配，英文是默认路由不需要加前缀
    const supportedLocales = ['zh', 'es', 'ja', 'de', 'fr', 'pt', 'ko'];
    const localePath = supportedLocales.includes(lang) ? `/${lang}` : '';
    const baseUrl = `https://pixelswift.site${localePath}/compress-image`;

    // 如果是 Base64 数据则直接拦截，防止 URL 过长导致 414 错误
    if (imageUrl.startsWith('data:')) {
      // 打开官方网站（无参数），让用户手动粘贴
      chrome.tabs.create({ url: baseUrl });
      return;
    }
    
    // 打开官方对应的语言网站，并把图片 URL 作为参数挂在后面带过去
    const pixelswiftUrl = `${baseUrl}?url=${encodeURIComponent(imageUrl)}`;
    
    // 自动新开一个标签页，跳去网站
    chrome.tabs.create({ url: pixelswiftUrl });
  }
});
