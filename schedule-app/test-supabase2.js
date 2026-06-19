import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  console.log("Inserting test code...");
  const { data, error } = await supabase.from("profiles").upsert(
    { user_id: "CODE-RAK7ZG", courses: { n: "Rakesh", c: { CS: "A" } }, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  ).select();
  console.log("Result:", data, error);
}

test();
