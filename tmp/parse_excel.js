const fs = require("fs");
const { execSync } = require("child_process");

try {
  if (!fs.existsSync("./node_modules/xlsx")) {
    console.log("Installing xlsx module...");
    execSync("npm install xlsx", { stdio: "inherit" });
  }

  const XLSX = require("xlsx");
  const wb = XLSX.readFile(
    "e:/code/ai开发/code/pixel-swift/docs/https___pixelswift.site_-Performance-on-Search-2026-04-01.xlsx",
  );
  let out = "";

  wb.SheetNames.forEach((sheet) => {
    out += "\n============================================\n";
    out += "SHEET: " + sheet + "\n";
    out += "============================================\n";

    // Convert to CSV, limit to 100 rows per sheet to avoid massive output
    let csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
    let lines = csv.split("\n");
    out += lines.slice(0, 100).join("\n") + "\n";
  });

  fs.writeFileSync("e:/code/ai开发/code/pixel-swift/tmp/excel_dump.txt", out);
  console.log("SUCCESS: Excel data dumped to excel_dump.txt");
} catch (e) {
  console.error("ERROR:", e);
}
