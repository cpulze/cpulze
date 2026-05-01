import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const APP_BASE = (() => {
  const h = location.hostname;
  if (h === 'app.stage.cpulze.com')   return 'https://app.stage.cpulze.com';
  if (h === 'app.cpulze.com')         return 'https://app.cpulze.com';
  if (h === 'localhost' || h === '127.0.0.1') return `http://${location.host}`;
  return `https://${location.host}`;  // Vercel preview URLs
})();

const SUPABASE_URL = 'https://buqauvcbsazzrstolsnx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cWF1dmNic2F6enJzdG9sc254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDc1MDcsImV4cCI6MjA4NTI4MzUwN30.DYhJN9EHxGDFCV2An08pdtHm7ZdsgsbJe8TMnNL1e7Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'cpulze-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
