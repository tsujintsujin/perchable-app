/** Mirrors public.profiles (supabase/migrations/20260926000000_profiles.sql),
 * camelCased for the app side. */
export type Profile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  usertag: string | null;
  createdAt: string;
  updatedAt: string;
};
