require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('document_folders').select('*')
  .then(res => {
    console.log(JSON.stringify(res, null, 2));
  })
  .catch(console.error);
