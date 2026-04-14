import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://loinrenvcbobfdvmahjf.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvaW5yZW52Y2JvYmZkdm1haGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDQ2ODksImV4cCI6MjA5MDM4MDY4OX0.GAPJECeuAhaI5uXkd0HkKTMQ2Jl_UCi3W5NsuQvLY6E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
