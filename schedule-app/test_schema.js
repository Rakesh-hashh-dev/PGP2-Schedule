import { supabase } from './src/lib/supabase.js';

async function check() {
  const { data, error } = await supabase.from('friend_pings').insert({
    target_id: 'test_group_123',
    from_id: 'test_user',
    name: 'test',
    meta: { type: 'chat_message', text: 'hello' }
  });
  console.log("Insert result:", { data, error });
  
  const { data: fetch, error: fetchErr } = await supabase.from('friend_pings').select('*').eq('target_id', 'test_group_123');
  console.log("Fetch result:", { fetch, fetchErr });
}
check();
