import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import Studio from "./studio/Studio";
import {
  completeOnboarding, describeError, resendVerification, resetPassword, saveOnboardingStep, setRole, signInWithEmail,
  createProject, deleteProject, deleteStrategy, saveStrategy, saveProfileFields, seedInterested, seedSampleProject, setListed, updateProject, type ClientProject, type ProjectDraft, type ProjectStatus, signInWithGoogle, signOutUser, signUpWithEmail, updateDisplayName, useSession, type FormValues, type Profile, type Role,
} from "./session";
import { OPTIONS, ROLE_FIELDS, toLink, type FieldSection } from "./profileFields";
import { between, CLIENTS, CREATORS, roundTo, seeded, formatCount, formatINR, formatINRShort, matchScore, totalFollowers, type SeedClient, type SeedCreator } from "./data/india";
import { creatorAvatar } from "./data/avatars";
import { generateStrategy, strategyToMarkdown, type Engine, type Strategy, type StrategyInput } from "./strategy";
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

interface Shell { role: Role; onSwitch: () => void; openProfile: () => void; openChat: (id: string) => void; pendingChat: string | null; clearPendingChat: () => void }
const ShellContext = createContext<Shell>({ role: "client", onSwitch: () => {}, openProfile: () => {}, openChat: () => {}, pendingChat: null, clearPendingChat: () => {} });

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

