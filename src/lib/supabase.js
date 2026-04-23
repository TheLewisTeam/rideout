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

// --- Shared rideouts (calendar) --------------------------------------------

// rideoutRowToEvent maps a DB row to the shape the UI already uses.
function rideoutRowToEvent(r, joinCount = 0) {
  return {
    id: r.id,
    title: r.title,
    types: r.types || [],
    type: (r.types && r.types[0]) || 'bike',
    date: r.date,
    time: r.time || '',
    location: r.location || '',
    coords: (r.coords_lat != null && r.coords_lng != null)
      ? { lat: r.coords_lat, lng: r.coords_lng }
      : null,
    host: r.host_name || 'Rider',
    hostId: r.host_code || null,
    hostCode: r.host_code || null,
    hostAvatar: r.host_avatar || null,
    level: r.level || 'moderate',
    description: r.description || '',
    beginnerFriendly: !!r.beginner_friendly,
    attendees: joinCount,
    comments: [],
    createdAt: r.created_at,
  };
}

export async function createRideout(event) {
  if (!supabase) return { error: 'offline' };
  const row = {
    title: event.title,
    types: event.types && event.types.length ? event.types : [event.type || 'bike'],
    date: event.date,
    time: event.time || null,
    location: event.location || null,
    coords_lat: event.coords?.lat ?? null,
    coords_lng: event.coords?.lng ?? null,
    host_name: event.host || null,
    host_code: event.hostCode || null,
    host_avatar: event.hostAvatar || null,
    level: event.level || 'moderate',
    description: event.description || null,
    beginner_friendly: !!event.beginnerFriendly,
  };
  const { data, error } = await supabase
    .from('rideouts')
    .insert(row)
    .select()
    .single();
  if (error) {
    console.warn('[rideout] createRideout', error.message);
    return { error: error.message };
  }
  return { data: rideoutRowToEvent(data, 1) };
}

export async function fetchRideouts() {
  if (!supabase) return [];
  // Fetch rideouts + their join counts in two queries.
  const { data: rides, error } = await supabase
    .from('rideouts')
    .select('*')
    .order('date', { ascending: true });
  if (error) {
    console.warn('[rideout] fetchRideouts', error.message);
    return [];
  }
  const ids = (rides ?? []).map((r) => r.id);
  let counts = {};
  if (ids.length) {
    const { data: joins } = await supabase
      .from('rideout_joins')
      .select('rideout_id')
      .in('rideout_id', ids);
    counts = (joins ?? []).reduce((acc, j) => {
      acc[j.rideout_id] = (acc[j.rideout_id] || 0) + 1;
      return acc;
    }, {});
  }
  return (rides ?? []).map((r) => rideoutRowToEvent(r, counts[r.id] || 0));
}

export function subscribeRideouts(onChange) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('rideouts:all')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rideouts' },
      (payload) => onChange(payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rideout_joins' },
      (payload) => onChange(payload),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function joinRideout({ rideoutId, riderCode, riderName }) {
  if (!supabase || !rideoutId) return;
  const { error } = await supabase
    .from('rideout_joins')
    .upsert(
      { rideout_id: rideoutId, rider_code: riderCode || null, rider_name: riderName || null },
      { onConflict: 'rideout_id,rider_code' },
    );
  if (error) console.warn('[rideout] joinRideout', error.message);
}

export async function leaveRideout({ rideoutId, riderCode }) {
  if (!supabase || !rideoutId) return;
  const { error } = await supabase
    .from('rideout_joins')
    .delete()
    .eq('rideout_id', rideoutId)
    .eq('rider_code', riderCode || '');
  if (error) console.warn('[rideout] leaveRideout', error.message);
}

export async function deleteRideout(rideoutId) {
  if (!supabase || !rideoutId) return;
  const { error } = await supabase.from('rideouts').delete().eq('id', rideoutId);
  if (error) console.warn('[rideout] deleteRideout', error.message);
}

// --- Chat room -------------------------------------------------------------

export async function fetchChatMessages(room = 'global', limit = 100) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('room', room)
    .order('sent_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.warn('[rideout] fetchChatMessages', error.message);
    return [];
  }
  return data ?? [];
}

