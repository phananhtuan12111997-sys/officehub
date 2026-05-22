import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
import { supabaseAdmin } from './src/lib/supabase/admin';

async function main() {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').limit(1);
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }
  if (data && data.length > 0) {
    console.log("Profile columns:", Object.keys(data[0]));
    console.log("Sample profile:", data[0]);
  } else {
    console.log("No profiles found.");
  }
}
main();
