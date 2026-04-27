import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Deleting generic scenes from knowledge_documents...");

  const { data, error } = await supabase
    .from("knowledge_documents")
    .delete()
    .in("scene", ["general", "seo", "blog"]);

  if (error) {
    console.error("Error deleting:", error.message);
  } else {
    console.log("Successfully deleted general, seo, and blog generic scenes.");
  }
}

main();
