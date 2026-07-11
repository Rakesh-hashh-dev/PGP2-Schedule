-- Remove the CLI/browser verification probe row so it doesn't pollute the
-- migration map (harmless — would never match a real Clerk prod user — but kept clean).
delete from _migration_map where email = 'clitest@iimsambalpur.ac.in';
