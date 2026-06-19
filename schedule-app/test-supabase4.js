import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  console.log("Selecting from profiles...");
  const { data, error } = await supabase.from("profiles").select("*").limit(5);
  console.log("Result:", data, error);
}

test();
