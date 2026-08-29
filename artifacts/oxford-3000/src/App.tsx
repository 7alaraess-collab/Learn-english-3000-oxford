import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { getGetProgressQueryKey, useGetProgress, useSaveProgress, type ProgressInput } from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Command, Layers3, ListFilter, Menu, Pencil, RotateCcw, Save, Search, Shuffle, Sparkles, Volume2, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { oxford3000 } from './oxford3000';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in the app environment.');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#24635f',
    colorForeground: '#202a40',
    colorMutedForeground: '#71776f',
    colorDanger: '#a04b39',
    colorBackground: '#fbf8f1',
    colorInput: '#f6f2e9',
    colorInputForeground: '#202a40',
    colorNeutral: '#ded8ca',
    fontFamily: 'DM Sans, Noto Sans Arabic, sans-serif',
    borderRadius: '0.9rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf8f1] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#202a40]',
    headerSubtitle: 'text-[#71776f]',
    socialButtonsBlockButtonText: 'text-[#202a40]',
    formFieldLabel: 'text-[#202a40]',
    footerActionLink: 'text-[#24635f]',
    footerActionText: 'text-[#71776f]',
    dividerText: 'text-[#71776f]',
    formFieldSuccessText: 'text-[#24635f]',
    alertText: 'text-[#a04b39]',
    logoBox: 'h-10',
    logoImage: 'h-10',
    socialButtonsBlockButton: 'border-[#ded8ca] bg-[#f6f2e9]',
    formButtonPrimary: 'bg-[#24635f] hover:bg-[#1c514e]',
    formFieldInput: 'border-[#ded8ca] bg-[#f6f2e9] text-[#202a40]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#ded8ca]',
    alert: 'border-[#f7d8cd] bg-[#fff4ef]',
    otpCodeFieldInput: 'border-[#ded8ca] bg-[#f6f2e9] text-[#202a40]',
    formFieldRow: 'text-[#202a40]',
    main: 'bg-[#fbf8f1]',
  },
};

const levelOptions = ['All levels', 'A1', 'A2', 'B1', 'B2'];
const typeOptions = ['All parts', 'Noun', 'Verb', 'Adjective', 'Adverb', 'Preposition'];
const reviewedStorageKey = 'wordroom-reviewed';
const reviewDatesStorageKey = 'wordroom-review-dates';
const dailyGoal = 12;
const overridesStorageKey = 'wordroom-word-overrides';

type EditableWord = {
  id: number;
  word: string;
  type: string;
  level: string;
  translation: string;
  example: string;
  exampleTranslation: string;
};

type WordOverrides = Partial<Omit<EditableWord, 'id'>>;
type AppView = 'study' | 'browse' | 'all-days';

const sourceWords: EditableWord[] = oxford3000.map((word) => ({ ...word }));
const wordsPerDay = 12;

function splitIntoDays(words: EditableWord[]) {
  const days: EditableWord[][] = [];
  for (let start = 0; start < words.length; start += wordsPerDay) {
    days.push(words.slice(start, start + wordsPerDay));
  }
  return days;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStorageKey(key: string, userId?: string) {
  return userId ? `${key}:${userId}` : key;
}

function readReviewedIds(userId?: string) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(getStorageKey(reviewedStorageKey, userId)) ?? '[]') as unknown;
    if (!Array.isArray(saved)) return new Set<number>();
    const validIds = new Set<number>(oxford3000.map((word) => word.id));
    return new Set(saved.filter((id): id is number => typeof id === 'number' && validIds.has(id)));
  } catch {
    return new Set<number>();
  }
}

function readReviewDates(userId?: string) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(getStorageKey(reviewDatesStorageKey, userId)) ?? '{}') as unknown;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([, date]) => typeof date === 'string')) as Record<string, string>;
  } catch {
    return {};
  }
}

function readWordOverrides() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(overridesStorageKey) ?? '{}') as unknown;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    const fields: (keyof WordOverrides)[] = ['word', 'type', 'level', 'translation', 'example', 'exampleTranslation'];
    const validIds = new Set(sourceWords.map((word) => word.id));
    return Object.fromEntries(Object.entries(saved).filter(([id, value]) => {
      if (!validIds.has(Number(id)) || !value || typeof value !== 'object' || Array.isArray(value)) return false;
      return Object.keys(value).some((field) => fields.includes(field as keyof WordOverrides));
    }).map(([id, value]) => {
      const clean = Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([field, text]) => fields.includes(field as keyof WordOverrides) && typeof text === 'string')) as WordOverrides;
      return [id, clean];
    })) as Record<string, WordOverrides>;
  } catch {
    return {};
  }
}

