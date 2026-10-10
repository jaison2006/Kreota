import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import Studio from "./studio/Studio";
import {
  completeOnboarding, describeError, resendVerification, resetPassword, saveOnboardingStep, setRole, signInWithEmail,
  saveProfileFields, seedInterested, setListed, signInWithGoogle, signOutUser, signUpWithEmail, updateDisplayName, useSession, type FormValues, type Profile, type Role,
} from "./session";
import { OPTIONS, ROLE_FIELDS, toLink, type FieldSection } from "./profileFields";
import { CLIENTS, CREATORS, formatCount, formatINR, formatINRShort, matchScore, totalFollowers, type SeedClient, type SeedCreator } from "./data/india";
import { creatorAvatar } from "./data/avatars";
import { conversationId, DEMO_CONTACTS, FileTooLargeError, loadFileData, MAX_FILE_BYTES, sendDemoFile, sendFile, type FileMeta, demoIdOf, isDemoId, markDemoRead, markRead, openConversation, openDemoConversation, publishDirectoryEntry, sendDemoMessage, sendMessage, useDemoInbox, useDemoMessages, useDirectory, useInbox, useMessages, type Contact, type DirectoryEntry } from "./messaging";

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
  clip: <path d="m21 11-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6L15.5 6" />,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M5 20h14" /></>,
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
            <div className="avatar-stack">{CREATORS.slice(0, 3).map((c) => <img src={creatorAvatar(c)} key={c.id} alt="" />)}<b>+{CREATORS.length - 3}</b></div>
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
            <div className="role-visual"><div className="video-frame"><Icon name="play" size={25} /></div><div className="float-card c"><span>New invite</span><b>₹45,000</b></div></div>
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
  const { profile, user } = useAccount();
  const inboxRows = useInbox(user.uid).data;
  const demoRows = useDemoInbox(user.uid).data;
  const unread = [...inboxRows, ...demoRows].reduce((n, r) => n + (r.unread ?? 0), 0);
  const clientNav = [["home","home","AI workspace"],["creators","users","Discover creators"],["projects","brief","Projects"],["messages","chat","Messages"],["profile","users","My profile"]];
  const creatorNav = [["home","home","Overview"],["opportunities","brief","Opportunities"],["messages","chat","Messages"],["studio","spark","Kreota Studio"],["profile","users","My profile"]];
  const nav = role === "client" ? clientNav : creatorNav;
  return <aside className="sidebar">
    <Logo />
    <nav>{nav.map(([id, icon, label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => onPage(id)}><Icon name={icon} /><span>{label}</span>{id === "messages" && unread > 0 && <i aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</i>}{id === "studio" && <small>AI</small>}</button>)}</nav>
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

/* ---------- marketplace data helpers ---------- */

const INDUSTRY_NICHES: Record<string, string[]> = {
  "Consumer technology": ["Tech", "Gadgets", "Smartphones"],
  "Beauty & wellness": ["Beauty", "Skincare", "Makeup", "Wellness"],
  Fashion: ["Fashion", "Ethnic wear", "Menswear"],
  "Food & beverage": ["Food", "Home cooking", "Street food"],
  Fintech: ["Personal finance", "Fintech"],
  Education: ["Education", "Careers", "Exams"],
  "Travel & hospitality": ["Travel", "Adventure"],
  "Home & living": ["Home decor", "DIY"],
  "Automotive & EV": ["Auto", "EV", "Bikes"],
  "Health & nutrition": ["Fitness", "Nutrition", "Wellness"],
};
const CHANNEL_PLATFORMS: Record<string, string[]> = {
  "Instagram & YouTube Shorts": ["Instagram", "YouTube Shorts"],
  YouTube: ["YouTube"],
  "Regional apps (Moj, Josh, ShareChat)": ["Moj", "Josh", "ShareChat"],
  LinkedIn: ["LinkedIn"],
  "Multi-channel": ["Instagram", "YouTube"],
};

/** What a signed-in client is looking for, read from their onboarding answers. */
function clientWant(p: Profile) {
  const c = p.client ?? {};
  return {
    niches: INDUSTRY_NICHES[c.industry as string] ?? [],
    platforms: CHANNEL_PLATFORMS[c.channels as string] ?? ["Instagram"],
    languages: ["Hindi", "English"],
  };
}

function matchReasons(c: SeedCreator, want: ReturnType<typeof clientWant>) {
  const reasons: string[] = [];
  const shared = c.niches.filter((n) => want.niches.includes(n));
  if (shared.length) reasons.push(`Creates ${shared.join(", ").toLowerCase()} content your audience follows`);
  const plat = c.platforms.filter((p) => want.platforms.some((w) => p.name.startsWith(w) || w.startsWith(p.name))).map((p) => p.name);
  if (plat.length) reasons.push(`Strong on ${plat.join(" and ")}, your main channels`);
  reasons.push(`${c.engagement}% engagement and ${c.rating}★ from ${c.reviews} brand reviews`);
  if (c.availability === "Available now") reasons.push("Available to start now");
  return reasons;
}

/** How well a brand brief fits the signed-in creator, from their skills and category. */
/** Words in the creator's own profile, used to judge brief fit. */
function profileWords(p: Profile) {
  const c = p.creator ?? {};
  return `${c.skills ?? ""} ${c.category ?? ""} ${c.bio ?? ""} ${c.displayName ?? ""} ${c.social ?? ""}`.toLowerCase();
}

/** Raw fit between a brief and the signed-in creator: niches, deliverable type, city and budget. */
function rawBriefFit(b: SeedClient, p: Profile) {
  const words = profileWords(p);
  const category = (p.creator?.category as string) ?? "";
  const location = ((p.creator?.location as string) ?? "").toLowerCase();
  let fit = (b.id.charCodeAt(1) * 7 + b.id.charCodeAt(2) * 13) % 9; // stable tie-breaker
  for (const n of b.brief.niches) {
    const n0 = n.toLowerCase();
    if (words.includes(n0) || n0.split(" ").some((w) => w.length > 3 && words.includes(w))) fit += 14;
  }
  const d = b.brief.deliverables.join(" ");
  if (category.includes("Video") && /reel|video|short|film|vlog|livestream/i.test(d)) fit += 12;
  if (category.includes("Photo") && /still|shoot|photo|lookbook/i.test(d)) fit += 12;
  if (category.includes("Design") && /motion|3d|render|design|graphic/i.test(d)) fit += 12;
  if (category.includes("Writing") && /linkedin|carousel|explainer|post|thread/i.test(d)) fit += 12;
  if (location && location.includes(b.city.toLowerCase())) fit += 8;
  else if (location && location.includes(b.state.toLowerCase())) fit += 4;
  fit += Math.min(6, b.brief.budget[1] / 50_000); // better-paid briefs edge ahead
  if (b.verified) fit += 2;
  return fit;
}

/** Match % for every brief, scaled across all 50 so your best fits always land near the top (58–97%). */
function briefScores(p: Profile): Map<string, number> {
  const raw = CLIENTS.map((b) => [b.id, rawBriefFit(b, p)] as const);
  const values = raw.map(([, v]) => v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return new Map(raw.map(([id, v]) => [id, Math.round(58 + ((v - lo) / Math.max(1, hi - lo)) * 39)]));
}

const rateRange = (c: SeedCreator) => `${formatINRShort(c.rateFrom)} – ${formatINRShort(c.rateTo)}`;
const briefBudget = (b: SeedClient) => `${formatINRShort(b.brief.budget[0])} – ${formatINRShort(b.brief.budget[1])}`;
const postedLabel = (d: number) => (d === 0 ? "Posted today" : d === 1 ? "Posted yesterday" : `Posted ${d} days ago`);
const monogram = (name: string) => name.split(/\s+/).filter((w) => /[A-Za-z]/.test(w[0] ?? "")).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const uniq = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));

