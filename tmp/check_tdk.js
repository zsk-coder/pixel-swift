const fs = require("fs");
const path = require("path");

const localesDir = "e:/code/ai开发/code/pixel-swift/locales";
const blogDir = "e:/code/ai开发/code/pixel-swift/content/blog";

let report = "TDK Length Audit Report\n=======================\n\n";
let warnings = 0;

// Helper to estimate limits
function isTooLong(text, isCJK, type) {
  if (!text) return false;
  const len = text.length;
  if (type === "title") {
    return isCJK ? len > 40 : len > 70;
  } else {
    return isCJK ? len > 100 : len > 165;
  }
}

// 1. Check JSON locales
if (fs.existsSync(localesDir)) {
  const files = fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"));
  files.forEach((file) => {
    const isCJK = file.match(/ja|zh|ko/) !== null;
    try {
      const content = JSON.parse(
        fs.readFileSync(path.join(localesDir, file), "utf-8"),
      );
      const seo = content.seo;
      if (seo) {
        Object.keys(seo).forEach((page) => {
          const title = seo[page].title;
          const desc = seo[page].description;

          if (
            isTooLong(title, isCJK, "title") ||
            isTooLong(desc, isCJK, "desc")
          ) {
            warnings++;
            report += `📝 [Locale: ${file}] -> Page: ${page}\n`;
            if (isTooLong(title, isCJK, "title"))
              report += `  ⚠️ TITLE (${title.length} chars): ${title}\n`;
            if (isTooLong(desc, isCJK, "desc"))
              report += `  ⚠️ DESC (${desc.length} chars): ${desc}\n`;
            report += "\n";
          }
        });
      }
    } catch (e) {}
  });
}

// 2. Check Blog Markdown files recursively
function getMDFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getMDFiles(filePath, fileList);
    } else if (file.endsWith(".md")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const mdFiles = getMDFiles(blogDir);
mdFiles.forEach((file) => {
  const isCJK = file.match(/[\\\/](ja|zh|ko)[\\\/]/) !== null;
  try {
    const content = fs.readFileSync(file, "utf-8");
    const titleMatch = content.match(/^title:\s*['"]?(.*?)['"]?$/m);
    const descMatch = content.match(/^description:\s*['"]?(.*?)['"]?$/m);

    const title = titleMatch ? titleMatch[1] : "";
    const desc = descMatch ? descMatch[1] : "";

    if (isTooLong(title, isCJK, "title") || isTooLong(desc, isCJK, "desc")) {
      warnings++;
      const relPath = file.substring(file.indexOf("content"));
      report += `📄 [Blog: ${relPath}]\n`;
      if (isTooLong(title, isCJK, "title"))
        report += `  ⚠️ TITLE (${title.length} chars): ${title}\n`;
      if (isTooLong(desc, isCJK, "desc"))
        report += `  ⚠️ DESC (${desc.length} chars): ${desc}\n`;
      report += "\n";
    }
  } catch (e) {}
});

report += `\nTotal Warnings: ${warnings}\n`;
fs.writeFileSync("e:/code/ai开发/code/pixel-swift/tmp/tdk_report.txt", report);
console.log("Audit complete. Warnings:", warnings);
