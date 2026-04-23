// Supabase client — single instance shared across the app.
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env.
// In production on Vercel, set these in Project → Settings → Environment Variables.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(url && anon);

if (!supabaseReady) {
  // eslint-disable-next-line no-console
  console.warn(
    '[rideout] Supabase env vars missing. App will run in offline/localStorage mode. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (or Vercel env vars).'
  );
}

export const supabase = supabaseReady
  ? createClient(url, anon, {
      realtime: { params: { eventsPerSecond: 10 } },
      auth: { persistSession: false },
    })
  : null;

// --- Rider location ---------------------------------------------------------

export async function upsertRider({ code, name, avatar, coords, speed }) {
  if (!supabase || !code) return;
  const row = {
    code,
    name: name ?? null,
    avatar: avatar ?? null,
    last_lat: coords?.lat ?? null,
    last_lng: coords?.lng ?? null,
    last_speed: speed ?? null,
    last_seen_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('riders').upsert(row, { onConflict: 'code' });
  if (error) console.warn('[rideout] upsertRider', error.message);
}

export async function fetchRider(code) {
  if (!supabase || !code) return null;
  const { data, error } = await supabase
    .from('riders')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (error) {
    console.warn('[rideout] fetchRider', error.message);
    return null;
  }
  return data;
}

export function subscribeRider(code, onChange) {
  if (!supabase || !code) return () => {};
  const channel = supabase
    .channel(`rider:${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'riders', filter: `code=eq.${code}` },
      (payload) => onChange(payload.new || payload.old),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function subscribeRiders(codes, onChange) {
  if (!supabase || !codes?.length) return () => {};
  // Supabase filters only support one value per subscription; open one channel per code.
  const channels = codes.map((code) =>
    supabase
      .channel(`rider:${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'riders', filter: `code=eq.${code}` },
        (payload) => onChange(payload.new || payload.old),
      )
      .subscribe(),
  );
  return () => channels.forEach((c) => supabase.removeChannel(c));
}

// --- Pager ------------------------------------------------------------------

export async function sendPageRemote({ riderCode, fromName, fromPhone, message }) {
  if (!supabase || !riderCode) return { error: 'offline' };
  const { data, error } = await supabase
    .from('pages')
    .insert({
      rider_code: riderCode,
      from_name: fromName ?? null,
      from_phone: fromPhone ?? null,
      message: message ?? null,
    })
    .select()
    .single();
  if (error) {
    console.warn('[rideout] sendPageRemote', error.message);
    return { error: error.message };
  }
  return { data };
}

export async function ackPage(pageId) {
  if (!supabase || !pageId) return;
  const { error } = await supabase
    .from('pages')
    .update({ ack: true, acked_at: new Date().toISOString() })
    .eq('id', pageId);
  if (error) console.warn('[rideout] ackPage', error.message);
}

export async function fetchLatestUnackedPage(riderCode) {
  if (!supabase || !riderCode) return null;
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('rider_code', riderCode)
    .eq('ack', false)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[rideout] fetchLatestUnackedPage', error.message);
    return null;
  }
  return data;
}

export function subscribePages(riderCode, onNewPage) {
  if (!supabase || !riderCode) return () => {};
  const channel = supabase
    .channel(`pages:${riderCode}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pages',
        filter: `rider_code=eq.${riderCode}`,
      },
      (payload) => onNewPage(payload.new),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// --- Guardian links ---------------------------------------------------------

export async function linkRider({ riderCode, guardianName, guardianPhone }) {
  if (!supabase || !riderCode) return { error: 'offline' };
  const { data, error } = await supabase
    .from('links')
    .upsert(
      {
        rider_code: riderCode,
        guardian_name: guardianName ?? null,
        guardian_phone: guardianPhone ?? null,
      },
      { onConflict: 'rider_code,guardian_phone' },
    )
    .select()
    .single();
  if (error) {
    console.warn('[rideout] linkRider', error.message);
    return { error: error.message };
  }
  return { data };
}

export async function unlinkRider({ riderCode, guardianPhone }) {
  if (!supabase || !riderCode) return;
  const { error } = await supabase
    .from('links')
    .delete()
    .eq('rider_code', riderCode)
    .eq('guardian_phone', guardianPhone ?? '');
  if (error) console.warn('[rideout] unlinkRider', error.message);
}

export async function fetchLinksForGuardian(guardianPhone) {
  if (!supabase || !guardianPhone) return [];
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .eq('guardian_phone', guardianPhone);
  if (error) {
    console.warn('[rideout] fetchLinksForGuardian', error.message);
    return [];
  }
  return data ?? [];
}
