import { createContext, FormEvent, ReactNode, useContext, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import Studio from "./studio/Studio";
import {
  completeOnboarding, describeError, resendVerification, resetPassword, saveOnboardingStep, setRole, signInWithEmail,
  saveProfileFields, signInWithGoogle, signOutUser, signUpWithEmail, updateDisplayName, useSession, type FormValues, type Profile, type Role,
} from "./session";
import { OPTIONS, ROLE_FIELDS, toLink, type FieldSection } from "./profileFields";

interface Account { user: User; profile: Profile }
const AccountContext = createContext<Account | null>(null);
const useAccount = () => {
  const a = useContext(AccountContext);
  if (!a) throw new Error("useAccount outside a signed-in screen");
  return a;
};

const firstName = (p: Profile) => (p.name || "there").split(" ")[0];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "K";
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const workspaceLabel = (p: Profile, role: Role) => (role === "client" ? (p.client?.brand as string) || "Client workspace" : (p.creator?.displayName as string) || "Creator workspace");

function Avatar({ profile, role }: { profile: Profile; role: Role }) {
  return profile.photoURL
    ? <img className="user-avatar photo" src={profile.photoURL} alt="" referrerPolicy="no-referrer" />
    : <div className={`user-avatar ${role}`}>{initials(profile.name)}</div>;
}
type ClientPage = "home" | "creators" | "projects" | "messages" | "profile";
type CreatorPage = "home" | "opportunities" | "messages" | "studio" | "profile";

const photos = [
  "https://images.unsplash.com/photo-1787647561687-fd0b69654aea?auto=format&fit=crop&w=500&q=85",
  "https://images.unsplash.com/photo-1544168190-79c17527004f?auto=format&fit=crop&w=500&q=85",
  "https://images.unsplash.com/photo-1648662199460-34b7597ba771?auto=format&fit=crop&w=500&q=85",
  "https://images.unsplash.com/photo-1753164597539-af93605a9178?auto=format&fit=crop&w=500&q=85",
];

const creators = [
  { name: "Maya Chen", role: "UGC Director", match: 98, rate: "$1.8k", tags: ["Beauty", "Short-form", "Gen Z"], photo: photos[0], tone: "mint" },
  { name: "Theo Brooks", role: "Product Filmmaker", match: 95, rate: "$2.4k", tags: ["Tech", "Motion", "YouTube"], photo: photos[1], tone: "lilac" },
  { name: "Sofia Marin", role: "Lifestyle Creator", match: 93, rate: "$1.6k", tags: ["Wellness", "TikTok", "UGC"], photo: photos[2], tone: "peach" },
  { name: "Noa Williams", role: "Social Storyteller", match: 89, rate: "$1.4k", tags: ["Fashion", "Reels", "Strategy"], photo: photos[3], tone: "blue" },
];

const iconPaths: Record<string, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  brief: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
  chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
  spark: <><path d="m12 3-1.4 4.1a5 5 0 0 1-3.1 3.1L3 12l4.5 1.8a5 5 0 0 1 3.1 3.1L12 21l1.4-4.1a5 5 0 0 1 3.1-3.1L21 12l-4.5-1.8a5 5 0 0 1-3.1-3.1Z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  video: <><rect x="3" y="5" width="14" height="14" rx="2" /><path d="m17 10 4-2v8l-4-2" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  filter: <><path d="M4 5h16M7 12h10M10 19h4" /></>,
  star: <path d="m12 2 3 6 7 .9-5 4.8 1.3 6.8L12 17l-6.3 3.5L7 13.7 2 9l7-.9Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 3h7v18h-7" /></>,
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><img src="/kreota-logo.png" alt="Kreota logo" /><span className={compact ? "sr-only" : ""}>Kreota</span></div>;
}

function Button({ children, kind = "dark", icon, onClick, type = "button", className = "" }: { children: ReactNode; kind?: "dark" | "light" | "ghost" | "accent"; icon?: string; onClick?: () => void; type?: "button" | "submit"; className?: string }) {
  return <button type={type} className={`button ${kind} ${className}`} onClick={onClick}>{children}{icon && <Icon name={icon} size={16} />}</button>;
}

const GoogleMark = () => <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5L15.4 17c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.2a10 10 0 0 0 0 9.1L6.5 14Z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.2 7.5l3.3 2.6A5.8 5.8 0 0 1 12 6Z"/></svg>;

