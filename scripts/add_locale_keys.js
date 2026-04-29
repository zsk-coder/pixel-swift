import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, "../locales");

const translations = {
  zh: [
    "正在解析转换参数约束...",
    "正在推演核心工作流...",
    "正在装配引擎节点...",
  ],
  en: [
    "Parsing conversion constraints...",
    "Deducing core workflow...",
    "Assembling engine nodes...",
  ],
  es: [
    "Analizando restricciones de conversión...",
    "Deduciendo flujo de trabajo...",
    "Ensamblando nodos del motor...",
  ],
  pt: [
    "Analisando restrições de conversão...",
    "Deduzindo fluxo de trabalho...",
    "Montando os nós do motor...",
  ],
  ko: [
    "변환 매개변수 제약 분석 중...",
    "핵심 워크플로우 추론 중...",
    "엔진 노드 조립 중...",
  ],
  ja: [
    "変換制約を解析中...",
    "コアワークフローを推論中...",
    "エンジンノードを組み立て中...",
  ],
  fr: [
    "Analyse des contraintes de conversion...",
    "Déduction du flux de travail...",
    "Assemblage des nœuds du moteur...",
  ],
  de: [
    "Konvertierungsbeschränkungen analysieren...",
    "Kern-Workflow ableiten...",
    "Motorenknoten zusammensetzen...",
  ],
};

fs.readdirSync(localesDir).forEach((file) => {
  if (!file.endsWith(".json")) return;
  const lang = path.basename(file, ".json");
  if (translations[lang]) {
    const filePath = path.join(localesDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    if (!data.copilot) data.copilot = {};
    if (!data.copilot.execution) data.copilot.execution = {};
    if (!data.copilot.execution.logs) data.copilot.execution.logs = {};

    data.copilot.execution.logs.thinkingSteps = translations[lang];

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    console.log(`Updated ${file}`);
  }
});
