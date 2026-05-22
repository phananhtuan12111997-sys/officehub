import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log("URL:", supabaseUrl ? "Exists" : "Missing");
  console.log("Key:", supabaseKey ? "Exists" : "Missing");

  // Get constraints
  const { data: schema, error: err3 } = await supabaseAdmin.from('information_schema.key_column_usage')
    .select('*')
    .eq('table_name', 'documents');
    
  console.log("Constraints info:", JSON.stringify(schema, null, 2), err3);
  
  // Try to insert a document with null folder_id
  const { data: ins, error: errIns } = await supabaseAdmin.from("documents").insert({
    name: "test.pdf",
    file_url: "http://example.com/test.pdf",
    size: "1MB",
    folder_id: null
  });
  console.log("Insert with null folder:", errIns?.message || "Success");

}
main();