function Auth() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"" | "google" | "email" | "reset">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [touched, setTouched] = useState(false);

  const signup = mode === "signup";
  const invalid = {
    name: signup && !name.trim() ? "Enter your name." : "",
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter a valid email address." : "",
    password: signup && password.length < 8 ? "Use at least 8 characters." : !password ? "Enter your password." : "",
  };

  const run = async (kind: "google" | "email" | "reset", action: () => Promise<void>) => {
    setBusy(kind); setError(""); setNotice("");
    try { await action(); } catch (e) { setError(describeError(e)); } finally { setBusy(""); }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid.name || invalid.email || invalid.password) return;
    run("email", () => (signup ? signUpWithEmail(name.trim(), email.trim(), password) : signInWithEmail(email.trim(), password)));
  };

  const forgot = () => {
    if (invalid.email) { setTouched(true); setError("Enter your email above, then choose “Forgot password”."); return; }
    run("reset", async () => { await resetPassword(email.trim()); setNotice(`If an account exists for ${email.trim()}, a reset link is on its way.`); });
  };

  const switchMode = () => { setMode(signup ? "login" : "signup"); setError(""); setNotice(""); setTouched(false); };

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="story-glow glow-one" /><div className="story-glow glow-two" />
        <Logo />
        <div className="story-content">
          <div className="eyebrow light"><span /> THE CREATIVE OPERATING SYSTEM</div>
          <h1>From brief to<br /><em>brilliant.</em></h1>
          <p>Build standout content with AI intelligence and the world’s most relevant creators.</p>
          <div className="story-proof">
            <div className="avatar-stack">{photos.slice(0, 3).map((p) => <img src={p} key={p} alt="" />)}<b>+2k</b></div>
            <span>Trusted by ambitious creative teams</span>
          </div>
        </div>
        <div className="story-foot">Creative momentum, engineered.</div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-logo"><Logo /></div>
          <div className="auth-topline">{signup ? "ALREADY ON KREOTA?" : "NEW TO KREOTA?"} <button onClick={switchMode}>{signup ? "Sign in" : "Create account"}</button></div>
          <div className="auth-heading">
            <div className="mini-mark"><Icon name="spark" /></div>
            <h2>{signup ? "Create your account" : "Welcome back"}</h2>
            <p>{signup ? "Start creating work people remember." : "Continue where your best work left off."}</p>
          </div>
          {error && <div className="auth-alert error" role="alert">{error}</div>}
          {notice && <div className="auth-alert" role="status">{notice}</div>}
          <button type="button" className="button light google" onClick={() => run("google", signInWithGoogle)} disabled={!!busy}>
            <GoogleMark />
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>
          <div className="divider"><span>or continue with email</span></div>
          <form onSubmit={submit} noValidate>
            {signup && (
              <label>Full name
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Alex Morgan" aria-invalid={touched && !!invalid.name} />
                {touched && invalid.name && <small className="field-error">{invalid.name}</small>}
              </label>
            )}
            <label>Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="alex@company.com" aria-invalid={touched && !!invalid.email} />
              {touched && invalid.email && <small className="field-error">{invalid.email}</small>}
            </label>
            <label>Password
              <div className="password">
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : "Your password"} aria-invalid={touched && !!invalid.password} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
              </div>
              {touched && invalid.password && <small className="field-error">{invalid.password}</small>}
            </label>
            {!signup && <button type="button" className="forgot-link" onClick={forgot} disabled={!!busy}>{busy === "reset" ? "Sending…" : "Forgot password?"}</button>}
            <button type="submit" className="button dark full" disabled={!!busy}>
              {busy === "email" ? (signup ? "Creating account…" : "Signing in…") : signup ? "Create account" : "Sign in"}
              {!busy && <Icon name="arrow" size={16} />}
            </button>
          </form>
          <p className="terms">By continuing, you agree to Kreota’s <u>Terms</u> and <u>Privacy Policy</u>. You’ll stay signed in on this device until you sign out.</p>
        </div>
      </section>
    </main>
  );
}

function RoleSelect({ onSelect }: { onSelect: (r: Role) => void }) {
  const { user } = useAccount();
  return (
    <main className="setup-shell">
      <header><Logo /><div className="setup-step">STEP 1 OF 2</div><SignedInAs email={user.email} /></header>
      <section className="role-wrap">
        <div className="eyebrow"><span /> PERSONALIZE YOUR EXPERIENCE</div>
        <h1>How will you use Kreota?</h1>
        <p>Choose your workspace. You can always switch later.</p>
        <div className="role-grid">
          <button className="role-card client" onClick={() => onSelect("client")}>
            <div className="role-visual"><div className="float-card a"><Icon name="spark" /><span>AI brief ready</span></div><div className="float-card b"><Icon name="users" /><span>12 matches</span></div></div>
            <div className="role-copy"><div className="role-icon"><Icon name="brief" /></div><div><h3>I’m a client</h3><p>Plan campaigns, discover creators and manage content from one place.</p><span className="role-link">Build with creators <Icon name="arrow" size={15} /></span></div></div>
          </button>
          <button className="role-card creator" onClick={() => onSelect("creator")}>
            <div className="role-visual"><div className="video-frame"><Icon name="play" size={25} /></div><div className="float-card c"><span>New invite</span><b>$2,400</b></div></div>
            <div className="role-copy"><div className="role-icon"><Icon name="video" /></div><div><h3>I’m a creator</h3><p>Find aligned projects, create with AI and grow your creative business.</p><span className="role-link">Create your profile <Icon name="arrow" size={15} /></span></div></div>
          </button>
        </div>
        <div className="secure-line"><Icon name="check" size={14} /> Identity-protected, secure collaboration</div>
      </section>
    </main>
  );
}

function SignedInAs({ email }: { email: string | null }) {
  return <div className="signed-in-as"><span>{email}</span><button onClick={() => signOutUser()}>Sign out</button></div>;
}

