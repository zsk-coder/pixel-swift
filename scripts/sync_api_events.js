const fs = require("fs");
const path = require("path");

const localesDir = "e:\\code\\ai开发\\code\\pixel-swift\\locales";
const files = fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"));

const apiEventsEn = {
  SERVER_ERROR: {
    AI_NOT_CONFIGURED:
      "AI service is not configured. Please contact the administrator.",
    QUOTA_DATA_ERROR: "User quota data is abnormal. Please try again later.",
    INVALID_PARAMS: "Invalid request parameters.",
    AI_UNAVAILABLE: "The AI planning service is temporarily unavailable.",
    UNKNOWN_ERROR: "An unknown error occurred.",
  },
  UNAUTHORIZED: {
    LOGIN_REQUIRED: "Please log in before using the AI planning feature.",
  },
  QUOTA_EXHAUSTED: {
    UPGRADE_REQUIRED:
      "Your free trial has been exhausted. Please upgrade to Pro to continue.",
  },
};

const apiEventsZh = {
  SERVER_ERROR: {
    AI_NOT_CONFIGURED: "AI服务尚未配置，请联系管理员",
    QUOTA_DATA_ERROR: "用户配额数据异常，请稍后重试",
    INVALID_PARAMS: "请求参数不合法",
    AI_UNAVAILABLE: "AI规划服务暂时不可用",
    UNKNOWN_ERROR: "发生了未知错误",
  },
  UNAUTHORIZED: {
    LOGIN_REQUIRED: "请先登录后再使用AI规划功能",
  },
  QUOTA_EXHAUSTED: {
    UPGRADE_REQUIRED: "免费体验次数已用完，请升级Pro继续使用",
  },
};

for (const file of files) {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (file === "zh.json") {
    data.apiEvents = apiEventsZh;
  } else {
    data.apiEvents = apiEventsEn;
  }

  console.log(`Updated ${file}`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}
