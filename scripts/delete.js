const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

fetch(`${url}/rest/v1/knowledge_documents?scene=in.(general,seo,blog)`, {
  method: "DELETE",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
  },
})
  .then(async (r) => {
    if (!r.ok) {
      console.error("Failed:", await r.text());
    } else {
      console.log("Successfully deleted generic scenes.");
    }
  })
  .catch((e) => console.error(e));