export async function sendChatMessage({ room = 'global', authorName, authorCode, avatar, body }) {
  if (!supabase || !body?.trim()) return { error: 'offline' };
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      room,
      author_name: authorName || 'Rider',
      author_code: authorCode || null,
      avatar: avatar || null,
      body: body.trim().slice(0, 2000),
    })
    .select()
    .single();
  if (error) {
    console.warn('[rideout] sendChatMessage', error.message);
    return { error: error.message };
  }
  return { data };
}

export function subscribeChat(room = 'global', onNewMessage) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`chat:${room}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room=eq.${room}`,
      },
      (payload) => onNewMessage(payload.new),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// --- Ride Feed -------------------------------------------------------------

// Map a feed_posts row to the shape the UI uses.
function feedRowToPost(r, likeCount = 0, likedByMe = false) {
  return {
    id: r.id,
    author: r.author_name || 'Rider',
    authorCode: r.author_code || null,
    avatar: r.avatar || null,
    rideType: r.ride_type || 'bike',
    body: r.body || '',
    imageUrl: r.image_url || null,
    distance: r.distance || null,
    duration: r.duration || null,
    createdAt: r.created_at,
    likes: likeCount,
    liked: likedByMe,
    comments: [],
  };
}

export async function fetchFeedPosts(viewerCode) {
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from('feed_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.warn('[rideout] fetchFeedPosts', error.message);
    return [];
  }
  const ids = (rows ?? []).map((r) => r.id);
  const counts = {};
  const mine = new Set();
  if (ids.length) {
    const { data: likes } = await supabase
      .from('feed_post_likes')
      .select('post_id, rider_code')
      .in('post_id', ids);
    (likes ?? []).forEach((l) => {
      counts[l.post_id] = (counts[l.post_id] || 0) + 1;
      if (viewerCode && l.rider_code === viewerCode) mine.add(l.post_id);
    });
  }
  return (rows ?? []).map((r) => feedRowToPost(r, counts[r.id] || 0, mine.has(r.id)));
}

export async function createFeedPost({ authorName, authorCode, avatar, rideType, body, imageUrl, distance, duration }) {
  if (!supabase) return { error: 'offline' };
  if (!body || !body.trim()) return { error: 'Write something first.' };
  const { data, error } = await supabase
    .from('feed_posts')
    .insert({
      author_name: authorName || 'Rider',
      author_code: authorCode || null,
      avatar: avatar || null,
      ride_type: rideType || 'bike',
      body: body.trim().slice(0, 2000),
      image_url: imageUrl || null,
      distance: distance || null,
      duration: duration || null,
    })
    .select()
    .single();
  if (error) {
    console.warn('[rideout] createFeedPost', error.message);
    return { error: error.message };
  }
  return { data: feedRowToPost(data, 0, false) };
}

export async function deleteFeedPost(postId) {
  if (!supabase || !postId) return;
  const { error } = await supabase.from('feed_posts').delete().eq('id', postId);
  if (error) console.warn('[rideout] deleteFeedPost', error.message);
}

export async function toggleFeedLike({ postId, riderCode, liked }) {
  if (!supabase || !postId || !riderCode) return;
  if (liked) {
    const { error } = await supabase
      .from('feed_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('rider_code', riderCode);
    if (error) console.warn('[rideout] toggleFeedLike(off)', error.message);
  } else {
    const { error } = await supabase
      .from('feed_post_likes')
      .upsert(
        { post_id: postId, rider_code: riderCode },
        { onConflict: 'post_id,rider_code' },
      );
    if (error) console.warn('[rideout] toggleFeedLike(on)', error.message);
  }
}

export function subscribeFeed(onChange) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('feed:all')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'feed_posts' },
      (payload) => onChange(payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'feed_post_likes' },
      (payload) => onChange(payload),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// --- Crews -----------------------------------------------------------------