function BrandMark({ client, size = 40 }: { client: SeedClient; size?: number }) {
  return <span className="mk-brandmark" style={{ background: client.color, width: size, height: size, fontSize: size * 0.36 }}>{monogram(client.brand)}</span>;
}

/* ---------- side drawer ---------- */

function Drawer({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus(); };
  }, [onClose]);
  return (
    <div className="mk-drawer-bg" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mk-drawer" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <button className="icon-btn mk-drawer-close" onClick={onClose} aria-label="Close"><Icon name="plus" /></button>
        {children}
      </div>
    </div>
  );
}

/* ---------- Discover creators (client) ---------- */

type CreatorSort = "match" | "followers" | "engagement" | "rating" | "priceLow" | "priceHigh";

function CreatorMarketplace() {
  const { user, profile } = useAccount();
  const want = clientWant(profile);
  const saved = profile.shortlist ?? {};
  const invited = profile.invites ?? {};
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("");
  const [platform, setPlatform] = useState("");
  const [maxRate, setMaxRate] = useState(0);
  const [sort, setSort] = useState<CreatorSort>("match");
  const [savedOnly, setSavedOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [open, setOpen] = useState<SeedCreator | null>(null);

  const scored = CREATORS.map((c) => ({ c, score: matchScore(c, want) }));
  const needle = q.trim().toLowerCase();
  const list = scored
    .filter(({ c }) => !needle || `${c.name} ${c.handle} ${c.title} ${c.city} ${c.state} ${c.niches.join(" ")} ${c.languages.join(" ")}`.toLowerCase().includes(needle))
    .filter(({ c }) => !niche || c.niches.includes(niche))
    .filter(({ c }) => !city || c.city === city)
    .filter(({ c }) => !language || c.languages.includes(language))
    .filter(({ c }) => !platform || c.platforms.some((p) => p.name === platform))
    .filter(({ c }) => !maxRate || c.rateFrom <= maxRate)
    .filter(({ c }) => !savedOnly || saved[c.id])
    .filter(({ c }) => !availableOnly || c.availability === "Available now")
    .sort((a, b) => {
      switch (sort) {
        case "followers": return totalFollowers(b.c) - totalFollowers(a.c);
        case "engagement": return b.c.engagement - a.c.engagement;
        case "rating": return b.c.rating - a.c.rating || b.c.reviews - a.c.reviews;
        case "priceLow": return a.c.rateFrom - b.c.rateFrom;
        case "priceHigh": return b.c.rateFrom - a.c.rateFrom;
        default: return b.score - a.score;
      }
    });
  const filtersOn = !!(q || niche || city || language || platform || maxRate || savedOnly || availableOnly);
  const reset = () => { setQ(""); setNiche(""); setCity(""); setLanguage(""); setPlatform(""); setMaxRate(0); setSavedOnly(false); setAvailableOnly(false); };
  const toggleSave = (c: SeedCreator) => setListed(user.uid, "shortlist", c.id, !saved[c.id]);
  const toggleInvite = (c: SeedCreator) => setListed(user.uid, "invites", c.id, !invited[c.id]);
  const brand = (profile.client?.brand as string) || "your brand";

  return <>
    <Topbar title="Discover creators" subtitle="Verified Indian creators, matched to your brand." />
    <div className="page-content">
      <div className="market-tools">
        <div className="search-box"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, city, niche or language…" aria-label="Search creators" /></div>
        <label className="mk-select"><span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as CreatorSort)}>
            <option value="match">Best match</option><option value="followers">Most followers</option><option value="engagement">Highest engagement</option>
            <option value="rating">Top rated</option><option value="priceLow">Price: low to high</option><option value="priceHigh">Price: high to low</option>
          </select>
        </label>
      </div>
      <div className="mk-filters">
        <select value={niche} onChange={(e) => setNiche(e.target.value)} aria-label="Niche"><option value="">All niches</option>{uniq(CREATORS.flatMap((c) => c.niches)).map((n) => <option key={n}>{n}</option>)}</select>
        <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City"><option value="">All cities</option>{uniq(CREATORS.map((c) => c.city)).map((n) => <option key={n}>{n}</option>)}</select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language"><option value="">All languages</option>{uniq(CREATORS.flatMap((c) => c.languages)).map((n) => <option key={n}>{n}</option>)}</select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform"><option value="">All platforms</option>{uniq(CREATORS.flatMap((c) => c.platforms.map((p) => p.name))).map((n) => <option key={n}>{n}</option>)}</select>
        <select value={maxRate} onChange={(e) => setMaxRate(Number(e.target.value))} aria-label="Budget"><option value={0}>Any budget</option>{[15_000, 30_000, 60_000, 1_00_000, 2_00_000].map((n) => <option key={n} value={n}>Starts under {formatINRShort(n)}</option>)}</select>
        <button className={`mk-chip${availableOnly ? " on" : ""}`} aria-pressed={availableOnly} onClick={() => setAvailableOnly((v) => !v)}>Available now</button>
        <button className={`mk-chip${savedOnly ? " on" : ""}`} aria-pressed={savedOnly} onClick={() => setSavedOnly((v) => !v)}><Icon name="star" size={13} /> Saved ({Object.keys(saved).length})</button>
        {filtersOn && <button className="text-button" onClick={reset}>Clear all</button>}
      </div>
      <div className="market-summary"><div><Icon name="spark" /><span>Matched to</span><b>{brand}</b></div><p><strong>{list.length}</strong> of {CREATORS.length} creators · {Object.keys(invited).length} invited<span className="mk-sample">Sample profiles for demo</span></p></div>
      {list.length ? (
        <div className="creator-grid">{list.map(({ c, score }) => (
          <article className="creator-card" key={c.id}>
            <button className="creator-photo mk-photo-btn" onClick={() => setOpen(c)} aria-label={`View ${c.name}'s profile`}>
              <img src={creatorAvatar(c)} alt="" loading="lazy" />
              <span className="match"><Icon name="spark" size={12} />{score}% match</span>
              <span className={`mk-avail${c.availability === "Available now" ? " now" : ""}`}>{c.availability}</span>
            </button>
            <button className={`save${saved[c.id] ? " on" : ""}`} onClick={() => toggleSave(c)} aria-pressed={!!saved[c.id]} aria-label={saved[c.id] ? `Remove ${c.name} from saved` : `Save ${c.name}`}><Icon name="star" size={16} /></button>
            <div className="creator-info">
              <div className="creator-name"><div><h3>{c.name}{c.verified && <span title="Verified">✓</span>}</h3><p>{c.title} · {c.city}</p></div></div>
              <p className="mk-rate"><b>{rateRange(c)}</b> / project</p>
              <div className="tag-row">{c.niches.slice(0, 3).map((t) => <span key={t}>{t}</span>)}</div>
              <div className="creator-stats"><span><b>{formatCount(totalFollowers(c))}</b> reach</span><span><b>{c.engagement}%</b> engagement</span><span><b>{c.rating}★</b> rating</span></div>
              <div className="mk-card-actions">
                <Button kind="light" onClick={() => setOpen(c)}>View profile</Button>
                <Button kind={invited[c.id] ? "light" : "dark"} onClick={() => toggleInvite(c)}>{invited[c.id] ? <><Icon name="check" /> Invited</> : <>Invite <Icon name="send" size={15} /></>}</Button>
              </div>
            </div>
          </article>
        ))}</div>
      ) : (
        <div className="mk-empty"><Icon name="search" size={26} /><b>No creators match these filters</b><p>Try removing a filter or searching a different city or niche.</p><Button kind="light" onClick={reset}>Clear filters</Button></div>
      )}
    </div>
    {open && <CreatorDrawer c={open} score={matchScore(open, want)} reasons={matchReasons(open, want)} saved={!!saved[open.id]} invited={!!invited[open.id]} onSave={() => toggleSave(open)} onInvite={() => toggleInvite(open)} onClose={() => setOpen(null)} />}
  </>;
}