const QUICK_PROMPTS: [string, string][] = [
  ["Product launch", "Launch our new product to young Indians in metros with honest creator reviews and a strong first-week buzz."],
  ["Festive campaign", "Plan a Diwali festive gifting campaign that makes our products the go-to gift, with regional creators across India."],
  ["UGC ads", "Create UGC-style short videos we can run as performance ads to drive orders with creator discount codes."],
  ["Regional reach", "Grow in Tier 2 cities with Hindi, Tamil and Telugu creators who explain our product in local language."],
];
const WS_PLATFORMS = ["Instagram", "YouTube Shorts", "YouTube", "Moj", "Josh", "ShareChat", "LinkedIn"];
const WS_LANGUAGES = ["Hindi", "English", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati", "Punjabi"];

interface WsResult { input: StrategyInput; strategy: Strategy; engine: Engine; notice?: string; savedId?: string; model?: string; appCheckToken?: string }

function ClientHome({ goCreators, goProjects }: { goCreators: () => void; goProjects: () => void }) {
  const { user, profile } = useAccount();
  const cl = profile.client ?? {};
  const [prompt, setPrompt] = useState("");
  const [objective, setObjective] = useState((cl.goal as string) || OPTIONS.goal[0]);
  const [budget, setBudget] = useState("150000");
  const [weeks, setWeeks] = useState(4);
  const [platforms, setPlatforms] = useState<string[]>(CHANNEL_PLATFORMS[cl.channels as string] ?? ["Instagram", "YouTube Shorts"]);
  const [languages, setLanguages] = useState<string[]>(["Hindi", "English"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WsResult | null>(null);
  const saved = Object.entries(profile.strategies ?? {}).map(([id, s]) => ({ id, ...s })).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const generate = async () => {
    const amount = Number(budget.replace(/[^\d]/g, ""));
    if (prompt.trim().length < 12) { setError("Describe what you want to create in a sentence or two."); return; }
    if (!amount || amount < 5000) { setError("Enter a budget of at least ₹5,000."); return; }
    if (!platforms.length) { setError("Pick at least one platform."); return; }
    setError("");
    setBusy(true);
    const input: StrategyInput = {
      prompt: prompt.trim(), objective, budget: amount, weeks, platforms, languages,
      brand: (cl.brand as string) || "", industry: (cl.industry as string) || "", description: (cl.description as string) || "", tone: (cl.tone as string) || "",
    };
    try {
      const r = await generateStrategy(input);
      setResult({ input, ...r });
      setTimeout(() => document.querySelector(".ws-report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return <>
    <Topbar title={`${greeting()}, ${firstName(profile)}.`} subtitle="What are we creating today?" />
    <div className="page-content client-home ws">
      <section className="ai-composer ws-composer">
        <div className="composer-label"><Icon name="spark" /><span>KREOTA INTELLIGENCE</span><em className="ws-engine">Gemini · with built-in planner fallback</em></div>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your product, audience and what you want to create…" aria-label="Describe your campaign" maxLength={1500} />
        <div className="ws-chips">{QUICK_PROMPTS.map(([label, text]) => <button key={label} onClick={() => setPrompt(text)}>{label}</button>)}</div>
        <div className="ws-settings">
          <label>Objective<select value={objective} onChange={(e) => setObjective(e.target.value)}>{OPTIONS.goal.map((g) => <option key={g}>{g}</option>)}</select></label>
          <label>Budget (₹)<input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
          <label>Timeline<select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>{[2, 3, 4, 6, 8].map((w) => <option key={w} value={w}>{w} weeks</option>)}</select></label>
        </div>
        <div className="ws-pickers">
          <div><span>Platforms</span><ChipPicker label="Platforms" options={WS_PLATFORMS} value={platforms} onChange={setPlatforms} /></div>
          <div><span>Languages</span><ChipPicker label="Languages" options={WS_LANGUAGES} value={languages} onChange={setLanguages} /></div>
        </div>
        {error && <div className="ws-error" role="alert">{error}</div>}
        <div className="composer-footer">
          <span className="ws-hint">Uses your brand profile{cl.brand ? ` (${cl.brand as string})` : ""} and Kreota's creator data.</span>
          <Button kind="accent" onClick={generate}>{busy ? <><span className="splash-spinner ws-spin" /> Writing strategy…</> : <><Icon name="spark" size={16} /> {result ? "Regenerate" : "Generate strategy"}</>}</Button>
        </div>
      </section>

      {busy && !result && <div className="ws-loading"><span className="splash-spinner" /><p>Writing your strategy — audience, hooks, content plan and budget…</p></div>}

      {result ? (
        <StrategyView
          r={result}
          onClose={() => setResult(null)}
          onSaved={(id) => setResult((x) => (x ? { ...x, savedId: id } : x))}
          goCreators={goCreators}
          goProjects={goProjects}
        />
      ) : (
        <>
          {saved.length > 0 && (
            <section className="ws-saved">
              <div className="section-title"><div><h2>Saved strategies</h2><p>Plans you've kept from the AI workspace.</p></div></div>
              <div className="ws-saved-grid">{saved.slice(0, 6).map((s) => (
                <article key={s.id} className="ws-saved-card">
                  <span className={`ws-badge ${s.engine}`}>{s.engine === "gemini" ? "Gemini" : "Kreota planner"}</span>
                  <b>{s.strategy.title}</b>
                  <p>{s.strategy.summary}</p>
                  <small>{fmtWhen(s.createdAt)} · {formatINRShort(s.input.budget)} · {s.input.weeks} weeks</small>
                  <div className="ws-saved-actions">
                    <Button kind="dark" onClick={() => setResult({ input: s.input, strategy: s.strategy, engine: s.engine, savedId: s.id })}>Open</Button>
                    <button className="text-button" onClick={() => { if (window.confirm("Delete this saved strategy?")) deleteStrategy(user.uid, s.id); }}>Delete</button>
                  </div>
                </article>
              ))}</div>
            </section>
          )}
          <DashboardOverview goCreators={goCreators} goProjects={goProjects} />
        </>
      )}
    </div>
  </>;
}

function StrategyView({ r, onClose, onSaved, goCreators, goProjects }: { r: WsResult; onClose: () => void; onSaved: (id: string) => void; goCreators: () => void; goProjects: () => void }) {
  const { user } = useAccount();
  const { openChat } = useContext(ShellContext);
  const { strategy: s, input } = r;
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const want = { niches: s.creatorNiches, platforms: input.platforms, languages: input.languages, budgetMax: input.budget * 0.6 };
  const creators = CREATORS.map((c) => ({ c, score: matchScore(c, want) })).sort((a, b) => b.score - a.score).slice(0, 4);
  const colors = ["#cdfc82", "#e9e1ff", "#ffeadc", "#e0efff", "#fdf0c4", "#ffe0ea"];

  const save = async () => {
    setBusy("save");
    try { onSaved(await saveStrategy(user.uid, { input, strategy: s, engine: r.engine })); setMsg("Saved to your workspace."); }
    catch (e) { setMsg(describeError(e)); }
    finally { setBusy(""); }
  };
  const toProject = async () => {
    setBusy("project");
    try {
      const deliverables = s.contentPlan.map((c) => `${c.count} × ${c.format} on ${c.platform} (${c.length})`);
      await createProject(user.uid, {
        title: s.title.slice(0, 120), objective: s.summary, deliverables,
        platforms: [...new Set([...input.platforms, ...s.contentPlan.map((c) => c.platform).filter((p) => PLATFORMS.includes(p))])],
        niches: s.creatorNiches.slice(0, 5), languages: input.languages,
        budgetMin: roundTo(input.budget * 0.6, 1000), budgetMax: input.budget,
        deadline: new Date(Date.now() + input.weeks * 7 * 86400000).toISOString().slice(0, 10),
        creatorsNeeded: Math.max(2, Math.min(6, s.contentPlan.length)), status: "draft",
      });
      goProjects();
    } catch (e) {
      setMsg(describeError(e));
      setBusy("");
    }
  };
  const download = () => {
    const blob = new Blob([strategyToMarkdown(s, input)], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${s.title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "strategy"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  return (
    <section className="ws-report" aria-label="Campaign strategy">
      {r.notice && (
        <div className="ws-notice" role="status">
          <Icon name="spark" size={14} />
          <div>
            <span>{r.notice}{r.notice.includes("isn't switched on") && <> <a href="https://console.firebase.google.com/project/kreota-83c24/ailogic/" target="_blank" rel="noopener noreferrer">Turn on Gemini →</a></>}</span>
            {r.appCheckToken && (
              <div className="ws-token">
                <code>{r.appCheckToken}</code>
                <button onClick={() => navigator.clipboard?.writeText(r.appCheckToken!).then(() => setMsg("Debug token copied."))}>Copy</button>
                <a href="https://console.firebase.google.com/project/kreota-83c24/appcheck/apps" target="_blank" rel="noopener noreferrer">Open App Check →</a>
              </div>
            )}
          </div>
        </div>
      )}
      <header className="ws-head">
        <div>
          <span className={`ws-badge ${r.engine}`}>{r.engine === "gemini" ? `Written by Gemini${r.model ? ` · ${r.model}` : ""}` : "Kreota planner"}</span>
          <h2>{s.title}</h2>
          <p>{s.summary}</p>
          <div className="op2-tags"><span className="plat">{formatINR(input.budget)}</span><span className="plat">{input.weeks} weeks</span>{input.platforms.map((p) => <span key={p}>{p}</span>)}{input.languages.map((l) => <span key={l}>{l}</span>)}</div>
        </div>
        <div className="ws-head-actions">
          <Button kind="accent" onClick={toProject}>{busy === "project" ? "Creating…" : <>Turn into project <Icon name="arrow" size={15} /></>}</Button>
          <Button kind="light" onClick={save}>{r.savedId ? <><Icon name="check" size={15} /> Saved</> : busy === "save" ? "Saving…" : "Save"}</Button>
          <Button kind="light" onClick={download}><Icon name="download" size={15} /> Download</Button>
          <button className="text-button" onClick={onClose}>Close</button>
        </div>
      </header>
      {msg && <p className="ws-msg">{msg}</p>}

      <div className="ws-grid">
        <section className="ws-card ws-audience">
          <h3><Icon name="users" size={16} /> Audience</h3>
          <p className="ws-big">{s.audience.primary}</p>
          <p className="ws-insight"><b>Insight</b> {s.audience.insight}</p>
        </section>

        <section className="ws-card ws-hooks">
          <h3><Icon name="spark" size={16} /> Hooks to test</h3>
          <ol>{s.hooks.map((h, i) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span>{h}</li>)}</ol>
        </section>

        <section className="ws-card ws-wide">
          <h3>Messaging pillars</h3>
          <div className="ws-pillars">{s.pillars.map((p, i) => <article key={i} style={{ background: colors[(i + 1) % colors.length] }}><b>{p.name}</b><p>{p.message}</p></article>)}</div>
        </section>

        <section className="ws-card ws-wide">
          <h3><Icon name="video" size={16} /> Content plan</h3>
          <div className="dc-table-wrap ws-table-wrap">
            <table className="dc-table ws-table">
              <thead><tr><th>Format</th><th>Platform</th><th>Count</th><th>Length</th><th>Purpose</th></tr></thead>
              <tbody>{s.contentPlan.map((c, i) => <tr key={i}><td><b>{c.format}</b></td><td>{c.platform}</td><td>{c.count}</td><td>{c.length}</td><td>{c.purpose}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="ws-card">
          <h3>Creative direction</h3>
          <dl className="ws-dl">
            <div><dt>Mood</dt><dd>{s.creative.mood}</dd></div>
            <div><dt>Visuals</dt><dd>{s.creative.visuals}</dd></div>
            <div><dt>Tone</dt><dd>{s.creative.tone}</dd></div>
          </dl>
          <h4>Avoid</h4>
          <div className="op2-tags">{s.creative.avoid.map((a) => <span key={a} className="ws-avoid">{a}</span>)}</div>
        </section>

        <section className="ws-card">
          <h3><Icon name="calendar" size={16} /> Timeline</h3>
          <ol className="ws-timeline">{s.timeline.map((t, i) => <li key={i}><b>{t.week}</b><span>{t.focus}</span></li>)}</ol>
        </section>

        <section className="ws-card">
          <h3>Budget split</h3>
          <div className="ws-bar" role="img" aria-label="Budget split">{s.budget.map((b, i) => <span key={b.item} style={{ width: `${b.percent}%`, background: colors[i % colors.length] }} title={`${b.item} ${b.percent}%`} />)}</div>
          <ul className="ws-budget">{s.budget.map((b, i) => <li key={b.item}><i style={{ background: colors[i % colors.length] }} /><span>{b.item}</span><b>{b.percent}%</b><em>{formatINRShort(Math.round((input.budget * b.percent) / 100))}</em></li>)}</ul>
        </section>

        <section className="ws-card">
          <h3>KPIs</h3>
          <div className="ws-kpis">{s.kpis.map((k) => <div key={k.metric}><span>{k.metric}</span><b>{k.target}</b></div>)}</div>
        </section>

        <section className="ws-card">
          <h3>Risks to watch</h3>
          <ul className="ws-list warn">{s.risks.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>

        <section className="ws-card">
          <h3>Next actions</h3>
          <ul className="ws-list">{s.nextActions.map((x) => <li key={x}><Icon name="check" size={14} /> {x}</li>)}</ul>
        </section>

        <section className="ws-card ws-wide">
          <div className="panel-head"><div><span>MATCHED TO THIS STRATEGY</span><h3>Creators to brief</h3></div><button className="text-button" onClick={goCreators}>Discover more <Icon name="arrow" size={14} /></button></div>
          <div className="ws-creators">{creators.map(({ c, score }) => (
            <article key={c.id}>
              <img src={creatorAvatar(c)} alt="" />
              <div><b>{c.name}</b><span>{c.title} · {c.city}</span><span>{rateRange(c)} · {c.niches.slice(0, 2).join(", ")}</span></div>
              <span className={`op2-match ${matchTone(score)}`}>{score}%</span>
              <button className="ws-msg-btn" onClick={() => openChat(c.id)} aria-label={`Message ${c.name}`}><Icon name="chat" size={15} /></button>
            </article>
          ))}</div>
        </section>
      </div>
    </section>
  );
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

/** First visit to Overview or Opportunities: shortlist the top 3 briefs once per account, so both pages start with data. */
function useStarterShortlist(scores: Map<string, number>) {
  const { user, profile } = useAccount();
  useEffect(() => {
    if (profile.seeded?.interested) return;
    const top = [...scores].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
    seedInterested(user.uid, top).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.seeded?.interested, user.uid]);
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
type CreatorView = "recommended" | "all" | "available" | "saved";

/** Project ids this creator has been invited to. */
const projectsInviting = (projects: ProjectWithId[], id: string) => projects.filter((p) => p.invited?.[id]);

function CreatorMarketplace({ goProjects }: { goProjects: () => void }) {
  const { user, profile } = useAccount();
  const { openChat } = useContext(ShellContext);
  const want = clientWant(profile);
  const saved = profile.shortlist ?? {};
  const projects = projectsOf(profile);
  const [view, setView] = useState<CreatorView>("recommended");
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("");
  const [platform, setPlatform] = useState("");
  const [maxRate, setMaxRate] = useState(0);
  const [sort, setSort] = useState<CreatorSort>("match");
  const [open, setOpen] = useState<SeedCreator | null>(null);
  const [inviting, setInviting] = useState<SeedCreator | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const scored = useMemo(() => CREATORS.map((c) => ({ c, score: matchScore(c, want) })), [want.niches.join(), want.platforms.join()]);
  const recommended = [...scored].sort((a, b) => b.score - a.score).slice(0, 12);
  const strong = scored.filter((x) => x.score >= 85);
  const available = scored.filter((x) => x.c.availability === "Available now");
  const savedList = scored.filter((x) => saved[x.c.id]);
  const invitedIds = new Set(projects.flatMap((p) => keysOf(p.invited)));
  const base = view === "recommended" ? recommended : view === "available" ? available : view === "saved" ? savedList : scored;

  const needle = q.trim().toLowerCase();
  const list = base
    .filter(({ c }) => !needle || `${c.name} ${c.handle} ${c.title} ${c.city} ${c.state} ${c.niches.join(" ")} ${c.languages.join(" ")}`.toLowerCase().includes(needle))
    .filter(({ c }) => !niche || c.niches.includes(niche))
    .filter(({ c }) => !city || c.city === city)
    .filter(({ c }) => !language || c.languages.includes(language))
    .filter(({ c }) => !platform || c.platforms.some((p) => p.name === platform))
    .filter(({ c }) => !maxRate || c.rateFrom <= maxRate)
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
  const filtersOn = !!(q || niche || city || language || platform || maxRate);
  const reset = () => { setQ(""); setNiche(""); setCity(""); setLanguage(""); setPlatform(""); setMaxRate(0); };
  const toggleSave = (c: SeedCreator) => setListed(user.uid, "shortlist", c.id, !saved[c.id]);
  const toggleCompare = (id: string) => setCompare((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length >= 3 ? xs : [...xs, id]));
  const sortLabel = { match: "best match", followers: "most followers", engagement: "highest engagement", rating: "top rated", priceLow: "price: low to high", priceHigh: "price: high to low" }[sort];
  const tabs: [CreatorView, string, number][] = [["recommended", "Recommended for you", recommended.length], ["all", "All creators", scored.length], ["available", "Available now", available.length], ["saved", "Saved", savedList.length]];
  const brand = (profile.client?.brand as string) || "your brand";

  return <>
    <Topbar title="Discover creators" subtitle={`Indian creators matched to ${brand}.`} />
    <div className="page-content op2 dc">
      <section className="op2-stats" aria-label="Summary">
        <div><span>Creators on Kreota</span><b>{CREATORS.length}</b><small>Across {new Set(CREATORS.map((c) => c.city)).size} cities · sample profiles</small></div>
        <div className="mint"><span>Strong matches</span><b>{strong.length}</b><small>85%+ fit with {brand}</small></div>
        <div className="lilac"><span>Saved</span><b>{savedList.length}</b><small>{savedList.length ? "Your shortlist of creators" : "Tap ☆ to save a creator"}</small></div>
        <div className="peach"><span>Invited to projects</span><b>{invitedIds.size}</b><small>{projects.length ? `Across ${projects.length} project${projects.length === 1 ? "" : "s"}` : "Create a project to invite"}</small></div>
      </section>

      <div className="op2-tabs" role="tablist" aria-label="Creator views">
        {tabs.map(([id, label, n]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? "on" : ""} onClick={() => setView(id)}>{label}<i>{n}</i></button>)}
      </div>

      <div className="op2-toolbar dc-toolbar">
        <div className="search-box"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, city, niche or language…" aria-label="Search creators" /></div>
        <select value={niche} onChange={(e) => setNiche(e.target.value)} aria-label="Niche"><option value="">All niches</option>{uniq(CREATORS.flatMap((c) => c.niches)).map((n) => <option key={n}>{n}</option>)}</select>
        <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City"><option value="">All cities</option>{uniq(CREATORS.map((c) => c.city)).map((n) => <option key={n}>{n}</option>)}</select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language"><option value="">All languages</option>{uniq(CREATORS.flatMap((c) => c.languages)).map((n) => <option key={n}>{n}</option>)}</select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform"><option value="">All platforms</option>{uniq(CREATORS.flatMap((c) => c.platforms.map((p) => p.name))).map((n) => <option key={n}>{n}</option>)}</select>
        <select value={maxRate} onChange={(e) => setMaxRate(Number(e.target.value))} aria-label="Budget"><option value={0}>Any budget</option>{[15_000, 30_000, 60_000, 1_00_000, 2_00_000].map((n) => <option key={n} value={n}>Starts under {formatINRShort(n)}</option>)}</select>
        <select value={sort} onChange={(e) => setSort(e.target.value as CreatorSort)} aria-label="Sort">
          <option value="match">Sort: Best match</option><option value="followers">Sort: Most followers</option><option value="engagement">Sort: Engagement</option>
          <option value="rating">Sort: Top rated</option><option value="priceLow">Sort: Price low–high</option><option value="priceHigh">Sort: Price high–low</option>
        </select>
      </div>

      <div className="op2-count">
        <span>Showing <b>{list.length}</b> creator{list.length === 1 ? "" : "s"} · sorted by {sortLabel}</span>
        {filtersOn && <button className="text-button" onClick={reset}>Clear filters</button>}
      </div>

      {list.length ? (
        <div className="dc-grid">{list.map(({ c, score }) => {
          const invitedTo = projectsInviting(projects, c.id);
          const inCompare = compare.includes(c.id);
          return (
            <article className={`dc-card${inCompare ? " comparing" : ""}`} key={c.id}>
              <div className="dc-photo">
                <button className="dc-photo-btn" onClick={() => setOpen(c)} aria-label={`View ${c.name}'s profile`}><img src={creatorAvatar(c)} alt="" loading="lazy" /></button>
                <span className={`op2-match ${matchTone(score)}`}><Icon name="spark" size={12} />{score}% match</span>
                <button className={`dc-save${saved[c.id] ? " on" : ""}`} onClick={() => toggleSave(c)} aria-pressed={!!saved[c.id]} aria-label={saved[c.id] ? `Remove ${c.name} from saved` : `Save ${c.name}`}><Icon name="star" size={16} /></button>
                <span className={`mk-avail${c.availability === "Available now" ? " now" : ""}`}>{c.availability}</span>
              </div>
              <div className="dc-body">
                <div className="dc-name">
                  <button onClick={() => setOpen(c)}>{c.name}</button>{c.verified && <span className="mk-verified" title="Verified">✓</span>}
                </div>
                <p className="dc-sub">{c.title} · {c.city}</p>
                <dl className="dc-stats">
                  <div><dt>Reach</dt><dd>{formatCount(totalFollowers(c))}</dd></div>
                  <div><dt>Engagement</dt><dd>{c.engagement}%</dd></div>
                  <div><dt>Rating</dt><dd>{c.rating}★</dd></div>
                </dl>
                <div className="op2-tags">{c.niches.slice(0, 3).map((t) => <span key={t}>{t}</span>)}</div>
                <p className="dc-rate"><b>{rateRange(c)}</b> per project · {c.turnaroundDays}-day turnaround</p>
                {invitedTo.length > 0 && <p className="dc-invited"><Icon name="check" size={13} /> Invited to {invitedTo.length === 1 ? invitedTo[0].title : `${invitedTo.length} projects`}</p>}
                <div className="dc-actions">
                  <Button kind="dark" onClick={() => setInviting(c)}>{invitedTo.length ? "Manage invites" : "Invite"}</Button>
                  <Button kind="light" onClick={() => openChat(c.id)}><Icon name="chat" size={15} /> Message</Button>
                </div>
                <label className="dc-compare"><input type="checkbox" checked={inCompare} disabled={!inCompare && compare.length >= 3} onChange={() => toggleCompare(c.id)} /> Compare</label>
              </div>
            </article>
          );
        })}</div>
      ) : (
        <div className="mk-empty">
          <Icon name={view === "saved" && !filtersOn ? "star" : "search"} size={26} />
          <b>{view === "saved" && !filtersOn ? "No saved creators yet" : "No creators match these filters"}</b>
          <p>{view === "saved" && !filtersOn ? "Tap ☆ on a creator to keep them here." : "Try removing a filter or searching a different city or niche."}</p>
          {filtersOn ? <Button kind="light" onClick={reset}>Clear filters</Button> : view !== "all" && <Button kind="light" onClick={() => setView("all")}>See all creators</Button>}
        </div>
      )}
    </div>

    {compare.length > 0 && !comparing && !open && !inviting && (
      <div className="dc-compare-bar" role="region" aria-label="Compare creators">
        <div className="dc-compare-faces">{compare.map((id) => { const c = CREATORS.find((x) => x.id === id)!; return <img key={id} src={creatorAvatar(c)} alt={c.name} title={c.name} />; })}</div>
        <span>{compare.length} of 3 selected</span>
        <button className="text-button" onClick={() => setCompare([])}>Clear</button>
        <Button kind="accent" onClick={() => setComparing(true)} >Compare {compare.length > 1 ? `${compare.length} creators` : ""}</Button>
      </div>
    )}

    {open && <CreatorDrawer c={open} score={matchScore(open, want)} reasons={matchReasons(open, want)} saved={!!saved[open.id]} invited={projectsInviting(projects, open.id).length > 0} onSave={() => toggleSave(open)} onInvite={() => setInviting(open)} onMessage={() => openChat(open.id)} onClose={() => setOpen(null)} />}
    {inviting && <InvitePicker c={inviting} projects={projects} onClose={() => setInviting(null)} goProjects={goProjects} />}
    {comparing && <CompareDrawer ids={compare} want={want} onClose={() => setComparing(false)} onInvite={(c) => { setComparing(false); setInviting(c); }} />}
  </>;
}

function InvitePicker({ c, projects, onClose, goProjects }: { c: SeedCreator; projects: ProjectWithId[]; onClose: () => void; goProjects: () => void }) {
  const { user } = useAccount();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const usable = projects.filter((p) => p.status !== "completed");
  const toggle = async (p: ProjectWithId) => {
    setBusy(p.id);
    setError("");
    try {
      if (p.invited?.[c.id]) await updateProject(user.uid, p.id, { [`invited/${c.id}`]: null, [`shortlisted/${c.id}`]: null });
      else await updateProject(user.uid, p.id, { [`invited/${c.id}`]: Date.now(), ...(p.status === "draft" ? { status: "open", "milestones/publishedAt": Date.now() } : {}) });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy("");
    }
  };
  return (
    <Drawer label={`Invite ${c.name}`} onClose={onClose}>
      <header className="mk-person">
        <img src={creatorAvatar(c)} alt="" />
        <div><h2>Invite {c.name}</h2><p>{c.title} · {rateRange(c)} per project</p><p className="mk-muted">Choose the projects to invite them to. Their proposal appears inside each project.</p></div>
      </header>
      {error && <div className="auth-alert error" role="alert">{error}</div>}
      {usable.length ? (
        <div className="dc-pick">{usable.map((p) => {
          const on = !!p.invited?.[c.id];
          const hired = !!p.hired?.[c.id];
          const fit = matchScore(c, { niches: p.niches, platforms: p.platforms, languages: p.languages, budgetMax: p.budgetMax });
          return (
            <div key={p.id} className={`dc-pick-row${on ? " on" : ""}`}>
              <div>
                <b>{p.title}</b>
                <span>{STATUS_LABEL[p.status]} · {formatINRShort(p.budgetMin)} – {formatINRShort(p.budgetMax)} · {dueLabel(p)}</span>
                {c.rateFrom > p.budgetMax && <small className="dc-warn">Their rate starts above this budget</small>}
              </div>
              <span className={`op2-match ${matchTone(fit)}`}>{fit}% fit</span>
              {hired ? <span className="pj-tag hired">Hired</span>
                : <Button kind={on ? "light" : "dark"} onClick={() => toggle(p)}>{busy === p.id ? "Saving…" : on ? <><Icon name="check" size={14} /> Invited</> : p.status === "draft" ? "Publish & invite" : "Invite"}</Button>}
            </div>
          );
        })}</div>
      ) : (
        <div className="ov-empty"><Icon name="brief" size={22} /><p>You don't have a live project yet. Create one, then invite {c.name.split(" ")[0]}.</p></div>
      )}
      <div className="mk-actions"><Button kind="light" icon="plus" onClick={() => { onClose(); goProjects(); }}>New project</Button></div>
    </Drawer>
  );
}

function CompareDrawer({ ids, want, onClose, onInvite }: { ids: string[]; want: ReturnType<typeof clientWant>; onClose: () => void; onInvite: (c: SeedCreator) => void }) {
  const people = ids.map((id) => CREATORS.find((c) => c.id === id)!).filter(Boolean);
  // Every creator tied for the best value in a row gets highlighted.
  const best = (vals: number[], high = true) => { const top = high ? Math.max(...vals) : Math.min(...vals); return vals.map((v) => v === top); };
  const rows: [string, (c: SeedCreator) => string, boolean[] | null][] = [
    ["Match", (c) => `${matchScore(c, want)}%`, best(people.map((c) => matchScore(c, want)))],
    ["Typical project", (c) => rateRange(c), best(people.map((c) => c.rateFrom), false)],
    ["Total reach", (c) => formatCount(totalFollowers(c)), best(people.map(totalFollowers))],
    ["Avg. views", (c) => formatCount(c.avgViews), best(people.map((c) => c.avgViews))],
    ["Engagement", (c) => `${c.engagement}%`, best(people.map((c) => c.engagement))],
    ["Rating", (c) => `${c.rating}★ (${c.reviews})`, best(people.map((c) => c.rating * 1000 + c.reviews))],
    ["Turnaround", (c) => `${c.turnaroundDays} days`, best(people.map((c) => c.turnaroundDays), false)],
    ["Projects done", (c) => String(c.projects), best(people.map((c) => c.projects))],
    ["Availability", (c) => c.availability, null],
    ["Based in", (c) => c.city, null],
    ["Languages", (c) => c.languages.join(", "), null],
    ["Niches", (c) => c.niches.join(", "), null],
    ["Platforms", (c) => c.platforms.map((p) => p.name).join(", "), null],
  ];
  return (
    <Drawer label="Compare creators" onClose={onClose}>
      <h2 className="pj-form-title">Compare creators</h2>
      <p className="mk-muted pj-form-sub">The best value in each row is highlighted.</p>
      <div className="dc-table-wrap">
        <table className="dc-table">
          <thead><tr><th />{people.map((c) => <th key={c.id}><img src={creatorAvatar(c)} alt="" /><b>{c.name}</b><span>{c.title}</span></th>)}</tr></thead>
          <tbody>
            {rows.map(([label, get, win]) => <tr key={label}><th scope="row">{label}</th>{people.map((c, i) => <td key={c.id} className={people.length > 1 && win?.[i] ? "win" : ""}>{get(c)}</td>)}</tr>)}
            <tr><th scope="row" />{people.map((c) => <td key={c.id}><Button kind="dark" onClick={() => onInvite(c)}>Invite</Button></td>)}</tr>
          </tbody>
        </table>
      </div>
    </Drawer>
  );
}

function CreatorDrawer({ c, score, reasons, saved, invited, onSave, onInvite, onMessage, onClose }: { c: SeedCreator; score: number; reasons: string[]; saved: boolean; invited: boolean; onSave: () => void; onInvite: () => void; onMessage?: () => void; onClose: () => void }) {
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
        {onMessage && <Button kind="light" onClick={onMessage}><Icon name="chat" size={15} /> Message</Button>}
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
  useStarterShortlist(scores);
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

function DashboardOverview({ goCreators, goProjects }: { goCreators: () => void; goProjects: () => void }) {
  const { profile } = useAccount();
  const projects = projectsOf(profile);
  const live = projects.filter((p) => p.status === "open" || p.status === "in_progress");
  const proposals = projects.filter((p) => p.status === "open").reduce((n, p) => n + keysOf(p.invited).length, 0);
  const want = clientWant(profile);
  const strongCreators = CREATORS.filter((c) => matchScore(c, want) >= 85).length;
  const saved = keysOf(profile.shortlist);
  const latest = live[0];
  const stage = latest ? stageOf(latest) : 0;
  const people = latest ? [...keysOf(latest.hired), ...keysOf(latest.invited)].filter((v, i, a) => a.indexOf(v) === i).map((id) => CREATORS.find((c) => c.id === id)).filter(Boolean) as SeedCreator[] : [];
  return <>
    <div className="section-title"><div><h2>Your creative workspace</h2><p>Everything moving forward, at a glance.</p></div><button className="text-button" onClick={goProjects}>All projects <Icon name="arrow" size={15} /></button></div>
    <div className="metric-grid">
      <button className="metric-card mint" onClick={goProjects}><span>ACTIVE PROJECTS</span><b>{String(live.length).padStart(2, "0")}</b><p>{projects.filter((p) => p.status === "draft").length} draft · {projects.filter((p) => p.status === "completed").length} completed</p></button>
      <button className="metric-card lilac" onClick={goCreators}><span>CREATOR MATCHES</span><b>{String(strongCreators).padStart(2, "0")}</b><p>85%+ fit with your brand</p></button>
      <button className="metric-card peach" onClick={goProjects}><span>PROPOSALS TO REVIEW</span><b>{String(proposals).padStart(2, "0")}</b><p>Across your open projects</p></button>
      <button className="metric-card dark" onClick={goCreators}><span>SAVED CREATORS</span><b>{String(saved.length).padStart(2, "0")}</b><p>{new Set(projects.flatMap((p) => keysOf(p.invited))).size} invited to projects</p></button>
    </div>
    <div className="dashboard-grid">
      {latest ? (
        <section className="panel project-panel">
          <div className="panel-head"><div><span className="status-dot" /> {STATUS_LABEL[latest.status].toUpperCase()}</div><button className="text-button" onClick={goProjects}>Open <Icon name="arrow" size={14} /></button></div>
          <h3>{latest.title}</h3><p>{latest.objective}</p>
          <div className="progress-label"><span>{stageLabel(stage)}</span><b>{Math.round((stage / 6) * 100)}%</b></div>
          <div className="progress"><span style={{ width: `${(stage / 6) * 100}%` }} /></div>
          <div className="project-meta"><span><Icon name="calendar" size={15} /> {dueLabel(latest)}</span><div className="avatar-stack small">{people.slice(0, 4).map((c) => <img src={creatorAvatar(c)} key={c.id} alt="" />)}</div></div>
        </section>
      ) : (
        <section className="panel project-panel">
          <div className="panel-head"><div><span className="status-dot" /> NO LIVE PROJECTS</div></div>
          <h3>Start your first project</h3><p>Write a brief, invite matched creators and compare proposals side by side.</p>
          <div className="project-meta"><Button icon="plus" onClick={goProjects}>New project</Button></div>
        </section>
      )}
      <section className="panel recommendations"><div className="panel-head"><div><span>AI RECOMMENDED</span><h3>Creators for you</h3></div><button className="text-button" onClick={goCreators}>See all <Icon name="arrow" size={14}/></button></div>{topMatches(profile,3).map(({c,score})=><div className="mini-creator" key={c.id}><img src={creatorAvatar(c)} alt=""/><div><b>{c.name}</b><span>{c.title} · {c.city}</span></div><strong>{score}%</strong></div>)}</section>
    </div>
  </>;
}


/* ---------- client projects ---------- */

type ProjectWithId = ClientProject & { id: string };

const PLATFORMS = ["Instagram", "YouTube", "YouTube Shorts", "Moj", "Josh", "ShareChat", "LinkedIn", "X"];
const LANGUAGES = ["Hindi", "English", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati", "Punjabi"];
const POPULAR_NICHES = (() => {
  const counts = new Map<string, number>();
  for (const c of CREATORS) for (const n of c.niches) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([n]) => n).sort();
})();
const STAGES = ["Brief ready", "Creators invited", "Proposals in", "Creator hired", "First cut", "Final delivery"];
const STATUS_LABEL: Record<ProjectStatus, string> = { draft: "Draft", open: "Open for proposals", in_progress: "In progress", completed: "Completed" };

const listOf = <T,>(v: T[] | Record<string, T> | undefined): T[] => (Array.isArray(v) ? v : v ? Object.values(v) : []);
const keysOf = (v?: Record<string, number>) => Object.keys(v ?? {});

function projectsOf(profile: Profile): ProjectWithId[] {
  return Object.entries(profile.projects ?? {})
    .map(([id, p]) => ({ ...p, id, deliverables: listOf(p.deliverables), platforms: listOf(p.platforms), niches: listOf(p.niches), languages: listOf(p.languages) }))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/** How far along a project is, as an index into STAGES (0–6). */
function stageOf(p: ClientProject) {
  if (p.status === "completed" || p.milestones?.final) return 6;
  if (p.milestones?.firstCut) return 5;
  if (keysOf(p.hired).length) return 4;
  if (keysOf(p.invited).length) return 3;
  if (p.status !== "draft") return 1;
  return 0;
}

/** The last finished step, e.g. "Proposals in". */
const stageLabel = (stage: number) => (stage <= 0 ? "Draft" : stage >= 6 ? "Delivered" : STAGES[stage - 1]);
const daysUntil = (date: string) => Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000);
const dueLabel = (p: ClientProject) => {
  if (p.status === "completed") return "Completed";
  const d = daysUntil(p.deadline);
  return d < 0 ? `Overdue by ${-d} day${d === -1 ? "" : "s"}` : d === 0 ? "Due today" : `${d} day${d === 1 ? "" : "s"} left`;
};
const fmtDate = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtWhen = (t?: number) => (t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

interface Proposal { c: SeedCreator; price: number; days: number; revisions: number; pitch: string; score: number; reasons: string[]; at: number }

const HOOKS = [
  "real routines and honest before-and-after moments",
  "a day-in-the-life story with your product as the hero",
  "quick explainers that answer the top three buyer questions",
  "a challenge format your audience can join in",
  "behind-the-scenes storytelling that builds trust",
];

/** A demo creator's proposal for a project: stable for the same creator + project. */
function proposalFor(c: SeedCreator, p: ProjectWithId): Proposal {
  const r = seeded(c.id + p.id);
  const want = { niches: p.niches, platforms: p.platforms, languages: p.languages, budgetMax: p.budgetMax };
  const score = matchScore(c, want);
  const target = between(r, Math.max(c.rateFrom, p.budgetMin * 0.7), Math.min(c.rateTo, Math.max(c.rateFrom * 1.1, p.budgetMax)));
  const price = roundTo(Math.max(c.rateFrom, target), 1000);
  const shared = c.niches.filter((n) => p.niches.includes(n));
  const platform = c.platforms.find((x) => p.platforms.includes(x.name))?.name ?? c.platforms[0].name;
  const langs = c.languages.filter((l) => p.languages.includes(l));
  const pitch = `A ${Math.max(2, p.deliverables.length)}-part ${platform} series built around ${(shared[0] ?? c.niches[0]).toLowerCase()} — ${HOOKS[Math.floor(r() * HOOKS.length)]}. I'll script the first two seconds for retention and deliver in ${(langs.length ? langs : c.languages.slice(0, 1)).join(" and ")}.`;
  const reasons: string[] = [];
  if (shared.length) reasons.push(`Works in ${shared.join(", ").toLowerCase()}`);
  if (c.platforms.some((x) => p.platforms.includes(x.name))) reasons.push(`Strong on ${platform} (${formatCount(c.platforms.find((x) => x.name === platform)?.followers ?? 0)})`);
  reasons.push(price <= p.budgetMax ? "Within your budget" : `${formatINRShort(price - p.budgetMax)} over budget`);
  reasons.push(`${c.rating}★ from ${c.reviews} reviews`);
  return { c, price, days: c.turnaroundDays + Math.floor(r() * 5), revisions: 1 + Math.floor(r() * 3), pitch, score, reasons, at: p.invited?.[c.id] ?? 0 };
}

function projectProposals(p: ProjectWithId) {
  return keysOf(p.invited)
    .map((id) => CREATORS.find((c) => c.id === id))
    .filter((c): c is SeedCreator => !!c)
    .map((c) => proposalFor(c, p))
    .sort((a, b) => Number(!!p.hired?.[b.c.id]) - Number(!!p.hired?.[a.c.id]) || Number(!!p.declined?.[a.c.id]) - Number(!!p.declined?.[b.c.id]) || b.score - a.score);
}

function sampleProjectFor(profile: Profile): ProjectDraft {
  const cl = profile.client ?? {};
  const niches = INDUSTRY_NICHES[cl.industry as string] ?? ["Lifestyle", "Food"];
  const platforms = CHANNEL_PLATFORMS[cl.channels as string] ?? ["Instagram", "YouTube Shorts"];
  const brand = (cl.brand as string) || profile.name;
  const deadline = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
  const draft: ProjectDraft = {
    title: `${brand} — festive launch campaign`,
    objective: (cl.description as string) ? `Introduce ${brand} to new customers this festive season. ${cl.description}` : `Introduce ${brand} to new customers this festive season with honest, creator-led content.`,
    deliverables: ["3 Instagram Reels (30–45s)", "2 YouTube Shorts", "1 set of 6 product stills", "Usage rights for 6 months"],
    platforms, niches: niches.slice(0, 3), languages: ["Hindi", "English"],
    budgetMin: 60_000, budgetMax: 1_50_000, deadline, creatorsNeeded: 2, status: "open",
  };
  const top = CREATORS.map((c) => ({ c, s: matchScore(c, { niches: draft.niches, platforms: draft.platforms, languages: draft.languages }) })).sort((a, b) => b.s - a.s).slice(0, 4);
  return { ...draft, invited: Object.fromEntries(top.map(({ c }) => [c.id, Date.now()])) };
}

/* ---------- list ---------- */

type ProjectTab = "all" | "open" | "in_progress" | "draft" | "completed";

function Projects() {
  const { user, profile } = useAccount();
  const projects = projectsOf(profile);
  const [tab, setTab] = useState<ProjectTab>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectWithId | "new" | null>(null);

  useEffect(() => {
    if (profile.seeded?.projects || projects.length) return;
    seedSampleProject(user.uid, sampleProjectFor(profile)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.seeded?.projects, user.uid]);

  const current = projects.find((p) => p.id === openId);
  if (current) return <>
    <ProjectDetail p={current} onBack={() => setOpenId(null)} onEdit={() => setEditing(current)} />
    {editing && <ProjectForm initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); setOpenId(id); }} />}
  </>;

  const counts: Record<ProjectTab, number> = {
    all: projects.length,
    open: projects.filter((p) => p.status === "open").length,
    in_progress: projects.filter((p) => p.status === "in_progress").length,
    draft: projects.filter((p) => p.status === "draft").length,
    completed: projects.filter((p) => p.status === "completed").length,
  };
  const shown = tab === "all" ? projects : projects.filter((p) => p.status === tab);
  const proposals = projects.filter((p) => p.status === "open").reduce((n, p) => n + keysOf(p.invited).length, 0);
  const budget = projects.filter((p) => p.status !== "draft").reduce((n, p) => n + p.budgetMax, 0);
  const tabs: [ProjectTab, string][] = [["all", "All"], ["open", "Open"], ["in_progress", "In progress"], ["draft", "Drafts"], ["completed", "Completed"]];

  return <>
    <Topbar title="Projects" subtitle="Plan briefs, compare creator proposals and track delivery." />
    <div className="page-content pj">
      <section className="op2-stats" aria-label="Summary">
        <div className="mint"><span>Active projects</span><b>{counts.open + counts.in_progress}</b><small>{counts.open} open · {counts.in_progress} in progress</small></div>
        <div className="lilac"><span>Proposals to review</span><b>{proposals}</b><small>Across your open projects</small></div>
        <div className="peach"><span>Committed budget</span><b>{formatINRShort(budget)}</b><small>Upper budget of live projects</small></div>
        <div><span>Completed</span><b>{counts.completed}</b><small>{counts.draft} draft{counts.draft === 1 ? "" : "s"} waiting</small></div>
      </section>

      <div className="pj-bar">
        <div className="op2-tabs" role="tablist" aria-label="Project status">
          {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}<i>{counts[id]}</i></button>)}
        </div>
        <Button icon="plus" onClick={() => setEditing("new")}>New project</Button>
      </div>

      {shown.length ? (
        <div className="pj-grid">{shown.map((p) => {
          const stage = stageOf(p);
          const people = [...keysOf(p.hired), ...keysOf(p.invited).filter((id) => !p.hired?.[id])].map((id) => CREATORS.find((c) => c.id === id)).filter(Boolean) as SeedCreator[];
          const late = p.status !== "completed" && daysUntil(p.deadline) < 0;
          return (
            <article key={p.id} className="pj-card">
              <header>
                <span className={`pj-status ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                {p.sample && <span className="pj-sample">Sample</span>}
                <span className={`pj-due${late ? " late" : ""}`}><Icon name="calendar" size={14} /> {dueLabel(p)}</span>
              </header>
              <button className="op2-title" onClick={() => setOpenId(p.id)}>{p.title}</button>
              <p className="op2-summary">{p.objective}</p>
              <div className="op2-tags">{p.platforms.map((t) => <span key={t} className="plat">{t}</span>)}{p.niches.slice(0, 2).map((t) => <span key={t}>{t}</span>)}</div>
              <div className="pj-progress">
                <div className="pj-progress-head"><span>{stageLabel(stage)}</span><b>{Math.round((stage / 6) * 100)}%</b></div>
                <div className="progress"><span style={{ width: `${(stage / 6) * 100}%` }} /></div>
              </div>
              <footer>
                <div className="pj-people">
                  {people.slice(0, 4).map((c) => <img key={c.id} src={creatorAvatar(c)} alt={c.name} title={c.name} />)}
                  <span>{keysOf(p.hired).length ? `${keysOf(p.hired).length} hired` : people.length ? `${people.length} proposal${people.length === 1 ? "" : "s"}` : "No creators yet"}</span>
                </div>
                <span className="pj-budget">{formatINRShort(p.budgetMin)} – {formatINRShort(p.budgetMax)}</span>
                <Button kind="dark" onClick={() => setOpenId(p.id)}>Open <Icon name="arrow" size={14} /></Button>
              </footer>
            </article>
          );
        })}</div>
      ) : (
        <div className="mk-empty">
          <Icon name="brief" size={28} />
          <b>{tab === "all" ? "No projects yet" : `No ${tabs.find((t) => t[0] === tab)![1].toLowerCase()} projects`}</b>
          <p>Write a brief, invite matched creators and compare their proposals side by side.</p>
          <Button icon="plus" onClick={() => setEditing("new")}>New project</Button>
        </div>
      )}
    </div>
    {editing && <ProjectForm initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); setOpenId(id); }} />}
  </>;
}

/* ---------- create / edit ---------- */

function ChipPicker({ options, value, onChange, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div className="pj-chips" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o);
        return <button type="button" key={o} className={on ? "on" : ""} aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}>{on && <Icon name="check" size={13} />}{o}</button>;
      })}
    </div>
  );
}

function ProjectForm({ initial, onClose, onSaved }: { initial: ProjectWithId | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { user, profile } = useAccount();
  const suggested = INDUSTRY_NICHES[profile.client?.industry as string] ?? [];
  const [title, setTitle] = useState(initial?.title ?? "");
  const [objective, setObjective] = useState(initial?.objective ?? "");
  const [deliverables, setDeliverables] = useState((initial?.deliverables ?? ["3 Instagram Reels (30–45s)", "Usage rights for 6 months"]).join("\n"));
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms ?? CHANNEL_PLATFORMS[profile.client?.channels as string] ?? ["Instagram"]);
  const [niches, setNiches] = useState<string[]>(initial?.niches ?? suggested.slice(0, 2));
  const [languages, setLanguages] = useState<string[]>(initial?.languages ?? ["Hindi", "English"]);
  const [budgetMin, setBudgetMin] = useState(String(initial?.budgetMin ?? 50000));
  const [budgetMax, setBudgetMax] = useState(String(initial?.budgetMax ?? 120000));
  const [deadline, setDeadline] = useState(initial?.deadline ?? new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10));
  const [creatorsNeeded, setCreatorsNeeded] = useState(String(initial?.creatorsNeeded ?? 1));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "draft" | "publish">("");
  const nicheOptions = [...new Set([...suggested, ...POPULAR_NICHES, ...niches])];

  const save = async (publish: boolean) => {
    const items = deliverables.split("\n").map((d) => d.trim()).filter(Boolean);
    const lo = Number(budgetMin.replace(/[^\d]/g, ""));
    const hi = Number(budgetMax.replace(/[^\d]/g, ""));
    const problem = !title.trim() ? "Give the project a title."
      : !objective.trim() ? "Describe what you want to achieve."
      : !items.length ? "Add at least one deliverable."
      : !platforms.length ? "Pick at least one platform."
      : !lo || !hi || lo > hi ? "Enter a budget range where the minimum is below the maximum."
      : !initial && daysUntil(deadline) < 1 ? "Choose a deadline at least a day from now."
      : "";
    if (problem) { setError(problem); return; }
    setError("");
    setBusy(publish ? "publish" : "draft");
    const data = { title: title.trim(), objective: objective.trim(), deliverables: items, platforms, niches, languages, budgetMin: lo, budgetMax: hi, deadline, creatorsNeeded: Math.max(1, Math.min(20, Number(creatorsNeeded) || 1)) };
    try {
      if (initial) {
        const status = publish && initial.status === "draft" ? "open" : initial.status;
        await updateProject(user.uid, initial.id, { ...data, status, ...(status === "open" && initial.status === "draft" ? { "milestones/publishedAt": Date.now() } : {}) });
        onSaved(initial.id);
      } else {
        onSaved(await createProject(user.uid, { ...data, status: publish ? "open" : "draft" }));
      }
    } catch (e) {
      setError(describeError(e));
      setBusy("");
    }
  };

  return (
    <Drawer label={initial ? "Edit project" : "New project"} onClose={onClose}>
      <h2 className="pj-form-title">{initial ? "Edit project" : "New project"}</h2>
      <p className="mk-muted pj-form-sub">Creators see this brief when you invite them.</p>
      {error && <div className="auth-alert error" role="alert">{error}</div>}
      <form className="me-form pj-form" onSubmit={(e) => { e.preventDefault(); save(true); }} noValidate>
        <label>Project title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali gifting launch" maxLength={120} /></label>
        <label>What do you want to achieve?<textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="The product, the audience, and what success looks like…" /></label>
        <label>Deliverables <span className="mk-muted">— one per line</span><textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} rows={4} /></label>
        <div className="pj-field"><span>Platforms</span><ChipPicker label="Platforms" options={PLATFORMS} value={platforms} onChange={setPlatforms} /></div>
        <div className="pj-field"><span>Niches</span><ChipPicker label="Niches" options={nicheOptions} value={niches} onChange={setNiches} /></div>
        <div className="pj-field"><span>Content languages</span><ChipPicker label="Languages" options={LANGUAGES} value={languages} onChange={setLanguages} /></div>
        <div className="me-form-grid">
          <label>Budget from (₹)<input inputMode="numeric" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} /></label>
          <label>Budget up to (₹)<input inputMode="numeric" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} /></label>
          <label>Deadline<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
          <label>Creators needed<input type="number" min={1} max={20} value={creatorsNeeded} onChange={(e) => setCreatorsNeeded(e.target.value)} /></label>
        </div>
        <div className="form-actions">
          {(!initial || initial.status === "draft") && <button type="button" className="button ghost" disabled={!!busy} onClick={() => save(false)}>{busy === "draft" ? "Saving…" : "Save as draft"}</button>}
          <button type="submit" className="button dark" disabled={!!busy}>{busy === "publish" ? "Saving…" : initial && initial.status !== "draft" ? "Save changes" : "Publish project"}</button>
        </div>
      </form>
    </Drawer>
  );
}

/* ---------- detail ---------- */

function ProjectDetail({ p, onBack, onEdit }: { p: ProjectWithId; onBack: () => void; onEdit: () => void }) {
  const { user } = useAccount();
  const { openChat } = useContext(ShellContext);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<SeedCreator | null>(null);
  const proposals = projectProposals(p);
  const hired = keysOf(p.hired);
  const stage = stageOf(p);
  const want = { niches: p.niches, platforms: p.platforms, languages: p.languages, budgetMax: p.budgetMax };
  const suggestions = CREATORS.filter((c) => !p.invited?.[c.id]).map((c) => ({ c, score: matchScore(c, want) })).sort((a, b) => b.score - a.score).slice(0, 6);
  const canInvite = p.status === "open" || p.status === "in_progress";

  const act = async (key: string, patch: Record<string, unknown>) => {
    setBusy(key);
    setError("");
    try { await updateProject(user.uid, p.id, patch); } catch (e) { setError(describeError(e)); } finally { setBusy(""); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete “${p.title}”? This can't be undone.`)) return;
    await deleteProject(user.uid, p.id).catch((e) => setError(describeError(e)));
    onBack();
  };

  const events = [
    p.createdAt && { t: p.createdAt, label: "Project created" },
    p.milestones?.publishedAt && { t: p.milestones.publishedAt, label: "Brief published" },
    ...keysOf(p.invited).map((id) => ({ t: p.invited![id], label: `Invited ${CREATORS.find((c) => c.id === id)?.name ?? "a creator"}` })),
    ...hired.map((id) => ({ t: p.hired![id], label: `Hired ${CREATORS.find((c) => c.id === id)?.name ?? "a creator"}` })),
    p.milestones?.firstCut && { t: p.milestones.firstCut, label: "First cut received" },
    p.milestones?.final && { t: p.milestones.final, label: "Final delivery approved" },
  ].filter(Boolean) as { t: number; label: string }[];
  events.sort((a, b) => b.t - a.t);

  return <>
    <Topbar title="Projects" subtitle="Plan briefs, compare creator proposals and track delivery." />
    <div className="page-content pj">
      <button className="pj-back" onClick={onBack}><Icon name="arrow" size={15} /> All projects</button>
      <section className="pj-head">
        <div className="pj-head-main">
          <div className="pj-head-tags"><span className={`pj-status ${p.status}`}>{STATUS_LABEL[p.status]}</span>{p.sample && <span className="pj-sample">Sample project</span>}</div>
          <h1>{p.title}</h1>
          <dl className="pj-meta">
            <div><dt>Budget</dt><dd>{formatINR(p.budgetMin)} – {formatINR(p.budgetMax)}</dd></div>
            <div><dt>Deadline</dt><dd>{fmtDate(p.deadline)} · <span className={p.status !== "completed" && daysUntil(p.deadline) < 0 ? "late" : ""}>{dueLabel(p)}</span></dd></div>
            <div><dt>Creators</dt><dd>{hired.length} of {p.creatorsNeeded} hired</dd></div>
            <div><dt>Platforms</dt><dd>{p.platforms.join(", ")}</dd></div>
          </dl>
        </div>
        <div className="pj-head-actions">
          {p.status === "draft" && <Button onClick={() => act("publish", { status: "open", "milestones/publishedAt": Date.now() })}>{busy === "publish" ? "Publishing…" : "Publish project"}</Button>}
          {p.status === "in_progress" && !p.milestones?.firstCut && <Button onClick={() => act("cut", { "milestones/firstCut": Date.now() })}><Icon name="check" size={15} /> First cut received</Button>}
          {p.status === "in_progress" && p.milestones?.firstCut && <Button kind="accent" onClick={() => act("final", { "milestones/final": Date.now(), status: "completed" })}><Icon name="check" size={15} /> Approve final delivery</Button>}
          {p.status === "completed" && <Button kind="light" onClick={() => act("reopen", { status: hired.length ? "in_progress" : "open", "milestones/final": null })}>Reopen</Button>}
          <Button kind="light" onClick={onEdit}>Edit</Button>
          <button className="pj-delete" onClick={remove} aria-label="Delete project" title="Delete project"><Icon name="plus" size={16} /></button>
        </div>
      </section>
      {error && <div className="auth-alert error" role="alert">{error}</div>}

      <ol className="pj-stages" aria-label="Project progress">
        {STAGES.map((s, i) => <li key={s} className={i < stage ? "done" : i === stage ? "current" : ""}><i>{i < stage ? <Icon name="check" size={13} /> : i + 1}</i><span>{s}</span></li>)}
      </ol>

      <div className="pj-layout">
        <div className="pj-main">
          <section className="panel">
            <div className="panel-head"><div><span>{proposals.length ? `${proposals.length} RECEIVED` : "PROPOSALS"}</span><h3>Creator proposals</h3></div>{proposals.length > 1 && <span className="mk-muted pj-note"><Icon name="spark" size={13} /> Ranked by fit, price and ratings</span>}</div>
            {proposals.length ? proposals.map((pr, i) => {
              const isHired = !!p.hired?.[pr.c.id];
              const isShort = !!p.shortlisted?.[pr.c.id];
              const isDeclined = !!p.declined?.[pr.c.id];
              const full = hired.length >= p.creatorsNeeded;
              return (
                <article key={pr.c.id} className={`pj-proposal${isHired ? " hired" : ""}${isDeclined ? " declined" : ""}`}>
                  <span className="pj-rank">{String(i + 1).padStart(2, "0")}</span>
                  <img src={creatorAvatar(pr.c)} alt="" />
                  <div className="pj-proposal-body">
                    <div className="pj-proposal-top">
                      <button className="pj-name" onClick={() => setOpen(pr.c)}>{pr.c.name}</button>
                      <span className={`op2-match ${matchTone(pr.score)}`}><Icon name="spark" size={12} />{pr.score}% fit</span>
                      {isHired && <span className="pj-tag hired">Hired</span>}
                      {isShort && !isHired && <span className="pj-tag">Shortlisted</span>}
                      {isDeclined && <span className="pj-tag muted">Declined</span>}
                      <span className="pj-demo">Demo proposal</span>
                    </div>
                    <p className="pj-who">{pr.c.title} · {pr.c.city} · {pr.c.rating}★</p>
                    <p className="pj-pitch">“{pr.pitch}”</p>
                    <ul className="pj-reasons">{pr.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                    <div className="pj-terms">
                      <span><b>{formatINR(pr.price)}</b> quote</span>
                      <span><b>{pr.days} days</b> delivery</span>
                      <span><b>{pr.revisions}</b> revision{pr.revisions === 1 ? "" : "s"}</span>
                    </div>
                    <div className="pj-actions">
                      {!isHired && !isDeclined && <Button kind="dark" onClick={() => act(`hire-${pr.c.id}`, { [`hired/${pr.c.id}`]: Date.now(), status: "in_progress", [`declined/${pr.c.id}`]: null })}>{full ? "Hire another" : "Hire"}</Button>}
                      {!isHired && !isDeclined && <Button kind="light" onClick={() => act(`short-${pr.c.id}`, { [`shortlisted/${pr.c.id}`]: isShort ? null : Date.now() })}><Icon name="star" size={14} /> {isShort ? "Shortlisted" : "Shortlist"}</Button>}
                      <Button kind="light" onClick={() => openChat(pr.c.id)}><Icon name="chat" size={14} /> Message</Button>
                      {!isHired && <button className="text-button" onClick={() => act(`decline-${pr.c.id}`, { [`declined/${pr.c.id}`]: isDeclined ? null : Date.now(), [`shortlisted/${pr.c.id}`]: null })}>{isDeclined ? "Undo decline" : "Decline"}</button>}
                      {isHired && p.status !== "completed" && <button className="text-button" onClick={() => act(`unhire-${pr.c.id}`, { [`hired/${pr.c.id}`]: null, ...(hired.length === 1 ? { status: "open", "milestones/firstCut": null } : {}) })}>Undo hire</button>}
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="ov-empty"><Icon name="users" size={22} /><p>{p.status === "draft" ? "Publish the project, then invite creators to get proposals." : "Invite creators below — their proposals appear here."}</p></div>
            )}
          </section>

          {canInvite && (
            <section className="panel">
              <div className="panel-head"><div><span>MATCHED TO THIS BRIEF</span><h3>Invite creators</h3></div></div>
              <div className="pj-suggest">{suggestions.map(({ c, score }) => (
                <div key={c.id} className="pj-suggest-row">
                  <img src={creatorAvatar(c)} alt="" />
                  <div><button className="pj-name" onClick={() => setOpen(c)}>{c.name}</button><span>{c.title} · {formatINRShort(c.rateFrom)}+ · {c.city}</span></div>
                  <span className={`op2-match ${matchTone(score)}`}>{score}%</span>
                  <Button kind="light" onClick={() => act(`invite-${c.id}`, { [`invited/${c.id}`]: Date.now() })}>{busy === `invite-${c.id}` ? "Inviting…" : "Invite"}</Button>
                </div>
              ))}</div>
            </section>
          )}
        </div>

        <aside className="pj-side">
          <section className="panel">
            <h3 className="pj-side-title">Brief</h3>
            <p className="pj-objective">{p.objective}</p>
            <h4>Deliverables</h4>
            <ul className="mk-list">{p.deliverables.map((d) => <li key={d}><Icon name="check" size={14} /> {d}</li>)}</ul>
            {!!p.niches.length && <><h4>Niches</h4><div className="op2-tags">{p.niches.map((n) => <span key={n}>{n}</span>)}</div></>}
            {!!p.languages.length && <><h4>Languages</h4><div className="op2-tags">{p.languages.map((n) => <span key={n}>{n}</span>)}</div></>}
          </section>
          <section className="panel">
            <h3 className="pj-side-title">Activity</h3>
            <ul className="pj-activity">{events.map((e, i) => <li key={i}><time>{fmtWhen(e.t)}</time><span>{e.label}</span></li>)}</ul>
          </section>
        </aside>
      </div>
    </div>
    {open && <CreatorDrawer c={open} score={matchScore(open, want)} reasons={matchReasons(open, { niches: p.niches, platforms: p.platforms, languages: p.languages })} saved={false} invited={!!p.invited?.[open.id]} onSave={() => {}} onInvite={() => act(`invite-${open.id}`, { [`invited/${open.id}`]: p.invited?.[open.id] ? null : Date.now() })} onClose={() => setOpen(null)} />}
  </>;
}

/** Share of profile details filled in for a workspace, plus what's still missing (same rule as My profile). */
function profileStrength(profile: Profile, user: User, role: Role) {
  const fields = ROLE_FIELDS[role].flatMap((s) => s.fields);
  const data = profile[role] ?? {};
  const missing = fields.filter((f) => !(typeof data[f.name] === "string" && (data[f.name] as string).trim())).map((f) => f.label);
  if (!profile.name) missing.push("Full name");
  if (!profile.photoURL) missing.push("Profile photo");
  if (!user.emailVerified) missing.push("Verified email");
  const total = fields.length + 3;
  return { pct: Math.round(((total - missing.length) / total) * 100), missing };
}

function CreatorHome({ go }: { go: (p: CreatorPage) => void }) {
  const { user, profile } = useAccount();
  const scores = useMemo(() => briefScores(profile), [profile.creator]);
  useStarterShortlist(scores);
  const ranked = CLIENTS.map((b) => ({ b, score: scores.get(b.id) ?? 60 })).sort((a, b) => b.score - a.score);
  const strong = ranked.filter((x) => x.score >= 80);
  const interested = profile.interested ?? {};
  const shortlisted = ranked.filter((x) => interested[x.b.id]);
  const closing = ranked.filter((x) => x.b.brief.deadlineDays <= 10);
  const closingShortlisted = shortlisted.filter((x) => x.b.brief.deadlineDays <= 10).sort((a, b) => a.b.brief.deadlineDays - b.b.brief.deadlineDays);

  const realInbox = useInbox(user.uid).data;
  const demoInbox = useDemoInbox(user.uid).data;
  const directory = useDirectory().data;
  const people = new Map<string, Contact>([...DEMO_CONTACTS, ...directory].map((d) => [d.uid, d]));
  const threads = [...realInbox, ...demoInbox].sort((a, b) => (b.lastAt ?? b.updatedAt ?? 0) - (a.lastAt ?? a.updatedAt ?? 0));
  const unread = threads.reduce((n, t) => n + (t.unread ?? 0), 0);

  const strength = profileStrength(profile, user, "creator");
  const [open, setOpen] = useState<SeedClient | null>(null);
  const toggle = (b: SeedClient) => setListed(user.uid, "interested", b.id, !interested[b.id]);

  // Market numbers come from your 12 best-fitting briefs.
  const top = ranked.slice(0, 12);
  const avgBudget = Math.round(top.reduce((s, x) => s + (x.b.brief.budget[0] + x.b.brief.budget[1]) / 2, 0) / Math.max(1, top.length));
  const count = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const topNiches = count(top.flatMap((x) => x.b.brief.niches)).slice(0, 5);
  const topPlatforms = count(top.flatMap((x) => x.b.brief.platforms)).slice(0, 3);
  const c = profile.creator ?? {};

  type Move = { key: string; icon: string; tone: string; title: string; detail: string; badge: string; act: () => void };
  const moves: Move[] = [];
  for (const t of threads.filter((t) => t.unread).slice(0, 2)) {
    const p = people.get(t.with);
    moves.push({ key: `m-${t.cid}`, icon: "chat", tone: "lilac", title: `Reply to ${p?.name ?? "a Kreota member"}`, detail: t.lastText ?? "New message", badge: `${t.unread} unread`, act: () => go("messages") });
  }
  for (const x of closingShortlisted.slice(0, 2)) {
    moves.push({ key: `b-${x.b.id}`, icon: "clock", tone: "peach", title: `${x.b.brief.title} — ${x.b.brand}`, detail: `Shortlisted brief · ${briefBudget(x.b)}`, badge: `${x.b.brief.deadlineDays} days left`, act: () => setOpen(x.b) });
  }
  for (const label of strength.missing.filter((m) => m !== "Profile photo" && m !== "Verified email").slice(0, 2)) {
    moves.push({ key: `p-${label}`, icon: "users", tone: "mint", title: `Fill in “${label}”`, detail: "Better profiles get better matches", badge: "Profile", act: () => go("profile") });
  }
  if (!shortlisted.length) moves.push({ key: "shortlist", icon: "star", tone: "mint", title: "Shortlist briefs you like", detail: `${strong.length} briefs fit you well right now`, badge: "Opportunities", act: () => go("opportunities") });
  moves.push({ key: "studio", icon: "spark", tone: "lilac", title: "Edit your next video in Kreota Studio", detail: "Trim, caption and export reels in the browser", badge: "Studio", act: () => go("studio") });

  const best = ranked[0];
  return <>
    <Topbar title={`${greeting()}, ${firstName(profile)}.`} subtitle="Here's what's happening with your creator business." />
    <div className="page-content ov">
      <section className="ov-hero">
        <div className="ov-hero-main">
          <span className="success-pill">CREATOR PULSE</span>
          <h2>You're a strong match for {strong.length} brand briefs.</h2>
          <p>Top fit right now: <b>{best.b.brief.title}</b> from {best.b.brand} — {best.score}% match, {briefBudget(best.b)}.</p>
          <div className="ov-hero-actions">
            <Button kind="accent" icon="arrow" onClick={() => go("opportunities")}>View opportunities</Button>
            <button className="ov-ghost" onClick={() => setOpen(best.b)}>Open top brief</button>
          </div>
        </div>
        <div className="ov-strength">
          <div className="ov-ring" style={{ ["--p" as string]: `${strength.pct}` }} role="img" aria-label={`Profile ${strength.pct}% complete`}><b>{strength.pct}%</b><span>profile</span></div>
          <div>
            <b>{strength.pct >= 100 ? "Profile complete" : "Complete your profile"}</b>
            {strength.missing.length ? <ul>{strength.missing.slice(0, 3).map((m) => <li key={m}>{m}</li>)}</ul> : <p>Brands see everything they need.</p>}
            {strength.missing.length > 0 && <button className="ov-link" onClick={() => go("profile")}>Finish profile <Icon name="arrow" size={13} /></button>}
          </div>
        </div>
      </section>

      <section className="op2-stats" aria-label="Summary">
        <button className="mint" onClick={() => go("opportunities")}><span>Strong matches</span><b>{strong.length}</b><small>80%+ fit with your profile</small></button>
        <button className="peach" onClick={() => go("opportunities")}><span>Closing soon</span><b>{closing.length}</b><small>{closingShortlisted.length ? `${closingShortlisted.length} on your shortlist` : "Deadlines within 10 days"}</small></button>
        <button className="lilac" onClick={() => go("opportunities")}><span>Shortlisted</span><b>{shortlisted.length}</b><small>Briefs you're interested in</small></button>
        <button onClick={() => go("messages")}><span>Unread messages</span><b>{unread}</b><small>{threads.length} conversation{threads.length === 1 ? "" : "s"}</small></button>
      </section>

      <div className="ov-grid">
        <section className="panel ov-panel">
          <div className="panel-head"><div><span>FOR YOU</span><h3>Top matches</h3></div><button className="text-button" onClick={() => go("opportunities")}>All briefs <Icon name="arrow" size={14} /></button></div>
          <div className="ov-briefs">{ranked.slice(0, 4).map(({ b, score }) => (
            <button key={b.id} className="ov-brief" onClick={() => setOpen(b)}>
              <BrandMark client={b} size={40} />
              <div><b>{b.brief.title}</b><span>{b.brand} · {briefBudget(b)} · {b.brief.deadlineDays} days</span></div>
              <span className={`op2-match ${matchTone(score)}`}><Icon name="spark" size={12} />{score}%</span>
            </button>
          ))}</div>
        </section>

        <section className="panel ov-panel">
          <div className="panel-head"><div><span>TODAY</span><h3>Your next moves</h3></div></div>
          <div className="ov-moves">{moves.slice(0, 5).map((m) => (
            <button key={m.key} className="task-row" onClick={m.act}>
              <i className={m.tone}><Icon name={m.icon} /></i>
              <div><b>{m.title}</b><span>{m.detail}</span></div>
              <em>{m.badge}</em>
              <Icon name="arrow" size={15} />
            </button>
          ))}</div>
        </section>

        <section className="panel ov-panel">
          <div className="panel-head"><div><span>INBOX</span><h3>Recent messages</h3></div><button className="text-button" onClick={() => go("messages")}>Open messages <Icon name="arrow" size={14} /></button></div>
          {threads.length ? (
            <div className="ov-threads">{threads.slice(0, 4).map((t) => {
              const p = people.get(t.with);
              return (
                <button key={t.cid} className={`ov-thread${t.unread ? " unread" : ""}`} onClick={() => go("messages")}>
                  <PersonAvatar entry={p} size={38} />
                  <div><b>{p?.name ?? "Kreota member"}</b><span>{t.lastText ? `${t.lastSender === user.uid ? "You: " : ""}${t.lastText}` : "No messages yet"}</span></div>
                  <div className="ov-thread-meta"><time>{shortTime(t.lastAt ?? t.updatedAt)}</time>{!!t.unread && <i>{t.unread}</i>}</div>
                </button>
              );
            })}</div>
          ) : (
            <div className="ov-empty"><Icon name="chat" size={22} /><p>No conversations yet. Message a brand about a brief you like.</p><Button kind="light" onClick={() => go("messages")}>Start a conversation</Button></div>
          )}
        </section>

        <section className="panel ov-panel">
          <div className="panel-head"><div><span>YOUR BUSINESS</span><h3>Rate card & market</h3></div><button className="text-button" onClick={() => go("profile")}>Edit <Icon name="arrow" size={14} /></button></div>
          <dl className="ov-rate">
            <div><dt>Your typical rate</dt><dd>{(c.rate as string) || "Not set"}</dd></div>
            <div><dt>Availability</dt><dd>{(c.availability as string) || "Not set"}</dd></div>
            <div><dt>Category</dt><dd>{(c.category as string) || "Not set"}</dd></div>
            <div><dt>Based in</dt><dd>{(c.location as string) || "Not set"}</dd></div>
          </dl>
          <div className="ov-market">
            <p><b>{formatINRShort(avgBudget)}</b> average budget across your top 12 briefs</p>
            <span>Most requested in your matches</span>
            <div className="op2-tags">{topNiches.map(([n, k]) => <span key={n}>{n} · {k}</span>)}</div>
            <span>Where brands want content</span>
            <div className="op2-tags">{topPlatforms.map(([n, k]) => <span key={n} className="plat">{n} · {k}</span>)}</div>
          </div>
        </section>
      </div>
    </div>
    {open && <BriefDrawer b={open} score={scores.get(open.id) ?? 60} interested={!!interested[open.id]} onToggle={() => toggle(open)} onClose={() => setOpen(null)} />}
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

  const { pendingChat, clearPendingChat } = useContext(ShellContext);
  useEffect(() => {
    if (!pendingChat || realInbox.loading) return;
    clearPendingChat();
    startWith(pendingChat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChat, realInbox.loading]);

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
  const strength = profileStrength(profile, user, role).pct;
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
  const [pendingChat,setPendingChat]=useState<string|null>(null);
  const page=role==="client"?clientPage:creatorPage;
  let content: ReactNode;
  if(role==="client"){
    content=clientPage==="home"?<ClientHome goCreators={()=>setClientPage("creators")} goProjects={()=>setClientPage("projects")}/>:clientPage==="creators"?<CreatorMarketplace goProjects={()=>setClientPage("projects")}/>:clientPage==="projects"?<Projects/>:clientPage==="profile"?<ProfilePage/>:<Messages/>;
  } else {
    content=creatorPage==="home"?<CreatorHome go={setCreatorPage}/>:creatorPage==="opportunities"?<Opportunities/>:creatorPage==="messages"?<Messages/>:creatorPage==="studio"?<Studio key={user.uid} userId={user.uid}/>:<ProfilePage/>;
  }
  return <ShellContext.Provider value={{ role, onSwitch, openProfile: () => (role === "client" ? setClientPage("profile") : setCreatorPage("profile")), openChat: (id) => { setPendingChat(id); if (role === "client") setClientPage("messages"); else setCreatorPage("messages"); }, pendingChat, clearPendingChat: () => setPendingChat(null) }}><div className="app-shell"><Sidebar role={role} page={page} onPage={role==="client"?setClientPage:setCreatorPage} onSwitch={onSwitch}/><main className="app-main">{content}</main></div></ShellContext.Provider>;
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
