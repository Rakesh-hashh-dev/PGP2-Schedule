import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(".env.local") });
dotenv.config({ path: path.resolve(".env") });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  console.log("Inserting test code...");
  const { data, error } = await supabase.from("profiles").upsert(
    { user_id: "TEST-CODE-123", courses: { CS: "A" }, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  ).select();
  console.log("Result:", data, error);
}

test();
