import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Command, Layers3, ListFilter, Menu, RotateCcw, Search, Shuffle, Sparkles, Volume2, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { oxford3000, type OxfordWord } from './oxford3000';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const levelOptions = ['All levels', 'A1', 'A2', 'B1', 'B2'];
const typeOptions = ['All parts', 'Noun', 'Verb', 'Adjective', 'Adverb', 'Preposition'];
const reviewedStorageKey = 'wordroom-reviewed';
const reviewDatesStorageKey = 'wordroom-review-dates';
const dailyGoal = 12;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readReviewedIds() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(reviewedStorageKey) ?? '[]') as unknown;
    if (!Array.isArray(saved)) return new Set<number>();
    const validIds = new Set<number>(oxford3000.map((word) => word.id));
    return new Set(saved.filter((id): id is number => typeof id === 'number' && validIds.has(id)));
  } catch {
    return new Set<number>();
  }
}

function readReviewDates() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(reviewDatesStorageKey) ?? '{}') as unknown;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([, date]) => typeof date === 'string')) as Record<string, string>;
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

function Sidebar({ view, setView, mobileOpen, closeMobile, onReset, reviewedToday }: { view: 'study' | 'browse'; setView: (view: 'study' | 'browse') => void; mobileOpen: boolean; closeMobile: () => void; onReset: () => void; reviewedToday: number }) {
  const nav = [
    { id: 'study' as const, label: 'Study room', arabic: 'غرفة الدراسة', icon: Sparkles },
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

function TopBar({ view, setView, openMenu }: { view: 'study' | 'browse'; setView: (view: 'study' | 'browse') => void; openMenu: () => void }) {
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
        <div className="ml-2 flex h-9 w-9 items-center justify-center rounded-full border border-[#ded8ca] bg-[#e9dfce] text-xs font-bold text-[#202a40]" data-testid="avatar-user">AM</div>
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

function Flashcard({ word, revealed, onReveal, onNext, onPrevious, onShuffle, current, total, isReviewed, onMarkReviewed }: { word: OxfordWord; revealed: boolean; onReveal: () => void; onNext: () => void; onPrevious: () => void; onShuffle: () => void; current: number; total: number; isReviewed: boolean; onMarkReviewed: () => void }) {
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
          <span className={`rounded-full px-2.5 py-1 font-mono-custom text-[10px] font-medium ${word.level === 'A1' ? 'bg-[#d9eee9] text-[#24635f]' : word.level === 'A2' ? 'bg-[#e5e9d2] text-[#5d6732]' : word.level === 'B1' ? 'bg-[#f8e7ba] text-[#7d5b19]' : 'bg-[#f7d8cd] text-[#a04b39]'}`}>{word.level}</span>
        </div>
        <div key={`${word.id}-${revealed}`} className="card-flip min-h-[340px] px-6 py-10 sm:min-h-[360px] sm:px-12 sm:py-12">
          <div className="flex items-center gap-2 text-[#ef7657]">
            <span className="h-2 w-2 rounded-full bg-[#ef7657]" />
            <span className="font-mono-custom text-[10px] uppercase tracking-[0.17em]">{word.type}</span>
          </div>
          <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-2">
            <h3 className="font-display text-[clamp(3.5rem,8vw,6.2rem)] leading-[.9] tracking-[-0.065em] text-[#202a40]" data-testid="text-current-word">{word.word}</h3>
            <button type="button" data-testid="button-pronounce" onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(word.word))} className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#e9e3d7] text-[#5f675f] transition-colors hover:bg-[#f3d24f] hover:text-[#202a40]" aria-label={`Pronounce ${word.word}`}><Volume2 size={16} /></button>
          </div>
          {revealed ? (
            <div className="animate-fade mt-8 border-t border-[#e4ded2] pt-6" data-testid="panel-answer">
              <div className="font-arabic text-[26px] font-semibold leading-tight text-[#24635f]" dir="rtl" data-testid="text-translation">{word.translation}</div>
              <div className="mt-5 grid gap-2 border-l-2 border-[#f3d24f] pl-4">
                <p className="text-[15px] leading-relaxed text-[#3d4651]" data-testid="text-example">“{word.example}”</p>
                <p className="font-arabic text-[13px] leading-relaxed text-[#858982]" dir="rtl" data-testid="text-example-translation">{word.exampleTranslation}</p>
              </div>
            </div>
          ) : (
            <button type="button" data-testid="button-reveal" onClick={onReveal} className="mt-9 flex items-center gap-2 border-b border-dashed border-[#9da398] pb-1 text-sm font-semibold text-[#5f675f] transition-colors hover:border-[#ef7657] hover:text-[#c14f39]">Tap to reveal <ArrowRight size={15} /></button>
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

function BrowseList({ words, onSelect }: { words: OxfordWord[]; onSelect: (word: OxfordWord) => void }) {
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

function StudyHome({ words, currentIndex, setCurrentIndex, reviewed, markReviewed }: { words: OxfordWord[]; currentIndex: number; setCurrentIndex: (index: number) => void; reviewed: Set<number>; markReviewed: (id: number) => void }) {
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
        <Flashcard word={current} revealed={revealed} onReveal={() => setRevealed(true)} onNext={next} onPrevious={previous} onShuffle={shuffle} current={currentIndex} total={words.length} isReviewed={reviewed.has(current.id)} onMarkReviewed={() => markReviewed(current.id)} />
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

function Home() {
  const [view, setView] = useState<'study' | 'browse'>('study');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('All levels');
  const [part, setPart] = useState('All parts');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewed, setReviewed] = useState<Set<number>>(readReviewedIds);
  const [reviewDates, setReviewDates] = useState<Record<string, string>>(readReviewDates);
  const today = localDateKey();
  const reviewedToday = Object.values(reviewDates).filter((date) => date === today).length;
  const currentStreak = getCurrentStreak(reviewDates);
  const filteredWords = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return oxford3000.filter((word) => {
      const matchesSearch = !normalized || word.word.toLocaleLowerCase().includes(normalized) || word.translation.includes(search.trim());
      const matchesLevel = level === 'All levels' || word.level === level;
      const matchesPart = part === 'All parts' || word.type.toLowerCase().includes(part.toLowerCase());
      return matchesSearch && matchesLevel && matchesPart;
    });
  }, [search, level, part]);
  useEffect(() => { if (currentIndex >= filteredWords.length) setCurrentIndex(0); }, [currentIndex, filteredWords.length]);
  const markReviewed = (id: number) => {
    setReviewed((existing) => {
      const next = new Set(existing);
      next.add(id);
      window.localStorage.setItem(reviewedStorageKey, JSON.stringify([...next]));
      return next;
    });
    setReviewDates((existing) => {
      const next = { ...existing, [id]: today };
      window.localStorage.setItem(reviewDatesStorageKey, JSON.stringify(next));
      return next;
    });
  };
  const selectWord = (word: OxfordWord) => { const index = filteredWords.findIndex((item) => item.id === word.id); setCurrentIndex(Math.max(index, 0)); setView('study'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const resetSession = () => {
    setReviewed(new Set());
    setReviewDates({});
    window.localStorage.removeItem(reviewedStorageKey);
    window.localStorage.removeItem(reviewDatesStorageKey);
  };
  const nextMilestone = reviewed.size >= oxford3000.length ? oxford3000.length : Math.min(oxford3000.length, Math.ceil((reviewed.size + 1) / 200) * 200);
  const wordsToMilestone = Math.max(0, nextMilestone - reviewed.size);
  return (
    <div className="paper-grain min-h-[100dvh] bg-[#f6f2e9]">
      <Sidebar view={view} setView={setView} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} onReset={resetSession} reviewedToday={reviewedToday} />
      <TopBar view={view} setView={setView} openMenu={() => setMobileOpen(true)} />
      <main className="ml-0 px-5 pb-16 pt-9 md:ml-[264px] md:px-10 md:pt-12">
        <div className="mx-auto max-w-[1250px]">
          <div className="animate-rise mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><div className="flex items-center gap-2 font-mono-custom text-[10px] uppercase tracking-[.21em] text-[#24635f]"><span className="h-2 w-2 rounded-full bg-[#ef7657]" /> Your learning desk</div><h1 className="mt-3 max-w-[620px] font-display text-[clamp(2.6rem,5.3vw,4.7rem)] leading-[.92] tracking-[-.065em] text-[#202a40]" data-testid="heading-page">{view === 'study' ? <>Make room for <em className="text-[#24635f]">better English.</em></> : <>Every word has a <em className="text-[#24635f]">place.</em></>}</h1><p className="mt-4 max-w-[470px] text-[14px] leading-relaxed text-[#71776f]">{view === 'study' ? 'A calm, focused practice for Arabic speakers. Meet a word, meet it again, then make it yours.' : 'Search the Oxford 3000 by meaning, level, or part of speech. Your next useful word is nearby.'}</p></div>
            <div className="flex items-center gap-2 text-right"><div><div className="font-mono-custom text-[10px] uppercase tracking-[.15em] text-[#858982]">Current streak</div><div className="mt-1 text-sm font-semibold text-[#202a40]">{currentStreak} {currentStreak === 1 ? 'day' : 'days'} <span className="ml-1 text-[#ef7657]">/</span> {currentStreak ? 'keep going' : 'start today'}</div></div><div className="ml-2 flex h-11 w-11 items-center justify-center rounded-full border border-[#e6c94d] bg-[#f3d24f] font-display text-xl text-[#202a40]">{currentStreak}</div></div>
          </div>
            <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard label="Words met" value={String(reviewed.size)} detail="of 3,000 in your goal" accent="bg-[#24635f]" /><StatCard label="In this view" value={String(filteredWords.length)} detail="matching your filters" accent="bg-[#ef7657]" /><StatCard label="Daily rhythm" value={`${Math.min(reviewedToday, dailyGoal)} / ${dailyGoal}`} detail="words in today's session" accent="bg-[#f3d24f]" /><StatCard label="Next milestone" value={reviewed.size >= oxford3000.length ? 'Complete' : String(nextMilestone)} detail={reviewed.size >= oxford3000.length ? 'Oxford 3000 finished' : `${wordsToMilestone} words to go`} accent="bg-[#779c7b]" /></div>
          <Filters search={search} setSearch={setSearch} level={level} setLevel={setLevel} part={part} setPart={setPart} resultCount={filteredWords.length} />
           <div className="mt-8" id="library">{view === 'study' ? <StudyHome words={filteredWords} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} reviewed={reviewed} markReviewed={markReviewed} /> : <BrowseList words={filteredWords} onSelect={selectWord} />}</div>
        </div>
      </main>
    </div>
  );
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;