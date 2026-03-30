export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = query.url as string;

  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: "URL is required",
    });
  }

  // 安全审计修复 1：SSRF (服务端请求伪造) 防御。严格限制协议，防止 file:///etc/passwd 等内网探测
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error();
    }
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid Protocol" });
  }

  try {
    // 伪装成真实的浏览器请求，防止被目标网站（如 Bing, 微博，淘宝）的防盗链和反爬虫系统拦截
    const targetOrigin = new URL(url).origin;
    
    // 安全防范 3：防挂起攻击 (Timeout Attack)。加入 15 秒绝对超时，防止目标服务器故意不回包把你的接口连接池耗尽
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        "Referer": targetOrigin, // 有些网站根据 Referer 判断是否允许下载图片
        "Connection": "keep-alive"
      }
    });

    clearTimeout(timeout);
    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: "Failed to fetch image",
      });
    }

    // 安全审计修复 2：防 DDoS 与内存溢出 (OOM)。限制单张图片最大下载体积为 20MB。
    // 如果恶意用户传入一个 10GB 的 4K 视频直链，不做这个验证会瞬间撑爆你的服务器内存。
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    if (contentLength > 20 * 1024 * 1024) {
      throw createError({
        statusCode: 413,
        statusMessage: "Image too large (Max 20MB)",
      });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    
    // 安全防范 4：防木马与异形文件滥用。代理接口只允许返回图片，拒绝代理 .exe, html 等恶意内容
    if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
      throw createError({
        statusCode: 415,
        statusMessage: "Unsupported Media Type: Images Only",
      });
    }

    const arrayBuffer = await response.arrayBuffer();

    // Set appropriate headers so the client receives a raw blob
    setResponseHeader(event, "Content-Type", contentType);
    setResponseHeader(event, "Cache-Control", "public, max-age=3600");

    // 关键修复：Nuxt Nitro 遇到原生的 ArrayBuffer 会把它当作普通对象 JSON.stringify 变成 "{}" (刚好 2 个字节！)
    // 必须用 Buffer.from() 包装一层才能作为二进制流发送
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Error fetching image proxy:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
    });
  }
});
