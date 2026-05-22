import * as dotenv from 'dotenv';
import { resolve } from 'path';

async function main() {
  dotenv.config({ path: resolve(process.cwd(), '.env.local') });
  const { supabaseAdmin } = await import('./src/lib/supabase/admin');
  
  const { data, error } = await supabaseAdmin.rpc('run_sql', { 
    sql: 'ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;' 
  });
  
  if (error) {
    console.error("Error migrating:", error);
  } else {
    console.log("Migration successful");
  }
}
main();
