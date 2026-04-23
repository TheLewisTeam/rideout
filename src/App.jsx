import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Users, Plus, Bike, Zap, Navigation, Clock, ChevronRight, User, Home, X, Check, Search, Filter, Heart, MessageCircle, Send, UserPlus, UserCheck, Layers, Route, Trash2, ArrowRight, ArrowLeft, Sparkles, Flame, Shield, BadgeCheck, Store, Camera, AlertTriangle, Flag, Image, Rss, Phone, ShieldCheck, Crown, Star, QrCode, Share2, Copy, Upload, LocateFixed, RefreshCw, Radio, Bell, BellRing, Eye } from 'lucide-react';
import {
  supabaseReady,
  upsertRider,
  fetchRider,
  subscribeRider,
  sendPageRemote,
  ackPage,
  fetchLatestUnackedPage,
  subscribePages,
} from './lib/supabase';

// Random 6-char rider code for guardian linking (no confusing chars)
function generateRiderCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Send a page from a guardian to a rider.
// Primary path: Supabase `pages` table — delivers across devices in real time.
// Fallback path: localStorage (same-origin only) so the app still works offline.
function sendPage(riderCode, fromName, fromPhone, msg) {
  const data = {
    at: Date.now(),
    from: fromName || 'Your guardian',
    phone: fromPhone || '',
    msg: msg || 'Check in with me.'
  };
  try { localStorage.setItem(`rideout_page_${riderCode}`, JSON.stringify(data)); } catch (e) {}
  if (supabaseReady) {
    sendPageRemote({ riderCode, fromName: data.from, fromPhone: data.phone, message: data.msg })
      .catch(() => { /* fallback already wrote localStorage */ });
  }
  return data;
}

// Tiny persistence wrapper. Same API as useState, but reads/writes localStorage.
function useLocalState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return defaultValue;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore quota/private-mode */ }
  }, [key, value]);
  return [value, setValue];
}

// Resize a picked image file to a square base64 data URL (default 256px).
function fileToAvatarDataURL(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('no file'));
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Cover-fit crop to square
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Reverse-geocode lat/lng to "City, ST" via Nominatim (free, no key).
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.hamlet || a.county || '';
    const state = a.state_code || a.state || '';
    if (!city && !state) return null;
    return [city, state].filter(Boolean).join(', ');
  } catch (e) { return null; }
}

const checkeredStyle = (color1 = '#3b82f6', color2 = '#ffffff', size = 12) => ({
  backgroundImage: `linear-gradient(45deg, ${color1} 25%, transparent 25%), linear-gradient(-45deg, ${color1} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${color1} 75%), linear-gradient(-45deg, transparent 75%, ${color1} 75%)`,
  backgroundSize: `${size}px ${size}px`,
  backgroundPosition: `0 0, 0 ${size/2}px, ${size/2}px -${size/2}px, -${size/2}px 0px`,
  backgroundColor: color2
});

function CheckeredStrip({ className = '', color1 = '#3b82f6', color2 = '#ffffff' }) {
  return <div className={`h-2 w-full ${className}`} style={checkeredStyle(color1, color2, 12)} />;
}

// Verified badge component
function VerifiedBadge({ size = 12 }) {
  return <BadgeCheck size={size} className="text-blue-400 fill-blue-400 stroke-white" />;
}

