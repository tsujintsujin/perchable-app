-- Removes the project's default TRUNCATE/REFERENCES/TRIGGER grants from public.profiles.
-- The existing select and column-level update grants for authenticated are left as they are.
revoke truncate, references, trigger on public.profiles from anon, authenticated;