function Onboarding({ role }: { role: Role }) {
  const { user, profile } = useAccount();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const creator = role === "creator";
  const other: Role = creator ? "client" : "creator";
  const saved = profile[role] ?? {};
  const v = (key: string, fallback = "") => (typeof saved[key] === "string" ? (saved[key] as string) : fallback);

  const next = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const values: FormValues = {};
    new FormData(form).forEach((val, key) => { values[key] = typeof val === "string" ? val.trim() : ""; });
    form.querySelectorAll<HTMLInputElement>("input[type=checkbox][name]").forEach((c) => { values[c.name] = c.checked; });
    setSaving(true);
    setError("");
    try {
      if (step < 3) { await saveOnboardingStep(user.uid, role, values); setStep(step + 1); }
      else await completeOnboarding(user.uid, role, values);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };
  const titles = creator ? ["Build your creator profile", "Show us your craft", "Verify your identity"] : ["Tell us about your brand", "Shape your creative needs", "Verify your business"];
  return (
    <main className="onboard-shell">
      <header>
        <Logo />
        <div className="step-dots">{[1,2,3].map(n => <span key={n} className={n <= step ? "active" : ""} />)}</div>
        <span className="step-count">{step} / 3</span>
        <div className="onboard-exits">
          {profile.onboarded?.[other] && <button onClick={() => setRole(user.uid, other)}>Back to {other} workspace</button>}
          <button onClick={() => signOutUser()}>Sign out</button>
        </div>
      </header>
      <section className="onboard-content">
        <aside>
          <div className="eyebrow"><span /> {creator ? "CREATOR ONBOARDING" : "CLIENT ONBOARDING"}</div>
          <h1>{titles[step - 1]}</h1>
          <p>{step === 1 ? "A few thoughtful details help us tailor your Kreota experience." : step === 2 ? "This helps our AI find better opportunities and recommendations." : "Verification keeps the marketplace trusted and projects protected."}</p>
          <div className="onboard-list">
            {titles.map((t, i) => <div className={`${i + 1 === step ? "current" : ""} ${i + 1 < step ? "done" : ""}`} key={t}><b>{i + 1 < step ? "✓" : `0${i + 1}`}</b><span>{t}</span></div>)}
          </div>
          <p className="saved-note"><Icon name="check" size={13} /> Saved to your account as you go.</p>
        </aside>
        <form className="onboard-form" onSubmit={next} key={step}>
          {error && <div className="auth-alert error" role="alert">{error}</div>}
          {step === 1 && (creator ? <>
            <div className="form-row"><label>Creator / display name<input name="displayName" required defaultValue={v("displayName", profile.name)} placeholder="e.g. Maya Creates" /></label><label>Based in<input name="location" required defaultValue={v("location")} placeholder="City, country" /></label></div>
            <label>Primary creator category<select name="category" defaultValue={v("category", OPTIONS.category[0])}>{OPTIONS.category.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label>Short bio<textarea name="bio" defaultValue={v("bio")} placeholder="Tell brands what makes your work distinctive..." /></label>
            <div className="form-row"><label>Instagram / TikTok<input name="social" defaultValue={v("social")} placeholder="@yourhandle" /></label><label>Portfolio URL<input name="portfolio" defaultValue={v("portfolio")} placeholder="https://" /></label></div>
          </> : <>
            <div className="form-row"><label>Brand name<input name="brand" required defaultValue={v("brand")} placeholder="e.g. Northstar Labs" /></label><label>Company website<input name="website" required defaultValue={v("website")} placeholder="https://" /></label></div>
            <label>What does your brand do?<textarea name="description" defaultValue={v("description")} placeholder="A short description of your product and audience..." /></label>
            <div className="form-row"><label>Industry<select name="industry" defaultValue={v("industry", OPTIONS.industry[0])}>{OPTIONS.industry.map((o) => <option key={o}>{o}</option>)}</select></label><label>Company size<select name="size" defaultValue={v("size", OPTIONS.size[0])}>{OPTIONS.size.map((o) => <option key={o}>{o}</option>)}</select></label></div>
          </>)}
          {step === 2 && (creator ? <>
            <label>Skills and specialties<input name="skills" defaultValue={v("skills")} placeholder="UGC, direction, editing, beauty..." /></label>
            <div className="form-row"><label>Typical project rate<select name="rate" defaultValue={v("rate", OPTIONS.rate[0])}>{OPTIONS.rate.map((o) => <option key={o}>{o}</option>)}</select></label><label>Weekly availability<select name="availability" defaultValue={v("availability", OPTIONS.availability[0])}>{OPTIONS.availability.map((o) => <option key={o}>{o}</option>)}</select></label></div>
            <label>Upload a recent project<div className="dropzone"><Icon name="upload" /><b>Drop files or browse</b><span>MP4, MOV, PNG up to 500MB</span></div></label>
          </> : <>
            <label>Main content goal<select name="goal" defaultValue={v("goal", OPTIONS.goal[0])}>{OPTIONS.goal.map((o) => <option key={o}>{o}</option>)}</select></label>
            <div className="form-row"><label>Monthly content budget<select name="budget" defaultValue={v("budget", OPTIONS.budget[0])}>{OPTIONS.budget.map((o) => <option key={o}>{o}</option>)}</select></label><label>Primary channels<select name="channels" defaultValue={v("channels", OPTIONS.channels[0])}>{OPTIONS.channels.map((o) => <option key={o}>{o}</option>)}</select></label></div>
            <label>Brand tone<input name="tone" defaultValue={v("tone")} placeholder="e.g. optimistic, intelligent, candid" /></label>
          </>)}
          {step === 3 && <>
            <div className="verify-box">
              <div className="verify-icon"><Icon name="check" size={24} /></div>
              <div>
                <h3>{user.emailVerified ? "Email verified" : "Verify your email"}</h3>
                <p>{user.emailVerified
                  ? `${user.email} is confirmed. Verified accounts build trust across the marketplace.`
                  : `We sent a verification link to ${user.email}. You can keep going and verify any time.`}</p>
                {!user.emailVerified && <button type="button" className="text-button" onClick={() => resendVerification().then(() => setResent(true)).catch((err) => setError(describeError(err)))}>{resent ? "Link sent — check your inbox" : "Resend verification link"}</button>}
              </div>
            </div>
            <label className="checkline"><input type="checkbox" name="agreed" required defaultChecked={saved.agreed === true} /> I confirm these details are accurate and agree to the marketplace guidelines.</label>
          </>}
          <div className="form-actions">{step > 1 && <Button kind="ghost" onClick={() => setStep(step - 1)}>Back</Button>}<button type="submit" className="button dark" disabled={saving}>{saving ? "Saving…" : step === 3 ? `Enter ${creator ? "creator" : "brand"} workspace` : "Continue"}{!saving && <Icon name="arrow" size={16} />}</button></div>
        </form>
      </section>
    </main>
  );
}

function Sidebar({ role, page, onPage, onSwitch }: { role: Role; page: string; onPage: (p: any) => void; onSwitch: () => void }) {
  const { profile } = useAccount();
  const clientNav = [["home","home","AI workspace"],["creators","users","Discover creators"],["projects","brief","Projects"],["messages","chat","Messages"],["profile","users","My profile"]];
  const creatorNav = [["home","home","Overview"],["opportunities","brief","Opportunities"],["messages","chat","Messages"],["studio","spark","Kreota Studio"],["profile","users","My profile"]];
  const nav = role === "client" ? clientNav : creatorNav;
  return <aside className="sidebar">
    <Logo />
    <nav>{nav.map(([id, icon, label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => onPage(id)}><Icon name={icon} /><span>{label}</span>{id === "messages" && <i>3</i>}{id === "studio" && <small>AI</small>}</button>)}</nav>
    <div className="sidebar-bottom">
      <div className="switcher"><Avatar profile={profile} role={role} /><div><b>{profile.name}</b><span>{workspaceLabel(profile, role)}</span></div><button className="sidebar-signout" onClick={() => signOutUser()} title="Sign out" aria-label="Sign out"><Icon name="logout" size={16} /></button></div>
      <button className="switch-role" onClick={onSwitch}>Switch to {role === "client" ? "creator" : "client"} workspace <Icon name="arrow" size={14} /></button>
    </div>
  </aside>;
}

const ShellContext = createContext<{ role: Role; onSwitch: () => void; openProfile: () => void }>({ role: "client", onSwitch: () => {}, openProfile: () => {} });

function AccountMenu() {
  const { profile, user } = useAccount();
  const { role, onSwitch, openProfile } = useContext(ShellContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="account-menu" ref={ref}>
      <button className="account-trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"><Avatar profile={profile} role={role} /></button>
      {open && (
        <div className="account-pop" role="menu">
          <div className="account-who"><b>{profile.name}</b><span>{user.email}</span></div>
          <button role="menuitem" onClick={() => { setOpen(false); openProfile(); }}><Icon name="users" size={16} /> My profile</button>
          <button role="menuitem" onClick={() => { setOpen(false); onSwitch(); }}><Icon name="arrow" size={16} /> Switch to {role === "client" ? "creator" : "client"} workspace</button>
          <button role="menuitem" onClick={() => signOutUser()}><Icon name="logout" size={16} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return <header className="topbar"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="top-actions"><button className="icon-btn" aria-label="Search"><Icon name="search" /></button><button className="icon-btn badge" aria-label="Notifications"><Icon name="bell" /></button><AccountMenu /></div></header>;
}

function ClientHome({ goCreators }: { goCreators: () => void }) {
  const { profile } = useAccount();
  const [generated, setGenerated] = useState(false);
  const [prompt, setPrompt] = useState("");
  return <>
    <Topbar title={`${greeting()}, ${firstName(profile)}.`} subtitle="What are we creating today?" />
    <div className="page-content client-home">
      <section className="ai-composer">
        <div className="composer-label"><Icon name="spark" /><span>KREOTA INTELLIGENCE</span></div>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe your product, audience and what you want to create..." />
        <div className="composer-footer"><div className="prompt-chips"><button onClick={() => setPrompt("Launch campaign for our new adaptogenic sparkling water")}>Product launch</button><button onClick={() => setPrompt("Create a 30-day social content plan for Gen Z")}>Social strategy</button><button onClick={() => setPrompt("Find an authentic creator for our wellness campaign")}>Find creators</button></div><Button kind="accent" icon="spark" onClick={() => setGenerated(true)}>Build my strategy</Button></div>
      </section>
      {generated ? <StrategyReport goCreators={goCreators} /> : <DashboardOverview goCreators={goCreators} />}
    </div>
  </>;
}

function DashboardOverview({ goCreators }: { goCreators: () => void }) {
  return <>
    <div className="section-title"><div><h2>Your creative workspace</h2><p>Everything moving forward, at a glance.</p></div><button className="text-button">View all activity <Icon name="arrow" size={15} /></button></div>
    <div className="metric-grid">
      <div className="metric-card mint"><span>ACTIVE PROJECTS</span><b>04</b><p><i>+2</i> this month</p></div>
      <div className="metric-card lilac"><span>CREATOR MATCHES</span><b>18</b><p>Curated for your briefs</p></div>
      <div className="metric-card peach"><span>CONTENT IN REVIEW</span><b>07</b><p>3 need your feedback</p></div>
      <div className="metric-card dark"><span>CAMPAIGN REACH</span><b>2.4M</b><p>▲ 18% from last month</p></div>
    </div>
    <div className="dashboard-grid">
      <section className="panel project-panel"><div className="panel-head"><div><span className="status-dot" /> ACTIVE PROJECT</div><button><Icon name="more" /></button></div><h3>Summer Reset Campaign</h3><p>Launch content for Northstar’s new adaptogenic hydration line.</p><div className="progress-label"><span>Content progress</span><b>68%</b></div><div className="progress"><span style={{width:"68%"}} /></div><div className="project-meta"><span><Icon name="calendar" size={15} /> Due Jun 28</span><div className="avatar-stack small">{photos.slice(0,3).map(p=><img src={p} key={p} alt="" />)}</div></div></section>
      <section className="panel recommendations"><div className="panel-head"><div><span>AI RECOMMENDED</span><h3>Creators for you</h3></div><button className="text-button" onClick={goCreators}>See all <Icon name="arrow" size={14}/></button></div>{creators.slice(0,3).map(c=><div className="mini-creator" key={c.name}><img src={c.photo} alt={c.name}/><div><b>{c.name}</b><span>{c.role}</span></div><strong>{c.match}%</strong></div>)}</section>
    </div>
  </>;
}

function StrategyReport({ goCreators }: { goCreators: () => void }) {
  return <section className="strategy">
    <div className="strategy-head"><div><span className="success-pill"><Icon name="check" size={13}/> STRATEGY READY</span><h2>Adaptogenic hydration launch</h2><p>A creator-led content system designed for discovery, trust and conversion.</p></div><Button kind="light">Export brief</Button></div>
    <div className="strategy-grid">
      <div className="strategy-card"><span className="number">01</span><Icon name="users"/><h3>Audience angle</h3><p>Lead with the 3pm energy dip. Position the product as a calm, credible ritual—not another quick fix.</p><div className="tag-row"><span>Gen Z wellness</span><span>Young professionals</span></div></div>
      <div className="strategy-card lilac"><span className="number">02</span><Icon name="video"/><h3>Content system</h3><p>Build a 3-part vertical series: problem-aware hook, creator routine, and 7-day honest review.</p><div className="tag-row"><span>9:16 video</span><span>15–30 sec</span></div></div>
      <div className="strategy-card peach"><span className="number">03</span><Icon name="spark"/><h3>Creative direction</h3><p>Natural morning light, tactile product moments and quiet confidence. Avoid over-polished studio tropes.</p><div className="tag-row"><span>Candid</span><span>Warm minimal</span></div></div>
    </div>
    <div className="creator-cta"><div className="cta-icon"><Icon name="users" size={24}/></div><div><span>NEXT BEST ACTION</span><h3>Find the right voices for this campaign</h3><p>We found 18 creators with audience, style and performance fit.</p></div><Button icon="arrow" onClick={goCreators}>See creator shortlist</Button></div>
  </section>;
}

function CreatorMarketplace() {
  const [invited, setInvited] = useState<string[]>([]);
  return <>
    <Topbar title="Discover creators" subtitle="AI-matched talent for your brand and brief." />
    <div className="page-content">
      <div className="market-tools"><div className="search-box"><Icon name="search"/><input placeholder="Search by name, skill or niche..." /></div><Button kind="light"><Icon name="filter"/> Filters</Button><Button kind="light">Best match ↓</Button></div>
      <div className="market-summary"><div><Icon name="spark"/><span>Matched to</span><b>Adaptogenic hydration launch</b></div><p><strong>18</strong> high-fit creators found</p></div>
      <div className="creator-grid">{creators.map((c,i)=><article className="creator-card" key={c.name}>
        <div className={`creator-photo ${c.tone}`}><img src={c.photo} alt={`${c.name}, ${c.role}`}/><span className="match"><Icon name="spark" size={12}/>{c.match}% match</span><button className="save"><Icon name="star" size={16}/></button></div>
        <div className="creator-info"><div className="creator-name"><div><h3>{c.name}<span>✓</span></h3><p>{c.role} · New York</p></div><b>{c.rate}<small> / project</small></b></div><div className="tag-row">{c.tags.map(t=><span key={t}>{t}</span>)}</div><div className="creator-stats"><span><b>{["2.8M","840k","1.2M","620k"][i]}</b> reach</span><span><b>{["6.4%","5.9%","7.1%","5.2%"][i]}</b> engagement</span><span><b>4.9</b> rating</span></div><Button kind={invited.includes(c.name) ? "light" : "dark"} className="full" onClick={()=>setInvited([...invited,c.name])}>{invited.includes(c.name) ? <><Icon name="check"/> Invite sent</> : <>Invite to project <Icon name="send" size={15}/></>}</Button></div>
      </article>)}</div>
    </div>
  </>;
}

function Projects() {
  return <>
    <Topbar title="Projects" subtitle="Manage briefs, proposals and content delivery." />
    <div className="page-content">
      <div className="section-title"><div className="tabs"><button className="active">Active <b>4</b></button><button>Proposals <b>7</b></button><button>Completed</button></div><Button icon="plus">New project</Button></div>
      <section className="project-hero"><div><span className="success-pill">IN PROGRESS</span><h2>Summer Reset Campaign</h2><p>Creator-led product launch · Due June 28</p></div><div className="project-score"><Icon name="spark"/><b>AI health score 92</b><span>On track</span></div></section>
      <div className="proposal-layout">
        <section className="panel proposals"><div className="panel-head"><div><h3>Creator proposals</h3><p>AI-ranked by creative fit, approach and value.</p></div><Button kind="light"><Icon name="spark"/> Shortlist with AI</Button></div>{creators.slice(0,3).map((c,i)=><div className="proposal" key={c.name}><div className="rank">0{i+1}</div><img src={c.photo} alt={c.name}/><div className="proposal-copy"><div><h4>{c.name}<span>{c.match-i}% fit</span></h4><p>“I’ll build a 3-part routine series around the afternoon energy dip, blending authentic review with tactile product moments...”</p></div><div className="proposal-meta"><span><Icon name="clock" size={14}/> 10 day delivery</span><b>{c.rate}</b><button>Review proposal <Icon name="arrow" size={14}/></button></div></div></div>)}</section>
        <aside className="panel timeline"><h3>Project timeline</h3>{[["Brief approved","May 26","done"],["Creator proposals","Jun 02","current"],["Creator selected","Jun 05",""],["First cut","Jun 16",""],["Final delivery","Jun 28",""]].map(([t,d,s])=><div className={`timeline-row ${s}`} key={t}><i>{s==="done"?"✓":""}</i><div><b>{t}</b><span>{d}</span></div></div>)}</aside>
      </div>
    </div>
  </>;
}

function CreatorHome({ go }: { go: (p: CreatorPage) => void }) {
  const { profile } = useAccount();
  return <>
    <Topbar title={`Welcome back, ${firstName(profile)}.`} subtitle="Your creative business, in motion." />
    <div className="page-content">
      <section className="creator-welcome"><div><span className="success-pill">CREATOR PULSE</span><h2>You’re a top match for 6 new briefs.</h2><p>Your short-form wellness work is trending with verified brands this week.</p><Button kind="accent" icon="arrow" onClick={()=>go("opportunities")}>View opportunities</Button></div><div className="pulse-orbit"><div><b>94</b><span>PROFILE<br/>STRENGTH</span></div></div></section>
      <div className="metric-grid creator-metrics"><div className="metric-card"><span>THIS MONTH</span><b>$8,420</b><p><i>+24%</i> from last month</p></div><div className="metric-card lilac"><span>ACTIVE PROJECTS</span><b>03</b><p>1 deliverable due soon</p></div><div className="metric-card mint"><span>NEW INVITES</span><b>06</b><p>4 are high-match</p></div><div className="metric-card peach"><span>AVG. RATING</span><b>4.9</b><p>Across 38 projects</p></div></div>
      <div className="dashboard-grid">
        <section className="panel task-list"><div className="panel-head"><div><span>TODAY</span><h3>Your next moves</h3></div><button className="text-button">View calendar</button></div>{[["Upload first cut","Summer Reset Campaign","Due today","peach"],["Review new brief","Aura skincare launch","98% match","mint"],["Reply to Theo","Northstar Labs","2 new messages","lilac"]].map(([a,b,c,t])=><button className="task-row" key={a}><i className={t}><Icon name={a.includes("Upload")?"upload":a.includes("Review")?"brief":"chat"} /></i><div><b>{a}</b><span>{b}</span></div><em>{c}</em><Icon name="arrow" size={15}/></button>)}</section>
        <section className="panel"><div className="panel-head"><div><span>PERFORMANCE</span><h3>Portfolio insights</h3></div><button><Icon name="more"/></button></div><div className="chart"><div className="chart-line"><span/><span/><span/><span/><span/><span/></div><div className="chart-labels"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div></div><p className="chart-note"><Icon name="spark" size={15}/> Product storytelling is your fastest-growing category.</p></section>
      </div>
    </div>
  </>;
}

function Opportunities() {
  return <>
    <Topbar title="Opportunities" subtitle="Briefs selected for your skills, style and audience." />
    <div className="page-content"><div className="market-tools"><div className="search-box"><Icon name="search"/><input placeholder="Search opportunities..." /></div><Button kind="light"><Icon name="filter"/> Filter</Button></div>
      <div className="opportunity-list">{[
        ["98","Northstar Labs","Summer Reset","Create a 3-part vertical video series for a new adaptogenic hydration line.","Wellness · UGC · 3 videos","$1,800 – $2,400","7 days"],
        ["95","Morrow Skin","Barrier, but better","Translate clinical skincare benefits into a warm, everyday creator story.","Beauty · Reels · 2 videos","$1,400 – $2,000","12 days"],
        ["91","Sunday Supply","Everyday objects","Lifestyle stills and one short film for a design-led homeware launch.","Lifestyle · Photo + video","$2,200 – $3,000","14 days"]
      ].map((o,i)=><article className="opportunity" key={o[2]}><div className="op-match"><Icon name="spark"/><b>{o[0]}%</b><span>MATCH</span></div><div className="op-main"><div className="op-brand"><div>{o[1].slice(0,1)}</div><span>{o[1]}<small>Verified brand</small></span></div><h2>{o[2]}</h2><p>{o[3]}</p><div className="tag-row"><span>{o[4]}</span></div></div><div className="op-side"><span>BUDGET</span><b>{o[5]}</b><span>DELIVERY</span><b>{o[6]}</b><Button kind={i===0?"dark":"light"}>View brief <Icon name="arrow" size={14}/></Button></div></article>)}</div>
    </div>
  </>;
}

function Messages() {
  const [messages,setMessages]=useState(["Hi Maya — the team loved your direction. The natural morning light feels exactly right.","Amazing. I’ll preserve that tone and share the first cut by Thursday."]);
  const [draft,setDraft]=useState("");
  const send=()=>{if(draft.trim()){setMessages([...messages,draft]);setDraft("");}};
  return <><Topbar title="Messages" subtitle="Keep every creative conversation in context."/><div className="messages-layout">
    <aside className="conversation-list"><div className="search-box"><Icon name="search"/><input placeholder="Search conversations"/></div>{creators.slice(0,3).map((c,i)=><button className={i===0?"active":""} key={c.name}><img src={c.photo} alt=""/><div><b>{i===0?"Northstar Labs":c.name}</b><span>{i===0?"The team loved your direction...":"Shared a project update"}</span></div><time>{i===0?"2m":"1d"}</time></button>)}</aside>
    <section className="chat-window"><header><div className="chat-person"><div className="user-avatar client">N</div><div><b>Northstar Labs</b><span><i/> Active now</span></div></div><div><button className="icon-btn"><Icon name="video"/></button><button className="icon-btn"><Icon name="more"/></button></div></header><div className="project-context"><Icon name="brief"/><div><span>PROJECT</span><b>Summer Reset Campaign</b></div><em>In progress</em></div><div className="chat-body"><div className="date-line">TODAY</div>{messages.map((m,i)=><div className={`bubble ${i%2?"mine":""}`} key={i}>{m}<time>{i%2?"10:34 AM":"10:28 AM"}</time></div>)}</div><div className="chat-input"><button><Icon name="plus"/></button><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Write a message..."/><button className="send-btn" onClick={send}><Icon name="send" size={17}/></button></div></section>
  </div></>;
}

function ProfilePage() {
  const { user, profile } = useAccount();
  const { role } = useContext(ShellContext);
  const other: Role = role === "client" ? "creator" : "client";
  const roles = profile.onboarded?.[other] ? [role, other] : [role];
  const fields = ROLE_FIELDS[role].flatMap((s) => s.fields);
  const data = profile[role] ?? {};
  const filled = fields.filter((f) => typeof data[f.name] === "string" && (data[f.name] as string).trim()).length + (profile.name ? 1 : 0) + (profile.photoURL ? 1 : 0) + (user.emailVerified ? 1 : 0);
  const strength = Math.round((filled / (fields.length + 3)) * 100);
  const google = profile.provider === "google.com" || user.providerData.some((p) => p.providerId === "google.com");
  const since = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";
  const headline = role === "creator" ? [data.category, data.location].filter(Boolean).join(" · ") : [data.brand, data.industry].filter(Boolean).join(" · ");
  const [resent, setResent] = useState(false);

  return <>
    <Topbar title="My profile" subtitle={role === "creator" ? "Your creative storefront on Kreota." : "How creators see your brand on Kreota."} />
    <div className="page-content profile-page">
      <section className="me-hero">
        <div className="me-avatar">{profile.photoURL ? <img src={profile.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className={role}>{initials(profile.name)}</span>}</div>
        <div className="me-main">
          <div className="me-chips">
            <span className={`me-chip ${role}`}>{role === "creator" ? "Creator" : "Client"}</span>
            {user.emailVerified ? <span className="me-chip ok"><Icon name="check" size={12} /> Email verified</span> : <span className="me-chip warn">Email not verified</span>}
            <span className="me-chip">{google ? "Google account" : "Email & password"}</span>
          </div>
          <h1>{role === "creator" && data.displayName ? (data.displayName as string) : profile.name}</h1>
          {headline && <p className="me-headline">{headline}</p>}
          <p className="me-meta">{user.email}{since && <> · Member since {since}</>}</p>
          {!user.emailVerified && <button className="text-button" onClick={() => resendVerification().then(() => setResent(true))}>{resent ? "Verification link sent — check your inbox" : "Send verification link"}</button>}
        </div>
        <div className="me-strength">
          <div className="me-strength-head"><span>Profile strength</span><b>{strength}%</b></div>
          <div className="progress"><span style={{ width: `${strength}%` }} /></div>
          <p>{strength >= 100 ? "Complete — you're ready to be matched." : "Fill in the remaining details to improve AI matches."}</p>
        </div>
      </section>

      <AccountSection google={google} />

      {roles.map((r) => (
        <div key={r} className="me-role-group">
          {roles.length > 1 && <h2 className="me-role-title">{r === "creator" ? "Creator workspace" : "Client workspace"}</h2>}
          {ROLE_FIELDS[r].map((section) => <DetailsSection key={section.title} role={r} section={section} />)}
        </div>
      ))}

      {profile[role]?.agreed === true && <p className="me-footnote"><Icon name="check" size={13} /> You accepted the marketplace guidelines during onboarding.</p>}
    </div>
  </>;
}

function AccountSection({ google }: { google: boolean }) {
  const { user, profile } = useAccount();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [state, setState] = useState<{ busy: boolean; error: string; saved: string }>({ busy: false, error: "", saved: "" });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setState({ busy: false, error: "Enter your name.", saved: "" }); return; }
    setState({ busy: true, error: "", saved: "" });
    try { await updateDisplayName(user, name.trim()); setEditing(false); setState({ busy: false, error: "", saved: "Name updated." }); }
    catch (err) { setState({ busy: false, error: describeError(err), saved: "" }); }
  };
  const reset = async () => {
    setState({ busy: true, error: "", saved: "" });
    try { await resetPassword(user.email ?? ""); setState({ busy: false, error: "", saved: `Password reset link sent to ${user.email}.` }); }
    catch (err) { setState({ busy: false, error: describeError(err), saved: "" }); }
  };
  return (
    <section className="me-card">
      <header><h3>Account</h3>{!editing && <button className="button ghost sm" onClick={() => { setName(profile.name); setEditing(true); setState({ busy: false, error: "", saved: "" }); }}>Edit</button>}</header>
      {state.error && <div className="auth-alert error" role="alert">{state.error}</div>}
      {state.saved && <div className="auth-alert" role="status">{state.saved}</div>}
      {editing ? (
        <form className="me-form" onSubmit={save}>
          <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
          <div className="form-actions"><Button kind="ghost" onClick={() => setEditing(false)}>Cancel</Button><button type="submit" className="button dark" disabled={state.busy}>{state.busy ? "Saving…" : "Save"}</button></div>
        </form>
      ) : (
        <dl className="me-list">
          <div><dt>Full name</dt><dd>{profile.name}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Sign-in method</dt><dd>{google ? "Continue with Google" : "Email and password"}</dd></div>
          <div><dt>Last signed in</dt><dd>{profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "—"}</dd></div>
          {!google && <div><dt>Password</dt><dd><button className="text-button" onClick={reset} disabled={state.busy}>Send password reset email</button></dd></div>}
        </dl>
      )}
    </section>
  );
}

function DetailsSection({ role, section }: { role: Role; section: FieldSection }) {
  const { user, profile } = useAccount();
  const data = profile[role] ?? {};
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<{ busy: boolean; error: string; saved: boolean }>({ busy: false, error: "", saved: false });
  const value = (name: string) => (typeof data[name] === "string" ? (data[name] as string) : "");

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values: FormValues = {};
    new FormData(e.currentTarget).forEach((v, k) => { values[k] = typeof v === "string" ? v.trim() : ""; });
    const missing = section.fields.find((f) => f.required && !values[f.name]);
    if (missing) { setState({ busy: false, error: `${missing.label} is required.`, saved: false }); return; }
    setState({ busy: true, error: "", saved: false });
    try { await saveProfileFields(user.uid, role, values); setEditing(false); setState({ busy: false, error: "", saved: true }); }
    catch (err) { setState({ busy: false, error: describeError(err), saved: false }); }
  };

  return (
    <section className="me-card">
      <header>
        <h3>{section.title}</h3>
        {state.saved && !editing && <span className="me-saved"><Icon name="check" size={13} /> Saved</span>}
        {!editing && <button className="button ghost sm" onClick={() => { setEditing(true); setState({ busy: false, error: "", saved: false }); }}>Edit</button>}
      </header>
      {state.error && <div className="auth-alert error" role="alert">{state.error}</div>}
      {editing ? (
        <form className="me-form" onSubmit={save} noValidate>
          <div className="me-form-grid">
            {section.fields.map((f) => (
              <label key={f.name} className={f.kind === "textarea" ? "wide" : ""}>
                {f.label}{f.required && <span className="req"> *</span>}
                {f.kind === "select" ? (
                  <select name={f.name} defaultValue={value(f.name) || f.options![0]}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                ) : f.kind === "textarea" ? (
                  <textarea name={f.name} defaultValue={value(f.name)} placeholder={f.placeholder} />
                ) : (
                  <input name={f.name} defaultValue={value(f.name)} placeholder={f.placeholder} inputMode={f.kind === "url" ? "url" : undefined} />
                )}
              </label>
            ))}
          </div>
          <div className="form-actions"><Button kind="ghost" onClick={() => setEditing(false)}>Cancel</Button><button type="submit" className="button dark" disabled={state.busy}>{state.busy ? "Saving…" : "Save changes"}</button></div>
        </form>
      ) : (
        <dl className="me-list">
          {section.fields.map((f) => {
            const v = value(f.name);
            const link = f.kind === "url" ? toLink(v) : null;
            return (
              <div key={f.name} className={f.kind === "textarea" ? "wide" : ""}>
                <dt>{f.label}</dt>
                <dd>{!v ? <span className="me-empty">Not added yet</span> : link ? <a href={link} target="_blank" rel="noopener noreferrer">{v}</a> : v}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}

function AppShell({ role, onSwitch }: { role: Role; onSwitch: () => void }) {
  const { user } = useAccount();
  const [clientPage,setClientPage]=useState<ClientPage>("home");
  const [creatorPage,setCreatorPage]=useState<CreatorPage>("home");
  const page=role==="client"?clientPage:creatorPage;
  let content: ReactNode;
  if(role==="client"){
    content=clientPage==="home"?<ClientHome goCreators={()=>setClientPage("creators")}/>:clientPage==="creators"?<CreatorMarketplace/>:clientPage==="projects"?<Projects/>:clientPage==="profile"?<ProfilePage/>:<Messages/>;
  } else {
    content=creatorPage==="home"?<CreatorHome go={setCreatorPage}/>:creatorPage==="opportunities"?<Opportunities/>:creatorPage==="messages"?<Messages/>:creatorPage==="studio"?<Studio key={user.uid} userId={user.uid}/>:<ProfilePage/>;
  }
  return <ShellContext.Provider value={{ role, onSwitch, openProfile: () => (role === "client" ? setClientPage("profile") : setCreatorPage("profile")) }}><div className="app-shell"><Sidebar role={role} page={page} onPage={role==="client"?setClientPage:setCreatorPage} onSwitch={onSwitch}/><main className="app-main">{content}</main></div></ShellContext.Provider>;
}

function Splash() {
  return <main className="splash" aria-busy="true"><Logo /><span className="splash-spinner" aria-label="Loading" /></main>;
}

function AccountProblem({ message }: { message: string }) {
  return (
    <main className="splash">
      <Logo />
      <div className="splash-card" role="alert">
        <h2>We couldn’t open your account</h2>
        <p>{message}</p>
        <div className="splash-actions"><Button kind="light" onClick={() => location.reload()}>Try again</Button><Button onClick={() => signOutUser()}>Sign out</Button></div>
      </div>
    </main>
  );
}

export default function App() {
  const session = useSession();
  if (session.status === "loading") return <Splash />;
  if (session.status === "signedOut") return <Auth />;
  const { user, profile, error } = session;
  if (!profile) return error ? <AccountProblem message={error} /> : <Splash />;
  const role = profile.role;
  return (
    <AccountContext.Provider value={{ user, profile }}>
      {!role ? <RoleSelect onSelect={(r) => setRole(user.uid, r)} />
        : !profile.onboarded?.[role] ? <Onboarding key={role} role={role} />
        : <AppShell role={role} onSwitch={() => setRole(user.uid, role === "client" ? "creator" : "client")} />}
    </AccountContext.Provider>
  );
}
