import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  console.log("Inserting test code into shared_schedules...");
  const { data, error } = await supabase.from("shared_schedules").upsert(
    { id: "RAK7ZG", payload: { n: "Rakesh", c: { CS: "A" } }, created_at: new Date().toISOString() }
  ).select();
  console.log("Result:", data, error);
}

test();
