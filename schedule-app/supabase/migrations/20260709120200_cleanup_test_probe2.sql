-- Remove all CLI verification probe rows (clitest*, user_PROBE*) so the map stays clean.
delete from _migration_map where email like 'clitest%@iimsambalpur.ac.in';