// cityKey normalizes "Lakeland, FL" → "lakeland, fl" so Crews Near You
// groups on consistent text regardless of user typing.
function cityKey(city) {
  return (city || '').trim().toLowerCase();
}

// Map a crews row + {members, riders, joinedRiderCodes} into the shape the UI uses.
function crewRowToCrew(r, extras = {}) {
  const { members = 0, riders = [], joinedRiderCodes = new Set(), viewerCode = null } = extras;
  const viewerRider = viewerCode ? riders.find((rd) => rd.rider_code === viewerCode) : null;
  return {
    id: r.id,
    name: r.name || 'Crew',
    tag: r.tag || '',
    city: r.city || '',
    rideType: r.ride_type || 'bike',
    description: r.description || '',
    color: r.color || 'bg-pink-500',
    founded: r.founded || String(new Date(r.created_at || Date.now()).getFullYear()),
    verified: !!r.verified,
    ownerCode: r.owner_code || null,
    ownerName: r.owner_name || null,
    createdAt: r.created_at,
    members,
    // Current viewer's membership state (drives "Join/Leave/Rejoin" button)
    isJoined: viewerRider ? !viewerRider.left_at : false,
    left: viewerRider ? !!viewerRider.left_at : false,
    leftAt: viewerRider?.left_at ? new Date(viewerRider.left_at).getTime() : null,
    // Full rider list for the detail view.
    riders: riders.map((rd) => ({
      code: rd.rider_code,
      name: rd.rider_name || 'Rider',
      avatar: rd.avatar || null,
      role: rd.role || 'member',
      joinedAt: rd.joined_at,
      leftAt: rd.left_at,
      left: !!rd.left_at,
    })),
  };
}

// Fetch every crew plus its rider list. Filtering by city happens client-side
// so the user can switch cities without a server round-trip.
export async function fetchCrews(viewerCode) {
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from('crews')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[rideout] fetchCrews', error.message);
    return [];
  }
  const ids = (rows ?? []).map((r) => r.id);
  let ridersByCrew = {};
  if (ids.length) {
    const { data: riders } = await supabase
      .from('crew_riders')
      .select('*')
      .in('crew_id', ids);
    (riders ?? []).forEach((rd) => {
      if (!ridersByCrew[rd.crew_id]) ridersByCrew[rd.crew_id] = [];
      ridersByCrew[rd.crew_id].push(rd);
    });
  }
  return (rows ?? []).map((r) => {
    const riders = ridersByCrew[r.id] || [];
    const activeMembers = riders.filter((rd) => !rd.left_at).length;
    return crewRowToCrew(r, { members: activeMembers, riders, viewerCode });
  });
}

// Create a crew. The creator is auto-added to crew_riders as owner.
export async function createCrewRemote(crew, { ownerCode, ownerName, avatar }) {
  if (!supabase) return { error: 'offline' };
  const row = {
    name: crew.name,
    tag: crew.tag || null,
    city: crew.city || null,
    city_key: cityKey(crew.city),
    ride_type: crew.rideType || 'bike',
    description: crew.description || null,
    color: crew.color || 'bg-pink-500',
    founded: crew.founded || String(new Date().getFullYear()),
    verified: false,
    owner_code: ownerCode || null,
    owner_name: ownerName || null,
  };
  const { data, error } = await supabase.from('crews').insert(row).select().single();
  if (error) {
    console.warn('[rideout] createCrewRemote', error.message);
    return { error: error.message };
  }
  // Auto-join owner
  if (ownerCode) {
    await supabase.from('crew_riders').upsert(
      {
        crew_id: data.id,
        rider_code: ownerCode,
        rider_name: ownerName || null,
        avatar: avatar || null,
        role: 'owner',
        left_at: null,
      },
      { onConflict: 'crew_id,rider_code' },
    );
  }
  return { data: crewRowToCrew(data, {
    members: 1,
    riders: ownerCode ? [{ crew_id: data.id, rider_code: ownerCode, rider_name: ownerName, avatar, role: 'owner', joined_at: new Date().toISOString(), left_at: null }] : [],
    viewerCode: ownerCode,
  }) };
}

