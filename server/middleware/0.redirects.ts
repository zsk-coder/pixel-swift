export default defineEventHandler((event) => {
  const url = event.path; // 获取完整的路径，包括 query string

  // 如果路径中包含旧的 /workflow-copilot
  // （这会自动匹配 /workflow-copilot 以及 /ko/workflow-copilot、/pt/workflow-copilot/demo 等）
  if (url.includes("/workflow-copilot")) {
    const newUrl = url.replace("/workflow-copilot", "/ai-workflow");
    return sendRedirect(event, newUrl, 301);
  }
});