export default function RideoutApp() {
  const [onboarded, setOnboarded] = useLocalState('rideout_onboarded', false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [profile, setProfile] = useLocalState('rideout_profile', {
    name: '', city: '', rideTypes: ['bike'],
    verified: false, level: 'moderate',
    trustedContact: null, shareLocation: false,
    avatar: null,            // base64 data URL
    coords: null,            // { lat, lng } once granted
    locationSharedWith: [],  // friend ids
    role: null,              // 'rider' | 'guardian'
    riderCode: '',           // riders: their own code; guardians ignore
    phone: '',               // guardians: their callback number
    guardians: [],           // riders: [{ name, phone }]
    linkedRiders: []         // guardians: [{ code, name }]
  });
  const [pendingPage, setPendingPage] = useState(null);

  // Ensure a rider always has a code
  useEffect(() => {
    if (profile.role === 'rider' && !profile.riderCode) {
      setProfile({ ...profile, riderCode: generateRiderCode() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.role]);

  // Rider listens for incoming pages. Real-time delivery via Supabase; falls back
  // to localStorage (same-origin only) when Supabase env vars aren't set.
  const pendingPageIdRef = useRef(null);
  useEffect(() => {
    if (profile.role !== 'rider' || !profile.riderCode) return;
    const code = profile.riderCode;

    // --- Fallback: localStorage cross-tab listener ---
    const key = `rideout_page_${code}`;
    const readAndMaybeShow = (raw) => {
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (!data || data.ack) return;
        if (Date.now() - data.at > 24 * 60 * 60 * 1000) return;
        setPendingPage((prev) => prev || data);
      } catch (e) {}
    };
    try { readAndMaybeShow(localStorage.getItem(key)); } catch (e) {}
    const storageHandler = (e) => { if (e.key === key) readAndMaybeShow(e.newValue); };
    window.addEventListener('storage', storageHandler);

    // --- Primary: Supabase realtime ---
    let unsub = () => {};
    if (supabaseReady) {
      // Show any existing un-acked page on mount (e.g. rider was offline when paged).
      fetchLatestUnackedPage(code).then((row) => {
        if (!row) return;
        pendingPageIdRef.current = row.id;
        setPendingPage({
          at: new Date(row.sent_at).getTime(),
          from: row.from_name || 'Your guardian',
          phone: row.from_phone || '',
          msg: row.message || 'Check in with me.',
          _id: row.id,
        });
      });
      unsub = subscribePages(code, (row) => {
        if (!row || row.ack) return;
        pendingPageIdRef.current = row.id;
        setPendingPage({
          at: new Date(row.sent_at).getTime(),
          from: row.from_name || 'Your guardian',
          phone: row.from_phone || '',
          msg: row.message || 'Check in with me.',
          _id: row.id,
        });
      });
    }

    return () => {
      window.removeEventListener('storage', storageHandler);
      unsub();
    };
  }, [profile.role, profile.riderCode]);

  const dismissPage = () => {
    try {
      if (profile.riderCode) {
        const key = `rideout_page_${profile.riderCode}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          localStorage.setItem(key, JSON.stringify({ ...data, ack: true }));
        }
      }
    } catch (e) {}
    const id = pendingPageIdRef.current;
    pendingPageIdRef.current = null;
    if (supabaseReady && id) ackPage(id).catch(() => {});
    setPendingPage(null);
  };

  const testPageSelf = () => {
    // Lets the rider preview what a page looks like without another device.
    if (!profile.riderCode) return;
    sendPage(profile.riderCode, 'Demo Guardian', '(555) 000-1234', 'This is a test page.');
    setPendingPage({
      at: Date.now(),
      from: 'Demo Guardian',
      phone: '(555) 000-1234',
      msg: 'This is a test page.'
    });
  };

  // Rider broadcasts their location so guardians can see them on the map.
  // Primary: upserts into Supabase `riders` row. Fallback: localStorage (same-origin).
  useEffect(() => {
    if (profile.role !== 'rider' || !profile.riderCode) return;
    const key = `rideout_rider_${profile.riderCode}`;
    const writePos = (lat, lng, speed) => {
      const spd = typeof speed === 'number' && !isNaN(speed) ? speed : null;
      try {
        localStorage.setItem(key, JSON.stringify({
          code: profile.riderCode,
          name: profile.name || 'Rider',
          coords: { lat, lng },
          speed: spd,
          at: Date.now()
        }));
      } catch (e) {}
      if (supabaseReady) {
        upsertRider({
          code: profile.riderCode,
          name: profile.name || 'Rider',
          avatar: profile.avatar || null,
          coords: { lat, lng },
          speed: spd,
        }).catch(() => {});
      }
    };
    // Seed immediately from saved coords so the guardian sees *something* even offline.
    if (profile.coords) writePos(profile.coords.lat, profile.coords.lng, null);
    let watchId = null;
    if (navigator.geolocation) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => writePos(pos.coords.latitude, pos.coords.longitude, pos.coords.speed),
          () => { /* silent; we already have the last-known */ },
          { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
        );
      } catch (e) {}
    }
    return () => { if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); };
  }, [profile.role, profile.riderCode, profile.name, profile.avatar, profile.coords]);
  const [showDemoTour, setShowDemoTour] = useState(false);
  const [activeTab, setActiveTab] = useState('discover');
  const [discoverSegment, setDiscoverSegment] = useState('rides'); // rides | calendar
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [beginnerFriendly, setBeginnerFriendly] = useState(false);
  const [joinedEvents, setJoinedEvents] = useLocalState('rideout_joinedEvents', []);
  const [checkedIn, setCheckedIn] = useLocalState('rideout_checkedIn', {});
  const [mapView, setMapView] = useState('street');
  const [chatEventId, setChatEventId] = useState(null);
  const [showFriends, setShowFriends] = useState(false);
  const [showRouteBuilder, setShowRouteBuilder] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [showShops, setShowShops] = useState(false);
  const [showCreateCrew, setShowCreateCrew] = useState(false);
  const [showTrustedContact, setShowTrustedContact] = useState(false);
  const [qrShare, setQrShare] = useState(null); // { title, subtitle, url, accentColor }

  const openShareApp = () => setQrShare({
    title: 'Join me on Rideout',
    subtitle: `${profile.name || 'Rider'}'s invite${profile.city ? ` · ${profile.city}` : ''}`,
    url: `rideout-lilac.vercel.app/i/${(profile.name || 'rider').toLowerCase().replace(/\s/g, '')}`,
    accentColor: 'from-pink-500 to-blue-500'
  });
  const openShareCrew = (crew) => setQrShare({
    title: `Join ${crew.name}`,
    subtitle: `${crew.members} members · ${crew.city}`,
    url: `rideout-lilac.vercel.app/c/${crew.tag}`,
    accentColor: crew.color.replace('bg-', 'from-') + ' to-blue-500'
  });
  const openShareEvent = (event) => setQrShare({
    title: 'Share this ride',
    subtitle: `${event.title} · ${event.location}`,
    url: `rideout-lilac.vercel.app/r/${event.id}`,
    accentColor: 'from-pink-500 to-blue-500'
  });

  const [friends, setFriends] = useLocalState('rideout_friends', []);
  const [crews, setCrews] = useLocalState('rideout_crews', []);
  const [shops, setShops] = useLocalState('rideout_shops', []);
  const [events, setEvents] = useLocalState('rideout_events', []);
  const [feedPosts, setFeedPosts] = useLocalState('rideout_feedPosts', []);
  const [showShareLocation, setShowShareLocation] = useState(false);

  const rideIcons = { bike: Bike, ebike: Bike, skates: Zap, scooter: Navigation, escooter: Navigation, other: Bike };
  const rideColors = { bike: 'bg-pink-500', ebike: 'bg-amber-400', skates: 'bg-blue-500', scooter: 'bg-cyan-400', escooter: 'bg-lime-400', other: 'bg-fuchsia-500' };
  const rideLabels = { bike: 'Bike', ebike: 'E-Bike', skates: 'Skates', scooter: 'Scooter', escooter: 'E-Scoot', other: 'Other' };
  const electricTypes = ['ebike', 'escooter'];

  let filteredEvents = events;
  if (filterType !== 'all') filteredEvents = filteredEvents.filter(e => (e.types && e.types.includes(filterType)) || e.type === filterType);
  if (beginnerFriendly) filteredEvents = filteredEvents.filter(e => e.beginnerFriendly);
  if (levelFilter !== 'all') filteredEvents = filteredEvents.filter(e => e.level === levelFilter);

  const friendIds = friends.filter(f => f.isFriend).map(f => f.id);
  const friendsEvents = events.filter(e => friendIds.includes(e.hostId));
  const joinedCrewIds = crews.filter(c => c.isJoined).map(c => c.id);

  const toggleJoin = (eventId) => {
    if (joinedEvents.includes(eventId)) {
      setJoinedEvents(joinedEvents.filter(id => id !== eventId));
      setEvents(events.map(e => e.id === eventId ? {...e, attendees: e.attendees - 1} : e));
    } else {
      setJoinedEvents([...joinedEvents, eventId]);
      setEvents(events.map(e => e.id === eventId ? {...e, attendees: e.attendees + 1} : e));
    }
  };

  const toggleCheckIn = (eventId) => {
    setCheckedIn({...checkedIn, [eventId]: !checkedIn[eventId]});
  };

  const toggleFriend = (friendId) => {
    setFriends(friends.map(f => f.id === friendId ? {...f, isFriend: !f.isFriend} : f));
  };

  const toggleCrewJoin = (crewId) => {
    setCrews(crews.map(c => c.id === crewId ? {...c, isJoined: !c.isJoined, members: c.members + (c.isJoined ? -1 : 1)} : c));
  };

  const toggleLike = (postId) => {
    setFeedPosts(feedPosts.map(p => p.id === postId ? {...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1)} : p));
  };

  const addComment = (eventId, text) => {
    if (!text.trim()) return;
    setEvents(events.map(e => e.id === eventId ? {
      ...e,
      comments: [...e.comments, { id: e.comments.length + 1, user: profile.name, avatar: 'bg-pink-500', text, time: 'Just now' }]
    } : e));
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Role picker (first-run). Existing onboarded users without role default to rider.
  if (!profile.role) {
    if (onboarded) {
      // Backfill existing users (from before guardian mode existed)
      setProfile({ ...profile, role: 'rider' });
      return null;
    }
    return <RoleSelect onPick={(role) => setProfile({ ...profile, role })} />;
  }

  // Guardian branch: separate onboarding + home screen, no rider feed/crews/etc.
  if (profile.role === 'guardian') {
    if (!profile.name || !profile.phone) {
      return <GuardianOnboarding profile={profile} setProfile={setProfile} onSwitchRole={() => setProfile({ ...profile, role: null })} />;
    }
    return <GuardianHome profile={profile} setProfile={setProfile} onSwitchRole={() => setProfile({ ...profile, role: null, name: '', phone: '' })} />;
  }

  // Rider branch continues below with the existing onboarding flow.
  if (!onboarded) {
    return <Onboarding profile={profile} setProfile={setProfile} step={onboardStep} setStep={setOnboardStep} onComplete={() => {
      setOnboarded(true);
      try { if (!localStorage.getItem('rideoutDemoSeen')) setShowDemoTour(true); } catch (e) { setShowDemoTour(true); }
    }} />;
  }

  const chatEvent = chatEventId ? events.find(e => e.id === chatEventId) : null;
  const todayStr = new Date().toISOString().slice(0,10);
  const activeRideToday = events.find(e => e.date === todayStr && joinedEvents.includes(e.id));

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-950 text-white relative overflow-hidden flex flex-col" style={{height: '100dvh', WebkitTapHighlightColor: 'transparent', overscrollBehavior: 'contain'}}>
      <div className="relative flex-none">
        <div className="bg-gradient-to-r from-pink-500 via-pink-600 to-blue-500 px-4 pb-4" style={{paddingTop: 'max(env(safe-area-inset-top), 1.5rem)'}}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight" style={{textShadow: '2px 2px 0 rgba(0,0,0,0.2)'}}>RIDEOUT</h1>
              <p className="text-xs text-white/90 mt-0.5 font-semibold tracking-wide">RIDE DEEP. RIDE TOGETHER.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setProfile({ ...profile, role: 'guardian' })}
                title="Switch to guardian mode"
                className="h-10 px-3 rounded-full bg-amber-400 text-black flex items-center gap-1.5 border-2 border-white font-black text-[10px] uppercase tracking-wide active:scale-95">
                <ShieldCheck size={14} />Guardian
              </button>
              <button onClick={openShareApp} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white">
                <QrCode size={18} />
              </button>
              <button onClick={() => setActiveTab('profile')} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white overflow-hidden">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                  : <User size={18} />}
              </button>
            </div>
          </div>
        </div>
        <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
      </div>

      {qrShare && <QRShareModal data={qrShare} onClose={() => setQrShare(null)} />}
      {showDemoTour && <DemoTour onClose={() => {
        setShowDemoTour(false);
        try { localStorage.setItem('rideoutDemoSeen', '1'); } catch (e) {}
      }} />}
      {pendingPage && <PagerOverlay page={pendingPage} onDismiss={dismissPage} />}

      {/* Active ride banner with SOS */}
      {activeRideToday && (
        <div className="bg-red-500/10 border-b-2 border-red-500/40 px-4 py-2 flex items-center justify-between flex-none">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-3 w-3 flex-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-xs font-black uppercase truncate">Ride today · {activeRideToday.title}</span>
          </div>
          <button onClick={() => setShowSOS(true)} className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase border border-white flex items-center gap-1 flex-none min-h-[32px]">
            <AlertTriangle size={10} fill="currentColor" />SOS
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-4" style={{WebkitOverflowScrolling: 'touch'}}>
        {activeTab === 'discover' && (
          <DiscoverScreen
            events={filteredEvents} friendsEvents={friendsEvents} friendIds={friendIds}
            filterType={filterType} setFilterType={setFilterType}
            beginnerFriendly={beginnerFriendly} setBeginnerFriendly={setBeginnerFriendly}
            levelFilter={levelFilter} setLevelFilter={setLevelFilter}
            joinedEvents={joinedEvents} onEventClick={setSelectedEvent}
            mapView={mapView} setMapView={setMapView}
            rideIcons={rideIcons} rideColors={rideColors} rideLabels={rideLabels} electricTypes={electricTypes}
            formatDate={formatDate} profile={profile}
            segment={discoverSegment} setSegment={setDiscoverSegment}
            toggleJoin={toggleJoin} setChatEventId={setChatEventId}
            shops={shops} onShopsClick={() => setShowShops(true)}
          />
        )}
        {activeTab === 'crews' && (
          <CrewsScreen
            crews={crews} onCrewClick={setSelectedCrew} onCreateCrew={() => setShowCreateCrew(true)}
            rideIcons={rideIcons} rideColors={rideColors} rideLabels={rideLabels}
          />
        )}
        {activeTab === 'feed' && (
          <FeedScreen
            posts={feedPosts} onLike={toggleLike}
            rideColors={rideColors} rideIcons={rideIcons}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen
            profile={profile} setProfile={setProfile}
            joinedEvents={joinedEvents} friendIds={friendIds} joinedCrewIds={joinedCrewIds}
            events={events} crews={crews} friends={friends}
            rideIcons={rideIcons} rideColors={rideColors} rideLabels={rideLabels}
            formatDate={formatDate} onEventClick={setSelectedEvent}
            onOpenFriends={() => setShowFriends(true)}
            onOpenTrustedContact={() => setShowTrustedContact(true)}
            onOpenSOS={() => setShowSOS(true)}
            onOpenShareLocation={() => setShowShareLocation(true)}
            onTestPager={testPageSelf}
            setActiveTab={setActiveTab} setSelectedCrew={setSelectedCrew}
          />
        )}
      </div>

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent} crews={crews}
          onClose={() => setSelectedEvent(null)}
          onJoin={() => toggleJoin(selectedEvent.id)}
          onCheckIn={() => toggleCheckIn(selectedEvent.id)}
          isCheckedIn={!!checkedIn[selectedEvent.id]}
          onOpenChat={() => { setChatEventId(selectedEvent.id); setSelectedEvent(null); }}
          onSOS={() => { setShowSOS(true); setSelectedEvent(null); }}
          onShare={() => openShareEvent(selectedEvent)}
          isJoined={joinedEvents.includes(selectedEvent.id)}
          rideIcons={rideIcons} rideColors={rideColors}
          formatDate={formatDate} mapView={mapView}
        />
      )}

      {selectedCrew && (
        <CrewDetailModal
          crew={selectedCrew} events={events.filter(e => e.crewId === selectedCrew.id)}
          onClose={() => setSelectedCrew(null)}
          onToggleJoin={() => toggleCrewJoin(selectedCrew.id)}
          onEventClick={(e) => { setSelectedCrew(null); setSelectedEvent(e); }}
          onShare={() => openShareCrew(selectedCrew)}
          rideIcons={rideIcons} rideColors={rideColors} rideLabels={rideLabels}
          formatDate={formatDate}
        />
      )}

      {chatEvent && (
        <ChatModal event={chatEvent} onClose={() => setChatEventId(null)} onSend={(t) => addComment(chatEvent.id, t)} rideColors={rideColors} rideIcons={rideIcons} />
      )}
      {showFriends && <FriendsModal friends={friends} onToggle={toggleFriend} onClose={() => setShowFriends(false)} />}
      {showSOS && <SOSModal onClose={() => setShowSOS(false)} trustedContact={profile.trustedContact} />}
      {showShops && <ShopsModal shops={shops} onClose={() => setShowShops(false)} />}
      {showTrustedContact && <TrustedContactModal profile={profile} setProfile={setProfile} onClose={() => setShowTrustedContact(false)} />}
      {showShareLocation && <ShareLocationModal profile={profile} setProfile={setProfile} friends={friends} onClose={() => setShowShareLocation(false)} />}
      {showCreateCrew && (
        <CreateCrewModal
          profileCity={profile.city}
          onClose={() => setShowCreateCrew(false)}
          onCreate={(c) => { setCrews([...crews, {...c, id: crews.length + 1, isJoined: true, members: 1, verified: false, founded: String(new Date().getFullYear())}]); setShowCreateCrew(false); }}
        />
      )}
      {showCreateEvent && (
        <CreateEventModal
          profileName={profile.name} crews={crews.filter(c => c.isJoined)}
          onClose={() => setShowCreateEvent(false)}
          showRouteBuilder={showRouteBuilder} setShowRouteBuilder={setShowRouteBuilder} mapView={mapView}
          onCreate={(newEvent) => {
            const newId = events.length + 1;
            setEvents([...events, {...newEvent, id: newId, hostId: 1, hostVerified: profile.verified, comments: [], coords: newEvent.route[0] || { x: 50, y: 50 }}]);
            setJoinedEvents([...joinedEvents, newId]);
            setShowCreateEvent(false);
          }}
        />
      )}

      <div className="flex-none bg-zinc-950 border-t-2 border-pink-500/30 px-2 pt-2 flex items-center justify-around" style={{paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)'}}>
        {[
          { id: 'discover', icon: Home, label: 'Discover' },
          { id: 'crews', icon: Users, label: 'Crews' },
          { id: 'feed', icon: Rss, label: 'Feed' },
          { id: 'profile', icon: User, label: 'Profile' }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-2 rounded-lg transition min-h-[52px] ${isActive ? 'text-pink-500' : 'text-zinc-500'}`}>
              <Icon size={22} />
              <span className="text-[10px] font-black mt-0.5 uppercase">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <button onClick={() => setShowCreateEvent(true)}
        className="absolute right-4 w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-blue-500 shadow-2xl flex items-center justify-center active:scale-95 transition z-30 border-4 border-white"
        style={{bottom: 'calc(5.5rem + env(safe-area-inset-bottom))'}}>
        <Plus size={24} />
      </button>
    </div>
  );
}

// ===== DISCOVER =====
function DiscoverScreen({ events, friendsEvents, friendIds, filterType, setFilterType, beginnerFriendly, setBeginnerFriendly, levelFilter, setLevelFilter, joinedEvents, onEventClick, mapView, setMapView, rideIcons, rideColors, rideLabels, electricTypes, formatDate, profile, segment, setSegment, shops, onShopsClick }) {
  return (
    <div>
      <MapView mapView={mapView} setMapView={setMapView} events={events} rideIcons={rideIcons} rideColors={rideColors} onEventClick={onEventClick} showRoutes={true} location={profile.city} profileCoords={profile.coords} />

      {/* Segmented control */}
      <div className="px-4 pt-3 pb-1 flex gap-1 bg-zinc-900/50 mx-4 mt-3 rounded-xl p-1">
        {[
          { id: 'rides', label: 'Rides' },
          { id: 'calendar', label: 'Calendar' }
        ].map(s => (
          <button key={s.id} onClick={() => setSegment(s.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition ${segment === s.id ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white' : 'text-zinc-400'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {segment === 'rides' && (
        <>
          <div className="px-4 py-3 flex gap-2 overflow-x-auto">
            {['all', 'bike', 'ebike', 'skates', 'scooter', 'escooter', 'other'].map(type => (
              <button key={type} onClick={() => setFilterType(type)}
                className={`px-3.5 py-2 rounded-full text-xs font-black whitespace-nowrap transition uppercase tracking-wide flex items-center gap-1 ${
                  filterType === type ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white border-2 border-white shadow-lg' : 'bg-zinc-900 text-zinc-300 border-2 border-zinc-800'
                }`}>
                {electricTypes.includes(type) && <Zap size={10} fill="currentColor" />}
                {type === 'all' ? 'All' : rideLabels[type]}
              </button>
            ))}
          </div>

          {/* Secondary filters */}
          <div className="px-4 pb-3 flex gap-2 flex-wrap">
            <button onClick={() => setBeginnerFriendly(!beginnerFriendly)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase border-2 flex items-center gap-1 ${beginnerFriendly ? 'bg-green-500 border-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
              <Sparkles size={10} />Beginner-friendly
            </button>
            {['all', 'beginner', 'moderate', 'experienced'].map(l => (
              <button key={l} onClick={() => setLevelFilter(l)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase border-2 ${levelFilter === l ? 'bg-blue-500 border-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                {l === 'all' ? 'All levels' : l}
              </button>
            ))}
          </div>

          {friendsEvents.length > 0 && filterType === 'all' && (
            <div className="px-4 mb-3">
              <h2 className="text-sm font-black flex items-center gap-2 mb-2 uppercase tracking-wide">
                <Flame size={16} className="text-pink-500" />From your crew
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {friendsEvents.map(event => {
                  const Icon = rideIcons[event.type];
                  return (
                    <button key={event.id} onClick={() => onEventClick(event)}
                      className="flex-shrink-0 w-56 bg-zinc-900 rounded-2xl p-3 text-left border-2 border-pink-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`${rideColors[event.type]} w-9 h-9 rounded-lg flex items-center justify-center border-2 border-white`}>
                          <Icon size={16} />
                        </div>
                        <span className="text-xs text-zinc-400 font-semibold flex items-center gap-1">
                          {event.host}{event.hostVerified && <VerifiedBadge size={10} />}
                        </span>
                      </div>
                      <h4 className="font-black text-sm truncate">{event.title}</h4>
                      <p className="text-xs text-zinc-400 mt-1">{formatDate(event.date)} · {event.time}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="px-4 space-y-3">
            <h2 className="text-sm font-black flex items-center justify-between uppercase tracking-wide">
              Nearby rides
              <span className="text-xs font-semibold text-zinc-400 normal-case tracking-normal">{events.length} events</span>
            </h2>
            {events.map(event => (
              <EventCard key={event.id} event={event} rideIcons={rideIcons} rideColors={rideColors}
                isJoined={joinedEvents.includes(event.id)} isFriendHost={friendIds.includes(event.hostId)}
                onClick={() => onEventClick(event)} formatDate={formatDate} />
            ))}
            {events.length === 0 && <p className="text-center text-zinc-400 text-sm py-8">No rides match your filters.</p>}
          </div>

          {/* Local shops teaser — only when we have partner shops */}
          {shops.length > 0 && (
            <button onClick={onShopsClick} className="mx-4 mt-4 w-[calc(100%-2rem)] bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl p-4 flex items-center gap-3 border-2 border-amber-500/30">
              <div className="bg-amber-500 w-12 h-12 rounded-xl flex items-center justify-center border-2 border-white">
                <Store size={22} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-sm uppercase">Local ride shops</p>
                <p className="text-xs text-zinc-400 mt-0.5">{shops.length} partner shops near you · discounts for members</p>
              </div>
              <ChevronRight size={18} className="text-zinc-500" />
            </button>
          )}
        </>
      )}

      {segment === 'calendar' && (
        <div className="p-4 pt-2 space-y-3">
          {[...events].sort((a,b) => a.date.localeCompare(b.date)).map(event => {
            const Icon = rideIcons[event.type];
            const isJoined = joinedEvents.includes(event.id);
            return (
              <button key={event.id} onClick={() => onEventClick(event)} className="w-full text-left bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-800">
                <div className={`${rideColors[event.type]} px-4 py-2 flex items-center justify-between`}>
                  <span className="text-sm font-black uppercase">{formatDate(event.date)} · {event.time}</span>
                  <Icon size={18} />
                </div>
                <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
                <div className="p-4">
                  <h3 className="font-black flex items-center gap-1">{event.title}{event.hostVerified && <VerifiedBadge />}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{event.location} · {event.distance} · {event.pace}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3 text-xs text-zinc-300">
                      <span className="flex items-center gap-1"><Users size={12} />{event.attendees}</span>
                      {event.beginnerFriendly && <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">Beginner OK</span>}
                    </div>
                    {isJoined && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-500 uppercase">Joined</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventCard({ event, rideIcons, rideColors, isJoined, isFriendHost, onClick, formatDate }) {
  const Icon = rideIcons[event.type];
  return (
    <button onClick={onClick} className="w-full bg-zinc-900 rounded-2xl p-4 text-left hover:bg-zinc-800 transition border-2 border-zinc-800">
      <div className="flex items-start gap-3">
        <div className={`${rideColors[event.type]} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-white`}>
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-black text-base truncate">{event.title}</h3>
            {isJoined && <span className="bg-pink-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black flex-shrink-0 uppercase">In</span>}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
            Hosted by {event.host}
            {event.hostVerified && <VerifiedBadge size={10} />}
            {isFriendHost && <UserCheck size={10} className="text-pink-500" />}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {event.beginnerFriendly && <span className="bg-green-500/20 text-green-400 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">Beginner OK</span>}
            <span className="bg-zinc-800 text-zinc-300 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">{event.level}</span>
            {event.types && event.types.length > 1 && (
              <span className="bg-blue-500/20 text-blue-300 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">+{event.types.length - 1} types</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-300">
            <span className="flex items-center gap-1"><Clock size={12} />{formatDate(event.date)} · {event.time}</span>
            <span className="flex items-center gap-1"><Users size={12} />{event.attendees}</span>
            {event.comments.length > 0 && <span className="flex items-center gap-1"><MessageCircle size={12} />{event.comments.length}</span>}
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-xs text-zinc-400">
            <MapPin size={12} /><span className="truncate">{event.location}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ===== CREWS =====
function CrewsScreen({ crews, onCrewClick, onCreateCrew, rideIcons, rideColors, rideLabels }) {
  const myCrews = crews.filter(c => c.isJoined);
  const otherCrews = crews.filter(c => !c.isJoined);
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black uppercase tracking-wide">Crews</h2>
        <button onClick={onCreateCrew} className="bg-gradient-to-r from-pink-500 to-blue-500 border-2 border-white px-3 py-1.5 rounded-full text-xs font-black uppercase flex items-center gap-1">
          <Plus size={12} />New crew
        </button>
      </div>
      {myCrews.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs text-zinc-400 font-black uppercase mb-2 tracking-wider">Your crews</h3>
          <div className="space-y-2">
            {myCrews.map(c => <CrewCard key={c.id} crew={c} onClick={() => onCrewClick(c)} rideIcons={rideIcons} rideColors={rideColors} rideLabels={rideLabels} />)}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-xs text-zinc-400 font-black uppercase mb-2 tracking-wider">Crews near you</h3>
        <div className="space-y-2">
          {otherCrews.map(c => <CrewCard key={c.id} crew={c} onClick={() => onCrewClick(c)} rideIcons={rideIcons} rideColors={rideColors} rideLabels={rideLabels} />)}
        </div>
        {crews.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-zinc-600" />
            </div>
            <p className="text-sm font-black uppercase tracking-wide text-zinc-300">No crews yet</p>
            <p className="text-xs text-zinc-500 mt-1.5 max-w-[280px] mx-auto font-semibold">Be the first — tap <span className="text-pink-400">New crew</span> to start one, or check back as riders join Rideout in your area.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CrewCard({ crew, onClick, rideIcons, rideColors, rideLabels }) {
  const Icon = rideIcons[crew.rideType];
  return (
    <button onClick={onClick} className="w-full bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-800 text-left">
      <div className={`${crew.color} p-3 flex items-center gap-3`}>
        <div className="w-14 h-14 rounded-xl bg-white/20 border-2 border-white flex items-center justify-center font-black text-lg backdrop-blur">
          {crew.tag}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black uppercase flex items-center gap-1 truncate">
            {crew.name}
            {crew.verified && <VerifiedBadge size={12} />}
          </p>
          <p className="text-xs text-white/90 font-semibold flex items-center gap-2 mt-0.5">
            <Icon size={11} />{rideLabels[crew.rideType]} · <Users size={11} />{crew.members}
          </p>
        </div>
        {crew.isJoined && <span className="bg-white text-zinc-900 text-[10px] font-black px-2 py-1 rounded-full uppercase">Member</span>}
      </div>
      <div className="p-3">
        <p className="text-xs text-zinc-300 line-clamp-2">{crew.description}</p>
        <p className="text-[10px] text-zinc-500 font-semibold mt-1.5 uppercase">{crew.city} · Est. {crew.founded}</p>
      </div>
    </button>
  );
}

function CrewDetailModal({ crew, events, onClose, onToggleJoin, onEventClick, onShare, rideIcons, rideColors, rideLabels, formatDate }) {
  const Icon = rideIcons[crew.rideType];
  return (
    <div className="absolute inset-0 bg-zinc-950 z-50 flex flex-col overflow-hidden">
      <div className={`${crew.color} px-4 pb-4`} style={{paddingTop: 'max(env(safe-area-inset-top), 1.5rem)'}}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={onClose}><ArrowLeft size={22} /></button>
          <button onClick={onShare} className="bg-white/20 backdrop-blur border-2 border-white rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-black uppercase">
            <QrCode size={14} />Share crew
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 rounded-2xl bg-white/20 border-4 border-white flex items-center justify-center font-black text-2xl backdrop-blur">
            {crew.tag}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-xl uppercase flex items-center gap-1">
              {crew.name}
              {crew.verified && <VerifiedBadge size={18} />}
            </h2>
            <p className="text-xs text-white/90 font-semibold mt-1 flex items-center gap-2">
              <Icon size={12} />{rideLabels[crew.rideType]}
            </p>
            <p className="text-xs text-white/80 font-semibold mt-0.5">{crew.city} · Est. {crew.founded}</p>
          </div>
        </div>
      </div>
      <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-zinc-900 rounded-xl p-3 text-center border-2 border-zinc-800">
            <p className="text-xl font-black text-pink-500">{crew.members}</p>
            <p className="text-[10px] text-zinc-400 uppercase font-black">Members</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 text-center border-2 border-zinc-800">
            <p className="text-xl font-black text-blue-500">{events.length}</p>
            <p className="text-[10px] text-zinc-400 uppercase font-black">Rides</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 text-center border-2 border-zinc-800">
            <p className="text-xl font-black">{new Date().getFullYear() - parseInt(crew.founded)}y</p>
            <p className="text-[10px] text-zinc-400 uppercase font-black">Riding</p>
          </div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 mb-4 border-2 border-zinc-800">
          <p className="text-xs text-zinc-400 font-black uppercase mb-1">About</p>
          <p className="text-sm">{crew.description}</p>
        </div>
        <button onClick={onToggleJoin}
          className={`w-full py-3 rounded-xl font-black uppercase border-2 mb-4 ${
            crew.isJoined ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-gradient-to-r from-pink-500 to-blue-500 text-white border-white'
          }`}>
          {crew.isJoined ? '✓ Member — tap to leave' : 'Join crew'}
        </button>
        {events.length > 0 && (
          <div>
            <h3 className="text-xs text-zinc-400 font-black uppercase mb-2 tracking-wider">Upcoming crew rides</h3>
            <div className="space-y-2">
              {events.map(e => {
                const EIcon = rideIcons[e.type];
                return (
                  <button key={e.id} onClick={() => onEventClick(e)} className="w-full bg-zinc-900 rounded-xl p-3 flex items-center gap-3 border-2 border-zinc-800 text-left">
                    <div className={`${rideColors[e.type]} w-10 h-10 rounded-lg flex items-center justify-center border-2 border-white`}>
                      <EIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate">{e.title}</p>
                      <p className="text-xs text-zinc-400">{formatDate(e.date)} · {e.time}</p>
                    </div>
                    <ChevronRight size={18} className="text-zinc-500" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateCrewModal({ onClose, onCreate, profileCity = '' }) {
  const [form, setForm] = useState({ name: '', tag: '', city: profileCity, rideType: 'bike', description: '', color: 'bg-pink-500' });
  const colors = ['bg-pink-500', 'bg-blue-500', 'bg-amber-400', 'bg-lime-400', 'bg-fuchsia-500', 'bg-cyan-400'];
  return (
    <div className="absolute inset-0 bg-black/80 z-50 flex items-end" onClick={onClose}>
      <div className="bg-zinc-950 rounded-t-3xl w-full p-5 border-t-4 border-pink-500 max-h-[90%] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-black text-xl uppercase">Start a crew</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Crew name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Polk County Cruisers"
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Tag (3-4 letters)</label>
            <input value={form.tag} onChange={e => setForm({...form, tag: e.target.value.toUpperCase().slice(0,4)})} placeholder="PCC"
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500 font-black" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">City</label>
            <input value={form.city} onChange={e => setForm({...form, city: e.target.value})}
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Crew color</label>
            <div className="flex gap-2 mt-1">
              {colors.map(c => (
                <button key={c} onClick={() => setForm({...form, color: c})}
                  className={`${c} w-10 h-10 rounded-full border-4 ${form.color === c ? 'border-white' : 'border-transparent'}`} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">About</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows="3" placeholder="What's your crew about?"
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500 resize-none" />
          </div>
          <button onClick={() => onCreate(form)} disabled={!form.name || !form.tag}
            className="w-full py-3 rounded-xl font-black uppercase bg-gradient-to-r from-pink-500 to-blue-500 disabled:opacity-40 border-2 border-white">
            Create crew
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== FEED =====
function FeedScreen({ posts, onLike, rideColors, rideIcons }) {
  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between sticky top-0 bg-zinc-950 z-10 border-b border-zinc-800">
        <h2 className="text-xl font-black uppercase tracking-wide">Ride Feed</h2>
        <Rss size={20} className="text-pink-500" />
      </div>
      <div className="space-y-4 px-4 pt-4">
        {posts.map(post => <FeedPostCard key={post.id} post={post} onLike={() => onLike(post.id)} rideColors={rideColors} rideIcons={rideIcons} />)}
        {posts.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Rss size={32} className="text-zinc-600" />
            </div>
            <p className="text-sm font-black uppercase tracking-wide text-zinc-300">No recaps yet</p>
            <p className="text-xs text-zinc-500 mt-1.5 max-w-[260px] mx-auto font-semibold">Finish a ride and post a recap to kick off the feed. Photos, stats, and shoutouts show up here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedPostCard({ post, onLike, rideColors, rideIcons }) {
  const Icon = rideIcons[post.rideType];
  return (
    <div className="bg-zinc-900 rounded-2xl overflow-hidden border-2 border-zinc-800">
      <div className="p-3 flex items-center gap-2">
        <div className={`${post.hostAvatar} w-10 h-10 rounded-full flex items-center justify-center font-black border-2 border-white`}>
          {post.host[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm flex items-center gap-1">{post.host}{post.hostVerified && <VerifiedBadge />}</p>
          <p className="text-[10px] text-zinc-400 font-semibold uppercase">{post.eventTitle} · {post.time}</p>
        </div>
        <div className={`${rideColors[post.rideType]} w-8 h-8 rounded-lg flex items-center justify-center border-2 border-white`}>
          <Icon size={14} />
        </div>
      </div>
      {/* Photo placeholder using gradient */}
      <div className={`bg-gradient-to-br ${post.imageGradient} h-56 flex items-end p-3 relative overflow-hidden`}>
        <div className="absolute top-2 right-2 bg-black/40 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 uppercase">
          <Image size={10} />Ride recap
        </div>
        <div className="bg-black/50 backdrop-blur rounded-xl px-3 py-2 flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] font-black uppercase opacity-80">Distance</p>
            <p className="font-black text-sm">{post.distance}</p>
          </div>
          <div className="w-px h-8 bg-white/30" />
          <div className="text-center">
            <p className="text-[10px] font-black uppercase opacity-80">Time</p>
            <p className="font-black text-sm">{post.duration}</p>
          </div>
          <div className="w-px h-8 bg-white/30" />
          <div className="text-center">
            <p className="text-[10px] font-black uppercase opacity-80">Riders</p>
            <p className="font-black text-sm">{post.riderCount}</p>
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm">{post.caption}</p>
        <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-400 font-semibold uppercase">
          <span>Shoutouts:</span>
          {post.shoutouts.map((s, i) => <span key={i} className="text-pink-400">{s}{i < post.shoutouts.length - 1 ? ',' : ''}</span>)}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800">
          <button onClick={onLike} className="flex items-center gap-1.5 font-black text-sm">
            <Heart size={18} className={post.liked ? 'fill-pink-500 text-pink-500' : 'text-zinc-400'} />
            {post.likes}
          </button>
          <button className="flex items-center gap-1.5 font-black text-sm text-zinc-400">
            <MessageCircle size={18} />{post.comments.length}
          </button>
        </div>
        {post.comments.length > 0 && (
          <div className="mt-2 space-y-1">
            {post.comments.slice(0, 2).map((c, i) => (
              <p key={i} className="text-xs"><span className="font-black">{c.user}</span> <span className="text-zinc-300">{c.text}</span></p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== PROFILE =====
function ProfileScreen({ profile, setProfile, joinedEvents, friendIds, joinedCrewIds, events, crews, friends, rideIcons, rideColors, rideLabels, formatDate, onEventClick, onOpenFriends, onOpenTrustedContact, onOpenSOS, onOpenShareLocation, onTestPager, setActiveTab, setSelectedCrew }) {
  const fileRef = useRef(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locMsg, setLocMsg] = useState('');

  const onPickAvatar = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const data = await fileToAvatarDataURL(file, 256);
      setProfile({ ...profile, avatar: data });
    } catch (err) { /* ignore */ }
    e.target.value = '';
  };

  const refreshLocation = () => {
    if (!navigator.geolocation) { setLocMsg('Location not supported'); return; }
    setLocBusy(true); setLocMsg('');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const city = await reverseGeocode(coords.lat, coords.lng);
      setProfile({ ...profile, coords, city: city || profile.city });
      setLocBusy(false);
      setLocMsg(city ? `Updated to ${city}` : 'Location updated');
      setTimeout(() => setLocMsg(''), 2500);
    }, () => { setLocBusy(false); setLocMsg('Location permission denied'); setTimeout(() => setLocMsg(''), 2500); },
    { enableHighAccuracy: true, timeout: 8000 });
  };

  const sharingCount = (profile.locationSharedWith || []).length;

  return (
    <div className="p-4">
      <div className="relative rounded-2xl overflow-hidden border-2 border-white/10">
        <div className="bg-gradient-to-br from-pink-500 via-pink-600 to-blue-500 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white mx-auto flex items-center justify-center relative overflow-hidden">
            {profile.avatar
              ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
              : <User size={36} />}
            <button
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
              className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1.5 border-2 border-white shadow-lg active:scale-95"
              aria-label="Upload profile picture">
              <Camera size={12} />
            </button>
            {profile.verified && <div className="absolute -bottom-1 -left-1 bg-blue-400 rounded-full p-0.5 border-2 border-white"><BadgeCheck size={14} fill="white" className="text-blue-400" /></div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
          <h2 className="text-xl font-black mt-3 uppercase flex items-center gap-1 justify-center">{profile.name}</h2>
          <p className="text-sm text-white/90 font-semibold flex items-center justify-center gap-1.5">
            <MapPin size={12} />{profile.city}
          </p>
          <div className="flex justify-center gap-2 mt-3 flex-wrap">
            {profile.rideTypes.map(t => (
              <span key={t} className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-black border border-white/30">
                {rideLabels[t]}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={refreshLocation}
            disabled={locBusy}
            className="mt-3 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-black border border-white/40 uppercase tracking-wide disabled:opacity-60">
            <RefreshCw size={12} className={locBusy ? 'animate-spin' : ''} />
            {locBusy ? 'Updating…' : profile.coords ? 'Refresh location' : 'Use my location'}
          </button>
          {locMsg && <p className="mt-2 text-[10px] font-bold text-white/90">{locMsg}</p>}
        </div>
        <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-zinc-900 rounded-xl p-3 text-center border-2 border-zinc-800">
          <p className="text-2xl font-black text-pink-500">{joinedEvents.length}</p>
          <p className="text-xs text-zinc-400 uppercase font-semibold">Upcoming</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3 text-center border-2 border-zinc-800">
          <p className="text-2xl font-black text-blue-500">{joinedCrewIds.length}</p>
          <p className="text-xs text-zinc-400 uppercase font-semibold">Crews</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3 text-center border-2 border-zinc-800">
          <p className="text-2xl font-black text-white">0</p>
          <p className="text-xs text-zinc-400 uppercase font-semibold">Miles</p>
        </div>
      </div>
      {/* SAFETY SECTION */}
      <div className="mt-4 bg-zinc-900 rounded-2xl p-4 border-2 border-zinc-800">
        <h3 className="text-xs text-zinc-400 font-black uppercase mb-3 tracking-wider flex items-center gap-2">
          <ShieldCheck size={14} className="text-blue-400" />Safety
        </h3>
        <div className="space-y-2">
          <div className="bg-zinc-800 rounded-xl p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profile.verified ? 'bg-blue-500' : 'bg-zinc-700'}`}>
              <BadgeCheck size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black">Identity verified</p>
              <p className="text-[10px] text-zinc-400">{profile.verified ? 'Verified rider' : 'Verify to host public rides'}</p>
            </div>
            {!profile.verified && (
              <button onClick={() => setProfile({...profile, verified: true})} className="text-[10px] font-black uppercase bg-blue-500 px-3 py-1.5 rounded-full border-2 border-white">Verify</button>
            )}
          </div>
          <button onClick={onOpenTrustedContact} className="w-full bg-zinc-800 rounded-xl p-3 flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
              <Phone size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black">Trusted contact</p>
              <p className="text-[10px] text-zinc-400 truncate">{profile.trustedContact ? `${profile.trustedContact.name} · shares your ride location` : 'Add a contact who gets your ride info'}</p>
            </div>
            <ChevronRight size={16} className="text-zinc-500" />
          </button>
          <button onClick={onOpenShareLocation} className="w-full bg-zinc-800 rounded-xl p-3 flex items-center gap-3 text-left">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${sharingCount > 0 ? 'bg-pink-500' : 'bg-zinc-700'}`}>
              <LocateFixed size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black">Share live location</p>
              <p className="text-[10px] text-zinc-400 truncate">
                {sharingCount > 0 ? `Sharing with ${sharingCount} rider${sharingCount === 1 ? '' : 's'}` : 'Pick which crew members see where you are'}
              </p>
            </div>
            <ChevronRight size={16} className="text-zinc-500" />
          </button>
          <button onClick={onOpenSOS} className="w-full bg-zinc-800 rounded-xl p-3 flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black">Emergency SOS</p>
              <p className="text-[10px] text-zinc-400">Practice using SOS · always 1 tap during rides</p>
            </div>
            <ChevronRight size={16} className="text-zinc-500" />
          </button>
        </div>
      </div>
      {/* GUARDIANS / PAGER */}
      <div className="mt-4 bg-zinc-900 rounded-2xl p-4 border-2 border-zinc-800">
        <h3 className="text-xs text-zinc-400 font-black uppercase mb-3 tracking-wider flex items-center gap-2">
          <Radio size={14} className="text-amber-400" />Guardians & Pager
        </h3>
        <div className="bg-gradient-to-br from-amber-500 to-pink-500 rounded-xl p-4 border-2 border-white mb-3">
          <p className="text-[10px] font-black uppercase text-white/80 tracking-widest">Your rider code</p>
          <div className="flex items-center justify-between mt-1">
            <p className="font-mono font-black text-3xl text-white tracking-[0.3em]">{profile.riderCode || '------'}</p>
            <button
              onClick={() => {
                try { navigator.clipboard && navigator.clipboard.writeText(profile.riderCode || ''); } catch (e) {}
              }}
              className="bg-white/20 backdrop-blur rounded-full px-3 py-1.5 text-[10px] font-black uppercase border-2 border-white active:scale-95">
              <Copy size={12} className="inline mr-1" />Copy
            </button>
          </div>
          <p className="text-[10px] text-white/90 mt-2 font-semibold">Share this code with a parent, spouse, or ride buddy so they can page you from the Guardian app.</p>
        </div>
        {(profile.guardians || []).length > 0 && (
          <div className="space-y-2 mb-3">
            {profile.guardians.map((g, i) => (
              <div key={i} className="bg-zinc-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center border-2 border-white">
                  <ShieldCheck size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black truncate">{g.name}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{g.phone || 'No phone on file'}</p>
                </div>
                <button
                  onClick={() => setProfile({ ...profile, guardians: profile.guardians.filter((_, j) => j !== i) })}
                  className="text-zinc-500 active:scale-95" aria-label="Remove guardian">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={onTestPager} className="w-full bg-zinc-800 rounded-xl p-3 flex items-center gap-3 text-left border-2 border-dashed border-amber-500/40">
          <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
            <BellRing size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black">Test pager</p>
            <p className="text-[10px] text-zinc-400">Preview what a page looks, sounds, and feels like</p>
          </div>
          <ChevronRight size={16} className="text-zinc-500" />
        </button>
      </div>
      <button onClick={onOpenFriends} className="w-full mt-4 bg-zinc-900 rounded-xl p-3 flex items-center justify-between border-2 border-zinc-800">
        <span className="flex items-center gap-2 font-black text-sm uppercase">
          <Users size={18} className="text-pink-500" />
          Your crew ({friendIds.length})
        </span>
        <ChevronRight size={18} className="text-zinc-500" />
      </button>
      {joinedCrewIds.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs text-zinc-400 font-black uppercase mb-2 tracking-wider">Your crews</h3>
          <div className="space-y-2">
            {crews.filter(c => c.isJoined).map(c => (
              <button key={c.id} onClick={() => setSelectedCrew(c)} className="w-full bg-zinc-900 rounded-xl p-3 flex items-center gap-3 border-2 border-zinc-800 text-left">
                <div className={`${c.color} w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs border-2 border-white`}>
                  {c.tag}
                </div>
                <div className="flex-1">
                  <p className="font-black text-sm flex items-center gap-1">{c.name}{c.verified && <VerifiedBadge />}</p>
                  <p className="text-xs text-zinc-400">{c.members} members</p>
                </div>
                <ChevronRight size={18} className="text-zinc-500" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4">
        <h3 className="text-xs text-zinc-400 font-black uppercase mb-2 tracking-wider">Your rideouts</h3>
        <div className="space-y-2">
          {events.filter(e => joinedEvents.includes(e.id)).map(event => {
            const Icon = rideIcons[event.type];
            return (
              <button key={event.id} onClick={() => onEventClick(event)} className="w-full bg-zinc-900 rounded-xl p-3 flex items-center gap-3 border-2 border-zinc-800 text-left">
                <div className={`${rideColors[event.type]} w-10 h-10 rounded-lg flex items-center justify-center border-2 border-white`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-black text-sm">{event.title}</p>
                  <p className="text-xs text-zinc-400">{formatDate(event.date)} · {event.time}</p>
                </div>
                <ChevronRight size={18} className="text-zinc-500" />
              </button>
            );
          })}
          {joinedEvents.length === 0 && <p className="text-zinc-400 text-sm text-center py-4">No rideouts joined yet!</p>}
        </div>
      </div>
      {/* BRAND CREDIT */}
      <div className="mt-8 mb-4 mx-auto max-w-[240px]">
        <div className="rounded-xl overflow-hidden border-2 border-white/10 shadow-lg">
          <div className="bg-gradient-to-br from-pink-500 via-pink-600 to-blue-500 py-4 px-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1 text-white/80">
              <Bike size={12} />
              <p className="text-[9px] font-black uppercase tracking-[0.25em]">Created By</p>
              <Bike size={12} />
            </div>
            <p className="text-sm font-black uppercase tracking-wider text-white">The Lewis Team</p>
          </div>
          <CheckeredStrip color1="#ec4899" color2="#ffffff" />
        </div>
      </div>
    </div>
  );
}

// ===== SOS MODAL =====
function SOSModal({ onClose, trustedContact }) {
  const [countdown, setCountdown] = useState(null);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);
  return (
    <div className="absolute inset-0 bg-red-600 z-[60] flex flex-col p-6 text-white">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-black text-2xl uppercase">SOS</h2>
        <button onClick={onClose} className="bg-white/20 rounded-full p-2"><X size={20} /></button>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center text-center">
        {countdown === null && (
          <>
            <AlertTriangle size={80} className="mb-6" />
            <h3 className="font-black text-xl mb-3 uppercase">Emergency assistance</h3>
            <p className="text-sm mb-6 max-w-xs">
              Press and hold the button below to alert your trusted contact and share your live location with emergency services if needed.
            </p>
            <button
              onMouseDown={() => setCountdown(5)}
              onMouseUp={() => setCountdown(null)}
              onTouchStart={() => setCountdown(5)}
              onTouchEnd={() => setCountdown(null)}
              className="w-40 h-40 rounded-full bg-white text-red-600 font-black uppercase text-xl border-8 border-white/40 shadow-2xl">
              Hold<br />for SOS
            </button>
            {trustedContact ? (
              <p className="text-xs mt-6 opacity-80">Will alert: <span className="font-black">{trustedContact.name}</span></p>
            ) : (
              <p className="text-xs mt-6 opacity-80">⚠ No trusted contact set — add one in Profile → Safety</p>
            )}
          </>
        )}
        {countdown !== null && countdown > 0 && (
          <>
            <div className="w-48 h-48 rounded-full bg-white flex items-center justify-center mb-6 animate-pulse">
              <span className="text-red-600 font-black text-8xl">{countdown}</span>
            </div>
            <p className="font-black text-lg uppercase">Hold to send SOS</p>
            <p className="text-sm mt-2 opacity-80">Release to cancel</p>
          </>
        )}
        {countdown === 0 && (
          <>
            <Check size={80} className="mb-6" />
            <h3 className="font-black text-2xl uppercase">SOS SENT</h3>
            <p className="text-sm mt-3 max-w-xs">Your trusted contact has been notified and will receive your live location.</p>
            <button onClick={onClose} className="mt-6 bg-white text-red-600 font-black uppercase px-6 py-3 rounded-xl">Close</button>
          </>
        )}
      </div>
      <p className="text-xs text-center opacity-70 mt-6">In a real emergency, always call 911</p>
    </div>
  );
}

// ===== TRUSTED CONTACT =====
function TrustedContactModal({ profile, setProfile, onClose }) {
  const [form, setForm] = useState(profile.trustedContact || { name: '', phone: '' });
  return (
    <div className="absolute inset-0 bg-black/80 z-50 flex items-end" onClick={onClose}>
      <div className="bg-zinc-950 rounded-t-3xl w-full p-5 border-t-4 border-green-500" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-black text-xl uppercase flex items-center gap-2"><Phone size={18} className="text-green-500" />Trusted contact</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <p className="text-xs text-zinc-400 mb-4">This person gets notified when you start a ride and receives your live location if you use SOS.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Who should we notify?"
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-green-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Phone</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="(555) 123-4567" inputMode="tel"
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-green-500" />
          </div>
          <button onClick={() => { setProfile({...profile, trustedContact: form}); onClose(); }}
            disabled={!form.name || !form.phone}
            className="w-full py-3 rounded-xl font-black uppercase bg-green-500 text-white border-2 border-white disabled:opacity-40 mt-2">
            Save contact
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== SHARE LIVE LOCATION =====
function ShareLocationModal({ profile, setProfile, friends, onClose }) {
  const shared = profile.locationSharedWith || [];
  const crewFriends = friends.filter(f => f.isFriend);
  const toggle = (id) => {
    const next = shared.includes(id) ? shared.filter(x => x !== id) : [...shared, id];
    setProfile({ ...profile, locationSharedWith: next });
  };
  const shareAll = () => setProfile({ ...profile, locationSharedWith: crewFriends.map(f => f.id) });
  const stopAll = () => setProfile({ ...profile, locationSharedWith: [] });
  return (
    <div className="absolute inset-0 bg-black/80 z-50 flex items-end" onClick={onClose}>
      <div className="bg-zinc-950 rounded-t-3xl w-full p-5 border-t-4 border-pink-500 max-h-[85%] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-black text-xl uppercase flex items-center gap-2"><LocateFixed size={18} className="text-pink-500" />Share live location</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <p className="text-xs text-zinc-400 mb-4">Pick which crew members can see your live location during a ride. You can turn it off any time.</p>
        {crewFriends.length === 0 ? (
          <div className="bg-zinc-900 rounded-xl p-6 text-center border-2 border-zinc-800">
            <Users size={32} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-black uppercase">No crew yet</p>
            <p className="text-xs text-zinc-400 mt-1">Add friends from the Crew button in the header, then come back here to pick who sees your location.</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <button onClick={shareAll} className="flex-1 bg-pink-500 text-white text-[10px] font-black px-3 py-2 rounded-full uppercase border-2 border-white active:scale-95">Share with all</button>
              <button onClick={stopAll} disabled={shared.length === 0} className="flex-1 bg-zinc-800 text-white text-[10px] font-black px-3 py-2 rounded-full uppercase border-2 border-zinc-700 disabled:opacity-40 active:scale-95">Stop sharing</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {crewFriends.map(f => {
                const on = shared.includes(f.id);
                return (
                  <button key={f.id} onClick={() => toggle(f.id)} className={`w-full rounded-xl p-3 flex items-center gap-3 border-2 text-left transition ${on ? 'bg-pink-500/15 border-pink-500' : 'bg-zinc-900 border-zinc-800'}`}>
                    <div className={`${f.avatar || 'bg-pink-500'} w-10 h-10 rounded-full flex items-center justify-center font-black border-2 border-white`}>
                      {(f.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate">{f.name}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{on ? 'Sharing location' : 'Not sharing'}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${on ? 'bg-pink-500 border-white' : 'bg-zinc-900 border-zinc-600'}`}>
                      {on && <Check size={14} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
        <button onClick={onClose} className="mt-4 w-full py-3 rounded-xl font-black uppercase bg-zinc-800 text-white border-2 border-zinc-700">
          Done
        </button>
      </div>
    </div>
  );
}

// ===== SHOPS =====
function ShopsModal({ shops, onClose }) {
  return (
    <div className="absolute inset-0 bg-zinc-950 z-50 flex flex-col">
      <div className="bg-gradient-to-r from-amber-500 to-pink-500 px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={onClose}><ArrowLeft size={22} /></button>
        <div className="flex-1">
          <h2 className="font-black text-xl uppercase">Local Shops</h2>
          <p className="text-xs text-white/90 font-semibold">Ride-friendly shops near you</p>
        </div>
        <Store size={22} />
      </div>
      <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {shops.map(s => (
          <div key={s.id} className="bg-zinc-900 rounded-2xl p-4 border-2 border-zinc-800">
            <div className="flex items-start gap-3">
              <div className={`${s.color} w-12 h-12 rounded-xl flex items-center justify-center border-2 border-white flex-shrink-0`}>
                <Store size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-black flex-1">{s.name}</h3>
                  {s.sponsored && <span className="bg-amber-500/20 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded uppercase">Partner</span>}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{s.type}</p>
                <p className="text-xs text-zinc-300 mt-2 flex items-center gap-1"><MapPin size={10} />{s.address}</p>
                <p className="text-xs text-zinc-300 flex items-center gap-1"><Clock size={10} />{s.hours}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {s.specialties.map(sp => <span key={sp} className="bg-zinc-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">{sp}</span>)}
                </div>
                {s.sponsored && <p className="text-[10px] text-amber-400 font-black uppercase mt-2">💳 15% off for Rideout members</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== EVENT DETAIL (enhanced) =====
function EventDetailModal({ event, crews, onClose, onJoin, onCheckIn, isCheckedIn, onOpenChat, onSOS, onShare, isJoined, rideIcons, rideColors, formatDate, mapView }) {
  const Icon = rideIcons[event.type];
  const crew = crews.find(c => c.id === event.crewId);
  const isToday = event.date === new Date().toISOString().slice(0,10);
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={onClose}>
      <div className="bg-zinc-950 rounded-t-3xl w-full p-5 border-t-4 border-pink-500 max-h-[92%] overflow-y-auto"
           style={{paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)'}} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`${rideColors[event.type]} w-12 h-12 rounded-xl flex items-center justify-center border-2 border-white flex-shrink-0`}>
              <Icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-lg truncate">{event.title}</h2>
              <p className="text-xs text-zinc-400 font-semibold flex items-center gap-1">
                Hosted by {event.host}{event.hostVerified && <VerifiedBadge size={11} />}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <button onClick={onShare} className="bg-zinc-800 border border-zinc-700 rounded-full p-2 min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-95 transition">
              <QrCode size={16} />
            </button>
            <button onClick={onClose} className="min-h-[36px] min-w-[36px] flex items-center justify-center"><X size={20} /></button>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {event.beginnerFriendly && <span className="bg-green-500/20 text-green-400 text-[10px] font-black px-2 py-1 rounded uppercase">Beginner OK</span>}
          <span className="bg-zinc-800 text-zinc-300 text-[10px] font-black px-2 py-1 rounded uppercase">{event.level}</span>
          {crew && <span className="bg-pink-500/20 text-pink-400 text-[10px] font-black px-2 py-1 rounded uppercase">Crew: {crew.tag}</span>}
        </div>

        <p className="text-sm text-zinc-300 mb-4">{event.description}</p>

        {event.route && event.route.length > 0 && (
          <div className={`relative rounded-xl h-32 overflow-hidden mb-3 border-2 border-zinc-800 ${mapView === 'satellite' ? 'bg-gradient-to-br from-green-900 to-emerald-800' : 'bg-zinc-800'}`}>
            <MapBackground mapView={mapView} />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline points={event.route.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="rgb(236,72,153)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
              {event.route.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.3" fill={i === 0 ? 'rgb(34,197,94)' : i === event.route.length - 1 ? 'rgb(239,68,68)' : 'rgb(59,130,246)'} vectorEffect="non-scaling-stroke" stroke="white" strokeWidth="0.3" />
              ))}
            </svg>
            <div className="absolute bottom-2 left-2 bg-zinc-950/90 px-2 py-1 rounded text-[10px] font-black flex items-center gap-1 uppercase border border-pink-500/40">
              <Route size={10} />Route
            </div>
          </div>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-3 bg-zinc-900 rounded-xl p-3 border-2 border-zinc-800">
            <Clock size={18} className="text-pink-500" />
            <div><p className="text-xs text-zinc-400 uppercase font-semibold">When</p><p className="text-sm font-black">{formatDate(event.date)} at {event.time}</p></div>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900 rounded-xl p-3 border-2 border-zinc-800">
            <MapPin size={18} className="text-blue-500" />
            <div><p className="text-xs text-zinc-400 uppercase font-semibold">Meetup point</p><p className="text-sm font-black">{event.location}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-900 rounded-xl p-3 text-center border-2 border-zinc-800"><p className="text-xs text-zinc-400 uppercase font-semibold">Distance</p><p className="text-sm font-black">{event.distance}</p></div>
            <div className="bg-zinc-900 rounded-xl p-3 text-center border-2 border-zinc-800"><p className="text-xs text-zinc-400 uppercase font-semibold">Pace</p><p className="text-sm font-black">{event.pace}</p></div>
            <div className="bg-zinc-900 rounded-xl p-3 text-center border-2 border-zinc-800"><p className="text-xs text-zinc-400 uppercase font-semibold">Going</p><p className="text-sm font-black">{event.attendees}</p></div>
          </div>
        </div>

        {/* Check-in button if joined + today */}
        {isJoined && isToday && (
          <button onClick={onCheckIn}
            className={`w-full py-3 rounded-xl font-black uppercase border-2 mb-2 flex items-center justify-center gap-2 ${
              isCheckedIn ? 'bg-green-500 text-white border-white' : 'bg-zinc-900 text-white border-green-500'
            }`}>
            <Flag size={16} />{isCheckedIn ? '✓ Checked in at meetup' : "I'm at the meetup"}
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onOpenChat} className="py-3 rounded-xl font-black uppercase bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center gap-2 text-sm">
            <MessageCircle size={16} />Chat ({event.comments.length})
          </button>
          <button onClick={onJoin}
            className={`py-3 rounded-xl font-black uppercase text-sm border-2 ${isJoined ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-gradient-to-r from-pink-500 to-blue-500 text-white border-white'}`}>
            {isJoined ? '✓ Joined' : 'Join ride'}
          </button>
        </div>

        {/* SOS shortcut if joined + today */}
        {isJoined && isToday && (
          <button onClick={onSOS} className="w-full mt-2 py-2 rounded-xl font-black uppercase bg-red-500/10 text-red-400 border-2 border-red-500/40 flex items-center justify-center gap-2 text-xs">
            <AlertTriangle size={14} />Emergency SOS
          </button>
        )}
      </div>
    </div>
  );
}

// ===== ONBOARDING (unchanged except ride types include electric) =====
function Onboarding({ profile, setProfile, step, setStep, onComplete }) {
  const rideTypeOptions = [
    { id: 'bike', label: 'Bike', emoji: '🚴', electric: false },
    { id: 'ebike', label: 'E-Bike', emoji: '🚴⚡', electric: true },
    { id: 'skates', label: 'Skates', emoji: '🛼', electric: false },
    { id: 'scooter', label: 'Scooter', emoji: '🛴', electric: false },
    { id: 'escooter', label: 'E-Scoot', emoji: '🛴⚡', electric: true },
    { id: 'other', label: 'Other', emoji: '🛹', electric: false }
  ];
  const toggleRideType = (type) => {
    const types = profile.rideTypes.includes(type) ? profile.rideTypes.filter(t => t !== type) : [...profile.rideTypes, type];
    setProfile({...profile, rideTypes: types.length > 0 ? types : ['bike']});
  };
  return (
    <div className="w-full max-w-md mx-auto bg-gradient-to-br from-pink-500 via-pink-600 to-blue-600 text-white relative overflow-hidden flex flex-col" style={{height: '100dvh', WebkitTapHighlightColor: 'transparent', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)'}}>
      <div className="absolute left-0 right-0 h-3" style={{...checkeredStyle('#3b82f6', '#ffffff', 14), top: 'env(safe-area-inset-top)'}} />
      <div className="absolute left-0 right-0 h-3" style={{...checkeredStyle('#ec4899', '#ffffff', 14), bottom: 'env(safe-area-inset-bottom)'}} />
      <div className="p-6 pt-9 pb-9 flex flex-col flex-1 overflow-y-auto">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="mb-4 text-white/90 flex items-center gap-1 text-sm font-bold">
            <ArrowLeft size={16} /> Back
          </button>
        )}
        <div className="flex-1 flex flex-col justify-center">
          {step === 0 && (
            <div className="text-center">
              <div className="w-24 h-24 bg-white rounded-3xl mx-auto flex items-center justify-center mb-6 border-4 border-blue-500 shadow-2xl">
                <Bike size={48} className="text-pink-500" />
              </div>
              <h1 className="text-5xl font-black mb-3 tracking-tighter" style={{textShadow: '3px 3px 0 rgba(0,0,0,0.15)'}}>RIDEOUT</h1>
              <p className="text-white text-lg mb-8 font-black uppercase tracking-wider">Ride deep.<br />Ride together.</p>
              <div className="space-y-3 text-left max-w-xs mx-auto">
                <Feature icon="🗺️" text="Rides near you" />
                <Feature icon="👥" text="Join or start a crew" />
                <Feature icon="🛡️" text="SOS & trusted contact" />
                <Feature icon="📸" text="Share post-ride recaps" />
              </div>
            </div>
          )}
          {step === 1 && (
            <div>
              <h2 className="text-4xl font-black mb-2 uppercase tracking-tight">What's<br />your name?</h2>
              <p className="text-white/90 mb-6 font-semibold">This is what your crew will see.</p>
              <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} placeholder="Your name"
                className="w-full bg-white/20 backdrop-blur rounded-2xl px-5 py-4 text-lg outline-none border-4 border-white font-bold placeholder-white/60" />
            </div>
          )}
          {step === 2 && (
            <OnboardLocationStep profile={profile} setProfile={setProfile} />
          )}
          {step === 3 && (
            <div>
              <h2 className="text-4xl font-black mb-2 uppercase tracking-tight">How<br />do you roll?</h2>
              <p className="text-white/90 mb-6 font-semibold">Pick all that apply.</p>
              <div className="grid grid-cols-3 gap-3">
                {rideTypeOptions.map(opt => {
                  const selected = profile.rideTypes.includes(opt.id);
                  return (
                    <button key={opt.id} onClick={() => toggleRideType(opt.id)}
                      className={`p-4 rounded-2xl border-4 transition relative ${selected ? 'bg-white text-pink-600 border-blue-500' : 'bg-white/10 backdrop-blur border-white/40'}`}>
                      {opt.electric && <div className="absolute top-1 right-1 bg-yellow-300 rounded-full p-0.5 border border-pink-600"><Zap size={8} fill="currentColor" className="text-yellow-900" /></div>}
                      <div className="text-2xl mb-1">{opt.emoji}</div>
                      <div className="font-black text-xs uppercase">{opt.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="text-center">
              <div className="w-24 h-24 bg-white rounded-full mx-auto flex items-center justify-center mb-6 border-4 border-blue-500 shadow-2xl">
                <Sparkles size={48} className="text-pink-500" />
              </div>
              <h2 className="text-3xl font-black mb-3 uppercase">Let's ride{profile.name ? `, ${profile.name}` : ''}!</h2>
              <p className="text-white/90 text-lg mb-2 font-semibold">You're all set up in</p>
              <p className="text-white font-black text-xl mb-6 uppercase">{profile.city || 'your city'}</p>
              <p className="text-white/80 text-sm font-semibold">Start a ride, join a crew, or invite friends to get rolling.</p>
            </div>
          )}
        </div>
        <div className="pt-6">
          <div className="flex gap-1.5 mb-4 justify-center">
            {[0,1,2,3,4].map(i => (
              <div key={i} className={`h-2 rounded-full transition-all border border-white/60 ${i === step ? 'w-10 bg-white' : 'w-2 bg-white/30'}`} />
            ))}
          </div>
          <button onClick={() => step === 4 ? onComplete() : setStep(step + 1)} disabled={step === 1 && !profile.name.trim()}
            className="w-full bg-white text-pink-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-lg disabled:opacity-50 border-4 border-blue-500 uppercase tracking-wide shadow-xl">
            {step === 4 ? 'Start riding' : step === 0 ? 'Get started' : 'Continue'}
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardLocationStep({ profile, setProfile }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const useMyLocation = () => {
    if (!navigator.geolocation) { setMsg('Location not supported on this device'); return; }
    setBusy(true); setMsg('');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const city = await reverseGeocode(coords.lat, coords.lng);
      setProfile({ ...profile, coords, city: city || profile.city });
      setBusy(false);
      setMsg(city ? `Got it — ${city}` : 'Location saved');
    }, () => {
      setBusy(false);
      setMsg('Permission denied — type your city below');
    }, { enableHighAccuracy: true, timeout: 8000 });
  };
  return (
    <div>
      <h2 className="text-4xl font-black mb-2 uppercase tracking-tight">Where<br />do you ride?</h2>
      <p className="text-white/90 mb-6 font-semibold">We'll show you rides in your area.</p>
      <button
        type="button"
        onClick={useMyLocation}
        disabled={busy}
        className="w-full bg-white text-pink-600 font-black py-3 rounded-2xl flex items-center justify-center gap-2 border-4 border-blue-500 uppercase tracking-wide text-sm mb-3 shadow-xl disabled:opacity-60">
        <LocateFixed size={18} />
        {busy ? 'Finding you…' : 'Use my current location'}
      </button>
      <input value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})} placeholder="Or type your city, state"
        className="w-full bg-white/20 backdrop-blur rounded-2xl px-5 py-4 text-lg outline-none border-4 border-white font-bold placeholder-white/60" />
      {msg
        ? <p className="text-white text-xs mt-3 font-black">{msg}</p>
        : <p className="text-white/80 text-xs mt-3 font-semibold">🧭 We'll ask for your location to show nearby rides</p>}
    </div>
  );
}

function Feature({ icon, text }) {
  return (
    <div className="flex items-center gap-3 bg-white/20 backdrop-blur rounded-xl px-4 py-3 border-2 border-white/40">
      <span className="text-2xl">{icon}</span>
      <span className="font-black uppercase text-sm tracking-wide">{text}</span>
    </div>
  );
}

// ===== DEMO TOUR =====
function DemoTour({ onClose }) {
  const [step, setStep] = useState(0);
  const slides = [
    {
      icon: Home, accent: 'from-pink-500 to-blue-500',
      title: 'Welcome to Rideout',
      body: 'A quick tour — or skip it if you\'d rather dive in. Rideout helps you find rides, build crews, and ride safer.'
    },
    {
      icon: MapPin, accent: 'from-pink-500 to-fuchsia-500',
      title: 'Discover rides',
      body: 'The map shows rideouts near you. Tap a pin or scroll the list to see details. Filter by ride type, skill level, or beginner-friendly.'
    },
    {
      icon: Users, accent: 'from-blue-500 to-cyan-400',
      title: 'Join a crew',
      body: 'Crews are your regular ride group — weekly rides, private chat, shared calendar. Join one or start your own from the Crews tab.'
    },
    {
      icon: Plus, accent: 'from-pink-500 to-blue-500',
      title: 'Host a ride',
      body: 'Tap the big + button from any screen to create a rideout. Set a route, pick a ride type, and invite your crew.'
    },
    {
      icon: Rss, accent: 'from-fuchsia-500 to-pink-500',
      title: 'Share the recap',
      body: 'After each ride, post photos and stats to the Feed. Tag riders, get likes, and keep the crew hyped for next time.'
    },
    {
      icon: ShieldCheck, accent: 'from-green-500 to-blue-500',
      title: 'Ride safer',
      body: 'Add a trusted contact and practice the SOS button from your Profile. Both live at the top of the Profile screen.'
    }
  ];
  const cur = slides[step];
  const Icon = cur.icon;
  const isLast = step === slides.length - 1;
  return (
    <div className="absolute inset-0 z-[100] bg-zinc-950/95 backdrop-blur-sm flex flex-col p-6" style={{paddingTop: 'max(env(safe-area-inset-top), 1.5rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)'}}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Tour · {step + 1} / {slides.length}</span>
        <button onClick={onClose} className="text-xs font-black uppercase text-zinc-400 border border-zinc-700 rounded-full px-3 py-1.5 active:scale-95">Skip tour</button>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div className={`bg-gradient-to-br ${cur.accent} rounded-3xl p-6 border-4 border-white/10 shadow-2xl`}>
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur border-2 border-white flex items-center justify-center mb-4">
            <Icon size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-black uppercase text-white mb-2 leading-tight">{cur.title}</h2>
          <p className="text-white/90 text-sm font-semibold leading-relaxed">{cur.body}</p>
        </div>
        <CheckeredStrip color1="#ec4899" color2="#ffffff" className="mt-4 rounded-full overflow-hidden" />
      </div>
      <div className="pt-4">
        <div className="flex gap-1.5 mb-4 justify-center">
          {slides.map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all border border-white/40 ${i === step ? 'w-8 bg-pink-500' : 'w-2 bg-zinc-700'}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="bg-zinc-800 text-white font-black py-3 px-5 rounded-2xl flex items-center gap-1 uppercase text-sm border-2 border-zinc-700 active:scale-95">
              <ArrowLeft size={16} />Back
            </button>
          )}
          <button onClick={() => isLast ? onClose() : setStep(step + 1)}
            className="flex-1 bg-gradient-to-r from-pink-500 to-blue-500 text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-wide border-2 border-white shadow-xl active:scale-95">
            {isLast ? "Let's ride" : 'Next'}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Stylized fallback background used inside modals where an interactive real map is overkill
function MapBackground({ mapView }) {
  if (mapView === 'satellite') {
    return (
      <>
        <div className="absolute inset-0" style={{backgroundImage: `radial-gradient(circle at 20% 30%, rgba(74,124,89,0.6) 0%, transparent 30%), radial-gradient(circle at 70% 20%, rgba(45,85,55,0.7) 0%, transparent 35%), radial-gradient(circle at 40% 70%, rgba(90,135,100,0.5) 0%, transparent 40%), radial-gradient(circle at 85% 65%, rgba(55,95,70,0.8) 0%, transparent 30%), radial-gradient(circle at 15% 85%, rgba(30,75,45,0.7) 0%, transparent 35%)`}} />
        <div className="absolute w-20 h-14 bg-blue-900/60 rounded-full blur-sm" style={{top: '35%', left: '40%'}} />
        <div className="absolute w-16 h-12 bg-blue-900/60 rounded-full blur-sm" style={{top: '55%', left: '25%'}} />
      </>
    );
  }
  return (
    <div className="absolute inset-0 opacity-20">
      {[...Array(10)].map((_, i) => <div key={`h${i}`} className="absolute w-full border-t border-white/20" style={{top: `${i * 10}%`}} />)}
      {[...Array(10)].map((_, i) => <div key={`v${i}`} className="absolute h-full border-l border-white/20" style={{left: `${i * 10}%`}} />)}
    </div>
  );
}

// Tile URLs by map style
const MAP_TILES = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  }
};

// Ride-type accent colors used for pins and routes
const PIN_COLORS = {
  bike: '#ec4899', ebike: '#f59e0b', skates: '#3b82f6',
  scooter: '#22d3ee', escooter: '#a3e635', other: '#d946ef'
};

// Event coords in this app are stored as { x, y } percentages (legacy).
// For real-map rendering we anchor them around a center point and scale to a small bbox.
function coordsToLatLng(coords, center) {
  if (!coords) return center;
  // ~0.05° = ~5km N/S, 0.07° ~= ~7km E/W at this latitude
  const latSpread = 0.05;
  const lngSpread = 0.07;
  const lat = center[0] + (50 - coords.y) / 50 * (latSpread / 2);
  const lng = center[1] + (coords.x - 50) / 50 * (lngSpread / 2);
  return [lat, lng];
}

function MapView({ mapView, setMapView, events, rideIcons, rideColors, onEventClick, showRoutes, location, profileCoords }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerLayerRef = useRef(null);
  const [center, setCenter] = useState(
    profileCoords ? [profileCoords.lat, profileCoords.lng] : [28.0222, -81.7328]
  );
  const [ready, setReady] = useState(false);

  // Keep map centered on the saved profile coords if they exist
  useEffect(() => {
    if (profileCoords) setCenter([profileCoords.lat, profileCoords.lng]);
  }, [profileCoords]);

  // If we don't have saved coords, try geolocation once on mount
  useEffect(() => {
    if (profileCoords) return; // saved coords win
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => { /* silent fallback to default */ },
      { timeout: 5000, maximumAge: 300000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!window.L || !containerRef.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(containerRef.current, {
      center, zoom: 13, zoomControl: false, attributionControl: true
    });
    const tiles = MAP_TILES[mapView] || MAP_TILES.street;
    tileLayerRef.current = L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: 19 }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setReady(true);
    // Ensure map redraws after container sizes settle
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when geolocation resolves
  useEffect(() => {
    if (mapRef.current) mapRef.current.setView(center, mapRef.current.getZoom());
  }, [center]);

  // Swap tiles on street/satellite toggle
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    const tiles = MAP_TILES[mapView] || MAP_TILES.street;
    tileLayerRef.current = window.L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: 19 }).addTo(mapRef.current);
  }, [mapView]);

  // Render markers + routes whenever events change
  useEffect(() => {
    if (!mapRef.current || !window.L || !markerLayerRef.current) return;
    const L = window.L;
    markerLayerRef.current.clearLayers();

    events.forEach(event => {
      const latlng = coordsToLatLng(event.coords, center);
      const color = PIN_COLORS[event.type] || '#ec4899';

      // Custom pin icon as DivIcon
      const pinHtml = `
        <div style="
          width:36px;height:36px;border-radius:50%;
          background:${color};border:3px solid #fff;
          box-shadow:0 4px 10px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:900;font-size:14px;">${event.type[0].toUpperCase()}</div>`;
      const icon = L.divIcon({
        html: pinHtml, className: '', iconSize: [36,36], iconAnchor: [18,18]
      });
      const marker = L.marker(latlng, { icon }).addTo(markerLayerRef.current);
      marker.on('click', () => onEventClick(event));

      // Route polyline
      if (showRoutes && event.route && event.route.length > 1) {
        const routeLatLngs = event.route.map(p => coordsToLatLng(p, center));
        L.polyline(routeLatLngs, {
          color, weight: 4, opacity: 0.75, dashArray: '6 6'
        }).addTo(markerLayerRef.current);
      }
    });

    // User "you are here" marker
    const youHtml = `
      <div style="position:relative;width:22px;height:22px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.25);animation:pulse 1.8s infinite;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2px solid #fff;"></div>
      </div>`;
    const youIcon = L.divIcon({ html: youHtml, className: '', iconSize: [22,22], iconAnchor: [11,11] });
    L.marker(center, { icon: youIcon, interactive: false }).addTo(markerLayerRef.current);
  }, [events, center, showRoutes, onEventClick, ready]);

  return (
    <div className="relative h-56 overflow-hidden border-b-2 border-pink-500/30 bg-zinc-900">
      <div ref={containerRef} className="absolute inset-0" style={{zIndex: 1}} />
      <div className="absolute top-3 left-3 bg-zinc-950/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 z-[500] border border-pink-500/40 uppercase pointer-events-none">
        <MapPin size={12} className="text-pink-500" />{location || 'Your area'}
      </div>
      <button onClick={() => setMapView(mapView === 'street' ? 'satellite' : 'street')} className="absolute top-3 right-3 bg-zinc-950/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 z-[500] border border-blue-500/40 uppercase text-white">
        <Layers size={12} />{mapView === 'street' ? 'Satellite' : 'Street'}
      </button>
    </div>
  );
}

// ===== CHAT =====
function ChatModal({ event, onClose, onSend, rideColors, rideIcons }) {
  const [text, setText] = useState('');
  const Icon = rideIcons[event.type];
  const handleSend = () => { onSend(text); setText(''); };
  return (
    <div className="absolute inset-0 bg-zinc-950 z-50 flex flex-col">
      <div className={`${rideColors[event.type]} px-4 pt-6 pb-3 flex items-center gap-3`}>
        <button onClick={onClose}><ArrowLeft size={22} /></button>
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border-2 border-white"><Icon size={18} /></div>
        <div className="flex-1 min-w-0">
          <h2 className="font-black truncate uppercase">{event.title}</h2>
          <p className="text-xs text-white/90 font-semibold">{event.attendees} riders · {event.comments.length} messages</p>
        </div>
      </div>
      <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {event.comments.length === 0 && (
          <div className="text-center py-10 text-zinc-400">
            <MessageCircle size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-bold">No messages yet.</p>
            <p className="text-xs mt-1">Be the first to say hi! 👋</p>
          </div>
        )}
        {event.comments.map(c => (
          <div key={c.id} className="flex gap-3">
            <div className={`${c.avatar} w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 border-2 border-white`}>{c.user[0]}</div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2"><span className="font-black text-sm">{c.user}</span><span className="text-xs text-zinc-500">{c.time}</span></div>
              <p className="text-sm text-zinc-200 mt-0.5">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t-2 border-zinc-800 flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Say something..."
          className="flex-1 bg-zinc-900 rounded-full px-4 py-3 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500" />
        <button onClick={handleSend} disabled={!text.trim()} className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-blue-500 flex items-center justify-center disabled:opacity-40 border-2 border-white">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

// ===== FRIENDS =====
function FriendsModal({ friends, onToggle, onClose }) {
  const [tab, setTab] = useState('crew');
  const [search, setSearch] = useState('');
  const myCrew = friends.filter(f => f.isFriend);
  const suggestions = friends.filter(f => !f.isFriend);
  const list = tab === 'crew' ? myCrew : suggestions;
  const filtered = list.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="absolute inset-0 bg-zinc-950 z-50 flex flex-col">
      <div className="bg-gradient-to-r from-pink-500 via-pink-600 to-blue-500 px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onClose}><ArrowLeft size={22} /></button>
          <h2 className="font-black text-xl uppercase tracking-wide">Riders</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('crew')} className={`flex-1 py-2 rounded-full text-sm font-black uppercase border-2 ${tab === 'crew' ? 'bg-white text-pink-600 border-blue-500' : 'bg-white/20 border-white/30'}`}>
            Following ({myCrew.length})
          </button>
          <button onClick={() => setTab('discover')} className={`flex-1 py-2 rounded-full text-sm font-black uppercase border-2 ${tab === 'discover' ? 'bg-white text-pink-600 border-blue-500' : 'bg-white/20 border-white/30'}`}>
            Discover ({suggestions.length})
          </button>
        </div>
      </div>
      <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
      <div className="p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search riders..."
            className="w-full bg-zinc-900 rounded-xl pl-10 pr-4 py-3 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.map(f => (
          <div key={f.id} className="bg-zinc-900 rounded-xl p-3 flex items-center gap-3 border-2 border-zinc-800">
            <div className={`${f.avatar} w-11 h-11 rounded-full flex items-center justify-center font-black border-2 border-white`}>{f.name[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm flex items-center gap-1">{f.name}{f.verified && <VerifiedBadge />}</p>
              <p className="text-xs text-zinc-400 truncate">{f.city} · {f.rideType}</p>
            </div>
            <button onClick={() => onToggle(f.id)} className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1 uppercase border-2 ${f.isFriend ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-gradient-to-r from-pink-500 to-blue-500 border-white'}`}>
              {f.isFriend ? <><UserCheck size={12} />Following</> : <><UserPlus size={12} />Follow</>}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <UserPlus size={36} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-sm font-black uppercase text-zinc-300">{tab === 'crew' ? "You're not following anyone yet" : 'No riders to suggest yet'}</p>
            <p className="text-xs text-zinc-500 mt-1.5 max-w-[260px] mx-auto font-semibold">Share your invite link or join a rideout to connect with other riders.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== CREATE EVENT =====
function CreateEventModal({ profileName, crews, onClose, onCreate, showRouteBuilder, setShowRouteBuilder, mapView }) {
  // Default date = tomorrow
  const defaultDate = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const [form, setForm] = useState({
    title: '', type: 'bike', types: ['bike'], date: defaultDate, time: '18:00', location: '',
    distance: '5 mi', pace: 'Chill', description: '', host: profileName,
    attendees: 1, route: [], level: 'moderate', beginnerFriendly: false, crewId: null
  });
  const toggleType = (id) => {
    const has = form.types.includes(id);
    const next = has ? form.types.filter(t => t !== id) : [...form.types, id];
    const safe = next.length > 0 ? next : ['bike'];
    setForm({ ...form, types: safe, type: safe[0] });
  };
  if (showRouteBuilder) {
    return <RouteBuilder initialRoute={form.route} mapView={mapView}
      onDone={(route) => { setForm({...form, route}); setShowRouteBuilder(false); }}
      onCancel={() => setShowRouteBuilder(false)} />;
  }
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end" onClick={onClose}>
      <div className="bg-zinc-950 rounded-t-3xl w-full p-5 border-t-4 border-pink-500 max-h-[90%] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-black text-xl uppercase tracking-wide">Create rideout</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Event name</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Sunday Morning Cruise"
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Ride types · pick all that apply</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                { id: 'bike', label: 'Bike', icon: Bike, electric: false },
                { id: 'ebike', label: 'E-Bike', icon: Bike, electric: true },
                { id: 'skates', label: 'Skates', icon: Zap, electric: false },
                { id: 'scooter', label: 'Scooter', icon: Navigation, electric: false },
                { id: 'escooter', label: 'E-Scoot', icon: Navigation, electric: true },
                { id: 'other', label: 'Other', icon: Bike, electric: false }
              ].map(t => {
                const Icon = t.icon;
                const selected = form.types.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggleType(t.id)}
                    className={`py-3 rounded-xl flex flex-col items-center gap-1 transition border-2 relative ${selected ? 'bg-gradient-to-br from-pink-500 to-blue-500 border-white' : 'bg-zinc-900 border-zinc-800'}`}>
                    {t.electric && <div className="absolute top-1 right-1 bg-yellow-300 rounded-full p-0.5 border border-zinc-950"><Zap size={8} fill="currentColor" className="text-yellow-900" /></div>}
                    {selected && <div className="absolute top-1 left-1 bg-white rounded-full p-0.5 border border-pink-600"><Check size={8} className="text-pink-600" /></div>}
                    <Icon size={18} />
                    <span className="text-[10px] font-black uppercase">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1.5 font-semibold">{form.types.length} selected — everyone with any of these ride types will see your rideout.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 font-black uppercase">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-black uppercase">Time</label>
              <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})}
                className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Meetup point</label>
            <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Central Park Fountain"
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500" />
          </div>

          {/* Rider level + beginner-friendly */}
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Rider level</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {['beginner', 'moderate', 'experienced'].map(l => (
                <button key={l} onClick={() => setForm({...form, level: l})}
                  className={`py-2 rounded-xl text-xs font-black uppercase border-2 ${form.level === l ? 'bg-blue-500 border-white' : 'bg-zinc-900 border-zinc-800'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setForm({...form, beginnerFriendly: !form.beginnerFriendly})}
            className={`w-full py-3 rounded-xl font-black uppercase text-sm border-2 flex items-center justify-center gap-2 ${form.beginnerFriendly ? 'bg-green-500 border-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
            <Sparkles size={14} />Beginner-friendly {form.beginnerFriendly ? '✓' : ''}
          </button>

          {/* Crew select */}
          {crews.length > 0 && (
            <div>
              <label className="text-xs text-zinc-400 font-black uppercase">Crew (optional)</label>
              <select value={form.crewId || ''} onChange={e => setForm({...form, crewId: e.target.value ? parseInt(e.target.value) : null})}
                className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800">
                <option value="">Open ride (no crew)</option>
                {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <button onClick={() => setShowRouteBuilder(true)} className="w-full bg-zinc-900 rounded-xl p-3 flex items-center justify-between border-2 border-zinc-800 hover:border-pink-500">
            <div className="flex items-center gap-2">
              <Route size={18} className="text-pink-500" />
              <div className="text-left">
                <p className="text-sm font-black uppercase">{form.route.length > 0 ? `Route set (${form.route.length} points)` : 'Draw route on map'}</p>
                <p className="text-xs text-zinc-400">{form.route.length > 0 ? 'Tap to edit' : 'Optional'}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-zinc-500" />
          </button>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 font-black uppercase">Distance</label>
              <select value={form.distance} onChange={e => setForm({...form, distance: e.target.value})}
                className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800">
                <option>3 mi</option><option>5 mi</option><option>8 mi</option><option>12 mi</option><option>20+ mi</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-black uppercase">Pace</label>
              <select value={form.pace} onChange={e => setForm({...form, pace: e.target.value})}
                className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800">
                <option>Chill</option><option>Moderate</option><option>Fast</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="What to expect..." rows="3"
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-pink-500 resize-none" />
          </div>
          <button onClick={() => onCreate(form)} disabled={!form.title || !form.location}
            className="w-full py-3 rounded-xl font-black uppercase bg-gradient-to-r from-pink-500 to-blue-500 disabled:opacity-40 border-2 border-white">
            Create rideout
          </button>
        </div>
      </div>
    </div>
  );
}

function RouteBuilder({ initialRoute, mapView, onDone, onCancel }) {
  const [route, setRoute] = useState(initialRoute || []);
  const mapRef = useRef(null);
  const handleMapTap = (e) => {
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setRoute([...route, { x: Math.round(x), y: Math.round(y) }]);
  };
  return (
    <div className="absolute inset-0 bg-zinc-950 z-50 flex flex-col">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={onCancel}><ArrowLeft size={22} /></button>
        <div className="flex-1"><h2 className="font-black text-lg uppercase">Draw Route</h2><p className="text-xs text-white/90 font-semibold">Tap the map to add points</p></div>
        <button onClick={() => onDone(route)} className="bg-white text-pink-600 font-black px-4 py-1.5 rounded-full text-sm uppercase border-2 border-blue-500">Done</button>
      </div>
      <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
      <div className="flex-1 relative overflow-hidden">
        <div ref={mapRef} onClick={handleMapTap} className={`absolute inset-0 cursor-crosshair ${mapView === 'satellite' ? 'bg-gradient-to-br from-green-900 via-emerald-800 to-green-900' : 'bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-800'}`}>
          <MapBackground mapView={mapView} />
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {route.length > 1 && <polyline points={route.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="rgb(236,72,153)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />}
            {route.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.6" fill={i === 0 ? 'rgb(34,197,94)' : i === route.length - 1 ? 'rgb(239,68,68)' : 'rgb(59,130,246)'} stroke="white" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />)}
          </svg>
          {route.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center bg-zinc-950/90 backdrop-blur rounded-2xl px-6 py-4 border-2 border-pink-500">
                <Route size={32} className="text-pink-500 mx-auto mb-2" />
                <p className="font-black uppercase">Tap anywhere to start</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="p-4 bg-zinc-950 border-t-2 border-zinc-800 flex gap-2">
        <button onClick={() => setRoute(route.slice(0, -1))} disabled={route.length === 0} className="flex-1 py-3 rounded-xl font-black uppercase bg-zinc-900 border-2 border-zinc-800 disabled:opacity-40 flex items-center justify-center gap-2">
          <ArrowLeft size={16} />Undo
        </button>
        <button onClick={() => setRoute([])} disabled={route.length === 0} className="flex-1 py-3 rounded-xl font-black uppercase bg-zinc-900 border-2 border-zinc-800 disabled:opacity-40 flex items-center justify-center gap-2">
          <Trash2 size={16} />Clear
        </button>
      </div>
    </div>
  );
}

// ===== ROLE SELECT =====
function RoleSelect({ onPick }) {
  return (
    <div className="w-full max-w-md mx-auto bg-gradient-to-br from-pink-500 via-pink-600 to-blue-600 text-white relative overflow-hidden flex flex-col" style={{height: '100dvh', WebkitTapHighlightColor: 'transparent', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)'}}>
      <div className="absolute left-0 right-0 h-3" style={{...checkeredStyle('#3b82f6', '#ffffff', 14), top: 'env(safe-area-inset-top)'}} />
      <div className="absolute left-0 right-0 h-3" style={{...checkeredStyle('#ec4899', '#ffffff', 14), bottom: 'env(safe-area-inset-bottom)'}} />
      <div className="p-6 pt-9 pb-9 flex flex-col flex-1">
        <div className="flex-1 flex flex-col justify-center">
          <div className="w-24 h-24 bg-white rounded-3xl mx-auto flex items-center justify-center mb-6 border-4 border-blue-500 shadow-2xl">
            <Bike size={48} className="text-pink-500" />
          </div>
          <h1 className="text-5xl font-black mb-3 tracking-tighter text-center" style={{textShadow: '3px 3px 0 rgba(0,0,0,0.15)'}}>RIDEOUT</h1>
          <p className="text-white text-base mb-8 font-black uppercase tracking-wider text-center">Who's riding today?</p>
          <button onClick={() => onPick('rider')}
            className="w-full bg-white text-pink-600 font-black py-5 rounded-2xl flex items-center gap-3 text-lg border-4 border-blue-500 uppercase tracking-wide shadow-xl mb-3 active:scale-95">
            <div className="w-12 h-12 rounded-xl bg-pink-500 text-white flex items-center justify-center"><Bike size={24} /></div>
            <div className="flex-1 text-left">
              <div className="text-xl">I'm a rider</div>
              <div className="text-[10px] text-pink-400 font-bold normal-case tracking-normal">Find rides, join crews, ride safer</div>
            </div>
            <ArrowRight size={22} />
          </button>
          <button onClick={() => onPick('guardian')}
            className="w-full bg-white text-amber-600 font-black py-5 rounded-2xl flex items-center gap-3 text-lg border-4 border-amber-400 uppercase tracking-wide shadow-xl active:scale-95">
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center"><ShieldCheck size={24} /></div>
            <div className="flex-1 text-left">
              <div className="text-xl">I'm a guardian</div>
              <div className="text-[10px] text-amber-500 font-bold normal-case tracking-normal">Track my rider, page them when needed</div>
            </div>
            <ArrowRight size={22} />
          </button>
        </div>
        <p className="text-center text-[10px] text-white/70 font-semibold uppercase tracking-widest">The Lewis Team</p>
      </div>
    </div>
  );
}

// ===== GUARDIAN ONBOARDING =====
function GuardianOnboarding({ profile, setProfile, onSwitchRole }) {
  const [name, setName] = useState(profile.name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const canContinue = name.trim().length > 0 && phone.trim().length > 0;
  return (
    <div className="w-full max-w-md mx-auto bg-gradient-to-br from-amber-500 via-amber-600 to-pink-600 text-white relative overflow-hidden flex flex-col" style={{height: '100dvh', WebkitTapHighlightColor: 'transparent', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)'}}>
      <div className="absolute left-0 right-0 h-3" style={{...checkeredStyle('#3b82f6', '#ffffff', 14), top: 'env(safe-area-inset-top)'}} />
      <div className="absolute left-0 right-0 h-3" style={{...checkeredStyle('#ec4899', '#ffffff', 14), bottom: 'env(safe-area-inset-bottom)'}} />
      <div className="p-6 pt-9 pb-9 flex flex-col flex-1 overflow-y-auto">
        <button onClick={onSwitchRole} className="mb-4 text-white/90 flex items-center gap-1 text-sm font-bold self-start">
          <ArrowLeft size={16} /> Not a guardian?
        </button>
        <div className="flex-1 flex flex-col justify-center">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center mb-5 border-4 border-amber-300 shadow-xl">
            <ShieldCheck size={44} className="text-amber-500" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-center mb-2">Guardian login</h1>
          <p className="text-white/90 mb-6 font-semibold text-center">Your rider will see your name & number when you page them.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-black uppercase text-white/80">Your name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mom, Dad, Aunt Jen"
                className="w-full bg-white/20 backdrop-blur rounded-xl px-4 py-3 mt-1 text-base outline-none border-4 border-white font-bold placeholder-white/60" />
            </div>
            <div>
              <label className="text-xs font-black uppercase text-white/80">Your phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" inputMode="tel"
                className="w-full bg-white/20 backdrop-blur rounded-xl px-4 py-3 mt-1 text-base outline-none border-4 border-white font-bold placeholder-white/60" />
            </div>
          </div>
        </div>
        <button
          onClick={() => setProfile({ ...profile, name: name.trim(), phone: phone.trim() })}
          disabled={!canContinue}
          className="w-full bg-white text-amber-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-lg disabled:opacity-50 border-4 border-blue-500 uppercase tracking-wide shadow-xl active:scale-95">
          Continue <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}

// ===== GUARDIAN HOME (map + pager buttons) =====
function GuardianHome({ profile, setProfile, onSwitchRole }) {
  const [showLink, setShowLink] = useState(false);
  const [lastPage, setLastPage] = useState({}); // riderCode -> timestamp
  const [positions, setPositions] = useState({}); // riderCode -> { coords, speed, at, name }
  const [selectedCode, setSelectedCode] = useState(null);
  const [switchToRider, setSwitchToRider] = useState(false);
  const linkedRiders = profile.linkedRiders || [];

  // Live positions for each linked rider.
  // Primary: Supabase realtime subscription (one channel per rider_code) +
  // initial fetchRider() to warm up the map on mount.
  // Fallback: localStorage poll (same-origin only) for offline/single-device testing.
  useEffect(() => {
    const readLocal = () => {
      setPositions((prev) => {
        const next = { ...prev };
        linkedRiders.forEach(r => {
          try {
            const raw = localStorage.getItem(`rideout_rider_${r.code}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              // Don't let stale localStorage overwrite a fresher Supabase value.
              const cur = next[r.code];
              if (!cur || (parsed.at || 0) > (cur.at || 0)) next[r.code] = parsed;
            }
          } catch (e) {}
        });
        return next;
      });
    };
    readLocal();
    const id = setInterval(readLocal, 4000);
    const handler = (e) => { if (e.key && e.key.startsWith('rideout_rider_')) readLocal(); };
    window.addEventListener('storage', handler);

    // Supabase: initial fetch + realtime row change subscription per code.
    const unsubs = [];
    if (supabaseReady) {
      linkedRiders.forEach((r) => {
        fetchRider(r.code).then((row) => {
          if (!row || row.last_lat == null || row.last_lng == null) return;
          setPositions((prev) => ({
            ...prev,
            [r.code]: {
              code: r.code,
              name: row.name || r.name,
              coords: { lat: row.last_lat, lng: row.last_lng },
              speed: row.last_speed,
              at: row.last_seen_at ? new Date(row.last_seen_at).getTime() : Date.now(),
            },
          }));
        });
        const unsub = subscribeRider(r.code, (row) => {
          if (!row || row.last_lat == null || row.last_lng == null) return;
          setPositions((prev) => ({
            ...prev,
            [r.code]: {
              code: r.code,
              name: row.name || r.name,
              coords: { lat: row.last_lat, lng: row.last_lng },
              speed: row.last_speed,
              at: row.last_seen_at ? new Date(row.last_seen_at).getTime() : Date.now(),
            },
          }));
        });
        unsubs.push(unsub);
      });
    }

    return () => {
      clearInterval(id);
      window.removeEventListener('storage', handler);
      unsubs.forEach((u) => { try { u(); } catch (e) {} });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedRiders.map(r => r.code).join(',')]);

  const linkRider = (code, name) => {
    const clean = (code || '').toUpperCase().trim();
    if (!clean) return;
    if (linkedRiders.find(r => r.code === clean)) { setShowLink(false); return; }
    setProfile({ ...profile, linkedRiders: [...linkedRiders, { code: clean, name: name.trim() || clean }] });
    setShowLink(false);
  };
  const unlink = (code) => {
    setProfile({ ...profile, linkedRiders: linkedRiders.filter(r => r.code !== code) });
    if (selectedCode === code) setSelectedCode(null);
  };
  const pageRider = (rider) => {
    sendPage(rider.code, profile.name, profile.phone, `${profile.name} is paging you. Please check in.`);
    setLastPage({ ...lastPage, [rider.code]: Date.now() });
  };

  const selected = selectedCode
    ? { rider: linkedRiders.find(r => r.code === selectedCode), pos: positions[selectedCode] }
    : null;

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-950 text-white relative overflow-hidden flex flex-col" style={{height: '100dvh', WebkitTapHighlightColor: 'transparent'}}>
      <div className="flex-none">
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-pink-500 px-4 pb-3" style={{paddingTop: 'max(env(safe-area-inset-top), 1.5rem)'}}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2" style={{textShadow: '2px 2px 0 rgba(0,0,0,0.2)'}}>
                <ShieldCheck size={22} />GUARDIAN
              </h1>
              <p className="text-xs text-white/90 mt-0.5 font-semibold tracking-wide truncate">{profile.name} · {profile.phone}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setProfile({ ...profile, role: 'rider' })}
                title="Switch to rider mode"
                className="h-9 px-3 rounded-full bg-pink-500 text-white flex items-center gap-1.5 border-2 border-white font-black text-[10px] uppercase tracking-wide active:scale-95">
                <Bike size={14} />Rider
              </button>
              <button onClick={() => setShowLink(true)} className="h-9 w-9 rounded-full bg-white/20 backdrop-blur border-2 border-white flex items-center justify-center active:scale-95" title="Link a rider">
                <UserPlus size={16} />
              </button>
            </div>
          </div>
        </div>
        <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
      </div>

      {/* MAP */}
      <GuardianMap riders={linkedRiders} positions={positions} onSelect={setSelectedCode} selectedCode={selectedCode} />

      {/* BOTTOM PANEL */}
      <div className="flex-1 overflow-y-auto p-4 bg-zinc-950">
        {linkedRiders.length === 0 ? (
          <div className="bg-zinc-900 rounded-2xl p-6 text-center border-2 border-zinc-800">
            <Users size={32} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-black uppercase">No riders linked yet</p>
            <p className="text-xs text-zinc-400 mt-1">Tap the <span className="text-amber-400 font-black">+ person</span> button above. You'll need the rider's 6-char code from their Profile → Guardians & Pager.</p>
          </div>
        ) : selected && selected.rider ? (
          <GuardianRiderCard
            rider={selected.rider}
            pos={selected.pos}
            onClose={() => setSelectedCode(null)}
            onPage={() => pageRider(selected.rider)}
            onUnlink={() => unlink(selected.rider.code)}
            paged={lastPage[selected.rider.code] && Date.now() - lastPage[selected.rider.code] < 60000}
          />
        ) : (
          <div className="space-y-2">
            <h2 className="text-xs text-zinc-400 font-black uppercase tracking-wider mb-2">Your riders · tap a pin or a row</h2>
            {linkedRiders.map(r => {
              const p = positions[r.code];
              const recently = lastPage[r.code] && Date.now() - lastPage[r.code] < 60000;
              return (
                <div key={r.code} className="bg-zinc-900 rounded-2xl border-2 border-zinc-800 overflow-hidden">
                  <button onClick={() => setSelectedCode(r.code)} className="w-full p-3 flex items-center gap-3 text-left active:bg-zinc-800">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-blue-500 border-2 border-white flex items-center justify-center">
                      <Bike size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate">{r.name}</p>
                      <p className="text-[10px] text-zinc-400 font-mono tracking-widest">{r.code} · {p ? formatAgo(p.at) : 'no location yet'}</p>
                    </div>
                    <ChevronRight size={16} className="text-zinc-600" />
                  </button>
                  <button onClick={() => pageRider(r)}
                    className={`w-full py-2.5 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 border-t-2 border-black/20 ${recently ? 'bg-green-500 text-white' : 'bg-amber-500 text-black'} active:scale-[0.98] transition`}>
                    {recently ? <><Check size={14} />Paged</> : <><BellRing size={14} />Page {r.name}</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showLink && <LinkRiderModal onClose={() => setShowLink(false)} onLink={linkRider} />}
    </div>
  );
}

// Human-readable "X ago" from a unix millisecond timestamp
function formatAgo(t) {
  if (!t) return 'never';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Speed in m/s → "x mph"
function speedMph(mps) {
  if (mps == null || isNaN(mps) || mps < 0) return '—';
  return `${(mps * 2.23694).toFixed(1)} mph`;
}

// ===== GUARDIAN MAP (Leaflet) =====
function GuardianMap({ riders, positions, onSelect, selectedCode }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerLayerRef = useRef(null);
  const [mapView, setMapView] = useState('street');

  // Initialize map once
  useEffect(() => {
    if (!window.L || !containerRef.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(containerRef.current, {
      center: [28.0222, -81.7328], zoom: 12, zoomControl: false, attributionControl: true
    });
    const tiles = MAP_TILES[mapView] || MAP_TILES.street;
    tileLayerRef.current = L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: 19 }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap tiles on toggle
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    const tiles = MAP_TILES[mapView] || MAP_TILES.street;
    tileLayerRef.current = window.L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: 19 }).addTo(mapRef.current);
  }, [mapView]);

  // Render rider pins + auto-fit bounds whenever positions change
  useEffect(() => {
    if (!mapRef.current || !window.L || !markerLayerRef.current) return;
    const L = window.L;
    markerLayerRef.current.clearLayers();
    const pts = [];
    riders.forEach(r => {
      const p = positions[r.code];
      if (!p || !p.coords) return;
      const isSelected = r.code === selectedCode;
      const ring = isSelected ? '#fef3c7' : '#ffffff';
      const body = isSelected ? '#f59e0b' : '#ec4899';
      const html = `
        <div style="position:relative;width:44px;height:44px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:${body}33;animation:pulse 2s infinite;"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:${body};border:3px solid ${ring};box-shadow:0 4px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11px;font-family:ui-monospace,monospace;">${(r.name||'?').charAt(0).toUpperCase()}</div>
        </div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [44, 44], iconAnchor: [22, 22] });
      const marker = L.marker([p.coords.lat, p.coords.lng], { icon }).addTo(markerLayerRef.current);
      marker.on('click', () => onSelect(r.code));
      pts.push([p.coords.lat, p.coords.lng]);
    });
    if (pts.length === 1) {
      mapRef.current.setView(pts[0], 14);
    } else if (pts.length > 1) {
      try { mapRef.current.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); } catch (e) {}
    }
  }, [riders, positions, selectedCode, onSelect]);

  return (
    <div className="relative h-72 flex-none border-b-2 border-amber-500/40 bg-zinc-900">
      <div ref={containerRef} className="absolute inset-0" style={{zIndex: 1}} />
      <div className="absolute top-3 left-3 bg-zinc-950/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 z-[500] border border-amber-500/60 uppercase pointer-events-none">
        <Eye size={12} className="text-amber-400" />Live tracking
      </div>
      <button onClick={() => setMapView(mapView === 'street' ? 'satellite' : 'street')}
        className="absolute top-3 right-3 bg-zinc-950/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 z-[500] border border-blue-500/40 uppercase text-white">
        <Layers size={12} />{mapView === 'street' ? 'Satellite' : 'Street'}
      </button>
    </div>
  );
}

// ===== GUARDIAN RIDER CARD (appears when a rider pin is selected) =====
function GuardianRiderCard({ rider, pos, onClose, onPage, onUnlink, paged }) {
  const hasPos = pos && pos.coords;
  return (
    <div className="bg-zinc-900 rounded-2xl border-2 border-amber-500/50 overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-blue-500 border-2 border-white flex items-center justify-center">
          <Bike size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-lg truncate">{rider.name}</p>
          <p className="text-[10px] text-zinc-400 font-mono tracking-widest">{rider.code} · {hasPos ? formatAgo(pos.at) : 'no location yet'}</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 active:scale-95" aria-label="Back">
          <X size={18} />
        </button>
      </div>
      {hasPos ? (
        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          <div className="bg-zinc-800 rounded-xl p-2.5 border border-zinc-700">
            <p className="text-[9px] text-zinc-500 font-black uppercase">Lat</p>
            <p className="text-sm font-mono font-black tabular-nums mt-0.5">{pos.coords.lat.toFixed(5)}</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-2.5 border border-zinc-700">
            <p className="text-[9px] text-zinc-500 font-black uppercase">Lng</p>
            <p className="text-sm font-mono font-black tabular-nums mt-0.5">{pos.coords.lng.toFixed(5)}</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-2.5 border border-zinc-700">
            <p className="text-[9px] text-zinc-500 font-black uppercase">Speed</p>
            <p className="text-sm font-mono font-black tabular-nums mt-0.5 text-amber-400">{speedMph(pos.speed)}</p>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <div className="bg-zinc-800 rounded-xl p-3 text-xs text-zinc-400 border border-zinc-700">
            Waiting for <span className="font-black text-white">{rider.name}</span> to open Rideout and share their location. Their pin will appear here automatically.
          </div>
        </div>
      )}
      <button onClick={onPage}
        className={`w-full py-4 font-black uppercase tracking-widest text-lg flex items-center justify-center gap-2 border-t-2 border-black/20 ${paged ? 'bg-green-500 text-white' : 'bg-amber-500 text-black'} active:scale-[0.98] transition`}>
        {paged ? <><Check size={20} />Paged · ringing their phone</> : <><BellRing size={22} />Page {rider.name}</>}
      </button>
      <button onClick={onUnlink}
        className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-t border-zinc-800 active:text-red-400">
        Unlink rider
      </button>
    </div>
  );
}

// ===== LINK RIDER MODAL (guardian) =====
function LinkRiderModal({ onClose, onLink }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="absolute inset-0 bg-black/80 z-50 flex items-end" onClick={onClose}>
      <div className="bg-zinc-950 rounded-t-3xl w-full p-5 border-t-4 border-amber-500" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-black text-xl uppercase flex items-center gap-2"><UserPlus size={18} className="text-amber-400" />Link a rider</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <p className="text-xs text-zinc-400 mb-4">Enter the 6-character rider code from your rider's Profile → Guardians & Pager screen.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Rider code</label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123" maxLength={6}
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 outline-none border-2 border-zinc-800 focus:border-amber-500 font-mono text-2xl tracking-[0.4em] text-center font-black" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-black uppercase">Rider's name (label)</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jamie"
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 mt-1 text-sm outline-none border-2 border-zinc-800 focus:border-amber-500" />
          </div>
          <button onClick={() => onLink(code, name)} disabled={code.length !== 6}
            className="w-full py-3 rounded-xl font-black uppercase bg-amber-500 text-black border-2 border-white disabled:opacity-40 mt-2 active:scale-95">
            Link rider
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== PAGER OVERLAY (rider sees this when guardian pages) =====
function PagerOverlay({ page, onDismiss }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Beep loop + vibrate
  useEffect(() => {
    let stopped = false;
    let ctx = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { /* some browsers block before a user gesture */ }

    const beep = (when, dur = 0.18) => {
      if (!ctx || stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 2400;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.25, when + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + dur + 0.02);
    };

    const roundOfBeeps = () => {
      if (!ctx || stopped) return;
      const now = ctx.currentTime;
      beep(now);
      beep(now + 0.24);
      beep(now + 0.48);
    };

    roundOfBeeps();
    const interval = setInterval(roundOfBeeps, 1800);

    let vibInt = null;
    if (navigator.vibrate) {
      navigator.vibrate([300, 120, 300, 120, 300]);
      vibInt = setInterval(() => navigator.vibrate && navigator.vibrate([300, 120, 300]), 1800);
    }

    return () => {
      stopped = true;
      clearInterval(interval);
      if (vibInt) clearInterval(vibInt);
      try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {}
      try { if (ctx) ctx.close(); } catch (e) {}
    };
  }, []);

  const timeStr = new Date(page.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const callHref = page.phone ? `tel:${page.phone.replace(/[^0-9+]/g, '')}` : null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4" style={{fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'}}>
      {/* Retro pager housing */}
      <div className="w-full max-w-sm bg-zinc-800 rounded-3xl p-5 border-4 border-zinc-700 shadow-[0_20px_60px_rgba(0,0,0,0.8)]" style={{
        backgroundImage: 'linear-gradient(180deg, #3f3f46 0%, #18181b 100%)'
      }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span></span>
            PAGER
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">RIDEOUT</span>
        </div>
        {/* LCD screen */}
        <div className="rounded-lg p-5 border-4 border-zinc-900 shadow-inner" style={{
          backgroundColor: '#9cc068',
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 3px)',
          color: '#1b2b15'
        }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">&gt; INCOMING PAGE</span>
            <span className="text-[10px] font-black tabular-nums opacity-70">{timeStr}</span>
          </div>
          <p className="text-[11px] font-black uppercase tracking-wider opacity-80">FROM:</p>
          <p className="text-2xl font-black uppercase leading-tight mb-3 break-words">{page.from}</p>
          <p className="text-[11px] font-black uppercase tracking-wider opacity-80">CALLBACK:</p>
          <p className="text-3xl font-black tabular-nums tracking-wider mb-3 break-all">{page.phone || '— — — —'}</p>
          {page.msg && (
            <>
              <p className="text-[11px] font-black uppercase tracking-wider opacity-80">MESSAGE:</p>
              <p className="text-sm font-bold leading-snug">{page.msg}</p>
            </>
          )}
          <div className="mt-4 pt-3 border-t border-black/20 flex items-center justify-between text-[10px] font-black tabular-nums opacity-70">
            <span>BEEPING · {String(Math.floor(elapsed/60)).padStart(2,'0')}:{String(elapsed%60).padStart(2,'0')}</span>
            <span className="flex items-center gap-1"><Bell size={10} />ALERT</span>
          </div>
        </div>
        {/* Buttons */}
        <div className="flex gap-2 mt-4">
          {callHref && (
            <a href={callHref}
              className="flex-1 bg-green-500 text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wide border-2 border-green-200 active:scale-95">
              <Phone size={18} />Call back
            </a>
          )}
          <button onClick={onDismiss}
            className="flex-1 bg-zinc-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wide border-2 border-zinc-600 active:scale-95">
            <X size={18} />Dismiss
          </button>
        </div>
        <p className="text-center text-[9px] text-zinc-500 mt-3 uppercase tracking-widest">Tap dismiss to silence the pager</p>
      </div>
    </div>
  );
}

// ===== QR SHARE MODAL =====
function QRShareModal({ data, onClose }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `https://${data.url}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(fullUrl)}&size=400x400&bgcolor=ffffff&color=000000&margin=10`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: data.title, text: data.subtitle, url: fullUrl }); } catch {}
    } else { copyLink(); }
  };
  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-[70] flex items-end" onClick={onClose}>
      <div className="bg-zinc-950 rounded-t-3xl w-full border-t-4 border-pink-500 max-h-[94%] overflow-y-auto"
           style={{paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)'}} onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-pink-500 to-blue-500 px-5 pt-5 pb-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <Share2 size={20} />
              <h2 className="font-black text-lg uppercase tracking-wide">Share</h2>
            </div>
            <button onClick={onClose}><X size={20} /></button>
          </div>
          <h3 className="font-black text-xl uppercase">{data.title}</h3>
          <p className="text-xs text-white/90 font-semibold mt-1">{data.subtitle}</p>
        </div>
        <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
        <div className="p-5">
          <div className="bg-white rounded-2xl p-4 mx-auto w-fit shadow-2xl border-4 border-pink-500">
            <img src={qrSrc} alt="QR code" className="w-56 h-56 block"
              onError={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.alt = 'QR'; }} />
          </div>
          <p className="text-center text-zinc-400 text-xs font-black uppercase mt-4 tracking-wider">📸 Point camera to scan</p>
          <div className="mt-4 bg-zinc-900 rounded-xl p-3 border-2 border-zinc-800 flex items-center gap-2">
            <code className="flex-1 text-xs text-pink-400 truncate font-mono">{fullUrl}</code>
            <button onClick={copyLink} className="flex items-center gap-1 text-xs font-black uppercase bg-zinc-800 px-3 py-2 rounded-lg border border-zinc-700 active:scale-95 transition min-h-[36px] flex-none">
              {copied ? <><Check size={12} className="text-green-400" />Copied</> : <><Copy size={12} />Copy</>}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={nativeShare} className="py-3 rounded-xl font-black uppercase bg-gradient-to-r from-pink-500 to-blue-500 text-white border-2 border-white flex items-center justify-center gap-2 text-sm min-h-[48px] active:scale-95 transition">
              <Share2 size={16} />Share
            </button>
            <button onClick={onClose} className="py-3 rounded-xl font-black uppercase bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center text-sm min-h-[48px]">
              Done
            </button>
          </div>
          <p className="text-center text-[10px] text-zinc-500 mt-3 font-semibold uppercase tracking-wide">
            ⚡ No app install · opens instantly in browser
          </p>
        </div>
      </div>
    </div>
  );
}
