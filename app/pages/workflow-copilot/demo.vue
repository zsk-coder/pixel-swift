<script setup lang="ts">
/**
 * Workflow Copilot 开发调试页面
 * 用于端到端测试 LangGraph AI 规划接口
 * 上线前删除此页面
 */
import type { ProcessPlan } from "~~/shared/types/workflow-copilot";

definePageMeta({ layout: false });
useHead({ title: "Copilot Demo (Dev Only)" });

const { $api } = useNuxtApp();

const goalText = ref("把这批图处理成适合 Shopify 商品页的版本");
const loading = ref(false);
const errorMsg = ref("");
const plan = ref<ProcessPlan | null>(null);
const rawResponse = ref("");
const elapsedMs = ref(0);

// 模拟的图片批次数据
const mockBatch = {
  fileCount: 3,
  totalSizeBytes: 8388608,
  formats: ["png", "jpg"],
  images: [
    {
      id: "1",
      fileName: "product-front.png",
      width: 4000,
      height: 3000,
      sizeBytes: 3145728,
      format: "png",
      hasAlpha: true,
    },
    {
      id: "2",
      fileName: "product-side.jpg",
      width: 3200,
      height: 2400,
      sizeBytes: 2621440,
      format: "jpg",
    },
    {
      id: "3",
      fileName: "lifestyle-shot.png",
      width: 5000,
      height: 3500,
      sizeBytes: 2621440,
      format: "png",
    },
  ],
};

async function generatePlan() {
  loading.value = true;
  errorMsg.value = "";
  plan.value = null;
  rawResponse.value = "";

  const start = Date.now();

  try {
    const res = await $api<{ plan: ProcessPlan; remainingTrialCount: number }>(
      "/api/workflow-copilot/plan",
      {
        method: "POST",
        body: {
          goal: {
            text: goalText.value,
            locale: "zh",
            source: "manual" as const,
          },
          batch: mockBatch,
        },
      },
    );

    elapsedMs.value = Date.now() - start;
    rawResponse.value = JSON.stringify(res, null, 2);

    if (res.code === 200 && res.data) {
      plan.value = res.data.plan;
    } else {
      errorMsg.value = res.msg || "未知错误";
    }
  } catch (err: any) {
    elapsedMs.value = Date.now() - start;
    errorMsg.value = err?.message || String(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    style="
      max-width: 900px;
      margin: 40px auto;
      padding: 0 20px;
      font-family: system-ui, sans-serif;
    "
  >
    <h1 style="font-size: 24px; margin-bottom: 8px">
      🤖 Workflow Copilot — Dev Demo
    </h1>
    <p style="color: #888; margin-bottom: 24px">
      端到端测试 LangGraph AI 规划接口（开发用，上线前删除）
    </p>

    <!-- 目标输入 -->
    <div style="margin-bottom: 16px">
      <label style="display: block; font-weight: 600; margin-bottom: 6px"
        >用户目标</label
      >
      <input
        v-model="goalText"
        type="text"
        placeholder="例如：把这批图处理成适合 Shopify 商品页的版本"
        style="
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 15px;
        "
      />
    </div>

    <!-- 模拟批次信息 -->
    <div
      style="
        margin-bottom: 16px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
        font-size: 13px;
        color: #666;
      "
    >
      📦 模拟批次：{{ mockBatch.fileCount }} 张图片（{{
        mockBatch.formats.join(", ")
      }}）， 总计 {{ (mockBatch.totalSizeBytes / 1024 / 1024).toFixed(1) }}MB
    </div>

    <!-- 发送按钮 -->
    <button
      :disabled="loading || !goalText.trim()"
      style="
        padding: 10px 28px;
        background: #409eff;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 15px;
        cursor: pointer;
      "
      @click="generatePlan"
    >
      {{ loading ? "⏳ AI 规划中..." : "🚀 生成处理计划" }}
    </button>

    <!-- 耗时 -->
    <span
      v-if="elapsedMs"
      style="margin-left: 12px; color: #888; font-size: 13px"
    >
      耗时 {{ (elapsedMs / 1000).toFixed(2) }}s
    </span>

    <!-- 错误提示 -->
    <div
      v-if="errorMsg"
      style="
        margin-top: 16px;
        padding: 12px;
        background: #fef0f0;
        border: 1px solid #f56c6c;
        border-radius: 8px;
        color: #f56c6c;
      "
    >
      ❌ {{ errorMsg }}
    </div>

    <!-- 计划结果 -->
    <div v-if="plan" style="margin-top: 24px">
      <h2 style="font-size: 18px; margin-bottom: 12px">📋 生成的处理计划</h2>

      <div
        style="
          padding: 16px;
          background: #f0f9eb;
          border: 1px solid #67c23a;
          border-radius: 8px;
          margin-bottom: 16px;
        "
      >
        <div><strong>摘要：</strong>{{ plan.taskSummary }}</div>
        <div>
          <strong>场景：</strong>{{ plan.scene }} | <strong>类型：</strong
          >{{ plan.taskType }}
        </div>
        <div>
          <strong>置信度：</strong>{{ (plan.confidence * 100).toFixed(0) }}%
        </div>
      </div>

      <!-- 步骤列表 -->
      <h3 style="font-size: 15px; margin-bottom: 8px">执行步骤</h3>
      <div
        v-for="step in plan.steps"
        :key="step.id"
        style="
          padding: 12px;
          margin-bottom: 8px;
          background: #fafafa;
          border: 1px solid #eee;
          border-radius: 8px;
        "
      >
        <div style="font-weight: 600">
          {{ step.enabled ? "✅" : "⏸️" }} {{ step.action }}
          <span style="color: #999; font-weight: normal; margin-left: 8px"
            >#{{ step.id }}</span
          >
        </div>
        <div style="color: #666; margin-top: 4px">{{ step.reason }}</div>
        <div style="color: #409eff; font-size: 13px; margin-top: 4px">
          参数：{{ JSON.stringify(step.params) }}
        </div>
      </div>

      <!-- 风险提示 -->
      <div v-if="plan.risks.length > 0">
        <h3 style="font-size: 15px; margin: 16px 0 8px">⚠️ 风险提示</h3>
        <div
          v-for="(risk, i) in plan.risks"
          :key="i"
          style="
            padding: 8px 12px;
            margin-bottom: 6px;
            background: #fdf6ec;
            border: 1px solid #e6a23c;
            border-radius: 6px;
            font-size: 13px;
          "
        >
          [{{ risk.severity }}] {{ risk.message }}
        </div>
      </div>

      <!-- 导出方案 -->
      <div
        style="
          margin-top: 16px;
          padding: 12px;
          background: #ecf5ff;
          border-radius: 8px;
          font-size: 13px;
        "
      >
        📦 导出：{{ plan.exportPlan.zipName }}.zip
        {{ plan.exportPlan.includeMetadataCsv ? "(含 CSV 元数据)" : "" }}
      </div>
    </div>

    <!-- 原始 JSON -->
    <details v-if="rawResponse" style="margin-top: 24px">
      <summary style="cursor: pointer; color: #409eff">
        查看原始 JSON 响应
      </summary>
      <pre
        style="
          margin-top: 8px;
          padding: 12px;
          background: #1e1e1e;
          color: #d4d4d4;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 12px;
        "
        >{{ rawResponse }}</pre
      >
    </details>
  </div>
</template>
