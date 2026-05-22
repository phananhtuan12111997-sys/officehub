import { supabaseAdmin } from "./src/lib/supabase/admin";

async function main() {
  console.log("Testing insert with folder_id = null");
  const { data, error } = await supabaseAdmin.from("documents").insert({
    name: "test.pdf",
    file_url: "http://example.com/test.pdf",
    size: "1MB",
    department: "Chung",
    uploaded_by: null, // this might fail if uploaded_by is NOT NULL
    folder_id: null
  });
  console.log("Result (null folder):", error?.message || "Success");
  
  if (error && error.message.includes('foreign key constraint')) {
    console.log("Null violates foreign key constraint? That's weird.");
  }
}
main();
