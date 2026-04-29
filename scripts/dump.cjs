const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
const key = process.env.NUXT_SUPABASE_SERVICE_KEY;

fetch(`${url}/rest/v1/knowledge_documents?select=id,scene,title`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
  },
})
  .then(async (r) => {
    if (!r.ok) {
      console.error("Failed:", await r.text());
    } else {
      const data = await r.json();
      console.log("All DB Records:", JSON.stringify(data, null, 2));
    }
  })
  .catch((e) => console.error(e));
