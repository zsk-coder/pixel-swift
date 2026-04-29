const fs = require("fs");
const path = require("path");

const localesDir = "e:\\code\\ai开发\\code\\pixel-swift\\locales";
const files = fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"));

const keysEn = {
  execution: {
    objectiveApplied: '🎯 Objective applied: "{intent}"',
    processingWorkflow: "Processing Workflow",
    processingDesc: "Batch image optimization and conversion",
    pipelineGenerated:
      "AI Pipeline Generated: Smart Resize, Format Conversion, Compress",
    viewDetails: "View Details",
    executionCore: "Execution Core (Detailed)",
    newWorkflow: "New Workflow",
    downloadAll: "Download All Results (.zip)",
  },
};

const keysZh = {
  execution: {
    objectiveApplied: '🎯 目标设定："{intent}"',
    processingWorkflow: "处理工作流正在执行",
    processingDesc: "批量图像优化与多格式转换",
    pipelineGenerated: "AI 处理管线已生成：智能裁剪、格式转换、智能压缩",
    viewDetails: "查看详情",
    executionCore: "执行核心状态 (日志)",
    newWorkflow: "新建工作流",
    downloadAll: "下载全部结果 (.zip)",
  },
};

for (const file of files) {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (!data.copilot) {
    data.copilot = {};
  }

  // Use ZH for zh.json, EN for everything else
  if (file === "zh.json") {
    data.copilot.execution = keysZh.execution;
  } else {
    data.copilot.execution = keysEn.execution;
  }

  console.log(`Updated ${file}`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}