function CreatorDrawer({ c, score, reasons, saved, invited, onSave, onInvite, onClose }: { c: SeedCreator; score: number; reasons: string[]; saved: boolean; invited: boolean; onSave: () => void; onInvite: () => void; onClose: () => void }) {
  return (
    <Drawer label={`${c.name} profile`} onClose={onClose}>
      <header className="mk-person">
        <img src={creatorAvatar(c)} alt="" />
        <div>
          <h2>{c.name}{c.verified && <span className="mk-verified" title="Verified creator">✓</span>}</h2>
          <p>{c.handle} · {c.title}</p>
          <p className="mk-muted">{c.city}, {c.state} · On Kreota since {new Date(`${c.joined}-01`).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
          <div className="me-chips"><span className="me-chip creator">{c.category}</span><span className={`me-chip ${c.availability === "Available now" ? "ok" : "warn"}`}>{c.availability}</span></div>
        </div>
      </header>
      <div className="mk-actions">
        <Button kind={invited ? "light" : "dark"} onClick={onInvite}>{invited ? <><Icon name="check" /> Invited to project</> : <>Invite to project <Icon name="send" size={15} /></>}</Button>
        <Button kind="light" onClick={onSave}><Icon name="star" size={15} /> {saved ? "Saved" : "Save"}</Button>
      </div>
      <section className="mk-section mk-match">
        <h3><Icon name="spark" size={15} /> {score}% match — why</h3>
        <ul>{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>
      <section className="mk-section"><h3>About</h3><p>{c.bio}</p></section>
      <section className="mk-section">
        <h3>Audience & performance</h3>
        <dl className="mk-stats">
          {c.platforms.map((p) => <div key={p.name}><dt>{p.name}</dt><dd>{formatCount(p.followers)} followers</dd></div>)}
          <div><dt>Avg. views</dt><dd>{formatCount(c.avgViews)}</dd></div>
          <div><dt>Engagement</dt><dd>{c.engagement}%</dd></div>
          <div><dt>Rating</dt><dd>{c.rating}★ · {c.reviews} reviews</dd></div>
          <div><dt>Projects done</dt><dd>{c.projects}</dd></div>
        </dl>
      </section>
      <section className="mk-section">
        <h3>Rates & delivery</h3>
        <dl className="mk-stats">
          <div><dt>Typical project</dt><dd>{formatINR(c.rateFrom)} – {formatINR(c.rateTo)}</dd></div>
          <div><dt>Turnaround</dt><dd>{c.turnaroundDays} days</dd></div>
          <div><dt>Languages</dt><dd>{c.languages.join(", ")}</dd></div>
          <div><dt>Niches</dt><dd>{c.niches.join(", ")}</dd></div>
        </dl>
      </section>
      <section className="mk-section">
        <h3>Recent work</h3>
        <div className="mk-portfolio">{c.portfolio.map((w, i) => (
          <article key={i} className={`mk-work t${i}`}>
            <span>{w.brand}</span>
            <b>{w.title}</b>
            <em>{w.result}</em>
          </article>
        ))}</div>
      </section>
    </Drawer>
  );
}

/* ---------- Opportunities (creator) ---------- */

type BriefSort = "match" | "newest" | "budget" | "deadline";

type BriefView = "recommended" | "all" | "closing" | "interested";

const matchTone = (score: number) => (score >= 90 ? "high" : score >= 80 ? "mid" : "low");

function Opportunities() {
  const { user, profile } = useAccount();
  const interested = profile.interested ?? {};
  const [view, setView] = useState<BriefView>("recommended");
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("");
  const [platform, setPlatform] = useState("");
  const [minBudget, setMinBudget] = useState(0);
  const [sort, setSort] = useState<BriefSort>("match");
  const [open, setOpen] = useState<SeedClient | null>(null);

  const scores = useMemo(() => briefScores(profile), [profile.creator]);
  const scored = CLIENTS.map((b) => ({ b, score: scores.get(b.id) ?? 60 }));
  // Recommended is always your 12 best fits; "strong" is anything scoring 80%+.
  const recommended = [...scored].sort((a, b) => b.score - a.score).slice(0, 12);
  const strong = scored.filter((x) => x.score >= 80);
  const closing = scored.filter((x) => x.b.brief.deadlineDays <= 10);
  const mine = scored.filter((x) => interested[x.b.id]);
  const newThisWeek = scored.filter((x) => x.b.brief.postedDaysAgo <= 7).length;
  const base = view === "recommended" ? recommended : view === "closing" ? closing : view === "interested" ? mine : scored;

  const needle = q.trim().toLowerCase();
  const list = base
    .filter(({ b }) => !needle || `${b.brand} ${b.brief.title} ${b.brief.summary} ${b.city} ${b.industry} ${b.brief.niches.join(" ")}`.toLowerCase().includes(needle))
    .filter(({ b }) => !industry || b.industry === industry)
    .filter(({ b }) => !platform || b.brief.platforms.includes(platform))
    .filter(({ b }) => !minBudget || b.brief.budget[1] >= minBudget)
    .sort((x, y) => sort === "newest" ? x.b.brief.postedDaysAgo - y.b.brief.postedDaysAgo
      : sort === "budget" ? y.b.brief.budget[1] - x.b.brief.budget[1]
      : sort === "deadline" ? x.b.brief.deadlineDays - y.b.brief.deadlineDays
      : y.score - x.score);
  const filtersOn = !!(q || industry || platform || minBudget);
  const reset = () => { setQ(""); setIndustry(""); setPlatform(""); setMinBudget(0); };
  const toggle = (b: SeedClient) => setListed(user.uid, "interested", b.id, !interested[b.id]);
  // First visit: shortlist your top 3 so the Interested tab has something to work with. Runs once per account.
  useEffect(() => {
    if (profile.seeded?.interested) return;
    seedInterested(user.uid, recommended.slice(0, 3).map((x) => x.b.id)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.seeded?.interested, user.uid]);
  const sortLabel = { match: "best match", newest: "newest", budget: "highest budget", deadline: "soonest deadline" }[sort];
  const tabs: [BriefView, string, number][] = [["recommended", "Recommended for you", recommended.length], ["all", "All briefs", scored.length], ["closing", "Closing soon", closing.length], ["interested", "Interested", mine.length]];

  return <>
    <Topbar title="Opportunities" subtitle="Live briefs from verified Indian brands, matched to your profile." />
    <div className="page-content op2">
      <section className="op2-stats" aria-label="Summary">
        <div><span>Open briefs</span><b>{scored.length}</b><small>from {new Set(CLIENTS.map((b) => b.industry)).size} industries</small></div>
        <div className="mint"><span>Strong matches</span><b>{strong.length}</b><small>80%+ fit with your skills</small></div>
        <div className="lilac"><span>You're interested in</span><b>{mine.length}</b><small>{mine.length ? "Saved to your shortlist" : "Tap ☆ on a brief to shortlist it"}</small></div>
        <div className="peach"><span>New this week</span><b>{newThisWeek}</b><small>Posted in the last 7 days</small></div>
      </section>

      <div className="op2-tabs" role="tablist" aria-label="Brief views">
        {tabs.map(([id, label, n]) => (
          <button key={id} role="tab" aria-selected={view === id} className={view === id ? "on" : ""} onClick={() => setView(id)}>
            {label}<i>{n}</i>
          </button>
        ))}
      </div>

      <div className="op2-toolbar">
        <div className="search-box"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brands, briefs, cities or niches…" aria-label="Search opportunities" /></div>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Industry"><option value="">All industries</option>{uniq(CLIENTS.map((b) => b.industry)).map((n) => <option key={n}>{n}</option>)}</select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform"><option value="">All platforms</option>{uniq(CLIENTS.flatMap((b) => b.brief.platforms)).map((n) => <option key={n}>{n}</option>)}</select>
        <select value={minBudget} onChange={(e) => setMinBudget(Number(e.target.value))} aria-label="Budget"><option value={0}>Any budget</option>{[25_000, 50_000, 1_00_000, 2_00_000].map((n) => <option key={n} value={n}>Pays {formatINRShort(n)}+</option>)}</select>
        <select value={sort} onChange={(e) => setSort(e.target.value as BriefSort)} aria-label="Sort"><option value="match">Sort: Best match</option><option value="newest">Sort: Newest</option><option value="budget">Sort: Highest budget</option><option value="deadline">Sort: Soonest deadline</option></select>
      </div>

      <div className="op2-count">
        <span>Showing <b>{list.length}</b> {list.length === 1 ? "brief" : "briefs"} · sorted by {sortLabel}</span>
        {filtersOn && <button className="text-button" onClick={reset}>Clear filters</button>}
      </div>

      {list.length ? (
        <div className="op2-grid">{list.map(({ b, score }) => (
          <article className="op2-card" key={b.id}>
            <header>
              <BrandMark client={b} size={42} />
              <div className="op2-brand">
                <b>{b.brand}{b.verified && <span className="mk-verified" title="Verified brand">✓</span>}</b>
                <span>{b.city} · {b.industry}</span>
              </div>
              <span className={`op2-match ${matchTone(score)}`} title="How well this brief fits your profile"><Icon name="spark" size={12} />{score}% match</span>
            </header>
            <button className="op2-title" onClick={() => setOpen(b)}>{b.brief.title}</button>
            <p className="op2-summary">{b.brief.summary}</p>
            <div className="op2-tags">
              {b.brief.platforms.map((t) => <span key={t} className="plat">{t}</span>)}
              {b.brief.niches.slice(0, 2).map((t) => <span key={t}>{t}</span>)}
            </div>
            <dl className="op2-facts">
              <div><dt>Budget</dt><dd>{briefBudget(b)}</dd></div>
              <div><dt>Delivery</dt><dd className={b.brief.deadlineDays <= 10 ? "soon" : ""}>{b.brief.deadlineDays} days</dd></div>
              <div><dt>Creators</dt><dd>{b.brief.creatorsNeeded} needed</dd></div>
              <div><dt>Deliverables</dt><dd>{b.brief.deliverables.length}</dd></div>
            </dl>
            <footer>
              <span className="op2-posted">{postedLabel(b.brief.postedDaysAgo)}</span>
              <button className={`op2-star${interested[b.id] ? " on" : ""}`} onClick={() => toggle(b)} aria-pressed={!!interested[b.id]}>
                <Icon name={interested[b.id] ? "check" : "star"} size={15} />{interested[b.id] ? "Interested" : "I'm interested"}
              </button>
              <Button kind="dark" onClick={() => setOpen(b)}>View brief <Icon name="arrow" size={14} /></Button>
            </footer>
          </article>
        ))}</div>
      ) : (
        <div className="mk-empty">
          <Icon name={view === "interested" ? "star" : "search"} size={26} />
          <b>{view === "interested" && !filtersOn ? "No briefs shortlisted yet" : "No briefs match"}</b>
          <p>{view === "interested" && !filtersOn ? "Tap “I'm interested” on any brief and it will appear here." : "Try a different search, remove a filter or switch tabs."}</p>
          {filtersOn ? <Button kind="light" onClick={reset}>Clear filters</Button> : view !== "all" && <Button kind="light" onClick={() => setView("all")}>See all briefs</Button>}
        </div>
      )}
    </div>
    {open && <BriefDrawer b={open} score={scores.get(open.id) ?? 60} interested={!!interested[open.id]} onToggle={() => toggle(open)} onClose={() => setOpen(null)} />}
  </>;
}

function BriefDrawer({ b, score, interested, onToggle, onClose }: { b: SeedClient; score: number; interested: boolean; onToggle: () => void; onClose: () => void }) {
  return (
    <Drawer label={`${b.brand} brief`} onClose={onClose}>
      <header className="mk-person">
        <BrandMark client={b} size={72} />
        <div>
          <h2>{b.brand}{b.verified && <span className="mk-verified" title="Verified brand">✓</span>}</h2>
          <p>{b.tagline}</p>
          <p className="mk-muted">{b.industry} · {b.city}, {b.state} · Since {b.founded}</p>
          <div className="me-chips"><span className="me-chip client">{b.rating}★ from creators</span><span className="me-chip">{b.campaigns} campaigns on Kreota</span></div>
        </div>
      </header>
      <div className="mk-actions">
        <Button kind={interested ? "light" : "dark"} onClick={onToggle}>{interested ? <><Icon name="check" /> You're interested</> : <>I'm interested <Icon name="send" size={15} /></>}</Button>
        <span className="mk-match-pill"><Icon name="spark" size={13} /> {score}% match</span>
      </div>
      <section className="mk-section mk-brief">
        <span className="mk-kicker">OPEN BRIEF · {postedLabel(b.brief.postedDaysAgo).toUpperCase()}</span>
        <h3 className="mk-brief-title">{b.brief.title}</h3>
        <p>{b.brief.summary}</p>
        <dl className="mk-stats">
          <div><dt>Budget</dt><dd>{formatINR(b.brief.budget[0])} – {formatINR(b.brief.budget[1])}</dd></div>
          <div><dt>Delivery</dt><dd>Within {b.brief.deadlineDays} days</dd></div>
          <div><dt>Creators needed</dt><dd>{b.brief.creatorsNeeded}</dd></div>
          <div><dt>Platforms</dt><dd>{b.brief.platforms.join(", ")}</dd></div>
        </dl>
        <h4>Deliverables</h4>
        <ul className="mk-list">{b.brief.deliverables.map((d) => <li key={d}><Icon name="check" size={14} /> {d}</li>)}</ul>
        <h4>Looking for</h4>
        <div className="tag-row">{b.brief.niches.map((n) => <span key={n}>{n}</span>)}{b.languages.map((l) => <span key={l}>{l}</span>)}</div>
      </section>
      <section className="mk-section">
        <h3>About {b.brand}</h3>
        <p>{b.description}</p>
        <dl className="mk-stats">
          <div><dt>Audience</dt><dd>{b.audience}</dd></div>
          <div><dt>Brand tone</dt><dd>{b.tone}</dd></div>
          <div><dt>Main goal</dt><dd>{b.goal}</dd></div>
          <div><dt>Monthly content budget</dt><dd>{formatINRShort(b.budgetMonthly[0])} – {formatINRShort(b.budgetMonthly[1])}</dd></div>
          <div><dt>Team size</dt><dd>{b.size}</dd></div>
          <div><dt>Contact</dt><dd>{b.contact.name}, {b.contact.title}</dd></div>
        </dl>
      </section>
    </Drawer>
  );
}

function topMatches(profile: Profile, n: number) {
  const want = clientWant(profile);
  return CREATORS.map((c) => ({ c, score: matchScore(c, want) })).sort((a, b) => b.score - a.score).slice(0, n);
}

function DashboardOverview({ goCreators }: { goCreators: () => void }) {
  const { profile } = useAccount();
  return <>
    <div className="section-title"><div><h2>Your creative workspace</h2><p>Everything moving forward, at a glance.</p></div><button className="text-button">View all activity <Icon name="arrow" size={15} /></button></div>
    <div className="metric-grid">
      <div className="metric-card mint"><span>ACTIVE PROJECTS</span><b>04</b><p><i>+2</i> this month</p></div>
      <div className="metric-card lilac"><span>CREATOR MATCHES</span><b>18</b><p>Curated for your briefs</p></div>
      <div className="metric-card peach"><span>CONTENT IN REVIEW</span><b>07</b><p>3 need your feedback</p></div>
      <div className="metric-card dark"><span>CAMPAIGN REACH</span><b>2.4M</b><p>▲ 18% from last month</p></div>
    </div>
    <div className="dashboard-grid">
      <section className="panel project-panel"><div className="panel-head"><div><span className="status-dot" /> ACTIVE PROJECT</div><button><Icon name="more" /></button></div><h3>Summer Reset Campaign</h3><p>Launch content for your new product line.</p><div className="progress-label"><span>Content progress</span><b>68%</b></div><div className="progress"><span style={{width:"68%"}} /></div><div className="project-meta"><span><Icon name="calendar" size={15} /> Due Jun 28</span><div className="avatar-stack small">{CREATORS.slice(3,6).map(c=><img src={creatorAvatar(c)} key={c.id} alt="" />)}</div></div></section>
      <section className="panel recommendations"><div className="panel-head"><div><span>AI RECOMMENDED</span><h3>Creators for you</h3></div><button className="text-button" onClick={goCreators}>See all <Icon name="arrow" size={14}/></button></div>{topMatches(profile,3).map(({c,score})=><div className="mini-creator" key={c.id}><img src={creatorAvatar(c)} alt=""/><div><b>{c.name}</b><span>{c.title} · {c.city}</span></div><strong>{score}%</strong></div>)}</section>
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

function Projects() {
  const { profile } = useAccount();
  const pitches = ["A 3-part reel series built around real routines, blending an honest review with tactile product moments.", "A short cinematic film for launch week plus cut-downs for Shorts and Reels in two languages.", "Regional-language explainers that show the product in everyday use, with a strong hook in the first 2 seconds."];
  return <>
    <Topbar title="Projects" subtitle="Manage briefs, proposals and content delivery." />
    <div className="page-content">
      <div className="section-title"><div className="tabs"><button className="active">Active <b>4</b></button><button>Proposals <b>7</b></button><button>Completed</button></div><Button icon="plus">New project</Button></div>
      <section className="project-hero"><div><span className="success-pill">IN PROGRESS</span><h2>Summer Reset Campaign</h2><p>Creator-led product launch · Due June 28</p></div><div className="project-score"><Icon name="spark"/><b>AI health score 92</b><span>On track</span></div></section>
      <div className="proposal-layout">
        <section className="panel proposals"><div className="panel-head"><div><h3>Creator proposals</h3><p>AI-ranked by creative fit, approach and value.</p></div><Button kind="light"><Icon name="spark"/> Shortlist with AI</Button></div>{topMatches(profile,3).map(({c,score},i)=><div className="proposal" key={c.id}><div className="rank">0{i+1}</div><img src={creatorAvatar(c)} alt=""/><div className="proposal-copy"><div><h4>{c.name}<span>{score}% fit</span></h4><p>“{pitches[i]}”</p></div><div className="proposal-meta"><span><Icon name="clock" size={14}/> {c.turnaroundDays} day delivery</span><b>{formatINRShort(c.rateFrom)}</b><button>Review proposal <Icon name="arrow" size={14}/></button></div></div></div>)}</section>
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
      <div className="metric-grid creator-metrics"><div className="metric-card"><span>THIS MONTH</span><b>₹1,84,500</b><p><i>+24%</i> from last month</p></div><div className="metric-card lilac"><span>ACTIVE PROJECTS</span><b>03</b><p>1 deliverable due soon</p></div><div className="metric-card mint"><span>NEW INVITES</span><b>06</b><p>4 are high-match</p></div><div className="metric-card peach"><span>AVG. RATING</span><b>4.9</b><p>Across 38 projects</p></div></div>
      <div className="dashboard-grid">
        <section className="panel task-list"><div className="panel-head"><div><span>TODAY</span><h3>Your next moves</h3></div><button className="text-button">View calendar</button></div>{[["Upload first cut",`${CLIENTS[0].brief.title} · ${CLIENTS[0].brand}`,"Due today","peach"],["Review new brief",`${CLIENTS[16].brief.title} · ${CLIENTS[16].brand}`,"New today","mint"],["Reply to "+CLIENTS[7].contact.name.split(" ")[0],CLIENTS[7].brand,"Waiting on you","lilac"]].map(([a,b,c,t])=><button className="task-row" key={a}><i className={t}><Icon name={a.includes("Upload")?"upload":a.includes("Review")?"brief":"chat"} /></i><div><b>{a}</b><span>{b}</span></div><em>{c}</em><Icon name="arrow" size={15}/></button>)}</section>
        <section className="panel"><div className="panel-head"><div><span>PERFORMANCE</span><h3>Portfolio insights</h3></div><button><Icon name="more"/></button></div><div className="chart"><div className="chart-line"><span/><span/><span/><span/><span/><span/></div><div className="chart-labels"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div></div><p className="chart-note"><Icon name="spark" size={15}/> Product storytelling is your fastest-growing category.</p></section>
      </div>
    </div>
  </>;
}

function shortTime(at?: number) {
  if (!at) return "";
  const d = new Date(at);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = (day(now) - day(d)) / 86400000;
  if (diff === 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function dayLabel(at: number) {
  const d = new Date(at);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function PersonAvatar({ entry, size = 40 }: { entry?: Contact; size?: number }) {
  const name = entry?.name ?? "Kreota member";
  const tone = entry?.roles.includes("creator") && !entry.roles.includes("client") ? "creator" : "client";
  return entry?.photoURL
    ? <img className="msg-avatar" style={{ width: size, height: size }} src={entry.photoURL} alt="" referrerPolicy="no-referrer" />
    : <span className={`msg-avatar ${tone}`} style={{ width: size, height: size }}>{initials(name)}</span>;
}

const roleText = (e?: Contact) => (e ? (e.demo ? (e.roles.includes("creator") ? "Demo creator" : "Demo brand") : e.roles.map((r) => (r === "creator" ? "Creator" : "Client")).join(" · ")) : "");

function Messages() {
  const { user } = useAccount();
  const me = user.uid;
  const realInbox = useInbox(me);
  const demoInbox = useDemoInbox(me);
  const directory = useDirectory();
  const people = new Map<string, Contact>([...DEMO_CONTACTS, ...directory.data].map((d) => [d.uid, d]));
  const inbox = {
    loading: realInbox.loading && demoInbox.loading,
    error: realInbox.error,
    data: [...realInbox.data, ...demoInbox.data].sort((a, b) => (b.lastAt ?? b.updatedAt ?? 0) - (a.lastAt ?? a.updatedAt ?? 0)),
  };
  const [active, setActive] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const rows = inbox.data.filter((r) => {
    if (!search.trim()) return true;
    const p = people.get(r.with);
    return `${p?.name ?? ""} ${p?.headline ?? ""} ${r.lastText ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
  });
  const activeRow = inbox.data.find((r) => r.cid === active);

  const startWith = async (other: string) => {
    setError("");
    try {
      const cid = isDemoId(other)
        ? await openDemoConversation(me, other)
        : await openConversation(me, other, realInbox.data.some((r) => r.cid === conversationId(me, other)));
      setActive(cid);
      setPicking(false);
    } catch (e) {
      setError(describeError(e));
    }
  };

  const blocked = inbox.error === "permission" || directory.error === "permission";

  return <>
    <Topbar title="Messages" subtitle="Talk directly with clients and creators on Kreota." />
    <div className={`msg-layout${active || picking ? " has-active" : ""}`}>
      <aside className="msg-list" aria-label="Conversations">
        <div className="msg-list-head">
          <div className="search-box"><Icon name="search" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></div>
          <button className="button dark sm" onClick={() => { setPicking(true); setActive(null); }}><Icon name="plus" size={15} /> New</button>
        </div>
        {inbox.loading ? (
          <div className="msg-loading"><span className="splash-spinner" /></div>
        ) : rows.length ? (
          <div className="msg-rows">
            {rows.map((r) => {
              const p = people.get(r.with);
              return (
                <button key={r.cid} className={`msg-row${active === r.cid ? " active" : ""}${r.unread ? " unread" : ""}`} onClick={() => { setActive(r.cid); setPicking(false); }}>
                  <PersonAvatar entry={p} />
                  <div className="msg-row-text">
                    <b>{p?.name ?? "Kreota member"}</b>
                    <span>{r.lastText ? `${r.lastSender === me ? "You: " : ""}${r.lastText}` : "No messages yet — say hello"}</span>
                  </div>
                  <div className="msg-row-meta">
                    <time>{shortTime(r.lastAt ?? r.updatedAt)}</time>
                    {!!r.unread && <i aria-label={`${r.unread} unread`}>{r.unread > 99 ? "99+" : r.unread}</i>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="msg-empty">
            <Icon name="chat" size={26} />
            <b>{search ? "No matches" : "No conversations yet"}</b>
            <p>{search ? "Try a different name." : "Start a conversation with a creator or brand on Kreota."}</p>
            {!search && <button className="button dark sm" onClick={() => setPicking(true)}><Icon name="plus" size={15} /> New message</button>}
          </div>
        )}
      </aside>

      <section className="msg-main">
        {blocked ? (
          <div className="msg-empty"><Icon name="chat" size={26} /><b>Messaging is waiting for database rules</b><p>The Realtime Database rules need the messaging section before conversations can load.</p></div>
        ) : picking ? (
          <PeoplePicker people={[...directory.data.filter((d) => d.uid !== me), ...DEMO_CONTACTS]} loading={directory.loading} onPick={startWith} onBack={() => setPicking(false)} error={error} />
        ) : active ? (
          <Chat key={active} cid={active} other={people.get(activeRow?.with ?? "")} otherId={activeRow?.with ?? ""} unread={activeRow?.unread ?? 0} onBack={() => setActive(null)} />
        ) : (
          <div className="msg-empty"><Icon name="chat" size={30} /><b>Your conversations</b><p>Pick a conversation, or start a new one.</p></div>
        )}
      </section>
    </div>
  </>;
}

function PeoplePicker({ people, loading, onPick, onBack, error }: { people: Contact[]; loading: boolean; onPick: (uid: string) => void; onBack: () => void; error: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const list = people
    .filter((p) => filter === "all" || p.roles.includes(filter))
    .filter((p) => `${p.name} ${p.headline}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(!!a.demo) - Number(!!b.demo) || a.name.localeCompare(b.name));
  return (
    <div className="msg-picker">
      <header className="msg-chat-head">
        <button className="icon-btn msg-back" onClick={onBack} aria-label="Back to conversations"><Icon name="arrow" /></button>
        <div><b>New message</b><span>Choose who to talk to</span></div>
      </header>
      <div className="msg-picker-tools">
        <div className="search-box"><Icon name="search" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people and brands" aria-label="Search people" /></div>
        <div className="msg-tabs" role="tablist">
          {([["all", "Everyone"], ["creator", "Creators"], ["client", "Clients"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>
      {error && <div className="auth-alert error" role="alert">{error}</div>}
      <div className="msg-people">
        {loading ? <div className="msg-loading"><span className="splash-spinner" /></div>
          : list.length ? list.map((p) => (
            <button key={p.uid} className="msg-person" disabled={!!busy} onClick={() => { setBusy(p.uid); Promise.resolve(onPick(p.uid)).finally(() => setBusy(null)); }}>
              <PersonAvatar entry={p} size={44} />
              <div><b>{p.name}{p.demo && <em className="msg-demo-tag">Demo</em>}</b><span>{p.headline || roleText(p) || "Kreota member"}</span></div>
              <small>{busy === p.uid ? "Opening…" : roleText(p)}</small>
            </button>
          ))
          : <div className="msg-empty small"><b>No one found</b><p>{people.length ? "Try another search or tab." : "Nobody else has joined Kreota yet. Invite a creator or brand to sign up."}</p></div>}
      </div>
    </div>
  );
}

const fileSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function FileBubble({ cid, file, me }: { cid: string; file: FileMeta; me: string }) {
  const isImage = file.type.startsWith("image/");
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isImage) return;
    let live = true;
    loadFileData(cid, me, file.id).then((d) => { if (live) setSrc(d); }).catch((e) => { if (live) setError(describeError(e)); });
    return () => { live = false; };
  }, [cid, me, file.id, isImage]);
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await loadFileData(cid, me, file.id);
      const blob = await (await fetch(data)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="msg-file">
      {isImage && (src ? <button className="msg-file-img" onClick={download} aria-label={`Download ${file.name}`}><img src={src} alt={file.name} /></button> : !error && <div className="msg-file-img loading"><span className="splash-spinner" /></div>)}
      <div className="msg-file-row">
        <span className="msg-file-icon"><Icon name="file" size={18} /></span>
        <div><b title={file.name}>{file.name}</b><span>{fileSize(file.size)}</span></div>
        <button className="msg-file-dl" onClick={download} disabled={busy} aria-label={`Download ${file.name}`}>{busy ? <span className="splash-spinner" /> : <Icon name="download" size={16} />}</button>
      </div>
      {error && <small className="msg-file-error">{error}</small>}
    </div>
  );
}

function Chat({ cid, other, otherId, unread, onBack }: { cid: string; other?: Contact; otherId: string; unread: number; onBack: () => void }) {
  const { user, profile } = useAccount();
  const me = user.uid;
  const demoId = demoIdOf(cid);
  const real = useMessages(demoId ? null : cid);
  const demo = useDemoMessages(demoId ? me : null, demoId);
  const msgs = demoId ? demo : real;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const shareFiles = async (files: File[]) => {
    setError("");
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) { setError(`"${f.name}" is ${fileSize(f.size)}. You can share files up to 5 MB.`); continue; }
      setUploading((u) => [...u, f.name]);
      try {
        if (demoId) await sendDemoFile(me, demoId, f);
        else await sendFile(cid, me, otherId, f);
      } catch (e) {
        const denied = /permission/i.test(`${(e as { code?: string }).code ?? ""} ${(e as Error).message ?? ""}`);
        setError(e instanceof FileTooLargeError ? e.message
          : denied ? "File sharing isn't switched on yet. The Realtime Database rules need the file-sharing update (files and demoFiles) — publish database.rules.json in the Firebase console."
          : describeError(e));
      } finally {
        setUploading((u) => { const i = u.indexOf(f.name); return i < 0 ? u : [...u.slice(0, i), ...u.slice(i + 1)]; });
      }
    }
  };

  // Opening a conversation (or receiving while it's open) clears its unread count.
  useEffect(() => {
    if (unread > 0 && document.visibilityState === "visible") (demoId ? markDemoRead(me, demoId) : markRead(me, cid)).catch(() => {});
  }, [unread, me, cid, demoId, msgs.data.length]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.data.length, cid]);

  useEffect(() => { inputRef.current?.focus(); }, [cid]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !otherId) return;
    setSending(true);
    setError("");
    setDraft("");
    try {
      if (demoId) await sendDemoMessage(me, demoId, text, profile.name, msgs.data.filter((m) => m.senderId === me).length);
      else await sendMessage(cid, me, otherId, text);
    } catch (e) {
      setDraft(text);
      setError(describeError(e));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  let lastDay = "";
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  return (
    <div
      className={`msg-chat${dragging ? " dragging" : ""}`}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={(e) => { if (hasFiles(e)) { e.preventDefault(); setDragging(false); shareFiles(Array.from(e.dataTransfer.files)); } }}
    >
      {dragging && <div className="msg-drop"><Icon name="clip" size={26} /><b>Drop to share</b><span>Files up to 5 MB</span></div>}
      <header className="msg-chat-head">
        <button className="icon-btn msg-back" onClick={onBack} aria-label="Back to conversations"><Icon name="arrow" /></button>
        <PersonAvatar entry={other} />
        <div><b>{other?.name ?? "Kreota member"}</b><span>{[roleText(other), other?.headline].filter(Boolean).join(" · ") || "Kreota member"}</span></div>
      </header>
      {demoId && <p className="msg-demo-note">This is a demo profile, not a real account. Replies are written automatically so you can try messaging.</p>}
      <div className="msg-thread" ref={listRef} aria-live="polite">
        {msgs.loading ? <div className="msg-loading"><span className="splash-spinner" /></div>
          : !msgs.data.length ? <div className="msg-empty small"><b>Start the conversation</b><p>Introduce yourself and what you'd like to create together.</p></div>
          : msgs.data.map((m, i) => {
            const label = m.at ? dayLabel(m.at) : "";
            const showDay = label && label !== lastDay;
            if (showDay) lastDay = label;
            const mine = m.senderId === me;
            const next = msgs.data[i + 1];
            const tail = !next || next.senderId !== m.senderId || (next.at ?? 0) - (m.at ?? 0) > 5 * 60000;
            return (
              <div key={m.id} className="msg-item">
                {showDay && <div className="msg-day"><span>{label}</span></div>}
                <div className={`msg-bubble${mine ? " mine" : ""}${tail ? " tail" : ""}`}>
                  {m.file && <FileBubble cid={cid} file={m.file} me={me} />}
                  {m.text && <p>{m.text}</p>}
                  {tail && <time>{"auto" in m && m.auto ? "Automatic reply · " : ""}{m.at ? new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}</time>}
                </div>
              </div>
            );
          })}
      </div>
      {error && <div className="auth-alert error msg-error" role="alert">{error}</div>}
      {uploading.length > 0 && <div className="msg-uploading">{uploading.map((n, i) => <span key={n + i}><span className="splash-spinner" /> Sending {n}…</span>)}</div>}
      <form className="msg-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => { shareFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        <button type="button" className="msg-attach" onClick={() => fileRef.current?.click()} aria-label="Share a file" title="Share a file (up to 5 MB)"><Icon name="clip" size={19} /></button>
        <textarea
          ref={inputRef}
          value={draft}
          rows={1}
          maxLength={4000}
          placeholder={`Message ${other?.name?.split(" ")[0] ?? ""}…`}
          aria-label="Message"
          onChange={(e) => { setDraft(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
        />
        <button type="submit" className="msg-send" disabled={!draft.trim() || sending} aria-label="Send message"><Icon name="send" size={18} /></button>
      </form>
    </div>
  );
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
  const readyProfile = session.status === "signedIn" && session.profile?.role && session.profile.onboarded?.[session.profile.role] ? session.profile : null;
  useEffect(() => { if (readyProfile) publishDirectoryEntry(readyProfile); }, [readyProfile]);
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
