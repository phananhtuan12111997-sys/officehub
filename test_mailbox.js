import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.from('mailbox').select('*').limit(1)
  console.log("Existing data:", data, error)

  const { error: updateError } = await supabase.from('mailbox').update({ is_deleted_by_receiver: true }).eq('id', 'non-existent-id')
  console.log("Update error?", updateError)
}

test()