function getCurrentStreak(reviewDates: Record<string, string>) {
  const activeDays = new Set(Object.values(reviewDates));
  let streak = 0;
  const cursor = new Date();
  while (activeDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getCompletedDayNumbers(days: EditableWord[][], reviewed: Set<number>) {
  return days.reduce<number[]>((completed, dayWords, dayIndex) => {
    if (dayWords.length > 0 && dayWords.every((word) => reviewed.has(word.id))) {
      completed.push(dayIndex + 1);
    }
    return completed;
  }, []);
}

function Logo() {
  return (
    <div className="flex items-center gap-3" data-testid="text-brand">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#f3d24f] text-[#202a40] shadow-[3px_3px_0_#b7a044]">
        <span className="font-display text-[24px] leading-none">w</span>
        <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-[#202a40] bg-[#ef7657]" />
      </div>
      <div className="leading-none">
        <div className="font-display text-[25px] tracking-[-0.04em] text-[#f9f5e9]">wordroom</div>
        <div className="mt-1 font-mono-custom text-[9px] uppercase tracking-[0.22em] text-[#aab3bd]">Oxford 3000</div>
      </div>
    </div>
  );
}

function Sidebar({ view, setView, mobileOpen, closeMobile, onReset, reviewedToday }: { view: AppView; setView: (view: AppView) => void; mobileOpen: boolean; closeMobile: () => void; onReset: () => void; reviewedToday: number }) {
  const nav = [
    { id: 'study' as const, label: 'Study room', arabic: 'غرفة الدراسة', icon: Sparkles },
    { id: 'all-days' as const, label: 'All Days', arabic: 'جميع الأيام', icon: CalendarDays },
    { id: 'browse' as const, label: 'Word library', arabic: 'مكتبة الكلمات', icon: Layers3 },
  ];
  return (
    <>
      {mobileOpen && <button type="button" aria-label="Close menu" data-testid="button-close-menu" onClick={closeMobile} className="fixed inset-0 z-30 bg-[#202a40]/35 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[#202a40] px-5 py-6 text-[#f9f5e9] transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Logo />
        <div className="mt-14">
          <div className="mb-3 px-3 font-mono-custom text-[9px] uppercase tracking-[0.2em] text-[#84909f]">Your desk</div>
          <nav className="space-y-1" aria-label="Main navigation">
            {nav.map(({ id, label, arabic, icon: Icon }) => (
              <button
                key={id}
                type="button"
                data-testid={`button-nav-${id}`}
                onClick={() => { setView(id); closeMobile(); }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 ${view === id ? 'bg-[#f3d24f] text-[#202a40] shadow-[3px_3px_0_#a89236]' : 'text-[#c2c8ce] hover:bg-[#2c3852] hover:text-[#f9f5e9]'}`}
              >
                <Icon size={17} strokeWidth={view === id ? 2.5 : 1.8} />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className={`font-arabic block text-[10px] ${view === id ? 'text-[#5b562e]' : 'text-[#7f8994]'}`} dir="rtl">{arabic}</span>
                </span>
                {view === id && <span className="h-1.5 w-1.5 rounded-full bg-[#ef7657]" />}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto rounded-2xl border border-[#3a465e] bg-[#29354e] p-4">
          <div className="flex items-center justify-between">
             <span className="font-mono-custom text-[10px] uppercase tracking-[0.15em] text-[#9da8b3]">Daily rhythm</span>
             <span className="text-[11px] font-semibold text-[#f3d24f]">{Math.min(reviewedToday, dailyGoal)} / {dailyGoal}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#1d273a]">
             <div className="h-full rounded-full bg-[#ef7657] transition-all duration-500" style={{ width: `${Math.min(100, (reviewedToday / dailyGoal) * 100)}%` }} />
          </div>
           <p className="mt-3 text-xs leading-relaxed text-[#aab3bd]">{reviewedToday >= dailyGoal ? 'Daily rhythm complete. Beautiful work.' : `${dailyGoal - reviewedToday} ${dailyGoal - reviewedToday === 1 ? 'word' : 'words'} left in today’s rhythm.`}</p>
          <button type="button" data-testid="button-reset-session" onClick={onReset} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#dce1dc] transition-colors hover:text-[#f3d24f]">
            <RotateCcw size={12} /> Reset session
          </button>
        </div>
        <div className="mt-5 flex items-center gap-2 px-2 text-[11px] text-[#84909f]"><Command size={12} /> <span>Built for the long game</span></div>
      </aside>
    </>
  );
}

function AuthControls() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  if (!isLoaded) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-[#e9e3d7]" aria-label="Loading account" />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-1.5">
        <button type="button" data-testid="button-login" onClick={() => setLocation('/sign-in')} className="rounded-full px-3 py-2 text-xs font-semibold text-[#5f675f] transition-colors hover:bg-[#e9e3d7] hover:text-[#202a40]">Log in</button>
        <button type="button" data-testid="button-sign-up" onClick={() => setLocation('/sign-up')} className="rounded-full bg-[#202a40] px-3.5 py-2 text-xs font-semibold text-[#f9f5e9] transition-all hover:-translate-y-0.5 hover:bg-[#2c3852]">Sign up</button>
      </div>
    );
  }

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? user.primaryEmailAddress?.emailAddress?.[0] ?? 'W'}`.toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <div className="max-w-[130px] truncate text-xs font-semibold text-[#202a40]">{user.firstName ?? user.primaryEmailAddress?.emailAddress}</div>
        <div className="font-mono-custom text-[9px] uppercase tracking-[.12em] text-[#858982]">Synced account</div>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e6c94d] bg-[#f3d24f] text-xs font-bold text-[#202a40]" data-testid="avatar-user">{initials}</div>
      <button type="button" data-testid="button-logout" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="rounded-full px-2.5 py-2 text-xs font-semibold text-[#71776f] transition-colors hover:bg-[#e9e3d7] hover:text-[#202a40]">Log out</button>
    </div>
  );
}

function TopBar({ view, setView, openMenu }: { view: AppView; setView: (view: AppView) => void; openMenu: () => void }) {
  const formattedDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#ded8ca] bg-[#f6f2e9]/90 px-5 backdrop-blur-md md:ml-[264px] md:px-10">
      <div className="flex items-center gap-3">
        <button type="button" data-testid="button-open-menu" onClick={openMenu} className="rounded-lg p-2 text-[#202a40] hover:bg-[#e9e3d7] md:hidden" aria-label="Open menu"><Menu size={20} /></button>
        <div className="font-mono-custom text-[10px] uppercase tracking-[0.18em] text-[#858982]">{formattedDate}</div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" data-testid="button-top-study" onClick={() => setView('study')} className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:block ${view === 'study' ? 'bg-[#202a40] text-[#f9f5e9]' : 'text-[#71776f] hover:bg-[#e9e3d7]'}`}>Study</button>
        <button type="button" data-testid="button-top-browse" onClick={() => setView('browse')} className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:block ${view === 'browse' ? 'bg-[#202a40] text-[#f9f5e9]' : 'text-[#71776f] hover:bg-[#e9e3d7]'}`}>Browse</button>
        <button type="button" data-testid="button-top-all-days" onClick={() => setView('all-days')} className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:block ${view === 'all-days' ? 'bg-[#202a40] text-[#f9f5e9]' : 'text-[#71776f] hover:bg-[#e9e3d7]'}`}>All Days</button>
        <AuthControls />
      </div>
    </header>
  );
}

function StatCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#ded8ca] bg-[#fbf8f1] p-4 shadow-[0_2px_5px_rgba(31,41,55,.03)]" data-testid={`card-stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <div className={`absolute right-0 top-0 h-1 w-14 ${accent}`} />
      <div className="font-mono-custom text-[9px] uppercase tracking-[0.17em] text-[#858982]">{label}</div>
      <div className="mt-2 font-display text-[30px] leading-none tracking-[-0.04em] text-[#202a40]">{value}</div>
      <div className="mt-2 text-[11px] text-[#858982]">{detail}</div>
    </div>
  );
}

function PronunciationButtons({ text, label, testIdPrefix }: { text: string; label: string; testIdPrefix: string }) {
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const speak = (locale: 'en-US' | 'en-GB') => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = 0.95;
    const localePrefix = locale.toLowerCase();
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find((voice) => voice.lang.toLowerCase() === localePrefix)
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(localePrefix.slice(0, 2)));
    if (matchingVoice) utterance.voice = matchingVoice;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#d6d1c6] bg-[#f6f2e9] p-1" aria-label={`${label} pronunciation`}>
      <span className="px-1.5 font-mono-custom text-[9px] uppercase tracking-[0.12em] text-[#858982]">Audio</span>
      {[
        { locale: 'en-US' as const, shortLabel: 'US' },
        { locale: 'en-GB' as const, shortLabel: 'UK' },
      ].map(({ locale, shortLabel }) => (
        <button
          key={locale}
          type="button"
          data-testid={`${testIdPrefix}-${shortLabel.toLowerCase()}`}
          onClick={() => speak(locale)}
          disabled={!canSpeak}
          title={canSpeak ? `Play ${shortLabel} pronunciation` : 'Speech playback is unavailable in this browser'}
          aria-label={`Play ${label} in ${shortLabel} English`}
          className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold text-[#5f675f] transition-colors hover:bg-[#f3d24f] hover:text-[#202a40] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Volume2 size={12} />
          {shortLabel}
        </button>
      ))}
    </div>
  );
}

function Flashcard({ word, revealed, onReveal, onNext, onPrevious, onShuffle, current, total, isReviewed, onMarkReviewed, onSaveWord }: { word: EditableWord; revealed: boolean; onReveal: () => void; onNext: () => void; onPrevious: () => void; onShuffle: () => void; current: number; total: number; isReviewed: boolean; onMarkReviewed: () => void; onSaveWord: (id: number, changes: WordOverrides) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WordOverrides>({});
  const startEditing = () => {
    setDraft({ word: word.word, type: word.type, level: word.level, translation: word.translation, example: word.example, exampleTranslation: word.exampleTranslation });
    setEditing(true);
  };
  const cancelEditing = () => {
    setDraft({});
    setEditing(false);
  };
  const saveEditing = () => {
    if (Object.values(draft).some((value) => !value?.trim())) return;
    onSaveWord(word.id, draft);
    setEditing(false);
  };
  const updateDraft = (field: keyof WordOverrides, value: string) => setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  const inputClassName = 'mt-1 w-full rounded-lg border border-[#d8d2c6] bg-[#f6f2e9] px-3 py-2 text-sm text-[#202a40] outline-none focus:border-[#24635f] focus:ring-2 focus:ring-[#24635f]/10';
  return (
    <section className="animate-rise" data-testid="section-flashcard">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-mono-custom text-[10px] uppercase tracking-[0.19em] text-[#858982]">Focused practice</div>
          <h2 className="mt-1 font-display text-[27px] tracking-[-0.035em] text-[#202a40]">One word at a time.</h2>
        </div>
        <button type="button" data-testid="button-shuffle" onClick={onShuffle} className="group flex items-center gap-2 rounded-full border border-[#d6d1c6] bg-[#fbf8f1] px-3 py-2 text-xs font-semibold text-[#5f675f] transition-all hover:border-[#ef7657] hover:text-[#c14f39]">
          <Shuffle size={14} className="transition-transform duration-300 group-hover:rotate-180" /> Shuffle
        </button>
      </div>
      <div className="relative overflow-hidden rounded-[26px] border border-[#d4cec0] bg-[#fbf8f1] shadow-[0_14px_34px_rgba(31,41,55,.08)]">
        <div className="flex items-center justify-between border-b border-[#e4ded2] px-6 py-4 sm:px-9">
          <span className="font-mono-custom text-[10px] uppercase tracking-[0.16em] text-[#858982]">Card {String(current + 1).padStart(2, '0')} <span className="text-[#c8c1b2]">/ {String(total).padStart(2, '0')}</span></span>
           <div className="flex items-center gap-2">
             <span className={`rounded-full px-2.5 py-1 font-mono-custom text-[10px] font-medium ${word.level === 'A1' ? 'bg-[#d9eee9] text-[#24635f]' : word.level === 'A2' ? 'bg-[#e5e9d2] text-[#5d6732]' : word.level === 'B1' ? 'bg-[#f8e7ba] text-[#7d5b19]' : 'bg-[#f7d8cd] text-[#a04b39]'}`}>{word.level}</span>
             <button type="button" data-testid="button-edit-word" onClick={startEditing} className="inline-flex items-center gap-1.5 rounded-full border border-[#d6d1c6] bg-[#f6f2e9] px-2.5 py-1.5 text-[11px] font-semibold text-[#5f675f] transition-colors hover:border-[#24635f] hover:text-[#24635f]"><Pencil size={12} /> Edit</button>
           </div>
        </div>
         <div key={`${word.id}-${revealed}-${editing}`} className="card-flip min-h-[340px] px-6 py-10 sm:min-h-[360px] sm:px-12 sm:py-12">
           {editing ? (
             <div className="animate-fade" data-testid="panel-edit-word">
               <div className="flex items-center gap-2 text-[#24635f]"><Pencil size={15} /><span className="font-mono-custom text-[10px] uppercase tracking-[0.17em]">Edit this card</span></div>
               <div className="mt-6 grid gap-4 sm:grid-cols-2">
                 <label className="text-xs font-semibold text-[#5f675f]">English word<input value={draft.word ?? ''} onChange={(event) => updateDraft('word', event.target.value)} className={inputClassName} required /></label>
                 <label className="text-xs font-semibold text-[#5f675f]">Part of speech<input value={draft.type ?? ''} onChange={(event) => updateDraft('type', event.target.value)} className={inputClassName} required /></label>
                 <label className="text-xs font-semibold text-[#5f675f]">CEFR level<input value={draft.level ?? ''} onChange={(event) => updateDraft('level', event.target.value)} className={inputClassName} required /></label>
                 <label className="text-xs font-semibold text-[#5f675f]">Arabic translation<input dir="rtl" value={draft.translation ?? ''} onChange={(event) => updateDraft('translation', event.target.value)} className={`${inputClassName} font-arabic`} required /></label>
                 <label className="text-xs font-semibold text-[#5f675f] sm:col-span-2">English example<textarea value={draft.example ?? ''} onChange={(event) => updateDraft('example', event.target.value)} className={`${inputClassName} min-h-20 resize-y`} required /></label>
                 <label className="text-xs font-semibold text-[#5f675f] sm:col-span-2">Arabic example translation<textarea dir="rtl" value={draft.exampleTranslation ?? ''} onChange={(event) => updateDraft('exampleTranslation', event.target.value)} className={`${inputClassName} min-h-20 resize-y font-arabic`} required /></label>
               </div>
               <div className="mt-6 flex justify-end gap-2">
                 <button type="button" onClick={cancelEditing} className="inline-flex items-center gap-1.5 rounded-full border border-[#d6d1c6] px-3 py-2 text-xs font-semibold text-[#737970] hover:bg-[#eee8dc]"><X size={14} /> Cancel</button>
                 <button type="button" data-testid="button-save-word" onClick={saveEditing} className="inline-flex items-center gap-1.5 rounded-full bg-[#24635f] px-3.5 py-2 text-xs font-semibold text-[#f9f5e9] hover:bg-[#1c514e]"><Save size={14} /> Save changes</button>
               </div>
             </div>
           ) : (
             <>
          <div className="flex items-center gap-2 text-[#ef7657]">
            <span className="h-2 w-2 rounded-full bg-[#ef7657]" />
            <span className="font-mono-custom text-[10px] uppercase tracking-[0.17em]">{word.type}</span>
          </div>
          <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-2">
            <h3 className="font-display text-[clamp(3.5rem,8vw,6.2rem)] leading-[.9] tracking-[-0.065em] text-[#202a40]" data-testid="text-current-word">{word.word}</h3>
             <PronunciationButtons text={word.word} label={`the word ${word.word}`} testIdPrefix="button-pronounce-word" />
          </div>
          {revealed ? (
            <div className="animate-fade mt-8 border-t border-[#e4ded2] pt-6" data-testid="panel-answer">
              <div className="font-arabic text-[26px] font-semibold leading-tight text-[#24635f]" dir="rtl" data-testid="text-translation">{word.translation}</div>
               <div className="mt-5 grid gap-3 border-l-2 border-[#f3d24f] pl-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                 <div className="grid gap-2">
                   <p className="text-[15px] leading-relaxed text-[#3d4651]" data-testid="text-example">“{word.example}”</p>
                   <p className="font-arabic text-[13px] leading-relaxed text-[#858982]" dir="rtl" data-testid="text-example-translation">{word.exampleTranslation}</p>
                 </div>
                 <PronunciationButtons text={word.example} label="the example sentence" testIdPrefix="button-pronounce-example" />
              </div>
            </div>
          ) : (
            <button type="button" data-testid="button-reveal" onClick={onReveal} className="mt-9 flex items-center gap-2 border-b border-dashed border-[#9da398] pb-1 text-sm font-semibold text-[#5f675f] transition-colors hover:border-[#ef7657] hover:text-[#c14f39]">Tap to reveal <ArrowRight size={15} /></button>
          )}
             </>
           )}
        </div>
        <div className="flex items-center justify-between border-t border-[#e4ded2] px-5 py-4 sm:px-9">
          <button type="button" data-testid="button-previous" onClick={onPrevious} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-[#737970] transition-colors hover:bg-[#eee8dc] hover:text-[#202a40]"><ArrowLeft size={15} /> Previous</button>
          <button type="button" data-testid="button-mark-known" onClick={onMarkReviewed} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all ${isReviewed ? 'bg-[#d9eee9] text-[#24635f]' : 'text-[#737970] hover:bg-[#f3d24f] hover:text-[#202a40]'}`}><Check size={14} /> {isReviewed ? 'In your rhythm' : 'I know this'}</button>
          <button type="button" data-testid="button-next" onClick={onNext} className="flex items-center gap-2 rounded-lg bg-[#202a40] px-3.5 py-2.5 text-xs font-semibold text-[#f9f5e9] transition-all hover:-translate-y-0.5 hover:bg-[#2c3852]">Next word <ArrowRight size={15} /></button>
        </div>
      </div>
    </section>
  );
}

function Filters({ search, setSearch, level, setLevel, part, setPart, resultCount }: { search: string; setSearch: (value: string) => void; level: string; setLevel: (value: string) => void; part: string; setPart: (value: string) => void; resultCount: number }) {
  return (
    <div className="rounded-2xl border border-[#ded8ca] bg-[#fbf8f1] p-3 shadow-[0_2px_5px_rgba(31,41,55,.03)]" data-testid="panel-filters">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969b91]" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search English or Arabic" data-testid="input-search" className="h-11 w-full rounded-xl border border-[#ded8ca] bg-[#f6f2e9] pl-10 pr-10 text-sm text-[#202a40] outline-none transition-colors placeholder:text-[#9b9e96] focus:border-[#24635f] focus:ring-2 focus:ring-[#24635f]/10" />
          {search && <button type="button" data-testid="button-clear-search" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#969b91] hover:text-[#202a40]" aria-label="Clear search"><X size={15} /></button>}
        </label>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <span className="sr-only">CEFR level</span>
            <select value={level} onChange={(e) => setLevel(e.target.value)} data-testid="select-level" className="h-11 min-w-[128px] appearance-none rounded-xl border border-[#ded8ca] bg-[#f6f2e9] px-3.5 pr-8 text-xs font-semibold text-[#49534d] outline-none focus:border-[#24635f]">
              {levelOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#858982]" />
          </label>
          <label className="relative">
            <span className="sr-only">Part of speech</span>
            <select value={part} onChange={(e) => setPart(e.target.value)} data-testid="select-part" className="h-11 min-w-[140px] appearance-none rounded-xl border border-[#ded8ca] bg-[#f6f2e9] px-3.5 pr-8 text-xs font-semibold capitalize text-[#49534d] outline-none focus:border-[#24635f]">
              {typeOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#858982]" />
          </label>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-[#858982]"><ListFilter size={13} /> <span data-testid="text-result-count">{resultCount} words in view</span></div>
    </div>
  );
}

function BrowseList({ words, onSelect }: { words: EditableWord[]; onSelect: (word: EditableWord) => void }) {
  return (
    <section className="animate-rise mt-6" data-testid="section-word-library">
      <div className="mb-4 flex items-end justify-between">
        <div><div className="font-mono-custom text-[10px] uppercase tracking-[0.19em] text-[#858982]">The whole shelf</div><h2 className="mt-1 font-display text-[27px] tracking-[-0.035em] text-[#202a40]">Browse the library.</h2></div>
        <span className="hidden text-xs text-[#858982] sm:block">Select a word to study it</span>
      </div>
      {words.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#c9c2b5] bg-[#fbf8f1] px-6 py-16 text-center" data-testid="empty-search-results"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f7d8cd] text-[#a04b39]"><Search size={18} /></div><h3 className="mt-4 font-display text-xl text-[#202a40]">No words match that search.</h3><p className="mt-1 text-sm text-[#858982]">Try a different spelling, level, or part of speech.</p></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#ded8ca] bg-[#fbf8f1]" data-testid="list-words">
          {words.map((word, index) => (
            <button type="button" key={word.id} data-testid={`button-word-${word.id}`} onClick={() => onSelect(word)} className="group flex w-full items-center gap-4 border-b border-[#e8e2d7] px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[#f5edda] sm:px-6">
              <span className="w-6 font-mono-custom text-[10px] text-[#afb1a8]">{String(index + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1"><span className="block font-display text-[22px] leading-none tracking-[-.02em] text-[#202a40] transition-colors group-hover:text-[#24635f]">{word.word}</span><span className="font-arabic mt-1 block text-xs text-[#858982]" dir="rtl">{word.translation}</span></span>
              <span className="hidden rounded-full bg-[#e9e3d7] px-2.5 py-1 font-mono-custom text-[10px] capitalize text-[#666d65] sm:block">{word.type}</span>
              <span className="w-8 text-center font-mono-custom text-[10px] text-[#24635f]">{word.level}</span>
              <ArrowRight size={15} className="text-[#b7b8b0] transition-transform group-hover:translate-x-1 group-hover:text-[#ef7657]" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function StudyHome({ words, currentIndex, setCurrentIndex, reviewed, markReviewed, onSaveWord }: { words: EditableWord[]; currentIndex: number; setCurrentIndex: (index: number) => void; reviewed: Set<number>; markReviewed: (id: number) => void; onSaveWord: (id: number, changes: WordOverrides) => void }) {
  const [revealed, setRevealed] = useState(false);
  const current = words[currentIndex] ?? words[0];
  const goalPercent = Math.min(100, (reviewed.size / oxford3000.length) * 100);
  useEffect(() => { setRevealed(false); }, [current?.id]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') { event.preventDefault(); setRevealed((value) => !value); }
      if (event.key === 'ArrowRight') setCurrentIndex(Math.min(words.length - 1, currentIndex + 1));
      if (event.key === 'ArrowLeft') setCurrentIndex(Math.max(0, currentIndex - 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, setCurrentIndex, words.length]);
  if (!current) return <div className="rounded-2xl border border-dashed border-[#c9c2b5] p-10 text-center">No word to study yet.</div>;
  const next = () => setCurrentIndex((currentIndex + 1) % words.length);
  const previous = () => setCurrentIndex((currentIndex - 1 + words.length) % words.length);
  const shuffle = () => setCurrentIndex(Math.floor(Math.random() * words.length));
  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div>
         <Flashcard word={current} revealed={revealed} onReveal={() => setRevealed(true)} onNext={next} onPrevious={previous} onShuffle={shuffle} current={currentIndex} total={words.length} isReviewed={reviewed.has(current.id)} onMarkReviewed={() => markReviewed(current.id)} onSaveWord={onSaveWord} />
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#9a9e94]" data-testid="text-keyboard-hint"><span className="rounded border border-[#d8d2c6] bg-[#fbf8f1] px-1.5 py-0.5 font-mono-custom text-[10px]">space</span> to reveal <span className="mx-1 text-[#c5c0b5]">·</span> <span className="rounded border border-[#d8d2c6] bg-[#fbf8f1] px-1.5 py-0.5 font-mono-custom text-[10px]">← →</span> to move</div>
      </div>
      <aside className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl bg-[#24635f] p-5 text-[#f9f5e9]">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border-[18px] border-[#4c8a81]/40" />
           <div className="relative flex items-start justify-between"><div><div className="font-mono-custom text-[9px] uppercase tracking-[.18em] text-[#b9d5ca]">Your 3,000 goal</div><div className="mt-2 font-display text-[38px] leading-none">{reviewed.size} <span className="font-sans text-[15px] font-medium text-[#b9d5ca]">/ 3,000</span></div></div><div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `conic-gradient(#f3d24f ${goalPercent}%, #3d7972 ${goalPercent}%)` }}><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#24635f] font-mono-custom text-[10px] text-[#f3d24f]">{goalPercent.toFixed(1)}%</div></div></div>
           <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[#1d5653]"><div className="h-full rounded-full bg-[#f3d24f] transition-all duration-500" style={{ width: `${goalPercent}%` }} /></div>
          <p className="mt-3 text-xs leading-relaxed text-[#d5e5dc]">A small, steady shelf becomes fluency.</p>
        </div>
        <div className="rounded-2xl border border-[#ded8ca] bg-[#fbf8f1] p-5">
          <div className="flex items-center justify-between"><h3 className="font-semibold text-[#202a40]">Level map</h3><span className="font-mono-custom text-[9px] uppercase tracking-[.14em] text-[#858982]">Words</span></div>
          <div className="mt-5 space-y-4">
             {['A1', 'A2', 'B1', 'B2'].map((level, index) => { const count = oxford3000.filter((word) => word.level === level).length; const maxLevelCount = 800; return <div key={level} className="flex items-center gap-3"><span className="w-6 font-mono-custom text-[10px] text-[#858982]">{level}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e9e3d7]"><div className={`h-full rounded-full ${index === 0 ? 'bg-[#24635f]' : index === 1 ? 'bg-[#6e9d83]' : index === 2 ? 'bg-[#e5ad48]' : 'bg-[#ef7657]'}`} style={{ width: `${(count / maxLevelCount) * 100}%` }} /></div><span className="w-8 text-right font-mono-custom text-[10px] text-[#858982]">{count}</span></div>; })}
          </div>
          <button type="button" data-testid="button-view-library" onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })} className="mt-6 flex w-full items-center justify-between border-t border-[#e8e2d7] pt-4 text-xs font-semibold text-[#24635f] hover:text-[#ef7657]">Explore all words <ArrowRight size={14} /></button>
        </div>
        <div className="rounded-2xl border border-[#ded8ca] bg-[#f5edda] p-5">
          <div className="flex items-center gap-2 text-[#c45a42]"><BookOpen size={15} /><span className="font-mono-custom text-[9px] uppercase tracking-[.16em]">Study note</span></div>
          <p className="mt-3 font-display text-[19px] leading-snug text-[#202a40]">“See the word in a sentence. That is where it starts to belong to you.”</p>
          <p className="mt-3 font-arabic text-[12px] text-[#858982]" dir="rtl">الكلمة تعيش في الجملة.</p>
        </div>
      </aside>
    </div>
  );
}

function AllDaysOverview({ days, reviewed, completedDays, onSelectDay }: { days: EditableWord[][]; reviewed: Set<number>; completedDays: Set<number>; onSelectDay: (dayIndex: number) => void }) {
  return (
    <section className="animate-rise" data-testid="section-all-days">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 font-mono-custom text-[10px] uppercase tracking-[.21em] text-[#24635f]"><span className="h-2 w-2 rounded-full bg-[#ef7657]" /> A steady path through every word</div>
          <h1 className="mt-3 max-w-[680px] font-display text-[clamp(2.6rem,5.3vw,4.7rem)] leading-[.92] tracking-[-.065em] text-[#202a40]" data-testid="heading-all-days">All days, one <em className="text-[#24635f]">steady rhythm.</em></h1>
          <p className="mt-4 max-w-[510px] text-[14px] leading-relaxed text-[#71776f]">Your complete vocabulary journey, arranged in focused daily sets of twelve words.</p>
        </div>
        <div className="text-left md:text-right">
          <div className="font-mono-custom text-[10px] uppercase tracking-[.15em] text-[#858982]">Your daily map</div>
          <div className="mt-1 font-display text-[31px] leading-none text-[#202a40]">{days.length} <span className="font-sans text-sm font-medium text-[#71776f]">days</span></div>
        </div>
      </div>
      <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {days.map((dayWords, dayIndex) => {
          const reviewedCount = dayWords.filter((word) => reviewed.has(word.id)).length;
          const isComplete = completedDays.has(dayIndex + 1) || (dayWords.length > 0 && reviewedCount === dayWords.length);
          const firstWord = dayWords[0]?.word ?? '';
          const lastWord = dayWords[dayWords.length - 1]?.word ?? '';
          return (
            <button
              type="button"
              key={dayIndex}
              data-testid={`button-all-days-day-${dayIndex + 1}`}
              onClick={() => onSelectDay(dayIndex)}
              className="group relative overflow-hidden rounded-2xl border border-[#ded8ca] bg-[#fbf8f1] p-5 text-left shadow-[0_2px_5px_rgba(31,41,55,.03)] transition-all duration-200 hover:-translate-y-1 hover:border-[#24635f] hover:shadow-[0_10px_22px_rgba(31,41,55,.08)]"
            >
              <div className="absolute right-0 top-0 h-1 w-14 bg-[#f3d24f] transition-all duration-200 group-hover:w-24" />
              <div className="flex items-center justify-between">
                <span className="font-mono-custom text-[10px] uppercase tracking-[.17em] text-[#858982]">Daily set</span>
                {isComplete ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#d9eee9] px-2 py-1 font-mono-custom text-[9px] uppercase tracking-[.08em] text-[#24635f]"><Check size={11} /> Complete</span>
                ) : (
                  <ArrowRight size={15} className="text-[#b7b8b0] transition-transform group-hover:translate-x-1 group-hover:text-[#ef7657]" />
                )}
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                <h2 className="font-display text-[29px] leading-none tracking-[-.04em] text-[#202a40]">Day {dayIndex + 1}</h2>
                <span className="rounded-full bg-[#e9e3d7] px-2.5 py-1 font-mono-custom text-[9px] text-[#666d65]">{dayWords.length} words</span>
              </div>
              <p className="mt-4 truncate text-xs text-[#71776f]" title={`${firstWord} — ${lastWord}`}>{firstWord} <span className="text-[#c6bfb1]">to</span> {lastWord}</p>
              <div className="mt-5 flex items-center gap-3 border-t border-[#e8e2d7] pt-4">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e9e3d7]">
                  <div className="h-full rounded-full bg-[#24635f] transition-all duration-500" style={{ width: `${dayWords.length ? (reviewedCount / dayWords.length) * 100 : 0}%` }} />
                </div>
                <span className="font-mono-custom text-[10px] text-[#858982]">{reviewedCount}/{dayWords.length}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AllDaysDetail({ dayNumber, words, reviewed, onBack }: { dayNumber: number; words: EditableWord[]; reviewed: Set<number>; onBack: () => void }) {
  const reviewedCount = words.filter((word) => reviewed.has(word.id)).length;
  return (
    <section className="animate-rise" data-testid="section-all-days-detail">
      <button type="button" data-testid="button-all-days-back" onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-[#d6d1c6] bg-[#fbf8f1] px-3.5 py-2 text-xs font-semibold text-[#5f675f] transition-colors hover:border-[#24635f] hover:text-[#24635f]">
        <ArrowLeft size={14} /> All Days
      </button>
      <div className="mt-8 flex flex-col justify-between gap-5 border-b border-[#ded8ca] pb-7 md:flex-row md:items-end">
        <div>
          <div className="font-mono-custom text-[10px] uppercase tracking-[.19em] text-[#858982]">Daily vocabulary set</div>
          <h1 className="mt-2 font-display text-[clamp(2.8rem,5vw,4.8rem)] leading-[.92] tracking-[-.065em] text-[#202a40]" data-testid="heading-day-detail">Day {dayNumber}</h1>
          <p className="mt-3 font-arabic text-sm text-[#71776f]" dir="rtl">اليوم {dayNumber} · {words.length} كلمة</p>
        </div>
        <div className="rounded-2xl border border-[#ded8ca] bg-[#f5edda] px-4 py-3 text-left md:text-right">
          <div className="font-mono-custom text-[9px] uppercase tracking-[.16em] text-[#858982]">Progress</div>
          <div className="mt-1 font-display text-2xl text-[#202a40]">{reviewedCount} <span className="font-sans text-xs text-[#71776f]">/ {words.length} reviewed</span></div>
        </div>
      </div>
      <div className="mt-7 overflow-hidden rounded-2xl border border-[#ded8ca] bg-[#fbf8f1]" data-testid="list-all-days-words">
        {words.map((word, wordIndex) => (
          <article key={word.id} data-testid={`card-all-days-word-${word.id}`} className="grid gap-3 border-b border-[#e8e2d7] px-4 py-4 last:border-b-0 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-6">
            <span className="font-mono-custom text-[10px] text-[#afb1a8]">{String(wordIndex + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[25px] leading-none tracking-[-.02em] text-[#202a40]">{word.word}</h2>
                <span className="rounded-full bg-[#e9e3d7] px-2 py-1 font-mono-custom text-[9px] uppercase text-[#666d65]">{word.type}</span>
              </div>
              <p className="font-arabic mt-2 text-sm text-[#24635f]" dir="rtl">{word.translation}</p>
            </div>
            <div className="flex items-center gap-3 sm:justify-end">
              <span className={`rounded-full px-2.5 py-1 font-mono-custom text-[10px] ${word.level === 'A1' ? 'bg-[#d9eee9] text-[#24635f]' : word.level === 'A2' ? 'bg-[#e5e9d2] text-[#5d6732]' : word.level === 'B1' ? 'bg-[#f8e7ba] text-[#7d5b19]' : 'bg-[#f7d8cd] text-[#a04b39]'}`}>{word.level}</span>
              {reviewed.has(word.id) && <span className="inline-flex items-center gap-1 font-mono-custom text-[9px] uppercase tracking-[.1em] text-[#24635f]"><Check size={12} /> Reviewed</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AllDaysView({ days, reviewed, completedDays, selectedDayIndex, onSelectDay, onBack }: { days: EditableWord[][]; reviewed: Set<number>; completedDays: Set<number>; selectedDayIndex: number | null; onSelectDay: (dayIndex: number) => void; onBack: () => void }) {
  const selectedDay = selectedDayIndex === null ? undefined : days[selectedDayIndex];
  if (selectedDay && selectedDayIndex !== null) {
    return <AllDaysDetail dayNumber={selectedDayIndex + 1} words={selectedDay} reviewed={reviewed} onBack={onBack} />;
  }
  return <AllDaysOverview days={days} reviewed={reviewed} completedDays={completedDays} onSelectDay={onSelectDay} />;
}

function Home() {
  const { isLoaded: authLoaded, isSignedIn, user } = useUser();
  const progressQuery = useGetProgress({
    query: { queryKey: getGetProgressQueryKey(), enabled: authLoaded && !!isSignedIn, staleTime: 0 },
  });
  const saveProgressMutation = useSaveProgress({
    mutation: {
      onSuccess: (savedProgress) => {
        queryClient.setQueryData(getGetProgressQueryKey(), savedProgress);
      },
    },
  });
  const [view, setView] = useState<AppView>('study');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('All levels');
  const [part, setPart] = useState('All parts');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState<Set<number>>(readReviewedIds);
  const [reviewDates, setReviewDates] = useState<Record<string, string>>(readReviewDates);
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [wordOverrides, setWordOverrides] = useState<Record<string, WordOverrides>>(readWordOverrides);
  const authUserRef = useRef<string | null | undefined>(undefined);
  const hydratedUserRef = useRef<string | null>(null);
  const today = localDateKey();
  const reviewedToday = Object.values(reviewDates).filter((date) => date === today).length;
  const currentStreak = getCurrentStreak(reviewDates);
  const editableWords = useMemo(() => sourceWords.map((word) => ({ ...word, ...(wordOverrides[word.id] ?? {}) })), [wordOverrides]);
  const days = useMemo(() => splitIntoDays(editableWords), [editableWords]);
  useEffect(() => {
    if (!authLoaded) return;
    const userId = isSignedIn ? user?.id ?? null : null;
    if (authUserRef.current === userId) return;

    authUserRef.current = userId;
    hydratedUserRef.current = null;
    if (userId) {
      const mergedReviewed = new Set([...readReviewedIds(userId), ...readReviewedIds()]);
      const mergedReviewDates = { ...readReviewDates(userId), ...readReviewDates() };
      setReviewed(mergedReviewed);
      setReviewDates(mergedReviewDates);
      setCompletedDays(new Set(getCompletedDayNumbers(days, mergedReviewed)));
      window.localStorage.setItem(getStorageKey(reviewedStorageKey, userId), JSON.stringify([...mergedReviewed]));
      window.localStorage.setItem(getStorageKey(reviewDatesStorageKey, userId), JSON.stringify(mergedReviewDates));
      window.localStorage.removeItem(reviewedStorageKey);
      window.localStorage.removeItem(reviewDatesStorageKey);
    } else {
      const guestReviewed = readReviewedIds();
      setReviewed(guestReviewed);
      setReviewDates(readReviewDates());
      setCompletedDays(new Set(getCompletedDayNumbers(days, guestReviewed)));
    }
  }, [authLoaded, isSignedIn, user?.id, days]);

  useEffect(() => {
    if (!authLoaded || !isSignedIn || !user?.id || progressQuery.isLoading || !progressQuery.data || hydratedUserRef.current === user.id) return;

    const serverReviewed = new Set(progressQuery.data.completedWordIds.filter((id) => sourceWords.some((word) => word.id === id)));
    const mergedReviewed = new Set([...reviewed, ...serverReviewed]);
    const mergedCompletedDays = new Set([
      ...progressQuery.data.completedDayNumbers,
      ...getCompletedDayNumbers(days, mergedReviewed),
    ]);
    const payload: ProgressInput = {
      completedWordIds: [...mergedReviewed].sort((a, b) => a - b),
      completedDayNumbers: [...mergedCompletedDays].sort((a, b) => a - b),
    };
    setReviewed(mergedReviewed);
    setCompletedDays(mergedCompletedDays);
    window.localStorage.setItem(getStorageKey(reviewedStorageKey, user.id), JSON.stringify(payload.completedWordIds));
    window.localStorage.setItem(getStorageKey(reviewDatesStorageKey, user.id), JSON.stringify(reviewDates));
    if (
      payload.completedWordIds.length !== progressQuery.data.completedWordIds.length ||
      payload.completedDayNumbers.length !== progressQuery.data.completedDayNumbers.length
    ) {
      saveProgressMutation.mutate({ data: payload });
    }
    hydratedUserRef.current = user.id;
  }, [authLoaded, isSignedIn, user?.id, progressQuery.data, progressQuery.isLoading, reviewed, days, reviewDates, saveProgressMutation]);
  const filteredWords = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return editableWords.filter((word) => {
      const matchesSearch = !normalized || word.word.toLocaleLowerCase().includes(normalized) || word.translation.includes(search.trim());
      const matchesLevel = level === 'All levels' || word.level === level;
      const matchesPart = part === 'All parts' || word.type.toLowerCase().includes(part.toLowerCase());
      return matchesSearch && matchesLevel && matchesPart;
    });
  }, [editableWords, search, level, part]);
  useEffect(() => { if (currentIndex >= filteredWords.length) setCurrentIndex(0); }, [currentIndex, filteredWords.length]);
  const markReviewed = (id: number) => {
    setReviewed((existing) => {
      const next = new Set(existing);
      next.add(id);
      const completedDayNumbers = getCompletedDayNumbers(days, next);
      const userId = isSignedIn ? user?.id : undefined;
      window.localStorage.setItem(getStorageKey(reviewedStorageKey, userId), JSON.stringify([...next]));
      setCompletedDays(new Set(completedDayNumbers));
      if (userId) {
        saveProgressMutation.mutate({
          data: {
            completedWordIds: [...next].sort((a, b) => a - b),
            completedDayNumbers,
          },
        });
      }
      return next;
    });
    setReviewDates((existing) => {
      const next = { ...existing, [id]: today };
      window.localStorage.setItem(getStorageKey(reviewDatesStorageKey, isSignedIn ? user?.id : undefined), JSON.stringify(next));
      return next;
    });
  };
  const selectWord = (word: EditableWord) => { const index = filteredWords.findIndex((item) => item.id === word.id); setCurrentIndex(Math.max(index, 0)); setView('study'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const navigate = (nextView: AppView) => { setView(nextView); if (nextView === 'all-days') setSelectedDayIndex(null); };
  const selectDay = (dayIndex: number) => { setSelectedDayIndex(dayIndex); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const saveWord = (id: number, changes: WordOverrides) => {
    setWordOverrides((existing) => {
      const next = { ...existing, [id]: changes };
      window.localStorage.setItem(overridesStorageKey, JSON.stringify(next));
      return next;
    });
  };
  const resetSession = () => {
    setReviewed(new Set());
    setReviewDates({});
    setCompletedDays(new Set());
    const userId = isSignedIn ? user?.id : undefined;
    window.localStorage.removeItem(getStorageKey(reviewedStorageKey, userId));
    window.localStorage.removeItem(getStorageKey(reviewDatesStorageKey, userId));
    if (userId) {
      saveProgressMutation.mutate({
        data: { completedWordIds: [], completedDayNumbers: [] },
      });
    }
  };
  const nextMilestone = reviewed.size >= oxford3000.length ? oxford3000.length : Math.min(oxford3000.length, Math.ceil((reviewed.size + 1) / 200) * 200);
  const wordsToMilestone = Math.max(0, nextMilestone - reviewed.size);
  return (
    <div className="paper-grain min-h-[100dvh] bg-[#f6f2e9]">
      <Sidebar view={view} setView={navigate} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} onReset={resetSession} reviewedToday={reviewedToday} />
      <TopBar view={view} setView={navigate} openMenu={() => setMobileOpen(true)} />
      <main className="ml-0 px-5 pb-16 pt-9 md:ml-[264px] md:px-10 md:pt-12">
        <div className="mx-auto max-w-[1250px]">
          {view === 'all-days' ? (
            <AllDaysView days={days} reviewed={reviewed} completedDays={completedDays} selectedDayIndex={selectedDayIndex} onSelectDay={selectDay} onBack={() => setSelectedDayIndex(null)} />
          ) : (
            <>
          <div className="animate-rise mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><div className="flex items-center gap-2 font-mono-custom text-[10px] uppercase tracking-[.21em] text-[#24635f]"><span className="h-2 w-2 rounded-full bg-[#ef7657]" /> Your learning desk</div><h1 className="mt-3 max-w-[620px] font-display text-[clamp(2.6rem,5.3vw,4.7rem)] leading-[.92] tracking-[-.065em] text-[#202a40]" data-testid="heading-page">{view === 'study' ? <>Make room for <em className="text-[#24635f]">better English.</em></> : <>Every word has a <em className="text-[#24635f]">place.</em></>}</h1><p className="mt-4 max-w-[470px] text-[14px] leading-relaxed text-[#71776f]">{view === 'study' ? 'A calm, focused practice for Arabic speakers. Meet a word, meet it again, then make it yours.' : 'Search the Oxford 3000 by meaning, level, or part of speech. Your next useful word is nearby.'}</p></div>
            <div className="flex items-center gap-2 text-right"><div><div className="font-mono-custom text-[10px] uppercase tracking-[.15em] text-[#858982]">Current streak</div><div className="mt-1 text-sm font-semibold text-[#202a40]">{currentStreak} {currentStreak === 1 ? 'day' : 'days'} <span className="ml-1 text-[#ef7657]">/</span> {currentStreak ? 'keep going' : 'start today'}</div></div><div className="ml-2 flex h-11 w-11 items-center justify-center rounded-full border border-[#e6c94d] bg-[#f3d24f] font-display text-xl text-[#202a40]">{currentStreak}</div></div>
          </div>
            <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Words met" value={String(reviewed.size)} detail="of 3,000 in your goal" accent="bg-[#24635f]" /><StatCard label="In this view" value={String(filteredWords.length)} detail="matching your filters" accent="bg-[#ef7657]" /><StatCard label="Daily rhythm" value={`${Math.min(reviewedToday, dailyGoal)} / ${dailyGoal}`} detail="words in today's session" accent="bg-[#f3d24f]" /><StatCard label="Next milestone" value={reviewed.size >= oxford3000.length ? 'Complete' : String(nextMilestone)} detail={reviewed.size >= oxford3000.length ? 'Oxford 3000 finished' : `${wordsToMilestone} words to go`} accent="bg-[#779c7b]" /></div>
          <Filters search={search} setSearch={setSearch} level={level} setLevel={setLevel} part={part} setPart={setPart} resultCount={filteredWords.length} />
           <div className="mt-8" id="library">{view === 'study' ? <StudyHome words={filteredWords} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} reviewed={reviewed} markReviewed={markReviewed} onSaveWord={saveWord} /> : <BrowseList words={filteredWords} onSelect={selectWord} />}</div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch>;
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f6f2e9] px-4 py-8">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f6f2e9] px-4 py-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to keep your learning rhythm.' } },
        signUp: { start: { title: 'Create your account', subtitle: 'Save your Oxford 3000 progress anywhere.' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <Switch>
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route component={Router} />
            </Switch>
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;