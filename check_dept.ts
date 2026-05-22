import * as dotenv from 'dotenv';
import { resolve } from 'path';

async function main() {
  dotenv.config({ path: resolve(process.cwd(), '.env.local') });
  const { supabaseAdmin } = await import('./src/lib/supabase/admin');
  
  const { data, error } = await supabaseAdmin.from('profiles').select('id, role, department_id, departments(name)').limit(1);
  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log("Profile data:", JSON.stringify(data, null, 2));
  }
}
main();
