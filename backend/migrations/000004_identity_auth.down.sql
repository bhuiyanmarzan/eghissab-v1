-- Authentication records and security boundaries must not be destroyed by rollback.
DO $$ BEGIN RAISE EXCEPTION 'Identity authentication migration is forward-only; deploy a reviewed corrective migration'; END $$;
