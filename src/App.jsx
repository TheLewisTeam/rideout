import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Users, Plus, Bike, Zap, Navigation, Clock, ChevronRight, User, Home, X, Check, Search, Filter, Heart, MessageCircle, Send, UserPlus, UserCheck, Layers, Route, Trash2, ArrowRight, ArrowLeft, Sparkles, Flame, Shield, BadgeCheck, Store, Camera, AlertTriangle, Flag, Image, Rss, Phone, ShieldCheck, Crown, Star, QrCode, Share2, Copy } from 'lucide-react';

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
  const [onboarded, setOnboarded] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [profile, setProfile] = useState({
    name: 'Lancey', city: 'Winter Haven, FL', rideTypes: ['bike'],
    verified: false, level: 'moderate',
    trustedContact: null, shareLocation: false
  });
  const [activeTab, setActiveTab] = useState('discover');
  const [discoverSegment, setDiscoverSegment] = useState('rides'); // rides | calendar
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [beginnerFriendly, setBeginnerFriendly] = useState(false);
  const [joinedEvents, setJoinedEvents] = useState([1, 3]);
  const [checkedIn, setCheckedIn] = useState({});
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
    subtitle: `${profile.name}'s invite · Winter Haven crew`,
    url: `rideout.app/i/${profile.name.toLowerCase().replace(/\s/g, '')}`,
    accentColor: 'from-pink-500 to-blue-500'
  });
  const openShareCrew = (crew) => setQrShare({
    title: `Join ${crew.name}`,
    subtitle: `${crew.members} members · ${crew.city}`,
    url: `rideout.app/c/${crew.tag}`,
    accentColor: crew.color.replace('bg-', 'from-') + ' to-blue-500'
  });
  const openShareEvent = (event) => setQrShare({
    title: 'Share this ride',
    subtitle: `${event.title} · ${event.location}`,
    url: `rideout.app/r/${event.id}`,
    accentColor: 'from-pink-500 to-blue-500'
  });

  const [friends, setFriends] = useState([
    { id: 2, name: 'Marcus T.', city: 'Winter Haven, FL', rideType: 'bike', isFriend: true, avatar: 'bg-blue-500', verified: true },
    { id: 3, name: 'Jayla R.', city: 'Lakeland, FL', rideType: 'skates', isFriend: true, avatar: 'bg-pink-500', verified: true },
    { id: 4, name: 'Devon K.', city: 'Winter Haven, FL', rideType: 'scooter', isFriend: false, avatar: 'bg-cyan-400', verified: false },
    { id: 5, name: 'Amara S.', city: 'Auburndale, FL', rideType: 'bike', isFriend: false, avatar: 'bg-purple-500', verified: true },
    { id: 6, name: 'Riley P.', city: 'Haines City, FL', rideType: 'other', isFriend: true, avatar: 'bg-fuchsia-500', verified: false },
    { id: 7, name: 'Tasha B.', city: 'Winter Haven, FL', rideType: 'ebike', isFriend: false, avatar: 'bg-pink-600', verified: true },
    { id: 8, name: 'Malik F.', city: 'Lake Wales, FL', rideType: 'escooter', isFriend: false, avatar: 'bg-sky-500', verified: false }
  ]);

  const [crews, setCrews] = useState([
    {
      id: 1, name: 'Winter Haven Ride Out Club', tag: 'WHRC', city: 'Winter Haven, FL',
      rideType: 'bike', members: 127, color: 'bg-pink-500', isJoined: true, verified: true,
      description: 'The OG ride-out crew in Polk County. Weekly rides, deep roster, all love. 🚴‍♂️',
      founded: '2021'
    },
    {
      id: 2, name: 'Chain of Lakes Cruisers', tag: 'COLC', city: 'Winter Haven, FL',
      rideType: 'bike', members: 54, color: 'bg-blue-500', isJoined: false, verified: true,
      description: 'Casual weekend cruisers. Family-friendly. Lake loops and brunch rides.',
      founded: '2022'
    },
    {
      id: 3, name: 'Polk County E-Squad', tag: 'PCES', city: 'Lakeland, FL',
      rideType: 'ebike', members: 38, color: 'bg-amber-400', isJoined: false, verified: false,
      description: 'Electric everything. Long-range loops that gas bikes can\'t touch.',
      founded: '2023'
    },
    {
      id: 4, name: 'Lake Wales Skate Collective', tag: 'LWSC', city: 'Lake Wales, FL',
      rideType: 'skates', members: 22, color: 'bg-pink-400', isJoined: false, verified: false,
      description: 'Roller skate meetups. Beginners welcome. Monthly jams at the park.',
      founded: '2024'
    },
    {
      id: 5, name: 'Ladies Who Ride FL', tag: 'LWR', city: 'Winter Haven, FL',
      rideType: 'bike', members: 89, color: 'bg-fuchsia-500', isJoined: true, verified: true,
      description: 'Women-led, women-first rides across Central Florida. All levels, all welcome.',
      founded: '2022'
    }
  ]);

  const [shops, setShops] = useState([
    { id: 1, name: 'Winter Haven Cycles', type: 'Bike shop', address: '3rd St SW', hours: 'Mon–Sat 10–7', specialties: ['BMX', 'Cruisers', 'Repairs'], sponsored: true, color: 'bg-pink-500' },
    { id: 2, name: 'Circuit E-Bikes', type: 'E-bike specialist', address: 'Cypress Gardens Blvd', hours: 'Tue–Sun 11–6', specialties: ['E-Bike sales', 'Battery service'], sponsored: true, color: 'bg-amber-400' },
    { id: 3, name: 'Lakeside Board Co.', type: 'Skate/Board', address: '1st St N', hours: 'Daily 11–8', specialties: ['Longboards', 'Roller skates'], sponsored: false, color: 'bg-blue-500' },
    { id: 4, name: 'Chain Gang Bike Shop', type: 'Bike shop', address: 'Ave A SW', hours: 'Wed–Sun 10–6', specialties: ['Fixies', 'Road bikes', 'Repairs'], sponsored: false, color: 'bg-fuchsia-500' }
  ]);

  const [events, setEvents] = useState([
    {
      id: 1, title: 'Chain of Lakes Sunset Cruise', type: 'bike', host: 'Marcus T.', hostId: 2, hostVerified: true,
      date: '2026-04-22', time: '18:30', location: 'Lake Silver Trailhead',
      coords: { x: 35, y: 45 }, attendees: 12, distance: '8 mi', pace: 'Chill',
      level: 'beginner', beginnerFriendly: true, crewId: 1,
      description: 'Easy cruise around the Chain of Lakes. All skill levels welcome. Big Rippers and cruisers posting up at the end for tacos!',
      route: [{x:35,y:45},{x:42,y:38},{x:55,y:40},{x:62,y:50},{x:58,y:62}],
      comments: [
        { id: 1, user: 'Sarah M.', avatar: 'bg-pink-500', text: 'So hyped for this one!', time: '2h ago' },
        { id: 2, user: 'Marcus T.', avatar: 'bg-blue-500', text: 'Weather looking perfect 🌅', time: '1h ago' }
      ]
    },
    {
      id: 2, title: 'Skate Jam Downtown WH', type: 'skates', host: 'Jayla R.', hostId: 3, hostVerified: true,
      date: '2026-04-23', time: '19:00', location: 'Central Park Fountain',
      coords: { x: 60, y: 30 }, attendees: 8, distance: '5 mi', pace: 'Moderate',
      level: 'moderate', beginnerFriendly: false, crewId: null,
      description: 'Weekly skate meetup. Bring lights! Rolling through downtown Winter Haven and the lakefront.',
      route: [{x:60,y:30},{x:65,y:40},{x:70,y:45},{x:68,y:55}],
      comments: [{ id: 1, user: 'Jayla R.', avatar: 'bg-pink-500', text: "Don't forget helmets 🛼", time: '3h ago' }]
    },
    {
      id: 3, title: 'Scooter Squad Morning Run', type: 'scooter', host: 'Devon K.', hostId: 4, hostVerified: false,
      date: '2026-04-24', time: '08:00', location: 'Sweet Magnolia Coffee',
      coords: { x: 45, y: 60 }, attendees: 5, distance: '12 mi', pace: 'Fast',
      level: 'experienced', beginnerFriendly: false, crewId: null,
      description: 'Early bird scooter session. Coffee first, then hitting the Fort Fraser Trail.',
      route: [{x:45,y:60},{x:38,y:55},{x:30,y:45},{x:25,y:35}],
      comments: []
    },
    {
      id: 4, title: 'Bok Tower Longboard Tour', type: 'other', host: 'Riley P.', hostId: 6, hostVerified: false,
      date: '2026-04-25', time: '16:00', location: 'Bok Tower Gardens',
      coords: { x: 75, y: 55 }, attendees: 6, distance: '6 mi', pace: 'Moderate',
      level: 'moderate', beginnerFriendly: false, crewId: null,
      description: 'Scenic ride through Lake Wales. Helmets required!',
      route: [{x:75,y:55},{x:70,y:48},{x:65,y:42}],
      comments: [
        { id: 1, user: 'Riley P.', avatar: 'bg-fuchsia-500', text: 'Bringing a speaker for tunes 🎶', time: '5h ago' },
        { id: 2, user: 'Kim A.', avatar: 'bg-blue-400', text: 'First longboard ride, nervous lol', time: '4h ago' },
        { id: 3, user: 'Riley P.', avatar: 'bg-fuchsia-500', text: '@Kim you got this! we\'ll go easy', time: '3h ago' }
      ]
    },
    {
      id: 5, title: 'Ladies Brunch Ride', type: 'bike', host: 'Amara S.', hostId: 5, hostVerified: true,
      date: '2026-04-26', time: '10:00', location: 'MLK Park Pavilion',
      coords: { x: 25, y: 70 }, attendees: 18, distance: '15 mi', pace: 'Chill',
      level: 'beginner', beginnerFriendly: true, crewId: 5,
      description: 'Women-led ride ending at the Winter Haven farmers market. All levels, all welcome!',
      route: [{x:25,y:70},{x:35,y:65},{x:45,y:60},{x:55,y:55}],
      comments: []
    },
    {
      id: 6, title: 'E-Bike Lakefront Blitz', type: 'ebike', host: 'Tasha B.', hostId: 7, hostVerified: true,
      date: '2026-04-23', time: '17:30', location: 'Lake Howard Park',
      coords: { x: 55, y: 75 }, attendees: 14, distance: '20+ mi', pace: 'Fast',
      level: 'experienced', beginnerFriendly: false, crewId: 3,
      description: 'Long-range e-bike ride around the full Chain of Lakes loop. Fully charged batteries required ⚡',
      route: [{x:55,y:75},{x:48,y:68},{x:42,y:58},{x:50,y:48},{x:62,y:52},{x:68,y:65}],
      comments: [{ id: 1, user: 'Tasha B.', avatar: 'bg-pink-600', text: 'Charge up fam ⚡⚡', time: '1h ago' }]
    },
    {
      id: 7, title: 'E-Scoot Downtown Takeover', type: 'escooter', host: 'Malik F.', hostId: 8, hostVerified: false,
      date: '2026-04-24', time: '20:00', location: '3rd Street SW Plaza',
      coords: { x: 68, y: 38 }, attendees: 9, distance: '8 mi', pace: 'Moderate',
      level: 'moderate', beginnerFriendly: false, crewId: null,
      description: 'Night ride through downtown on e-scooters. LED lights encouraged. Food truck stop after 🛴⚡',
      route: [{x:68,y:38},{x:62,y:42},{x:55,y:48},{x:60,y:55}],
      comments: []
    }
  ]);

  // Post-ride feed
  const [feedPosts, setFeedPosts] = useState([
    {
      id: 1, eventTitle: 'Chain of Lakes Sunset Cruise', rideType: 'bike',
      host: 'Marcus T.', hostAvatar: 'bg-blue-500', hostVerified: true,
      time: '3h ago', distance: '8.2 mi', duration: '1h 12m', riderCount: 14,
      caption: 'Perfect night out. 14 deep rolling through Cypress Gardens. Next week we doing it again 🔥',
      imageGradient: 'from-pink-500 via-orange-400 to-yellow-300', // "sunset"
      likes: 42, liked: false,
      comments: [
        { user: 'Jayla R.', text: 'Wish I caught this one!' },
        { user: 'Amara S.', text: 'Crew looked clean 🔥' }
      ],
      shoutouts: ['Devon K.', 'Sarah M.', 'Marcus T.']
    },
    {
      id: 2, eventTitle: 'Ladies Brunch Ride', rideType: 'bike',
      host: 'Amara S.', hostAvatar: 'bg-purple-500', hostVerified: true,
      time: '1d ago', distance: '15.6 mi', duration: '2h 04m', riderCount: 18,
      caption: 'Biggest Ladies ride yet! Welcoming 4 new riders — y\'all crushed it 💪 Farmers market never disappoints 🥐',
      imageGradient: 'from-fuchsia-500 via-pink-500 to-orange-400',
      likes: 89, liked: true,
      comments: [
        { user: 'Lancey', text: 'This is amazing!' },
        { user: 'Riley P.', text: 'Legends ✨' },
        { user: 'Tasha B.', text: 'Coming next month fr' }
      ],
      shoutouts: ['Amara S.', '+17 others']
    },
    {
      id: 3, eventTitle: 'Bok Tower Longboard Tour', rideType: 'other',
      host: 'Riley P.', hostAvatar: 'bg-fuchsia-500', hostVerified: false,
      time: '2d ago', distance: '6.1 mi', duration: '48m', riderCount: 7,
      caption: 'Kim\'s first longboard ride — smooth like butter 🛹 Bok Tower hits different on a board.',
      imageGradient: 'from-green-500 via-emerald-400 to-teal-400',
      likes: 31, liked: false,
      comments: [{ user: 'Kim A.', text: 'Thank you crew, I\'m hooked 🥹' }],
      shoutouts: ['Kim A.', 'Riley P.']
    }
  ]);

  const rideIcons = { bike: Bike, ebike: Bike, skates: Zap, scooter: Navigation, escooter: Navigation, other: Bike };
  const rideColors = { bike: 'bg-pink-500', ebike: 'bg-amber-400', skates: 'bg-blue-500', scooter: 'bg-cyan-400', escooter: 'bg-lime-400', other: 'bg-fuchsia-500' };
  const rideLabels = { bike: 'Bike', ebike: 'E-Bike', skates: 'Skates', scooter: 'Scooter', escooter: 'E-Scoot', other: 'Other' };
  const electricTypes = ['ebike', 'escooter'];

  let filteredEvents = events;
  if (filterType !== 'all') filteredEvents = filteredEvents.filter(e => e.type === filterType);
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
    const today = new Date('2026-04-22');
    const diff = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (!onboarded) {
    return <Onboarding profile={profile} setProfile={setProfile} step={onboardStep} setStep={setOnboardStep} onComplete={() => setOnboarded(true)} />;
  }

  const chatEvent = chatEventId ? events.find(e => e.id === chatEventId) : null;
  const activeRideToday = events.find(e => e.date === '2026-04-22' && joinedEvents.includes(e.id));

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
              <button onClick={openShareApp} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white">
                <QrCode size={18} />
              </button>
              <button onClick={() => setShowFriends(true)} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white">
                <Users size={18} />
              </button>
              <button onClick={() => setActiveTab('profile')} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white">
                <User size={18} />
              </button>
            </div>
          </div>
        </div>
        <CheckeredStrip color1="#3b82f6" color2="#ffffff" />
      </div>

      {qrShare && <QRShareModal data={qrShare} onClose={() => setQrShare(null)} />}

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
            events={events} crews={crews}
            rideIcons={rideIcons} rideColors={rideColors} rideLabels={rideLabels}
            formatDate={formatDate} onEventClick={setSelectedEvent}
            onOpenFriends={() => setShowFriends(true)}
            onOpenTrustedContact={() => setShowTrustedContact(true)}
            onOpenSOS={() => setShowSOS(true)}
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
      {showCreateCrew && (
        <CreateCrewModal
          onClose={() => setShowCreateCrew(false)}
          onCreate={(c) => { setCrews([...crews, {...c, id: crews.length + 1, isJoined: true, members: 1, verified: false, founded: '2026'}]); setShowCreateCrew(false); }}
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
      <MapView mapView={mapView} setMapView={setMapView} events={events} rideIcons={rideIcons} rideColors={rideColors} onEventClick={onEventClick} showRoutes={true} location={profile.city} />

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

          {/* Local shops teaser */}
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

function CreateCrewModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', tag: '', city: 'Winter Haven, FL', rideType: 'bike', description: '', color: 'bg-pink-500' });
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
function ProfileScreen({ profile, setProfile, joinedEvents, friendIds, joinedCrewIds, events, crews, rideIcons, rideColors, rideLabels, formatDate, onEventClick, onOpenFriends, onOpenTrustedContact, onOpenSOS, setActiveTab, setSelectedCrew }) {
  return (
    <div className="p-4">
      <div className="relative rounded-2xl overflow-hidden border-2 border-white/10">
        <div className="bg-gradient-to-br from-pink-500 via-pink-600 to-blue-500 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white mx-auto flex items-center justify-center relative">
            <User size={36} />
            {profile.verified && <div className="absolute -bottom-1 -right-1 bg-blue-400 rounded-full p-0.5 border-2 border-white"><BadgeCheck size={14} fill="white" className="text-blue-400" /></div>}
          </div>
          <h2 className="text-xl font-black mt-3 uppercase flex items-center gap-1 justify-center">{profile.name}</h2>
          <p className="text-sm text-white/90 font-semibold">{profile.city}</p>
          <div className="flex justify-center gap-2 mt-3 flex-wrap">
            {profile.rideTypes.map(t => (
              <span key={t} className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-black border border-white/30">
                {rideLabels[t]}
              </span>
            ))}
          </div>
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
          <p className="text-2xl font-black text-white">186</p>
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
  const isToday = event.date === '2026-04-22';
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
            <div>
              <h2 className="text-4xl font-black mb-2 uppercase tracking-tight">Where<br />do you ride?</h2>
              <p className="text-white/90 mb-6 font-semibold">We'll show you rides in your area.</p>
              <input value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})} placeholder="City, State"
                className="w-full bg-white/20 backdrop-blur rounded-2xl px-5 py-4 text-lg outline-none border-4 border-white font-bold placeholder-white/60" />
              <p className="text-white/80 text-xs mt-3 font-semibold">🧭 STARTING YOU IN WINTER HAVEN, FL</p>
            </div>
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
              <h2 className="text-3xl font-black mb-3 uppercase">Let's ride, {profile.name}!</h2>
              <p className="text-white/90 text-lg mb-2 font-semibold">We found 7 rideouts and 5 crews near</p>
              <p className="text-white font-black text-xl mb-6 uppercase">{profile.city}</p>
              <p className="text-white/80 text-sm font-semibold">Add a trusted contact in Profile for safer rides.</p>
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

function Feature({ icon, text }) {
  return (
    <div className="flex items-center gap-3 bg-white/20 backdrop-blur rounded-xl px-4 py-3 border-2 border-white/40">
      <span className="text-2xl">{icon}</span>
      <span className="font-black uppercase text-sm tracking-wide">{text}</span>
    </div>
  );
}

function MapBackground({ mapView }) {
  if (mapView === 'satellite') {
    return (
      <>
        <div className="absolute inset-0" style={{backgroundImage: `radial-gradient(circle at 20% 30%, rgba(74,124,89,0.6) 0%, transparent 30%), radial-gradient(circle at 70% 20%, rgba(45,85,55,0.7) 0%, transparent 35%), radial-gradient(circle at 40% 70%, rgba(90,135,100,0.5) 0%, transparent 40%), radial-gradient(circle at 85% 65%, rgba(55,95,70,0.8) 0%, transparent 30%), radial-gradient(circle at 15% 85%, rgba(30,75,45,0.7) 0%, transparent 35%)`}} />
        <div className="absolute w-20 h-14 bg-blue-900/60 rounded-full blur-sm" style={{top: '35%', left: '40%'}} />
        <div className="absolute w-16 h-12 bg-blue-900/60 rounded-full blur-sm" style={{top: '55%', left: '25%'}} />
        <div className="absolute w-14 h-10 bg-blue-900/60 rounded-full blur-sm" style={{top: '25%', left: '65%'}} />
        <div className="absolute w-12 h-16 bg-blue-900/60 rounded-full blur-sm" style={{top: '60%', left: '65%'}} />
        <svg className="absolute inset-0 w-full h-full opacity-40">
          <line x1="0" y1="50%" x2="100%" y2="45%" stroke="rgba(200,180,130,0.6)" strokeWidth="2" />
          <line x1="50%" y1="0" x2="45%" y2="100%" stroke="rgba(200,180,130,0.6)" strokeWidth="2" />
          <line x1="0" y1="20%" x2="100%" y2="25%" stroke="rgba(200,180,130,0.4)" strokeWidth="1.5" />
          <line x1="30%" y1="0" x2="35%" y2="100%" stroke="rgba(200,180,130,0.4)" strokeWidth="1.5" />
        </svg>
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

function MapView({ mapView, setMapView, events, rideIcons, rideColors, onEventClick, showRoutes, location }) {
  return (
    <div className={`relative h-56 overflow-hidden border-b-2 border-pink-500/30 ${mapView === 'satellite' ? 'bg-gradient-to-br from-green-900 via-emerald-800 to-green-900' : 'bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-800'}`}>
      <MapBackground mapView={mapView} />
      {showRoutes && (
        <svg className="absolute inset-0 w-full h-full" style={{zIndex: 1}} viewBox="0 0 100 100" preserveAspectRatio="none">
          {events.map(event => event.route && event.route.length > 1 && (
            <polyline key={event.id} points={event.route.map(p => `${p.x},${p.y}`).join(' ')} fill="none"
              stroke={event.type === 'bike' ? 'rgba(236,72,153,0.7)' : event.type === 'ebike' ? 'rgba(251,191,36,0.7)' : event.type === 'skates' ? 'rgba(59,130,246,0.7)' : event.type === 'scooter' ? 'rgba(34,211,238,0.7)' : event.type === 'escooter' ? 'rgba(163,230,53,0.7)' : 'rgba(217,70,239,0.7)'}
              strokeWidth="0.8" strokeDasharray="1.5,1" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      )}
      {events.map(event => {
        const Icon = rideIcons[event.type];
        return (
          <button key={event.id} onClick={() => onEventClick(event)} className="absolute transform -translate-x-1/2 -translate-y-1/2" style={{left: `${event.coords.x}%`, top: `${event.coords.y}%`, zIndex: 10}}>
            <div className={`${rideColors[event.type]} w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse`}>
              <Icon size={18} className="text-white" />
            </div>
          </button>
        );
      })}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{zIndex: 5}}>
        <div className="relative">
          <div className="absolute inset-0 w-16 h-16 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full bg-blue-500/20 animate-ping" />
          <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
        </div>
      </div>
      <div className="absolute top-3 left-3 bg-zinc-950/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 z-20 border border-pink-500/40 uppercase">
        <MapPin size={12} className="text-pink-500" />{location}
      </div>
      <button onClick={() => setMapView(mapView === 'street' ? 'satellite' : 'street')} className="absolute top-3 right-3 bg-zinc-950/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 z-20 border border-blue-500/40 uppercase">
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
      </div>
    </div>
  );
}

// ===== CREATE EVENT =====
function CreateEventModal({ profileName, crews, onClose, onCreate, showRouteBuilder, setShowRouteBuilder, mapView }) {
  const [form, setForm] = useState({
    title: '', type: 'bike', date: '2026-04-23', time: '18:00', location: '',
    distance: '5 mi', pace: 'Chill', description: '', host: profileName,
    attendees: 1, route: [], level: 'moderate', beginnerFriendly: false, crewId: null
  });
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
            <label className="text-xs text-zinc-400 font-black uppercase">Ride type</label>
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
                return (
                  <button key={t.id} onClick={() => setForm({...form, type: t.id})}
                    className={`py-3 rounded-xl flex flex-col items-center gap-1 transition border-2 relative ${form.type === t.id ? 'bg-gradient-to-br from-pink-500 to-blue-500 border-white' : 'bg-zinc-900 border-zinc-800'}`}>
                    {t.electric && <div className="absolute top-1 right-1 bg-yellow-300 rounded-full p-0.5 border border-zinc-950"><Zap size={8} fill="currentColor" className="text-yellow-900" /></div>}
                    <Icon size={18} />
                    <span className="text-[10px] font-black uppercase">{t.label}</span>
                  </button>
                );
              })}
            </div>
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
