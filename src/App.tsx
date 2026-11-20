import { useEffect, useMemo, useState } from "react";
import { supabase, configured, todayLocal, mondayOf, dateKey, shareWhatsApp, type Profile, type DailyLog } from "./lib";
import { Activity, Award, Droplets, Footprints, LogOut, Menu, Share2, ShieldCheck, Sparkles, Target, Trophy, Users, Utensils, X } from "lucide-react";

type Tab = "today" | "leaderboard" | "teams" | "weekly" | "admin";
type Rank = { user_id: string; display_name: string; total_xp: number; team_name?: string | null };
const BADGES = [
  { key: "first_checkin", name: "First Step", icon: "🌱", desc: "Complete your first daily check-in." },
  { key: "hydration_7", name: "Hydration Hero", icon: "💧", desc: "Reach your water target on 7 days." },
  { key: "protein_7", name: "Protein Pro", icon: "🥗", desc: "Reach your protein target on 7 days." },
  { key: "steps_7", name: "Step Master", icon: "👟", desc: "Reach your steps target on 7 days." },
  { key: "streak_7", name: "Consistency Spark", icon: "🔥", desc: "Check in on 7 consecutive days." }
];

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [todayLog, setTodayLog] = useState({ protein_g: 0, water_ml: 0, steps: 0 });
  const [leaderboard, setLeaderboard] = useState<Rank[]>([]);
  const [teamRanks, setTeamRanks] = useState<any[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState<"login"|"signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) { setProfile(null); setLoading(false); return; }
    loadAll();
  }, [session]);

  async function loadAll() {
    if (!supabase || !session) return;
    setLoading(true);
    const uid = session.user.id;
    const [p, l, lb, b, t, tr] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase.from("daily_logs").select("*").eq("user_id", uid).order("log_date", { ascending: false }).limit(90),
      supabase.from("leaderboard_view").select("*").order("total_xp", { ascending: false }).limit(50),
      supabase.from("member_achievements").select("achievement_key").eq("user_id", uid),
      supabase.from("teams").select("id,name"),
      supabase.from("team_leaderboard_view").select("team_id,total_xp")
    ]);
    if (p.data) setProfile(p.data as Profile);
    if (l.data) {
      setLogs(l.data as DailyLog[]);
      const today = l.data.find((x: any) => x.log_date === todayLocal());
      if (today) setTodayLog({ protein_g: today.protein_g, water_ml: today.water_ml, steps: today.steps });
    }
    if (lb.data) setLeaderboard(lb.data as Rank[]);
    if (b.data) setBadges(b.data.map((x: any) => x.achievement_key));
    if (t.data) setTeams(t.data.map((team: any) => ({ ...team, total_xp: tr.data?.find((r: any) => r.team_id === team.id)?.total_xp || 0 })));
    setLoading(false);
  }

  // async function authenticate(e: React.FormEvent) {
  //   e.preventDefault(); if (!supabase) return;
  //   setBusy(true); setNotice("");
  //   const result = authMode === "signup"
  //     ? await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
  //     : await supabase.auth.signInWithPassword({ email, password });
  //   if (result.error) setNotice(result.error.message);
  //   else if (authMode === "signup" && !result.data.session) setNotice("Check your email to confirm your account, then sign in.");
  //   else setNotice("Welcome to Wellness Compass!");
  //   setBusy(false);
  // }


  async function authenticate(e: React.FormEvent) {
  e.preventDefault();
  if (!supabase) return;

  setBusy(true);
  setNotice("");

  const result = authMode === "signup"
    ? await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      })
    : await supabase.auth.signInWithPassword({
        email,
        password
      });

  if (result.error) {
    setNotice(result.error.message);
  } else if (authMode === "signup" && !result.data.session) {
    setNotice("Check your email to confirm your account, then sign in.");
  } else {
    setNotice("Welcome to Wellness Compass!");
  }

  setBusy(false);
}

  async function saveLog(e: React.FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setNotice("");
    const { error } = await supabase.rpc("save_daily_log", {
      p_log_date: todayLocal(),
      p_protein_g: Math.max(0, Math.round(todayLog.protein_g)),
      p_water_ml: Math.max(0, Math.round(todayLog.water_ml)),
      p_steps: Math.max(0, Math.round(todayLog.steps))
    });
    if (error) setNotice(error.message);
    else { setNotice("Today's progress saved. Keep going!"); await loadAll(); }
    setBusy(false);
  }

  async function signOut() { await supabase?.auth.signOut(); setProfile(null); }
  const totalXp = leaderboard.find(x => x.user_id === session?.user?.id)?.total_xp ?? 0;
  const today = logs.find(x => x.log_date === todayLocal());
  const weekStart = dateKey(mondayOf(new Date()));
  const weekLogs = logs.filter(x => x.log_date >= weekStart);
  const weekXp = weekLogs.reduce((s,x) => s + (x.xp_earned || 0), 0);
  const weekDays = weekLogs.length;
  const streak = useMemo(() => {
    const dates = new Set(logs.map(x => x.log_date));
    let n = 0, d = new Date();
    if (!dates.has(dateKey(d))) d.setDate(d.getDate()-1);
    while (dates.has(dateKey(d))) { n++; d.setDate(d.getDate()-1); }
    return n;
  }, [logs]);
  const pct = (v: number, target: number) => Math.min(100, target > 0 ? Math.round(v / target * 100) : 0);
  const xpToNext = 500 - (totalXp % 500);

  if (!configured) return <SetupScreen />;
  if (loading) return <div className="loading"><div className="spinner"/><p>Loading your wellness journey…</p></div>;
  if (!session) return <AuthScreen {...{authMode,setAuthMode,email,setEmail,password,setPassword,displayName,setDisplayName,authenticate,busy,notice}} />;

  const nav = [
    ["today","Today's journey",Activity], ["leaderboard","Leaderboard",Trophy], ["teams","Team challenge",Users], ["weekly","Weekly report",Award],
    ...(profile?.role === "admin" ? [["admin","Admin dashboard",ShieldCheck] as any] : [])
  ] as const;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "show" : ""}`}>
      <div className="brand"><div className="brand-mark">✦</div><div><b>WELLNESS</b><span>COMPASS</span></div><button className="close-nav" onClick={()=>setMobileNav(false)}><X/></button></div>
      <div className="side-caption">YOUR COMMUNITY</div>
      {nav.map(([id,label,Icon]: any) => <button key={id} className={`nav-link ${tab===id?"active":""}`} onClick={()=>{setTab(id);setMobileNav(false)}}><Icon size={18}/>{label}</button>)}
      <div className="sidebar-bottom"><div className="avatar">{(profile?.display_name || "W").slice(0,1).toUpperCase()}</div><div className="user-meta"><b>{profile?.display_name || "Wellness member"}</b><span>{profile?.role === "admin" ? "Community admin" : "Community member"}</span></div><button className="icon-btn" title="Sign out" onClick={signOut}><LogOut size={17}/></button></div>
    </aside>
    {mobileNav && <div className="scrim" onClick={()=>setMobileNav(false)}/>}
    <main className="main">
      <header className="topbar"><button className="menu-btn" onClick={()=>setMobileNav(true)}><Menu/></button><div><span className="eyebrow">WELLNESS COMPASS COMMUNITY</span><h1>{nav.find(x=>x[0]===tab)?.[1] || "Your journey"}</h1></div><button className="share-top" onClick={()=>shareWhatsApp(`I'm tracking my wellness journey with Wellness Compass! Join me: ${window.location.origin}`)}><Share2 size={16}/> Invite</button></header>
      {notice && <div className="notice" role="status">{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
      {tab==="today" && <section className="content">
        <div className="welcome-row"><div><p className="eyebrow">YOUR DAILY CHECK-IN</p><h2>Hello, {profile?.display_name?.split(" ")[0] || "there"} 👋</h2><p className="muted">Small daily actions add up. Make today count.</p></div><div className="date-pill">{new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</div></div>
        <div className="hero-card"><div><span className="hero-tag"><Sparkles size={14}/> YOUR WELLNESS SCORE</span><h2>{totalXp.toLocaleString()} <small>XP</small></h2><p>{xpToNext} XP to your next level milestone</p><div className="level-track"><i style={{width:`${(totalXp%500)/5}%`}}/></div><span className="hero-foot">LEVEL {Math.floor(totalXp/500)+1} · {levelName(totalXp)}</span></div><div className="hero-orbit">✦</div><div className="hero-streak"><b>🔥 {streak}</b><span>day streak</span></div></div>
        <div className="section-heading"><div><h3>Today's targets</h3><p className="muted">Update your progress and save your check-in.</p></div><span className="live-dot">● TODAY</span></div>
        <form className="tracker-grid" onSubmit={saveLog}>
          <Tracker icon={<Utensils/>} title="Protein" unit="grams" value={todayLog.protein_g} target={profile?.protein_target_g || 80} color="green" 
          onChange={(v: number) => setTodayLog(x => ({ ...x, protein_g: v }))}
           progress={pct(todayLog.protein_g,profile?.protein_target_g||80)} />
          <Tracker icon={<Droplets/>} title="Water" unit="millilitres" value={todayLog.water_ml} target={profile?.water_target_ml || 2500} color="blue"
          onChange={(v: number) => setTodayLog(x => ({ ...x, water_ml: v }))}
            progress={pct(todayLog.water_ml,profile?.water_target_ml||2500)} />
          <Tracker icon={<Footprints/>} title="Steps" unit="steps" value={todayLog.steps} target={profile?.steps_target || 8000} color="orange" 
         onChange={(v: number) => setTodayLog(x => ({ ...x, steps: v }))}
          progress={pct(todayLog.steps,profile?.steps_target||8000)} />
          <div className="save-card"><div className="save-icon"><Target/></div><h3>Ready to check in?</h3><p>Save your numbers to earn points and update your community progress.</p><button className="primary-btn" disabled={busy}>{busy?"Saving…":"Save today's progress"}</button><span className="tiny-muted">Your targets can be adjusted in your profile in a future release.</span></div>
        </form>
        <div className="section-heading"><div><h3>Your achievements</h3><p className="muted">Celebrate every milestone.</p></div></div>
        <div className="badge-grid">{BADGES.map(b=><div key={b.key} className={`badge-card ${badges.includes(b.key)?"unlocked":""}`}><div>{b.icon}</div><b>{b.name}</b><span>{badges.includes(b.key)?"Unlocked":b.desc}</span></div>)}</div>
      </section>}
      {tab==="leaderboard" && <section className="content"><div className="page-intro"><p className="eyebrow">COMMUNITY MOTIVATION</p><h2>Celebrate consistency.</h2><p className="muted">Community XP leaderboard. Encourage each other and keep showing up.</p></div><div className="table-card"><div className="table-head"><b>Overall leaderboard</b><span>ALL-TIME XP</span></div>{leaderboard.map((r,i)=><div className="rank-row" key={r.user_id}><div className={`rank-num rank-${i+1}`}>{i+1}</div><div className="avatar small">{(r.display_name||"M").slice(0,1).toUpperCase()}</div><div className="rank-name"><b>{r.display_name}</b><span>{r.user_id===session.user.id?"That's you": "Wellness community"}</span></div><b className="rank-xp">{r.total_xp} XP</b></div>)}{!leaderboard.length&&<Empty text="No scores yet. Be the first to check in!"/>}</div></section>}
      {tab==="teams" && <section className="content"><div className="page-intro"><p className="eyebrow">BETTER TOGETHER</p><h2>Team challenge</h2><p className="muted">Teams grow stronger when every member participates.</p></div><div className="team-grid">{teams.map((t:any,i:number)=><div className="team-card" key={t.id}><div className="team-icon">{["🌿","🌞","🌊","🌻"][i%4]}</div><h3>{t.name}</h3><p className="muted">Community team</p><div className="team-score">{t.total_xp || 0} <span>XP</span></div><span className="tiny-muted">Team points</span></div>)}</div>{!teams.length&&<Empty text="Teams will appear here once your admin creates them."/>}</section>}
      {tab==="weekly" && <section className="content"><div className="page-intro"><p className="eyebrow">YOUR WEEK IN REVIEW</p><h2>Progress, not perfection.</h2><p className="muted">Week starting {new Date(`${weekStart}T00:00:00`).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</p></div><div className="stats-grid"><Stat label="XP earned" value={`${weekXp}`} note="This week" icon={<Sparkles/>}/><Stat label="Check-in days" value={`${weekDays}/7`} note="Days logged" icon={<Target/>}/><Stat label="Current streak" value={`${streak}`} note="Consecutive days" icon={<Activity/>}/></div><div className="table-card weekly-card"><div className="table-head"><b>Daily progress</b><span>LAST 7 DAYS</span></div>{Array.from({length:7},(_,i)=>{const d=new Date(`${weekStart}T00:00:00`);d.setDate(d.getDate()+i);const key=dateKey(d);const log=weekLogs.find(x=>x.log_date===key);return <div className="week-row" key={key}><span>{d.toLocaleDateString("en-IN",{weekday:"short",day:"numeric"})}</span><div className="week-bars"><i className={log?.protein_done?"done":""}/><i className={log?.water_done?"done":""}/><i className={log?.steps_done?"done":""}/></div><b>{log?.xp_earned||0} XP</b></div>})}<div className="legend"><span><i className="p"/> Protein</span><span><i className="w"/> Water</span><span><i className="s"/> Steps</span></div><button className="secondary-btn full" onClick={()=>shareWhatsApp(`My Wellness Compass weekly check-in 🌿\nXP earned: ${weekXp}\nDays checked in: ${weekDays}/7\nCurrent streak: ${streak} days\nJoin our community: ${window.location.origin}`)}><Share2 size={16}/> Share weekly report on WhatsApp</button></div></section>}
      {tab==="admin" && profile?.role==="admin" && <AdminPanel members={members} setMembers={setMembers} teams={teams} setTeams={setTeams} />}
    </main>
  </div>;
}

function levelName(xp:number) { const names=["Fresh Starter","Health Explorer","Daily Achiever","Wellness Champion","Wellness Legend"]; return names[Math.min(names.length-1,Math.floor(xp/500))]; }
function Tracker({icon,title,unit,value,target,color,onChange,progress}:any) {
  return <div className={`tracker-card ${color}`}><div className="tracker-top"><div className="tracker-icon">{icon}</div><span className="target-label">TARGET {target.toLocaleString()} {unit==="grams"?"g":unit==="millilitres"?"ml":""}</span></div><h3>{title}</h3><div className="tracker-input"><input type="number" min="0" max={title==="Steps"?200000:10000} value={value} onChange={e=>onChange(Number(e.target.value))}/><span>{unit}</span></div><div className="progress-track"><i style={{width:`${progress}%`}}/></div><div className="progress-meta"><span>{progress}% complete</span><b>{Math.max(0,target-value).toLocaleString()} to go</b></div></div>;
}
function Stat({label,value,note,icon}:any) { return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function Empty({text}:any) { return <div className="empty"><span>🌱</span><p>{text}</p></div>; }

function AdminPanel({members,setMembers,teams,setTeams}:any) {
  const [newTeam,setNewTeam]=useState(""); const [message,setMessage]=useState("");
  async function load() {
    if(!supabase)return;
    const [m,t,tr]=await Promise.all([supabase.from("admin_member_summary").select("*").order("total_xp",{ascending:false}),supabase.from("teams").select("*").order("name"),supabase.from("team_leaderboard_view").select("team_id,total_xp")]);
    if(m.data)setMembers(m.data); if(t.data)setTeams(t.data.map((team:any)=>({...team,total_xp:tr.data?.find((r:any)=>r.team_id===team.id)?.total_xp||0})));
  }
  useEffect(()=>{load();},[]);
  async function createTeam(e:React.FormEvent){e.preventDefault();if(!supabase||!newTeam.trim())return;const {error}=await supabase.from("teams").insert({name:newTeam.trim()});setMessage(error?error.message:"Team created.");if(!error){setNewTeam("");load();}}
  async function assignRole(id:string,role:string){if(!supabase)return;const {error}=await supabase.from("profiles").update({role}).eq("id",id);setMessage(error?error.message:"Member role updated.");load();}
  return <section className="content"><div className="page-intro"><p className="eyebrow">COMMUNITY CONTROL CENTRE</p><h2>Admin dashboard</h2><p className="muted">Monitor member activity and organize team competitions.</p></div>{message&&<div className="notice">{message}</div>}<div className="admin-grid"><div className="table-card"><div className="table-head"><b>Members</b><span>{members.length} MEMBERS</span></div>{members.map((m:any)=><div className="member-row" key={m.id}><div className="avatar small">{(m.display_name||"M").slice(0,1).toUpperCase()}</div><div className="rank-name"><b>{m.display_name}</b><span>{m.role} · {m.total_xp||0} XP</span></div>{m.role!=="admin"&&<button className="text-btn" onClick={()=>assignRole(m.id,"admin")}>Make admin</button>}</div>)}{!members.length&&<Empty text="Member summaries will load here."/>}</div><div className="table-card create-team"><div className="table-head"><b>Manage teams</b><span>{teams.length} TEAMS</span></div><form onSubmit={createTeam}><label>New team name</label><input value={newTeam} onChange={e=>setNewTeam(e.target.value)} placeholder="e.g. Sunrise Squad" required/><button className="primary-btn">Create team</button></form>{teams.map((t:any)=><div className="member-row" key={t.id}><span>🌿</span><b>{t.name}</b></div>)}</div></div><p className="admin-warning">Admin access is controlled by the database role. Only grant admin access to trusted community organizers.</p></section>;
}

function AuthScreen(props:any) {
  return <div className="auth-wrap"><div className="auth-art"><div className="brand light"><div className="brand-mark">✦</div><div><b>WELLNESS</b><span>COMPASS</span></div></div><div className="auth-message"><span className="eyebrow">YOUR COMMUNITY. YOUR JOURNEY.</span><h1>Build healthy habits.<br/>Celebrate every step.</h1><p>Track your daily actions, earn achievements and grow together with your wellness community.</p><div className="auth-points"><span>✦ Daily wellness missions</span><span>✦ Community leaderboards</span><span>✦ Progress you can celebrate</span></div></div><div className="auth-bottom">Small daily actions. Extraordinary lifestyle changes.</div></div><div className="auth-form-wrap"><form className="auth-form" onSubmit={props.authenticate}><div className="mobile-brand brand"><div className="brand-mark">✦</div><div><b>WELLNESS</b><span>COMPASS</span></div></div><span className="eyebrow">WELCOME TO THE COMMUNITY</span><h2>{props.authMode==="signup"?"Create your account":"Welcome back"}</h2><p className="muted">{props.authMode==="signup"?"Start your wellness journey today.":"Sign in to continue your journey."}</p>{props.authMode==="signup"&&<><label>Your name</label><input value={props.displayName} onChange={(e:any)=>props.setDisplayName(e.target.value)} placeholder="Enter your name" required/></>}<label>Email address</label><input type="email" value={props.email} onChange={(e:any)=>props.setEmail(e.target.value)} placeholder="you@example.com" required/><label>Password</label><input type="password" minLength={8} value={props.password} onChange={(e:any)=>props.setPassword(e.target.value)} placeholder="At least 8 characters" required/><button className="primary-btn" disabled={props.busy}>{props.busy?"Please wait…":props.authMode==="signup"?"Create account":"Sign in"}</button>{props.notice&&<div className="notice">{props.notice}</div>}<p className="switch-auth">{props.authMode==="signup"?"Already a member?":"New to Wellness Compass?"} <button type="button" onClick={()=>props.setAuthMode(props.authMode==="signup"?"login":"signup")}>{props.authMode==="signup"?"Sign in":"Create account"}</button></p><small className="terms">By joining, you agree to use the app for habit tracking and community encouragement, not medical diagnosis or treatment.</small></form></div></div>;
}
function SetupScreen(){return <div className="setup-wrap"><div className="setup-card"><div className="brand"><div className="brand-mark">✦</div><div><b>WELLNESS</b><span>COMPASS</span></div></div><h1>One small setup step.</h1><p>Add your Supabase project credentials to connect authentication, member profiles and progress tracking.</p><ol><li>Create a Supabase project.</li><li>Run <code>supabase/schema.sql</code> in the SQL Editor.</li><li>Copy <code>.env.example</code> to <code>.env</code> and add your project URL and anon key.</li><li>Restart the development server.</li></ol><p className="muted">See README.md for the complete instructions and security setup.</p></div></div>;}
export default App;
