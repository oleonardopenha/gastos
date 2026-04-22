import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://unxrdkesolclndmstjbh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueHJka2Vzb2xjbG5kbXN0amJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDU5MDIsImV4cCI6MjA5MjM4MTkwMn0.-h8AT_PuipSOOt5NuGqViRx7QsXAwI2tcY8KQ_ShAos';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