// Update editable crew fields. Owners only — but RLS is open for now.
export async function updateCrewRemote(crewId, patch) {
  if (!supabase || !crewId) return { error: 'offline' };
  const row = {
    name: patch.name,
    tag: patch.tag,
    city: patch.city,
    city_key: cityKey(patch.city),
    ride_type: patch.rideType,
    description: patch.description,
    color: patch.color,
    updated_at: new Date().toISOString(),
  };
  // Only include defined fields so partial patches work.
  Object.keys(row).forEach((k) => { if (row[k] === undefined) delete row[k]; });
  const { error } = await supabase.from('crews').update(row).eq('id', crewId);
  if (error) {
    console.warn('[rideout] updateCrewRemote', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

export async function deleteCrewRemote(crewId) {
  if (!supabase || !crewId) return;
  const { error } = await supabase.from('crews').delete().eq('id', crewId);
  if (error) console.warn('[rideout] deleteCrewRemote', error.message);
}

// Join (or rejoin) a crew. Clears left_at if present.
export async function joinCrewRemote({ crewId, riderCode, riderName, avatar }) {
  if (!supabase || !crewId || !riderCode) return { error: 'offline' };
  const { error } = await supabase.from('crew_riders').upsert(
    {
      crew_id: crewId,
      rider_code: riderCode,
      rider_name: riderName || null,
      avatar: avatar || null,
      role: 'member',
      left_at: null,
    },
    { onConflict: 'crew_id,rider_code' },
  );
  if (error) {
    console.warn('[rideout] joinCrewRemote', error.message);
    return { error: error.message };
  }
  return { ok: true };
}

// Leave but keep the row so we can show strikethrough + rejoin.
export async function leaveCrewRemote({ crewId, riderCode }) {
  if (!supabase || !crewId || !riderCode) return;
  const { error } = await supabase
    .from('crew_riders')
    .update({ left_at: new Date().toISOString() })
    .eq('crew_id', crewId)
    .eq('rider_code', riderCode);
  if (error) console.warn('[rideout] leaveCrewRemote', error.message);
}

// Fetch the riders attached to one crew.
export async function fetchCrewRiders(crewId) {
  if (!supabase || !crewId) return [];
  const { data, error } = await supabase
    .from('crew_riders')
    .select('*')
    .eq('crew_id', crewId)
    .order('joined_at', { ascending: true });
  if (error) {
    console.warn('[rideout] fetchCrewRiders', error.message);
    return [];
  }
  return data ?? [];
}

// Add a rider to a crew by their rider code. Used by the "Add Rider" flow.
// If the rider already exists in `riders`, we'll include their name/avatar.
export async function addRiderToCrew({ crewId, riderCode }) {
  if (!supabase || !crewId || !riderCode) return { error: 'offline' };
  // Try to pull the rider's saved name/avatar so the crew list shows real data.
  const { data: rider } = await supabase
    .from('riders')
    .select('code, name, avatar')
    .eq('code', riderCode)
    .maybeSingle();
  if (!rider) {
    // Rider code must exist in the riders table — if not, we still add them
    // so they pick up the membership as soon as they open the app.
    await supabase.from('riders').upsert({ code: riderCode, name: null }, { onConflict: 'code' });
  }
  const { error } = await supabase.from('crew_riders').upsert(
    {
      crew_id: crewId,
      rider_code: riderCode,
      rider_name: rider?.name || null,
      avatar: rider?.avatar || null,
      role: 'member',
      left_at: null,
    },
    { onConflict: 'crew_id,rider_code' },
  );
  if (error) {
    console.warn('[rideout] addRiderToCrew', error.message);
    return { error: error.message };
  }
  return { ok: true, rider: rider || { code: riderCode } };
}

// Subscribe to every crew + crew_riders change so the list refreshes live.
export function subscribeCrews(onChange) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('crews:all')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'crews' },
      (payload) => onChange(payload),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'crew_riders' },
      (payload) => onChange(payload),
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
