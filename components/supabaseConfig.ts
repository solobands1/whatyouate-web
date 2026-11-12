// The project's address and publishable key. The publishable key is meant to ship in browser code: what anyone can read
// or change is decided in the database (row-level security plus the functions in the app repo's supabase/*.sql).
// Kept in its own file so the page tracker (components/track.ts) can use them without loading supabase-js.
export const SUPABASE_URL = "https://dopwptglzsfpdqmbeayw.supabase.co";
export const SUPABASE_KEY = "sb_publishable_nYhmn0_Ivtx51pT5LmmRPA_UFj7VsSP";
