import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { arSA } from '@clerk/localizations';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { getGetProgressQueryKey, useGetProgress, useSaveProgress, type ProgressInput } from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, Command, Gamepad2, Layers3, Link2, ListFilter, Lock, Menu, Moon, Pencil, RotateCcw, Save, Search, Shuffle, Sparkles, SpellCheck, Star, Sun, Volume2, X } from 'lucide-react';
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
const reviewMilestonesStorageKey = 'wordroom-review-milestones';
const completedDaysStorageKey = 'wordroom-completed-days';
const starredStorageKey = 'wordroom-starred';
const dailyGoal = 12;
const overridesStorageKey = 'wordroom-word-overrides';
const themePreferenceStorageKey = 'wordroom-theme-preference';
const systemThemeQuery = '(prefers-color-scheme: dark)';

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
type AppView = 'study' | 'browse' | 'starred' | 'review' | 'all-days';
type Language = 'en' | 'ar';
type Theme = 'light' | 'dark';
type QuizMode = 'word-building' | 'multiple-choice' | 'matching';
type ReviewBlock = {
  key: string;
  dayCount: 3 | 6;
  startDay: number;
  endDay: number;
};

const translations = {
  en: {
    languageButton: 'العربية',
    languageButtonLabel: 'Switch to Arabic',
    themeToggleLabel: 'Toggle color theme',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
     openMenu: 'Open menu',
    closeMenu: 'Close menu',
    mainNavigation: 'Main navigation',
    yourDesk: 'Your desk',
    dailyRhythm: 'Daily rhythm',
    dailyRhythmComplete: 'Daily rhythm complete. Beautiful work.',
    dailyWordsLeft: (count: number) => `${count} ${count === 1 ? 'word' : 'words'} left in today’s rhythm.`,
    resetAllData: 'Start over',
    resetAllDataConfirmation: 'Are you sure you want to delete all progress and start over?',
    builtForLongGame: 'Built for the long game',
    study: 'Study',
    browse: 'Browse',
    wordLibrary: 'Word library',
    starredWords: 'Starred Words',
    starredWordsDescription: 'Keep the words that need another look close at hand.',
    starWord: 'Star this word',
    unstarWord: 'Remove from starred words',
    noStarredWords: 'No starred words yet.',
    noStarredWordsDescription: 'Tap the star on any word to build a focused shelf for difficult words.',
    practiceStarred: 'Practice starred words',
    backToStarred: 'Back to starred words',
    starredCount: (count: number) => `${count} ${count === 1 ? 'word' : 'words'} starred`,
    review: 'Review',
    allDays: 'All Days',
    login: 'Log in',
    signUp: 'Sign up',
    logout: 'Log out',
    syncedAccount: 'Synced account',
    loadingAccount: 'Loading account',
    currentStreak: 'Current streak',
    day: 'day',
    days: 'days',
    keepGoing: 'keep going',
    startToday: 'start today',
    wordsMet: 'Words met',
    wordsOfGoal: 'of 3,000 in your goal',
    inThisView: 'In this view',
    matchingFilters: 'matching your filters',
    dailyWordsSession: "words in today's session",
    complete: 'Complete',
    learningDesk: 'Your learning desk',
    betterEnglish: 'better English.',
    everyWordHasAPlace: 'Every word has a',
    place: 'place.',
    studyDescription: 'A calm, focused practice for Arabic speakers. Meet a word, meet it again, then make it yours.',
    browseDescription: 'Search the Oxford 3000 by meaning, level, or part of speech. Your next useful word is nearby.',
    focusedPractice: 'Focused practice',
    oneWordAtTime: 'One word at a time.',
    shuffle: 'Shuffle',
    card: 'Card',
    edit: 'Edit',
    editThisCard: 'Edit this card',
    englishWord: 'English word',
    partOfSpeech: 'Part of speech',
    cefrLevel: 'CEFR level',
    arabicTranslation: 'Arabic translation',
    englishExample: 'English example',
    arabicExampleTranslation: 'Arabic example translation',
    cancel: 'Cancel',
    saveChanges: 'Save changes',
    exampleSentence: 'the example sentence',
    tapToReveal: 'Tap to reveal',
    previous: 'Previous',
    inYourRhythm: 'In your rhythm',
    iKnowThis: 'I know this',
     gotIt: 'Got it',
     reviewLater: 'Review Later',
     dailySessionComplete: 'Daily session complete',
     reviewRound: (round: number) => `Review round ${round}`,
     wordsToReview: (count: number) => `${count} ${count === 1 ? 'word' : 'words'} to review again`,
    nextWord: 'Next word',
    quizTitle: 'Choose your practice',
    quizDescription: 'Pick one or more games for six focused words from today’s set.',
    quizModes: 'Quiz modes',
    selectAtLeastOneQuiz: 'Choose at least one game to continue.',
    startQuiz: 'Start selected games',
    wordBuilding: 'Word building',
    wordBuildingDescription: 'Spell the English word from its Arabic meaning.',
    multipleChoice: 'Multiple choice',
    multipleChoiceDescription: 'Choose the Arabic meaning that fits.',
    matching: 'Matching',
    matchingDescription: 'Pair each English word with its meaning.',
    continueToQuiz: 'Continue to quiz',
    quizWordsReady: (count: number) => `${count} words selected`,
    quizProgress: (current: number, total: number) => `Word ${current} of ${total}`,
    spellTheWord: 'Spell the word',
    tapLetters: 'Tap the letters in order',
    hint: 'Hint',
    hintDescription: 'Reveal the answer as a learning aid. This attempt will not count as correct.',
    removePlacedLetter: (letter: string) => `Remove ${letter} from the answer`,
    clearAnswer: 'Clear answer',
    checkAnswer: 'Check answer',
    correct: 'Correct',
    notQuite: 'Not quite',
    tryAgain: 'Try again',
    nextQuizWord: 'Next word',
    chooseMeaning: 'Choose the Arabic meaning',
    matched: 'Matched',
    tapToMatch: 'Tap one word and its meaning',
    finishQuiz: 'Finish quiz',
    quizComplete: 'Practice complete',
    quizCompleteDescription: 'A small review today makes tomorrow easier.',
    backToDay: 'Back to day',
    selectedModes: (count: number) => `${count} ${count === 1 ? 'game' : 'games'} selected`,
    searchEnglishArabic: 'Search English or Arabic',
    clearSearch: 'Clear search',
    allLevels: 'All levels',
    allParts: 'All parts',
    resultCount: (count: number) => `${count} ${count === 1 ? 'word' : 'words'} in view`,
    theWholeShelf: 'The whole shelf',
    browseLibrary: 'Browse the library.',
    selectWordToStudy: 'Select a word to study it',
    noWordsMatch: 'No words match that search.',
    tryDifferentSearch: 'Try a different spelling, level, or part of speech.',
    noWordToStudy: 'No word to study yet.',
    keyboardHint: 'to reveal',
    keyboardMove: 'to move',
    yourGoal: 'Your 3,000 goal',
    smallShelf: 'A small, steady shelf becomes fluency.',
    levelMap: 'Level map',
    words: 'Words',
    exploreAllWords: 'Explore all words',
    studyNote: 'Study note',
    quote: '“See the word in a sentence. That is where it starts to belong to you.”',
    steadyPath: 'A steady path through every word',
    allDaysTitle: 'All days, one',
    steadyRhythm: 'steady rhythm.',
    vocabularyJourney: 'Your complete vocabulary journey, arranged in focused daily sets of twelve words.',
    dailyMap: 'Your daily map',
    dailySet: 'Daily set',
    dayLabel: (day: number) => `Day ${day}`,
    wordsCount: (count: number) => `${count} ${count === 1 ? 'word' : 'words'}`,
    to: 'to',
    dailyVocabularySet: 'Daily vocabulary set',
    today: 'Today',
    reviewed: 'reviewed',
    progress: 'Progress',
    allDaysBack: 'All Days',
    flashcardMode: 'Flashcard Mode',
    returnToDayList: 'Back to day list',
    audio: 'Audio',
    playPronunciation: (label: string, shortLabel: string) => `Play ${label} in ${shortLabel} English`,
    pronunciationUnavailable: 'Speech playback is unavailable in this browser',
    reviewTitle: 'Make it stick.',
    reviewDescription: 'Return to the words you have already met. A little distance is where memory gets stronger.',
    reviewDeskLabel: 'The recall desk',
    reviewThreeDay: '3-day review',
    reviewSixDay: '6-day review',
    reviewThreeDayDescription: '12 words total — 4 randomly selected from each of your last three completed days.',
    reviewSixDayDescription: '20 words total — balanced across all six of your last completed days.',
    reviewBlockDays: (start: number, end: number) => `Days ${start}–${end}`,
    reviewLockedDescription: 'Complete the earlier days and review blocks to unlock this block.',
    reviewReplayUnlocked: 'Unlocked for replay',
    reviewBlocksProgress: (unlocked: number, total: number) => `${unlocked} of ${total} review blocks unlocked`,
    reviewDaysReady: (count: number) => `${count} ${count === 1 ? 'day' : 'days'} completed`,
    reviewWordsReady: (count: number) => `${count} ${count === 1 ? 'word' : 'words'} in the mix`,
    reviewNeedDays: (count: number) => `Complete ${count} ${count === 1 ? 'day' : 'days'} to open this review.`,
    reviewStart: 'Start review',
    reviewAgain: 'Review again',
    reviewCompleted: 'Completed',
    reviewFreshMix: 'Fresh mix every time',
    reviewSessionLabel: 'Milestone review',
    reviewSessionDescription: (count: number) => `Move through ${count} words at your own pace. Mark each one when it feels familiar.`,
    reviewSessionComplete: 'Checkpoint complete',
    reviewSessionCompleteDescription: 'You returned to the words that matter. That is how vocabulary stays close.',
    reviewBack: 'Back to reviews',
    locked: 'Locked',
    futureDayLocked: (day: number) => `Day ${day} is locked. Complete the pending milestone review in Review to open it.`,
    openReview: 'Open Review',
    dismiss: 'Dismiss',
  },
  ar: {
    languageButton: 'English',
    languageButtonLabel: 'التبديل إلى الإنجليزية',
    themeToggleLabel: 'تبديل مظهر الألوان',
    lightMode: 'الوضع الفاتح',
    darkMode: 'الوضع الداكن',
     openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
    mainNavigation: 'التنقل الرئيسي',
    yourDesk: 'مساحتك',
    dailyRhythm: 'إيقاعك اليومي',
    dailyRhythmComplete: 'اكتمل إيقاعك اليومي. عمل رائع.',
    dailyWordsLeft: (count: number) => `${count} ${count === 1 ? 'كلمة متبقية' : 'كلمات متبقية'} في إيقاع اليوم.`,
    resetAllData: 'البدء من جديد',
    resetAllDataConfirmation: 'هل أنت متأكد من رغبتك في حذف كل التقدم والبدء من جديد؟',
    builtForLongGame: 'مصمم للتعلّم المستمر',
    study: 'دراسة',
    browse: 'تصفّح',
    wordLibrary: 'مكتبة الكلمات',
    starredWords: 'الكلمات المميزة',
    starredWordsDescription: 'احتفظ بالكلمات التي تحتاج إلى نظرة أخرى في متناولك.',
    starWord: 'تمييز هذه الكلمة',
    unstarWord: 'إزالة الكلمة من المميزة',
    noStarredWords: 'لا توجد كلمات مميزة بعد.',
    noStarredWordsDescription: 'اضغط على النجمة بجانب أي كلمة لتبني مجموعة مركّزة للكلمات الصعبة.',
    practiceStarred: 'تدرّب على الكلمات المميزة',
    backToStarred: 'العودة إلى الكلمات المميزة',
    starredCount: (count: number) => `${count} ${count === 1 ? 'كلمة مميزة' : 'كلمات مميزة'}`,
    review: 'مراجعة',
    allDays: 'كل الأيام',
    login: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    logout: 'تسجيل الخروج',
    syncedAccount: 'حساب متزامن',
    loadingAccount: 'جارٍ تحميل الحساب',
    currentStreak: 'السلسلة الحالية',
    day: 'يوم',
    days: 'أيام',
    keepGoing: 'واصل التقدم',
    startToday: 'ابدأ اليوم',
    wordsMet: 'كلمات تعلّمتها',
    wordsOfGoal: 'من أصل 3,000 كلمة في هدفك',
    inThisView: 'في هذا العرض',
    matchingFilters: 'كلمة مطابقة للتصفية',
    dailyWordsSession: 'كلمة في جلسة اليوم',
    complete: 'مكتمل',
    learningDesk: 'مساحتك التعليمية',
    betterEnglish: 'إنجليزية أفضل.',
    everyWordHasAPlace: 'لكل كلمة',
    place: 'مكان.',
    studyDescription: 'تعلّم هادئ ومركّز للناطقين بالعربية. تعرّف إلى الكلمة، ثم قابلها مجددًا واجعلها جزءًا منك.',
    browseDescription: 'ابحث في قائمة أكسفورد 3000 حسب المعنى أو المستوى أو نوع الكلمة. كلمتك المفيدة التالية قريبة منك.',
    focusedPractice: 'تدريب مركّز',
    oneWordAtTime: 'كلمة واحدة في كل مرة.',
    shuffle: 'خلط',
    card: 'بطاقة',
    edit: 'تعديل',
    editThisCard: 'تعديل هذه البطاقة',
    englishWord: 'الكلمة الإنجليزية',
    partOfSpeech: 'نوع الكلمة',
    cefrLevel: 'مستوى CEFR',
    arabicTranslation: 'الترجمة العربية',
    englishExample: 'مثال بالإنجليزية',
    arabicExampleTranslation: 'ترجمة المثال بالعربية',
    cancel: 'إلغاء',
    saveChanges: 'حفظ التغييرات',
    exampleSentence: 'جملة المثال',
    tapToReveal: 'اضغط لإظهار المعنى',
    previous: 'السابق',
    inYourRhythm: 'ضمن إيقاعك',
    iKnowThis: 'أعرف هذه الكلمة',
     gotIt: 'تعلّمتها',
     reviewLater: 'مراجعة لاحقًا',
     dailySessionComplete: 'اكتملت الجلسة اليومية',
     reviewRound: (round: number) => `جولة المراجعة ${round}`,
     wordsToReview: (count: number) => `${count} ${count === 1 ? 'كلمة' : 'كلمات'} للمراجعة مجددًا`,
    nextWord: 'الكلمة التالية',
    quizTitle: 'اختر تدريبك',
    quizDescription: 'اختر لعبة واحدة أو أكثر لست كلمات مركّزة من مجموعة اليوم.',
    quizModes: 'أنماط الاختبار',
    selectAtLeastOneQuiz: 'اختر لعبة واحدة على الأقل للمتابعة.',
    startQuiz: 'ابدأ الألعاب المختارة',
    wordBuilding: 'بناء الكلمة',
    wordBuildingDescription: 'اكتب الكلمة الإنجليزية انطلاقًا من معناها العربي.',
    multipleChoice: 'اختيار من متعدد',
    multipleChoiceDescription: 'اختر المعنى العربي المناسب.',
    matching: 'المطابقة',
    matchingDescription: 'طابق كل كلمة إنجليزية مع معناها.',
    continueToQuiz: 'المتابعة إلى الاختبار',
    quizWordsReady: (count: number) => `${count} كلمات مختارة`,
    quizProgress: (current: number, total: number) => `الكلمة ${current} من ${total}`,
    spellTheWord: 'اكتب الكلمة',
    tapLetters: 'اضغط على الحروف بالترتيب',
    hint: 'مساعدة',
    hintDescription: 'أظهر الإجابة كوسيلة للتعلّم. لن تُحتسب هذه المحاولة كإجابة صحيحة.',
    removePlacedLetter: (letter: string) => `إزالة الحرف ${letter} من الإجابة`,
    clearAnswer: 'مسح الإجابة',
    checkAnswer: 'تحقق من الإجابة',
    correct: 'صحيح',
    notQuite: 'ليس تمامًا',
    tryAgain: 'حاول مجددًا',
    nextQuizWord: 'الكلمة التالية',
    chooseMeaning: 'اختر المعنى العربي',
    matched: 'تمت المطابقة',
    tapToMatch: 'اضغط على الكلمة ومعناها',
    finishQuiz: 'إنهاء الاختبار',
    quizComplete: 'اكتمل التدريب',
    quizCompleteDescription: 'مراجعة صغيرة اليوم تجعل الغد أسهل.',
    backToDay: 'العودة إلى اليوم',
    selectedModes: (count: number) => `${count} ${count === 1 ? 'لعبة مختارة' : 'ألعاب مختارة'}`,
    searchEnglishArabic: 'ابحث بالإنجليزية أو العربية',
    clearSearch: 'مسح البحث',
    allLevels: 'كل المستويات',
    allParts: 'كل الأنواع',
    resultCount: (count: number) => `${count} ${count === 1 ? 'كلمة' : 'كلمات'} في العرض`,
    theWholeShelf: 'كل المجموعة',
    browseLibrary: 'تصفّح المكتبة.',
    selectWordToStudy: 'اختر كلمة لدراستها',
    noWordsMatch: 'لا توجد كلمات تطابق هذا البحث.',
    tryDifferentSearch: 'جرّب تهجئة أو مستوى أو نوع كلمة مختلفًا.',
    noWordToStudy: 'لا توجد كلمة للدراسة بعد.',
    keyboardHint: 'لإظهار المعنى',
    keyboardMove: 'للتنقل',
    yourGoal: 'هدفك: 3,000 كلمة',
    smallShelf: 'مجموعة صغيرة وثابتة تقودك إلى الطلاقة.',
    levelMap: 'خريطة المستويات',
    words: 'كلمات',
    exploreAllWords: 'استكشف كل الكلمات',
    studyNote: 'ملاحظة دراسية',
    quote: '«شاهد الكلمة في جملة؛ هناك تبدأ في الانتماء إليك.»',
    steadyPath: 'طريق ثابت عبر كل كلمة',
    allDaysTitle: 'كل الأيام،',
    steadyRhythm: 'إيقاع ثابت.',
    vocabularyJourney: 'رحلتك الكاملة مع المفردات، مرتبة في مجموعات يومية مركّزة من اثنتي عشرة كلمة.',
    dailyMap: 'خريطتك اليومية',
    dailySet: 'مجموعة يومية',
    dayLabel: (day: number) => `اليوم ${day}`,
    wordsCount: (count: number) => `${count} ${count === 1 ? 'كلمة' : 'كلمات'}`,
    to: 'إلى',
    dailyVocabularySet: 'مجموعة المفردات اليومية',
    today: 'اليوم',
    reviewed: 'تمت مراجعتها',
    progress: 'التقدم',
    allDaysBack: 'كل الأيام',
    flashcardMode: 'وضع البطاقات',
    returnToDayList: 'العودة إلى قائمة اليوم',
    audio: 'صوت',
    playPronunciation: (label: string, shortLabel: string) => `تشغيل نطق ${label} بلهجة ${shortLabel}`,
    pronunciationUnavailable: 'تشغيل النطق غير متاح في هذا المتصفح',
    reviewTitle: 'ثبّت ما تعلّمت.',
    reviewDescription: 'عُد إلى الكلمات التي التقيتها من قبل. قليل من المسافة يجعل الذاكرة أقوى.',
    reviewDeskLabel: 'مكتب الاستدعاء',
    reviewThreeDay: 'مراجعة 3 أيام',
    reviewSixDay: 'مراجعة 6 أيام',
    reviewThreeDayDescription: '12 كلمة — 4 كلمات مختارة عشوائيًا من كل يوم من آخر ثلاثة أيام مكتملة.',
    reviewSixDayDescription: '20 كلمة — موزعة بتوازن على آخر ستة أيام مكتملة.',
    reviewBlockDays: (start: number, end: number) => `الأيام ${start}–${end}`,
    reviewLockedDescription: 'أكمل الأيام والمراجعات السابقة لفتح هذه المحطة.',
    reviewReplayUnlocked: 'مفتوحة لإعادة التدريب',
    reviewBlocksProgress: (unlocked: number, total: number) => `${unlocked} من ${total} محطة مراجعة مفتوحة`,
    reviewDaysReady: (count: number) => `${count} ${count === 1 ? 'يوم مكتمل' : 'أيام مكتملة'}`,
    reviewWordsReady: (count: number) => `${count} ${count === 1 ? 'كلمة في المزيج' : 'كلمات في المزيج'}`,
    reviewNeedDays: (count: number) => `أكمل ${count === 1 ? 'يومًا' : `${count} أيام`} لفتح هذه المراجعة.`,
    reviewStart: 'ابدأ المراجعة',
    reviewAgain: 'مراجعة مجددًا',
    reviewCompleted: 'مكتملة',
    reviewFreshMix: 'مزيج جديد في كل مرة',
    reviewSessionLabel: 'مراجعة مرحلية',
    reviewSessionDescription: (count: number) => `مرّ على ${count} كلمة بالوتيرة التي تناسبك. علّم كل كلمة عندما تصبح مألوفة.`,
    reviewSessionComplete: 'اكتملت المحطة',
    reviewSessionCompleteDescription: 'عدت إلى الكلمات التي تهمك. هكذا تبقى المفردات قريبة.',
    reviewBack: 'العودة إلى المراجعات',
    locked: 'مقفلة',
    futureDayLocked: (day: number) => `اليوم ${day} مقفل. أكمل المراجعة المرحلية المعلّقة في قسم المراجعة لفتحه.`,
    openReview: 'فتح المراجعة',
    dismiss: 'إغلاق',
  },
} as const;

type TranslationSet = (typeof translations)[Language];
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: TranslationSet };
const LanguageContext = createContext<LanguageContextValue | null>(null);
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageContext.Provider');
  return context;
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeContext.Provider');
  return context;
}

function getSystemTheme(): Theme {
  try {
    return window.matchMedia?.(systemThemeQuery).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function readInitialTheme(): Theme {
  try {
    const savedPreference = window.localStorage.getItem(themePreferenceStorageKey);
    if (savedPreference === 'light' || savedPreference === 'dark') return savedPreference;
  } catch {
    // Fall back to the device preference when storage is unavailable.
  }
  return getSystemTheme();
}

const partOfSpeechTranslations: Record<string, { en: string; ar: string }> = {
  Noun: { en: 'Noun', ar: 'اسم' },
  Verb: { en: 'Verb', ar: 'فعل' },
  Adjective: { en: 'Adjective', ar: 'صفة' },
  Adverb: { en: 'Adverb', ar: 'حال' },
  Preposition: { en: 'Preposition', ar: 'حرف جر' },
  Article: { en: 'Article', ar: 'أداة' },
  Conjunction: { en: 'Conjunction', ar: 'حرف عطف' },
  Determiner: { en: 'Determiner', ar: 'محدِّد' },
  Exclamation: { en: 'Exclamation', ar: 'تعجب' },
  'Modal verb': { en: 'Modal verb', ar: 'فعل ناقص' },
  Number: { en: 'Number', ar: 'عدد' },
  Pronoun: { en: 'Pronoun', ar: 'ضمير' },
  'Auxiliary verb': { en: 'Auxiliary verb', ar: 'فعل مساعد' },
  'Infinitive marker': { en: 'Infinitive marker', ar: 'علامة المصدر' },
};

function displayPartOfSpeech(value: string, language: Language) {
  return value.split(' / ').map((part) => partOfSpeechTranslations[part]?.[language] ?? part).join(language === 'ar' ? ' / ' : ' / ');
}

const sourceWords: EditableWord[] = oxford3000.map((word) => ({ ...word }));
const wordsPerDay = 12;
const curriculumDays = 250;
const threeDayReviewWordCount = 12;
const sixDayReviewWordCount = 20;

function splitIntoDays(words: EditableWord[]) {
  if (words.length !== curriculumDays * wordsPerDay) {
    throw new Error(`Oxford 3000 curriculum must contain exactly ${curriculumDays * wordsPerDay} words.`);
  }
  return Array.from({ length: curriculumDays }, (_, dayIndex) =>
    words.slice(dayIndex * wordsPerDay, (dayIndex + 1) * wordsPerDay),
  );
}

function shuffleItems<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function chooseQuizWords(words: EditableWord[], reviewLaterIds: Set<number>) {
  const priority = words.filter((word) => reviewLaterIds.has(word.id));
  const remaining = shuffleItems(words.filter((word) => !reviewLaterIds.has(word.id)));
  return [...priority, ...remaining].slice(0, Math.min(6, words.length));
}

function quizModeLabel(mode: QuizMode, t: TranslationSet) {
  if (mode === 'word-building') return t.wordBuilding;
  if (mode === 'multiple-choice') return t.multipleChoice;
  return t.matching;
}

function quizModeDescription(mode: QuizMode, t: TranslationSet) {
  if (mode === 'word-building') return t.wordBuildingDescription;
  if (mode === 'multiple-choice') return t.multipleChoiceDescription;
  return t.matchingDescription;
}

function QuizSelection({ words, reviewLaterIds, selectedModes, onToggleMode, onStart, onBack }: { words: EditableWord[]; reviewLaterIds: Set<number>; selectedModes: Set<QuizMode>; onToggleMode: (mode: QuizMode) => void; onStart: () => void; onBack: () => void }) {
  const { t } = useLanguage();
  const modes: { id: QuizMode; icon: typeof SpellCheck }[] = [
    { id: 'word-building', icon: SpellCheck },
    { id: 'multiple-choice', icon: CheckCircle2 },
    { id: 'matching', icon: Link2 },
  ];
  const quizWords = chooseQuizWords(words, reviewLaterIds);
  return (
    <section className="animate-rise mt-7" data-testid="panel-quiz-selection">
      <div className="rounded-[26px] border border-[#d4cec0] bg-[#fbf8f1] p-6 shadow-[0_14px_34px_rgba(31,41,55,.06)] sm:p-10">
        <div className="flex flex-col justify-between gap-6 border-b border-[#e4ded2] pb-7 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 font-mono-custom text-[10px] uppercase tracking-[.19em] text-[#24635f]"><Gamepad2 size={14} /> {t.quizModes}</div>
            <h2 className="mt-3 font-display text-[clamp(2.1rem,4vw,3.5rem)] leading-[.95] tracking-[-.055em] text-[#202a40]">{t.quizTitle}</h2>
            <p className="mt-3 max-w-[500px] text-sm leading-relaxed text-[#71776f]">{t.quizDescription}</p>
          </div>
          <div className="rounded-2xl bg-[#f5edda] px-4 py-3 text-left">
            <div className="font-mono-custom text-[9px] uppercase tracking-[.15em] text-[#858982]">{t.quizWordsReady(quizWords.length)}</div>
            <div className="mt-1 text-xs font-semibold text-[#24635f]">{t.selectedModes(selectedModes.size)}</div>
          </div>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {modes.map(({ id, icon: Icon }) => {
            const selected = selectedModes.has(id);
            return (
              <button type="button" key={id} data-testid={`button-quiz-mode-${id}`} aria-pressed={selected} onClick={() => onToggleMode(id)} className={`group rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${selected ? 'border-[#24635f] bg-[#edf7f3] shadow-[0_8px_22px_rgba(36,99,95,.12)]' : 'border-[#ded8ca] bg-[#f6f2e9] hover:border-[#aeb9ac]'}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-[#24635f] text-[#f9f5e9]' : 'bg-[#e9e3d7] text-[#24635f]'}`}><Icon size={19} /></div>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <h3 className="font-display text-[22px] tracking-[-.02em] text-[#202a40]">{quizModeLabel(id, t)}</h3>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-[#24635f] bg-[#24635f] text-white' : 'border-[#b8b9b0]'}`}>{selected && <Check size={13} />}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#71776f]">{quizModeDescription(id, t)}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#e4ded2] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" data-testid="button-quiz-back-to-celebration" onClick={onBack} className="rounded-full px-4 py-2.5 text-xs font-semibold text-[#737970] transition-colors hover:bg-[#e9e3d7] hover:text-[#202a40]">{t.returnToDayList}</button>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            {selectedModes.size === 0 && <p className="text-xs text-[#a04b39]" data-testid="text-quiz-selection-error">{t.selectAtLeastOneQuiz}</p>}
            <button type="button" data-testid="button-start-quiz" disabled={selectedModes.size === 0} onClick={onStart} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#202a40] px-5 py-3 text-xs font-semibold text-[#f9f5e9] transition-all hover:-translate-y-0.5 hover:bg-[#2c3852] disabled:cursor-not-allowed disabled:opacity-40">{t.startQuiz} <ArrowRight size={14} /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

function WordBuildingGame({ words, onDone }: { words: EditableWord[]; onDone: () => void }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(false);
  const word = words[index] ?? words[0];
  const letters = useMemo(() => shuffleItems(word.word.toLowerCase().replace(/[^a-z]/g, '').split('')), [word.word]);
  const target = word.word.toLowerCase().replace(/[^a-z]/g, '');
  const solution = useMemo(() => {
    const used = new Set<number>();
    return target.split('').map((character) => {
      const letterIndex = letters.findIndex((letter, candidateIndex) => letter === character && !used.has(candidateIndex));
      if (letterIndex === -1) return -1;
      used.add(letterIndex);
      return letterIndex;
    });
  }, [letters, target]);
  const hintTimer = useRef<number | null>(null);
  useEffect(() => {
    setAnswer([]);
    setChecked(null);
    setRevealed(false);
    return () => {
      if (hintTimer.current !== null) {
        window.clearTimeout(hintTimer.current);
        hintTimer.current = null;
      }
    };
  }, [word.id]);
  const submit = () => {
    if (answer.length !== letters.length) return;
    const typed = answer.map((letterIndex) => letters[letterIndex]).join('');
    setChecked(typed === target);
  };
  const next = () => {
    if (index === words.length - 1) onDone();
    else setIndex((current) => current + 1);
  };
  const revealAnswer = () => {
    if (revealed || checked !== null) return;
    setAnswer(solution);
    setRevealed(true);
    hintTimer.current = window.setTimeout(() => {
      hintTimer.current = null;
      next();
    }, 1400);
  };
  return (
    <div data-testid="quiz-game-word-building">
      <div className="mt-7 rounded-[26px] border border-[#d4cec0] bg-[#fbf8f1] p-6 shadow-[0_14px_34px_rgba(31,41,55,.06)] sm:p-10">
        <div className="flex items-center justify-between gap-4"><span className="font-mono-custom text-[10px] uppercase tracking-[.16em] text-[#858982]">{t.quizProgress(index + 1, words.length)}</span><span className="rounded-full bg-[#f5edda] px-3 py-1.5 font-mono-custom text-[9px] uppercase tracking-[.1em] text-[#7d5b19]">{t.wordBuilding}</span></div>
        <div className="mt-12 text-center">
          <div className="font-mono-custom text-[10px] uppercase tracking-[.18em] text-[#858982]">{t.spellTheWord}</div>
          <div className="font-arabic mt-4 text-[clamp(2rem,5vw,3.2rem)] font-semibold text-[#24635f]" dir="rtl">{word.translation}</div>
          <p className="mt-3 text-sm text-[#858982]">{t.tapLetters}</p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <div className="flex min-h-[58px] flex-wrap items-center justify-center gap-2" aria-label={t.spellTheWord}>
              {letters.map((_, slotIndex) => {
                const placedLetterIndex = answer[slotIndex];
                const placedLetter = placedLetterIndex === undefined ? null : letters[placedLetterIndex];
                return placedLetter ? (
                  <button type="button" key={slotIndex} data-testid={`button-placed-letter-${slotIndex}`} aria-label={t.removePlacedLetter(placedLetter)} disabled={checked === true || revealed} onClick={() => setAnswer((current) => current.filter((_, answerIndex) => answerIndex !== slotIndex))} className="flex h-12 min-w-10 items-center justify-center rounded-lg border-b-2 border-[#24635f] px-2 font-display text-3xl text-[#202a40] transition-colors hover:bg-[#edf7f3] disabled:cursor-not-allowed">{placedLetter}</button>
                ) : (
                  <span key={slotIndex} className="flex h-12 min-w-10 items-center justify-center border-b-2 border-[#c6bfb1] px-2 font-display text-3xl text-[#202a40]">_</span>
                );
              })}
            </div>
            <button type="button" data-testid="button-hint-word-building" aria-label={t.hint} disabled={checked === true || revealed} onClick={revealAnswer} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d6d1c6] bg-[#f6f2e9] font-mono-custom text-sm text-[#737970] transition-all hover:border-[#24635f] hover:bg-[#edf7f3] hover:text-[#24635f] disabled:cursor-not-allowed disabled:opacity-40">?</button>
          </div>
          <div className="mx-auto mt-8 flex max-w-[520px] flex-wrap justify-center gap-2">
            {letters.map((letter, letterIndex) => <button type="button" key={`${letter}-${letterIndex}`} data-testid={`button-letter-${letterIndex}`} disabled={answer.includes(letterIndex) || checked === true || revealed} onClick={() => setAnswer((current) => [...current, letterIndex])} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d6d1c6] bg-[#f6f2e9] font-display text-xl text-[#202a40] transition-all hover:-translate-y-0.5 hover:border-[#24635f] hover:bg-[#edf7f3] disabled:cursor-not-allowed disabled:opacity-35">{letter}</button>)}
          </div>
        </div>
        {revealed ? <div className="mx-auto mt-7 max-w-[520px] rounded-xl bg-[#f5edda] px-4 py-3 text-center text-sm font-semibold text-[#7d5b19]" data-testid="text-word-building-hint-feedback">{t.hintDescription}</div> : checked !== null && <div className={`mx-auto mt-7 flex max-w-[520px] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${checked ? 'bg-[#d9eee9] text-[#24635f]' : 'bg-[#fff4ef] text-[#a04b39]'}`} data-testid="text-word-building-feedback">{checked ? <><CheckCircle2 size={16} /> {t.correct}</> : <>{t.notQuite} — {t.tryAgain}</>}</div>}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button type="button" data-testid="button-clear-word-answer" onClick={() => { setAnswer([]); setChecked(null); }} disabled={revealed} className="rounded-full border border-[#d6d1c6] px-4 py-2.5 text-xs font-semibold text-[#737970] transition-colors hover:bg-[#e9e3d7] disabled:cursor-not-allowed disabled:opacity-40">{t.clearAnswer}</button>
          {checked === true ? <button type="button" data-testid="button-next-word-building" onClick={next} className="rounded-full bg-[#24635f] px-5 py-2.5 text-xs font-semibold text-[#f9f5e9]">{index === words.length - 1 ? t.finishQuiz : t.nextQuizWord} <ArrowRight size={14} className="ml-1 inline" /></button> : <button type="button" data-testid="button-check-word-answer" onClick={submit} disabled={answer.length !== letters.length || revealed} className="rounded-full bg-[#202a40] px-5 py-2.5 text-xs font-semibold text-[#f9f5e9] disabled:cursor-not-allowed disabled:opacity-40">{t.checkAnswer}</button>}
        </div>
      </div>
    </div>
  );
}

function MultipleChoiceGame({ words, allWords, onDone }: { words: EditableWord[]; allWords: EditableWord[]; onDone: () => void }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const word = words[index] ?? words[0];
  const options = useMemo(() => shuffleItems([word.translation, ...shuffleItems(allWords.filter((item) => item.id !== word.id && item.translation !== word.translation)).slice(0, 3).map((item) => item.translation)]), [word.id, allWords]);
  useEffect(() => setSelected(null), [word.id]);
  const next = () => { if (index === words.length - 1) onDone(); else setIndex((current) => current + 1); };
  return (
    <div data-testid="quiz-game-multiple-choice">
      <div className="mt-7 rounded-[26px] border border-[#d4cec0] bg-[#fbf8f1] p-6 shadow-[0_14px_34px_rgba(31,41,55,.06)] sm:p-10">
        <div className="flex items-center justify-between gap-4"><span className="font-mono-custom text-[10px] uppercase tracking-[.16em] text-[#858982]">{t.quizProgress(index + 1, words.length)}</span><span className="rounded-full bg-[#f5edda] px-3 py-1.5 font-mono-custom text-[9px] uppercase tracking-[.1em] text-[#7d5b19]">{t.multipleChoice}</span></div>
        <div className="mx-auto mt-12 max-w-[620px] text-center"><div className="font-mono-custom text-[10px] uppercase tracking-[.18em] text-[#858982]">{t.chooseMeaning}</div><h3 className="mt-4 font-display text-[clamp(3rem,8vw,5.5rem)] leading-none tracking-[-.06em] text-[#202a40]">{word.word}</h3><PronunciationButtons text={word.word} label={`the word ${word.word}`} testIdPrefix="button-quiz-pronounce" /></div>
        <div className="mx-auto mt-10 grid max-w-[700px] gap-3 sm:grid-cols-2">
          {options.map((option, optionIndex) => {
            const isCorrect = option === word.translation;
            const isSelected = selected === option;
            return <button type="button" key={`${option}-${optionIndex}`} data-testid={`button-meaning-option-${optionIndex}`} disabled={selected !== null} onClick={() => setSelected(option)} dir="rtl" className={`min-h-14 rounded-2xl border px-5 py-4 text-right font-arabic text-base transition-all ${selected === null ? 'border-[#ded8ca] bg-[#f6f2e9] hover:-translate-y-0.5 hover:border-[#24635f]' : isCorrect ? 'border-[#24635f] bg-[#d9eee9] text-[#24635f]' : isSelected ? 'border-[#a04b39] bg-[#fff4ef] text-[#a04b39]' : 'border-[#ded8ca] bg-[#f6f2e9] opacity-60'}`}>{option}{selected !== null && isCorrect && <Check size={16} className="ml-2 inline" />}</button>;
          })}
        </div>
        {selected !== null && <div className={`mx-auto mt-6 max-w-[700px] text-center text-sm font-semibold ${selected === word.translation ? 'text-[#24635f]' : 'text-[#a04b39]'}`} data-testid="text-multiple-choice-feedback">{selected === word.translation ? t.correct : t.notQuite}</div>}
        {selected !== null && <div className="mt-7 text-center"><button type="button" data-testid="button-next-multiple-choice" onClick={next} className="rounded-full bg-[#202a40] px-5 py-2.5 text-xs font-semibold text-[#f9f5e9]">{index === words.length - 1 ? t.finishQuiz : t.nextQuizWord} <ArrowRight size={14} className="ml-1 inline" /></button></div>}
      </div>
    </div>
  );
}

function MatchingGame({ words, onDone }: { words: EditableWord[]; onDone: () => void }) {
  const { t } = useLanguage();
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [selectedEnglish, setSelectedEnglish] = useState<number | null>(null);
  const [selectedArabic, setSelectedArabic] = useState<number | null>(null);
  const [wrongPair, setWrongPair] = useState<[number, number] | null>(null);
  const meanings = useMemo(() => shuffleItems(words), [words]);
  useEffect(() => {
    if (selectedEnglish === null || selectedArabic === null) return;
    let timer: number | undefined;
    if (selectedEnglish === selectedArabic) {
      const next = new Set(matched).add(selectedEnglish);
      setMatched(next);
      setSelectedEnglish(null);
      setSelectedArabic(null);
      if (next.size === words.length) window.setTimeout(onDone, 450);
    } else {
      setWrongPair([selectedEnglish, selectedArabic]);
      timer = window.setTimeout(() => { setWrongPair(null); setSelectedEnglish(null); setSelectedArabic(null); }, 550);
    }
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, [selectedEnglish, selectedArabic, matched, words.length, onDone]);
  return (
    <div data-testid="quiz-game-matching">
      <div className="mt-7 rounded-[26px] border border-[#d4cec0] bg-[#fbf8f1] p-6 shadow-[0_14px_34px_rgba(31,41,55,.06)] sm:p-10">
        <div className="flex items-center justify-between gap-4"><span className="font-mono-custom text-[10px] uppercase tracking-[.16em] text-[#858982]">{t.quizProgress(matched.size + 1, words.length)}</span><span className="rounded-full bg-[#f5edda] px-3 py-1.5 font-mono-custom text-[9px] uppercase tracking-[.1em] text-[#7d5b19]">{t.matching}</span></div>
        <div className="mt-8 text-center"><p className="text-sm text-[#71776f]">{t.tapToMatch}</p></div>
        <div className="mt-7 grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            {words.map((item) => <button type="button" key={item.id} disabled={matched.has(item.id)} onClick={() => setSelectedEnglish(item.id)} className={`flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left font-display text-xl transition-all ${matched.has(item.id) ? 'border-[#c9e2dc] bg-[#edf7f3] text-[#24635f]' : wrongPair?.[0] === item.id ? 'border-[#a04b39] bg-[#fff4ef] text-[#a04b39]' : selectedEnglish === item.id ? 'border-[#24635f] bg-[#d9eee9] text-[#24635f]' : 'border-[#ded8ca] bg-[#f6f2e9] text-[#202a40] hover:border-[#24635f]'}`}>{item.word}{matched.has(item.id) && <Check size={16} />}</button>)}
          </div>
          <div className="space-y-2">
            {meanings.map((item) => <button type="button" key={item.id} disabled={matched.has(item.id)} onClick={() => setSelectedArabic(item.id)} dir="rtl" className={`flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 py-3 text-right font-arabic text-base transition-all ${matched.has(item.id) ? 'border-[#c9e2dc] bg-[#edf7f3] text-[#24635f]' : wrongPair?.[1] === item.id ? 'border-[#a04b39] bg-[#fff4ef] text-[#a04b39]' : selectedArabic === item.id ? 'border-[#24635f] bg-[#d9eee9] text-[#24635f]' : 'border-[#ded8ca] bg-[#f6f2e9] text-[#202a40] hover:border-[#24635f]'}`}>{item.translation}{matched.has(item.id) && <Check size={16} />}</button>)}
          </div>
        </div>
        <div className="mt-6 text-center font-mono-custom text-[10px] uppercase tracking-[.14em] text-[#858982]">{t.matched}: {matched.size}/{words.length}</div>
      </div>
    </div>
  );
}

function QuizExperience({ words, allWords, modes, onBack, onFinish }: { words: EditableWord[]; allWords: EditableWord[]; modes: QuizMode[]; onBack: () => void; onFinish: () => void }) {
  const { t } = useLanguage();
  const [modeIndex, setModeIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const mode = modes[modeIndex];
  const handleDone = () => { if (modeIndex === modes.length - 1) setComplete(true); else setModeIndex((current) => current + 1); };
  if (complete) {
    return <section className="animate-rise mt-7" data-testid="panel-quiz-complete"><div className="rounded-[26px] border border-[#c9e2dc] bg-[#edf7f3] px-6 py-20 text-center shadow-[0_14px_34px_rgba(31,41,55,.06)]"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#24635f] text-[#f9f5e9]"><CheckCircle2 size={30} /></div><h2 className="mt-6 font-display text-[clamp(2.3rem,5vw,4rem)] leading-none tracking-[-.055em] text-[#202a40]">{t.quizComplete}</h2><p className="mx-auto mt-4 max-w-[390px] text-sm leading-relaxed text-[#5f675f]">{t.quizCompleteDescription}</p><button type="button" data-testid="button-finish-quiz" onClick={onFinish} className="mt-8 rounded-full bg-[#202a40] px-5 py-3 text-xs font-semibold text-[#f9f5e9]">{t.backToDay}</button></div></section>;
  }
  return <section data-testid="panel-quiz-experience"><div className="mt-7 flex items-center justify-between gap-4"><button type="button" data-testid="button-quiz-back-to-selection" onClick={onBack} className="rounded-full border border-[#d6d1c6] bg-[#fbf8f1] px-3.5 py-2 text-xs font-semibold text-[#737970] hover:border-[#24635f] hover:text-[#24635f]"><ArrowLeft size={14} className="mr-1 inline" /> {t.quizModes}</button><span className="font-mono-custom text-[10px] uppercase tracking-[.15em] text-[#858982]">{modeIndex + 1} / {modes.length}</span></div>{mode === 'word-building' && <WordBuildingGame words={words} onDone={handleDone} />}{mode === 'multiple-choice' && <MultipleChoiceGame words={words} allWords={allWords} onDone={handleDone} />}{mode === 'matching' && <MatchingGame words={words} onDone={handleDone} />}</section>;
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

function readStarredIds(userId?: string) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(getStorageKey(starredStorageKey, userId)) ?? '[]') as unknown;
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

function readReviewMilestones(userId?: string) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(getStorageKey(reviewMilestonesStorageKey, userId)) ?? '{}') as unknown;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return normalizeReviewMilestones(Object.fromEntries(Object.entries(saved).filter(([, date]) => typeof date === 'string')) as Record<string, string>);
  } catch {
    return {};
  }
}

function readCompletedDayNumbers(userId?: string) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(getStorageKey(completedDaysStorageKey, userId)) ?? '[]') as unknown;
    if (!Array.isArray(saved)) return new Set<number>();
    const totalDays = Math.ceil(sourceWords.length / wordsPerDay);
    return new Set(saved.filter((day): day is number => (
      typeof day === 'number'
      && Number.isInteger(day)
      && day >= 1
      && day <= totalDays
    )));
  } catch {
    return new Set<number>();
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

function getCurrentStreak(completedDays: Set<number>) {
  const orderedDays = [...completedDays].sort((a, b) => a - b);
  let longestStreak = 0;
  let currentStreak = 0;
  let previousDay: number | undefined;

  for (const dayNumber of orderedDays) {
    currentStreak = previousDay !== undefined && dayNumber === previousDay + 1
      ? currentStreak + 1
      : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    previousDay = dayNumber;
  }

  return longestStreak;
}

function getCompletedDayNumbers(days: EditableWord[][], reviewed: Set<number>) {
  return days.reduce<number[]>((completed, dayWords, dayIndex) => {
    if (dayWords.length > 0 && dayWords.every((word) => reviewed.has(word.id))) {
      completed.push(dayIndex + 1);
    }
    return completed;
  }, []);
}

function getContiguousCompletedDayCount(completedDays: Set<number>, totalDays: number) {
  let count = 0;
  while (count < totalDays && completedDays.has(count + 1)) count += 1;
  return count;
}

function getMilestoneKey(dayCount: 3 | 6, boundaryDay: number) {
  return `review-${dayCount}-day-${boundaryDay}`;
}

function normalizeReviewMilestones(milestones: Record<string, string>) {
  const normalized = { ...milestones };
  if (milestones['review-3-day'] && !normalized[getMilestoneKey(3, 3)]) {
    normalized[getMilestoneKey(3, 3)] = milestones['review-3-day'];
  }
  if (milestones['review-6-day'] && !normalized[getMilestoneKey(6, 6)]) {
    normalized[getMilestoneKey(6, 6)] = milestones['review-6-day'];
  }
  return normalized;
}

function getReviewBoundary(dayCount: 3 | 6, completedThrough: number) {
  if (completedThrough < dayCount) return undefined;
  const boundary = Math.floor(completedThrough / dayCount) * dayCount;
  if (dayCount === 3 && boundary % 6 === 0) return boundary - 3;
  return boundary;
}

function getPendingMilestone(completedDays: Set<number>, reviewMilestones: Record<string, string>, totalDays: number) {
  const completedThrough = getContiguousCompletedDayCount(completedDays, totalDays);
  for (let boundaryDay = 3; boundaryDay <= completedThrough; boundaryDay += 3) {
    const dayCount = boundaryDay % 6 === 0 ? 6 : 3;
    const key = getMilestoneKey(dayCount, boundaryDay);
    if (!reviewMilestones[key]) return { dayCount: dayCount as 3 | 6, boundaryDay, key };
  }
  return undefined;
}

function getNextUnlockedDay(completedDays: Set<number>, reviewMilestones: Record<string, string>, totalDays: number) {
  const completedThrough = getContiguousCompletedDayCount(completedDays, totalDays);
  if (completedThrough === 0) return 1;
  if (completedThrough % 3 === 0) {
    const dayCount = completedThrough % 6 === 0 ? 6 : 3;
    if (!reviewMilestones[getMilestoneKey(dayCount as 3 | 6, completedThrough)]) return completedThrough;
  }
  return Math.min(completedThrough + 1, totalDays);
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
  const { language, t } = useLanguage();
  const nav = [
    { id: 'study' as const, label: language === 'ar' ? 'غرفة الدراسة' : 'Study room', subtitle: 'غرفة الدراسة', icon: Sparkles },
    { id: 'browse' as const, label: t.wordLibrary, subtitle: language === 'ar' ? 'Word library' : 'مكتبة الكلمات', icon: Layers3 },
    { id: 'starred' as const, label: t.starredWords, subtitle: language === 'ar' ? 'Starred Words' : 'الكلمات المميزة', icon: Star },
    { id: 'review' as const, label: t.review, subtitle: language === 'ar' ? 'Review' : 'مراجعة', icon: RotateCcw },
    { id: 'all-days' as const, label: t.allDays, subtitle: 'جميع الأيام', icon: CalendarDays },
  ];
  return (
    <>
      {mobileOpen && <button type="button" aria-label={t.closeMenu} data-testid="button-close-menu" onClick={closeMobile} className="fixed inset-0 z-30 bg-[#202a40]/35 md:hidden" />}
      <aside id="mobile-sidebar" aria-label={t.mainNavigation} className={`app-sidebar fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[#202a40] px-5 py-6 text-[#f9f5e9] transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'is-open translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-start justify-between gap-3">
          <Logo />
          <button
            type="button"
            aria-label={t.closeMenu}
            data-testid="button-close-sidebar"
            onClick={closeMobile}
            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#46536a] text-[#dce1dc] transition-colors hover:border-[#f3d24f] hover:bg-[#2c3852] hover:text-[#f3d24f] md:hidden"
          >
            <X size={19} strokeWidth={2} />
          </button>
        </div>
        <div className="mt-14">
          <div className="mb-3 px-3 font-mono-custom text-[9px] uppercase tracking-[0.2em] text-[#84909f]">{t.yourDesk}</div>
          <nav className="space-y-1" aria-label={t.mainNavigation}>
            {nav.map(({ id, label, subtitle, icon: Icon }) => (
              <button
                key={id}
                type="button"
                data-testid={`button-nav-${id}`}
                onClick={() => { setView(id); closeMobile(); }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${language === 'ar' ? 'text-right' : 'text-left'} ${view === id ? 'bg-[#f3d24f] text-[#202a40] shadow-[3px_3px_0_#a89236]' : 'text-[#c2c8ce] hover:bg-[#2c3852] hover:text-[#f9f5e9]'}`}
              >
                <Icon size={17} strokeWidth={view === id ? 2.5 : 1.8} />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className={`font-arabic block text-[10px] ${view === id ? 'text-[#5b562e]' : 'text-[#7f8994]'}`} dir="rtl">{subtitle}</span>
                </span>
                {view === id && <span className="h-1.5 w-1.5 rounded-full bg-[#ef7657]" />}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto rounded-2xl border border-[#3a465e] bg-[#29354e] p-4">
          <div className="flex items-center justify-between">
             <span className="font-mono-custom text-[10px] uppercase tracking-[0.15em] text-[#9da8b3]">{t.dailyRhythm}</span>
             <span className="text-[11px] font-semibold text-[#f3d24f]">{Math.min(reviewedToday, dailyGoal)} / {dailyGoal}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#1d273a]">
             <div className="h-full rounded-full bg-[#ef7657] transition-all duration-500" style={{ width: `${Math.min(100, (reviewedToday / dailyGoal) * 100)}%` }} />
          </div>
            <p className="mt-3 text-xs leading-relaxed text-[#aab3bd]">{reviewedToday >= dailyGoal ? t.dailyRhythmComplete : t.dailyWordsLeft(dailyGoal - reviewedToday)}</p>
        </div>
         <button type="button" data-testid="button-reset-all-data" onClick={onReset} className="mt-4 inline-flex items-center gap-1.5 self-start px-2 text-[11px] font-semibold text-[#84909f] transition-colors hover:text-[#f3d24f]">
           <RotateCcw size={12} /> {t.resetAllData}
         </button>
         <div className="mt-5 flex items-center gap-2 px-2 text-[11px] text-[#84909f]"><Command size={12} /> <span>{t.builtForLongGame}</span></div>
      </aside>
    </>
  );
}

function AuthControls() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  if (!isLoaded) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-[#e9e3d7]" aria-label={t.loadingAccount} />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-1.5">
        <button type="button" data-testid="button-login" onClick={() => setLocation('/sign-in')} className="rounded-full px-3 py-2 text-xs font-semibold text-[#5f675f] transition-colors hover:bg-[#e9e3d7] hover:text-[#202a40]">{t.login}</button>
        <button type="button" data-testid="button-sign-up" onClick={() => setLocation('/sign-up')} className="rounded-full bg-[#202a40] px-3.5 py-2 text-xs font-semibold text-[#f9f5e9] transition-all hover:-translate-y-0.5 hover:bg-[#2c3852]">{t.signUp}</button>
      </div>
    );
  }

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? user.primaryEmailAddress?.emailAddress?.[0] ?? 'W'}`.toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <div className="max-w-[130px] truncate text-xs font-semibold text-[#202a40]">{user.firstName ?? user.primaryEmailAddress?.emailAddress}</div>
        <div className="font-mono-custom text-[9px] uppercase tracking-[.12em] text-[#858982]">{t.syncedAccount}</div>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e6c94d] bg-[#f3d24f] text-xs font-bold text-[#202a40]" data-testid="avatar-user">{initials}</div>
      <button type="button" data-testid="button-logout" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="rounded-full px-2.5 py-2 text-xs font-semibold text-[#71776f] transition-colors hover:bg-[#e9e3d7] hover:text-[#202a40]">{t.logout}</button>
    </div>
  );
}

function TopBar({ view, setView, openMenu, mobileOpen }: { view: AppView; setView: (view: AppView) => void; openMenu: () => void; mobileOpen: boolean }) {
  const { language, t, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const formattedDate = new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return (
    <header className="app-topbar sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#ded8ca] bg-background/90 px-5 backdrop-blur-md md:ml-[264px] md:px-10">
      <div className="flex items-center gap-3">
        <button type="button" data-testid="button-open-menu" onClick={openMenu} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d6d1c6] bg-[#fbf8f1] text-[#202a40] shadow-[0_2px_5px_rgba(31,41,55,.05)] transition-colors hover:border-[#24635f] hover:bg-[#e9e3d7] md:hidden" aria-label={t.openMenu} aria-controls="mobile-sidebar" aria-expanded={mobileOpen}><Menu size={20} strokeWidth={2.25} /></button>
        <div className="font-mono-custom text-[10px] uppercase tracking-[0.18em] text-[#858982]">{formattedDate}</div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" data-testid="button-top-study" onClick={() => setView('study')} className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:block ${view === 'study' ? 'bg-[#202a40] text-[#f9f5e9]' : 'text-[#71776f] hover:bg-[#e9e3d7]'}`}>{t.study}</button>
        <button type="button" data-testid="button-top-browse" onClick={() => setView('browse')} className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:block ${view === 'browse' ? 'bg-[#202a40] text-[#f9f5e9]' : 'text-[#71776f] hover:bg-[#e9e3d7]'}`}>{t.browse}</button>
        <button type="button" data-testid="button-top-review" onClick={() => setView('review')} className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:block ${view === 'review' ? 'bg-[#202a40] text-[#f9f5e9]' : 'text-[#71776f] hover:bg-[#e9e3d7]'}`}>{t.review}</button>
        <button type="button" data-testid="button-top-all-days" onClick={() => setView('all-days')} className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:block ${view === 'all-days' ? 'bg-[#202a40] text-[#f9f5e9]' : 'text-[#71776f] hover:bg-[#e9e3d7]'}`}>{t.allDays}</button>
         <button type="button" role="switch" aria-checked={theme === 'dark'} aria-label={t.themeToggleLabel} data-testid="button-theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="theme-toggle inline-flex items-center gap-1.5 rounded-full border border-[#d6d1c6] bg-[#fbf8f1] px-2.5 py-1.5 text-[#5f675f] transition-colors hover:border-[#24635f] hover:text-[#24635f]">
           {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
           <span className="hidden text-[11px] font-semibold md:inline">{theme === 'dark' ? t.lightMode : t.darkMode}</span>
           <span className={`relative h-4 w-7 rounded-full transition-colors ${theme === 'dark' ? 'bg-[#24635f]' : 'bg-[#d6d1c6]'}`} aria-hidden="true">
             <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-[#fbf8f1] shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
           </span>
         </button>
        <button type="button" data-testid="button-language-toggle" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} aria-label={t.languageButtonLabel} className="rounded-full border border-[#d6d1c6] bg-[#fbf8f1] px-3 py-1.5 text-xs font-semibold text-[#24635f] transition-colors hover:border-[#24635f] hover:bg-[#e9e3d7]">{t.languageButton}</button>
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
  const { language, t } = useLanguage();
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
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#d6d1c6] bg-[#f6f2e9] p-1" aria-label={`${label} ${language === 'ar' ? 'النطق' : 'pronunciation'}`}>
      <span className="px-1.5 font-mono-custom text-[9px] uppercase tracking-[0.12em] text-[#858982]">{t.audio}</span>
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
          title={canSpeak ? t.playPronunciation(label, shortLabel) : t.pronunciationUnavailable}
          aria-label={t.playPronunciation(label, shortLabel)}
          className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold text-[#5f675f] transition-colors hover:bg-[#f3d24f] hover:text-[#202a40] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Volume2 size={12} />
          {shortLabel}
        </button>
      ))}
    </div>
  );
}

function StarButton({ isStarred, onToggle, testId }: { isStarred: boolean; onToggle: () => void; testId: string }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={isStarred ? t.unstarWord : t.starWord}
      aria-pressed={isStarred}
      title={isStarred ? t.unstarWord : t.starWord}
      onClick={(event) => { event.stopPropagation(); onToggle(); }}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all ${isStarred ? 'border-[#e6c94d] bg-[#f8e7ba] text-[#a17818] hover:bg-[#f3d24f]' : 'border-[#d6d1c6] bg-[#f6f2e9] text-[#969b91] hover:border-[#e6c94d] hover:bg-[#f8e7ba] hover:text-[#a17818]'}`}
    >
      <Star size={16} fill={isStarred ? 'currentColor' : 'none'} strokeWidth={isStarred ? 2.2 : 1.8} />
    </button>
  );
}

function Flashcard({ word, revealed, onReveal, onNext, onPrevious, onShuffle, current, total, isReviewed, onMarkReviewed, onSaveWord, isStarred, onToggleStar, sessionActions }: { word: EditableWord; revealed: boolean; onReveal: () => void; onNext: () => void; onPrevious: () => void; onShuffle: () => void; current: number; total: number; isReviewed: boolean; onMarkReviewed: () => void; onSaveWord: (id: number, changes: WordOverrides) => void; isStarred: boolean; onToggleStar: () => void; sessionActions?: { onGotIt: () => void; onReviewLater: () => void } }) {
  const { language, t } = useLanguage();
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
           <div className="font-mono-custom text-[10px] uppercase tracking-[0.19em] text-[#858982]">{t.focusedPractice}</div>
           <h2 className="mt-1 font-display text-[27px] tracking-[-0.035em] text-[#202a40]">{t.oneWordAtTime}</h2>
        </div>
        <button type="button" data-testid="button-shuffle" onClick={onShuffle} className="group flex items-center gap-2 rounded-full border border-[#d6d1c6] bg-[#fbf8f1] px-3 py-2 text-xs font-semibold text-[#5f675f] transition-all hover:border-[#ef7657] hover:text-[#c14f39]">
           <Shuffle size={14} className="transition-transform duration-300 group-hover:rotate-180" /> {t.shuffle}
        </button>
      </div>
      <div className="relative overflow-hidden rounded-[26px] border border-[#d4cec0] bg-[#fbf8f1] shadow-[0_14px_34px_rgba(31,41,55,.08)]">
        <div className="flex items-center justify-between border-b border-[#e4ded2] px-6 py-4 sm:px-9">
           <span className="font-mono-custom text-[10px] uppercase tracking-[0.16em] text-[#858982]">{t.card} {String(current + 1).padStart(2, '0')} <span className="text-[#c8c1b2]">/ {String(total).padStart(2, '0')}</span></span>
           <div className="flex items-center gap-2">
             <span className={`rounded-full px-2.5 py-1 font-mono-custom text-[10px] font-medium ${word.level === 'A1' ? 'bg-[#d9eee9] text-[#24635f]' : word.level === 'A2' ? 'bg-[#e5e9d2] text-[#5d6732]' : word.level === 'B1' ? 'bg-[#f8e7ba] text-[#7d5b19]' : 'bg-[#f7d8cd] text-[#a04b39]'}`}>{word.level}</span>
              <StarButton isStarred={isStarred} onToggle={onToggleStar} testId={`button-star-word-${word.id}`} />
              <button type="button" data-testid="button-edit-word" onClick={startEditing} className="inline-flex items-center gap-1.5 rounded-full border border-[#d6d1c6] bg-[#f6f2e9] px-2.5 py-1.5 text-[11px] font-semibold text-[#5f675f] transition-colors hover:border-[#24635f] hover:text-[#24635f]"><Pencil size={12} /> {t.edit}</button>
           </div>
        </div>
         <div key={`${word.id}-${revealed}-${editing}`} className="card-flip min-h-[340px] px-6 py-10 sm:min-h-[360px] sm:px-12 sm:py-12">
           {editing ? (
             <div className="animate-fade" data-testid="panel-edit-word">
                <div className="flex items-center gap-2 text-[#24635f]"><Pencil size={15} /><span className="font-mono-custom text-[10px] uppercase tracking-[0.17em]">{t.editThisCard}</span></div>
               <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#5f675f]">{t.englishWord}<input value={draft.word ?? ''} onChange={(event) => updateDraft('word', event.target.value)} className={inputClassName} required /></label>
                  <label className="text-xs font-semibold text-[#5f675f]">{t.partOfSpeech}<input value={draft.type ?? ''} onChange={(event) => updateDraft('type', event.target.value)} className={inputClassName} required /></label>
                  <label className="text-xs font-semibold text-[#5f675f]">{t.cefrLevel}<input value={draft.level ?? ''} onChange={(event) => updateDraft('level', event.target.value)} className={inputClassName} required /></label>
                  <label className="text-xs font-semibold text-[#5f675f]">{t.arabicTranslation}<input dir="rtl" value={draft.translation ?? ''} onChange={(event) => updateDraft('translation', event.target.value)} className={`${inputClassName} font-arabic`} required /></label>
                  <label className="text-xs font-semibold text-[#5f675f] sm:col-span-2">{t.englishExample}<textarea value={draft.example ?? ''} onChange={(event) => updateDraft('example', event.target.value)} className={`${inputClassName} min-h-20 resize-y`} required /></label>
                  <label className="text-xs font-semibold text-[#5f675f] sm:col-span-2">{t.arabicExampleTranslation}<textarea dir="rtl" value={draft.exampleTranslation ?? ''} onChange={(event) => updateDraft('exampleTranslation', event.target.value)} className={`${inputClassName} min-h-20 resize-y font-arabic`} required /></label>
               </div>
               <div className="mt-6 flex justify-end gap-2">
                  <button type="button" onClick={cancelEditing} className="inline-flex items-center gap-1.5 rounded-full border border-[#d6d1c6] px-3 py-2 text-xs font-semibold text-[#737970] hover:bg-[#eee8dc]"><X size={14} /> {t.cancel}</button>
                  <button type="button" data-testid="button-save-word" onClick={saveEditing} className="inline-flex items-center gap-1.5 rounded-full bg-[#24635f] px-3.5 py-2 text-xs font-semibold text-[#f9f5e9] hover:bg-[#1c514e]"><Save size={14} /> {t.saveChanges}</button>
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
              <PronunciationButtons text={word.word} label={language === 'ar' ? `كلمة ${word.word}` : `the word ${word.word}`} testIdPrefix="button-pronounce-word" />
          </div>
          {revealed ? (
            <div className="animate-fade mt-8 border-t border-[#e4ded2] pt-6" data-testid="panel-answer">
              <div className="font-arabic text-[26px] font-semibold leading-tight text-[#24635f]" dir="rtl" data-testid="text-translation">{word.translation}</div>
               <div className="mt-5 grid gap-3 border-l-2 border-[#f3d24f] pl-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                 <div className="grid gap-2">
                   <p className="text-[15px] leading-relaxed text-[#3d4651]" data-testid="text-example">“{word.example}”</p>
                   <p className="font-arabic text-[13px] leading-relaxed text-[#858982]" dir="rtl" data-testid="text-example-translation">{word.exampleTranslation}</p>
                 </div>
                  <PronunciationButtons text={word.example} label={language === 'ar' ? 'جملة المثال' : t.exampleSentence} testIdPrefix="button-pronounce-example" />
              </div>
            </div>
          ) : (
            <button type="button" data-testid="button-reveal" onClick={onReveal} className="mt-9 flex items-center gap-2 border-b border-dashed border-[#9da398] pb-1 text-sm font-semibold text-[#5f675f] transition-colors hover:border-[#ef7657] hover:text-[#c14f39]">{t.tapToReveal} <ArrowRight size={15} /></button>
          )}
             </>
           )}
        </div>
        <div className="flex items-center justify-between border-t border-[#e4ded2] px-5 py-4 sm:px-9">
          <button type="button" data-testid="button-previous" onClick={onPrevious} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-[#737970] transition-colors hover:bg-[#eee8dc] hover:text-[#202a40]"><ArrowLeft size={15} /> {t.previous}</button>
           {sessionActions ? (
             <div className="flex flex-wrap items-center justify-center gap-2">
               <button type="button" data-testid="button-got-it" onClick={sessionActions.onGotIt} className="inline-flex items-center gap-1.5 rounded-full bg-[#24635f] px-3.5 py-2 text-xs font-semibold text-[#f9f5e9] transition-all hover:-translate-y-0.5 hover:bg-[#1c514e]"><Check size={14} /> {t.gotIt}</button>
               <button type="button" data-testid="button-review-later" onClick={sessionActions.onReviewLater} className="inline-flex items-center gap-1.5 rounded-full border border-[#d6d1c6] bg-[#f6f2e9] px-3.5 py-2 text-xs font-semibold text-[#5f675f] transition-colors hover:border-[#ef7657] hover:bg-[#fff4ef] hover:text-[#c14f39]"><RotateCcw size={13} /> {t.reviewLater}</button>
             </div>
           ) : (
             <button type="button" data-testid="button-mark-known" onClick={onMarkReviewed} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all ${isReviewed ? 'bg-[#d9eee9] text-[#24635f]' : 'text-[#737970] hover:bg-[#f3d24f] hover:text-[#202a40]'}`}><Check size={14} /> {isReviewed ? t.inYourRhythm : t.iKnowThis}</button>
           )}
          <button type="button" data-testid="button-next" onClick={onNext} className="flex items-center gap-2 rounded-lg bg-[#202a40] px-3.5 py-2.5 text-xs font-semibold text-[#f9f5e9] transition-all hover:-translate-y-0.5 hover:bg-[#2c3852]">{t.nextWord} <ArrowRight size={15} /></button>
        </div>
      </div>
    </section>
  );
}

function Filters({ search, setSearch, level, setLevel, part, setPart, resultCount }: { search: string; setSearch: (value: string) => void; level: string; setLevel: (value: string) => void; part: string; setPart: (value: string) => void; resultCount: number }) {
  const { language, t } = useLanguage();
  return (
    <div className="rounded-2xl border border-[#ded8ca] bg-[#fbf8f1] p-3 shadow-[0_2px_5px_rgba(31,41,55,.03)]" data-testid="panel-filters">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#969b91]" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchEnglishArabic} data-testid="input-search" className={`h-11 w-full rounded-xl border border-[#ded8ca] bg-[#f6f2e9] text-sm text-[#202a40] outline-none transition-colors placeholder:text-[#9b9e96] focus:border-[#24635f] focus:ring-2 focus:ring-[#24635f]/10 ${language === 'ar' ? 'pr-10 pl-10' : 'pl-10 pr-10'}`} />
          {search && <button type="button" data-testid="button-clear-search" onClick={() => setSearch('')} className={`absolute top-1/2 -translate-y-1/2 text-[#969b91] hover:text-[#202a40] ${language === 'ar' ? 'left-3' : 'right-3'}`} aria-label={t.clearSearch}><X size={15} /></button>}
        </label>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <span className="sr-only">{t.cefrLevel}</span>
            <select value={level} onChange={(e) => setLevel(e.target.value)} data-testid="select-level" className={`h-11 min-w-[128px] appearance-none rounded-xl border border-[#ded8ca] bg-[#f6f2e9] px-3.5 text-xs font-semibold text-[#49534d] outline-none focus:border-[#24635f] ${language === 'ar' ? 'pl-8' : 'pr-8'}`}>
              {levelOptions.map((item) => <option key={item} value={item}>{item === 'All levels' ? t.allLevels : item}</option>)}
            </select>
            <ChevronDown size={14} className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[#858982] ${language === 'ar' ? 'left-2.5' : 'right-2.5'}`} />
          </label>
          <label className="relative">
            <span className="sr-only">{t.partOfSpeech}</span>
            <select value={part} onChange={(e) => setPart(e.target.value)} data-testid="select-part" className={`h-11 min-w-[140px] appearance-none rounded-xl border border-[#ded8ca] bg-[#f6f2e9] px-3.5 text-xs font-semibold capitalize text-[#49534d] outline-none focus:border-[#24635f] ${language === 'ar' ? 'pl-8' : 'pr-8'}`}>
              {typeOptions.map((item) => <option key={item} value={item}>{item === 'All parts' ? t.allParts : displayPartOfSpeech(item, language)}</option>)}
            </select>
            <ChevronDown size={14} className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-[#858982] ${language === 'ar' ? 'left-2.5' : 'right-2.5'}`} />
          </label>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-[#858982]"><ListFilter size={13} /> <span data-testid="text-result-count">{t.resultCount(resultCount)}</span></div>
    </div>
  );
}

function BrowseList({ words, starred, onSelect, onToggleStar }: { words: EditableWord[]; starred: Set<number>; onSelect: (word: EditableWord) => void; onToggleStar: (id: number) => void }) {
  const { language, t } = useLanguage();
  return (
    <section className="animate-rise mt-6" data-testid="section-word-library">
      <div className="mb-4 flex items-end justify-between">
        <div><div className="font-mono-custom text-[10px] uppercase tracking-[0.19em] text-[#858982]">{t.theWholeShelf}</div><h2 className="mt-1 font-display text-[27px] tracking-[-0.035em] text-[#202a40]">{t.browseLibrary}</h2></div>
        <span className="hidden text-xs text-[#858982] sm:block">{t.selectWordToStudy}</span>
      </div>
      {words.length === 0 ? (
         <div className="rounded-2xl border border-dashed border-[#c9c2b5] bg-[#fbf8f1] px-6 py-16 text-center" data-testid="empty-search-results"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f7d8cd] text-[#a04b39]"><Search size={18} /></div><h3 className="mt-4 font-display text-xl text-[#202a40]">{t.noWordsMatch}</h3><p className="mt-1 text-sm text-[#858982]">{t.tryDifferentSearch}</p></div>
      ) : (
         <div className="overflow-hidden rounded-2xl border border-[#ded8ca] bg-[#fbf8f1]" data-testid="list-words">
          {words.map((word, index) => (
              <div key={word.id} className={`group flex w-full items-center gap-3 border-b border-[#e8e2d7] px-4 py-3 transition-colors last:border-b-0 hover:bg-[#f5edda] sm:px-6 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                <button type="button" data-testid={`button-word-${word.id}`} onClick={() => onSelect(word)} className="flex min-w-0 flex-1 items-center gap-4 py-1">
                 <span className="w-6 shrink-0 font-mono-custom text-[10px] text-[#afb1a8]">{String(index + 1).padStart(2, '0')}</span>
                 <span className="min-w-0 flex-1"><span className="block font-display text-left text-[22px] leading-none tracking-[-.02em] text-[#202a40] transition-colors group-hover:text-[#24635f]">{word.word}</span><span className="font-arabic mt-1 block text-left text-xs text-[#858982]" dir="rtl">{word.translation}</span></span>
                  <span className="hidden rounded-full bg-[#e9e3d7] px-2.5 py-1 font-mono-custom text-[10px] capitalize text-[#666d65] sm:block">{displayPartOfSpeech(word.type, language)}</span>
                 <span className="w-8 shrink-0 text-center font-mono-custom text-[10px] text-[#24635f]">{word.level}</span>
                 <ArrowRight size={15} className="shrink-0 text-[#b7b8b0] transition-transform group-hover:translate-x-1 group-hover:text-[#ef7657]" />
                </button>
                <StarButton isStarred={starred.has(word.id)} onToggle={() => onToggleStar(word.id)} testId={`button-star-word-${word.id}`} />
              </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StarredWordsView({ words, starred, reviewed, onToggleStar, onMarkReviewed, onSaveWord }: { words: EditableWord[]; starred: Set<number>; reviewed: Set<number>; onToggleStar: (id: number) => void; onMarkReviewed: (id: number) => void; onSaveWord: (id: number, changes: WordOverrides) => void }) {
  const { language, t } = useLanguage();
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const current = words[practiceIndex] ?? words[0];

  useEffect(() => {
    setRevealed(false);
  }, [current?.id]);

  const startPractice = (index = 0) => {
    setPracticeIndex(index);
    setRevealed(false);
    setPracticeMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const next = () => setPracticeIndex((currentIndex) => (currentIndex + 1) % words.length);
  const previous = () => setPracticeIndex((currentIndex) => (currentIndex - 1 + words.length) % words.length);
  const shuffle = () => setPracticeIndex(Math.floor(Math.random() * words.length));

  if (practiceMode && current) {
    return (
      <section className="animate-rise" data-testid="section-starred-practice">
        <button type="button" data-testid="button-starred-practice-back" onClick={() => setPracticeMode(false)} className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d6d1c6] bg-[#fbf8f1] px-3.5 py-2 text-xs font-semibold text-[#5f675f] transition-colors hover:border-[#24635f] hover:text-[#24635f]">
          <ArrowLeft size={14} /> {t.backToStarred}
        </button>
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-[#ded8ca] pb-6">
          <div>
            <div className="flex items-center gap-2 font-mono-custom text-[10px] uppercase tracking-[.21em] text-[#a17818]"><Star size={14} fill="currentColor" /> {t.starredWords}</div>
            <h1 className="mt-3 font-display text-[clamp(2.8rem,6vw,5.2rem)] leading-[.88] tracking-[-.07em] text-[#202a40]">{t.practiceStarred}</h1>
          </div>
          <div className="font-mono-custom text-[10px] uppercase tracking-[.15em] text-[#858982]">{practiceIndex + 1} / {words.length}</div>
        </div>
        <Flashcard
          word={current}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onNext={next}
          onPrevious={previous}
          onShuffle={shuffle}
          current={practiceIndex}
          total={words.length}
          isReviewed={reviewed.has(current.id)}
          onMarkReviewed={() => onMarkReviewed(current.id)}
          onSaveWord={onSaveWord}
          isStarred={starred.has(current.id)}
          onToggleStar={() => onToggleStar(current.id)}
        />
      </section>
    );
  }

  return (
    <section className="animate-rise" data-testid="section-starred-words">
      <div className="flex flex-col justify-between gap-6 border-b border-[#ded8ca] pb-7 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 font-mono-custom text-[10px] uppercase tracking-[.21em] text-[#a17818]"><Star size={14} fill="currentColor" /> {t.starredWords}</div>
          <h1 className="mt-3 max-w-[680px] font-display text-[clamp(2.8rem,6vw,5.2rem)] leading-[.88] tracking-[-.07em] text-[#202a40]" data-testid="heading-starred-words">{t.starredWords}</h1>
          <p className="mt-4 max-w-[500px] text-[14px] leading-relaxed text-[#71776f]">{t.starredWordsDescription}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono-custom text-[10px] uppercase tracking-[.12em] text-[#858982]">{t.starredCount(words.length)}</span>
          {words.length > 0 && <button type="button" data-testid="button-practice-starred" onClick={() => startPractice()} className="inline-flex items-center gap-2 rounded-full bg-[#202a40] px-4 py-2.5 text-xs font-semibold text-[#f9f5e9] transition-all hover:-translate-y-0.5 hover:bg-[#2c3852]"><Layers3 size={14} /> {t.practiceStarred}</button>}
        </div>
      </div>
      {words.length === 0 ? (
        <div className="mt-7 rounded-[26px] border border-dashed border-[#c9c2b5] bg-[#fbf8f1] px-6 py-20 text-center" data-testid="empty-starred-words">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f8e7ba] text-[#a17818]"><Star size={24} fill="currentColor" /></div>
          <h2 className="mt-5 font-display text-2xl tracking-[-.03em] text-[#202a40]">{t.noStarredWords}</h2>
          <p className="mx-auto mt-2 max-w-[400px] text-sm leading-relaxed text-[#858982]">{t.noStarredWordsDescription}</p>
        </div>
      ) : (
        <div className="mt-7 overflow-hidden rounded-2xl border border-[#ded8ca] bg-[#fbf8f1]" data-testid="list-starred-words">
          {words.map((word, index) => (
            <div key={word.id} className={`group flex w-full items-center gap-3 border-b border-[#e8e2d7] px-4 py-4 last:border-b-0 sm:px-6 ${language === 'ar' ? 'text-right' : 'text-left'} hover:bg-[#f5edda]`}>
              <button type="button" data-testid={`button-practice-starred-${word.id}`} onClick={() => startPractice(index)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                <span className="w-6 shrink-0 font-mono-custom text-[10px] text-[#afb1a8]">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1"><span className="block font-display text-[22px] leading-none tracking-[-.02em] text-[#202a40] transition-colors group-hover:text-[#24635f]">{word.word}</span><span className="font-arabic mt-1 block text-xs text-[#858982]" dir="rtl">{word.translation}</span></span>
                <span className="hidden rounded-full bg-[#e9e3d7] px-2.5 py-1 font-mono-custom text-[10px] capitalize text-[#666d65] sm:block">{displayPartOfSpeech(word.type, language)}</span>
                <span className="w-8 shrink-0 text-center font-mono-custom text-[10px] text-[#24635f]">{word.level}</span>
                <ArrowRight size={15} className="shrink-0 text-[#b7b8b0] transition-transform group-hover:translate-x-1 group-hover:text-[#ef7657]" />
              </button>
              <StarButton isStarred={starred.has(word.id)} onToggle={() => onToggleStar(word.id)} testId={`button-star-word-${word.id}`} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StudyHome({ words, currentIndex, setCurrentIndex, reviewed, starred, markReviewed, onToggleStar, onSaveWord }: { words: EditableWord[]; currentIndex: number; setCurrentIndex: (index: number) => void; reviewed: Set<number>; starred: Set<number>; markReviewed: (id: number) => void; onToggleStar: (id: number) => void; onSaveWord: (id: number, changes: WordOverrides) => void }) {
  const { language, t } = useLanguage();
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
   if (!current) return <div className="rounded-2xl border border-dashed border-[#c9c2b5] p-10 text-center">{t.noWordToStudy}</div>;
  const next = () => setCurrentIndex((currentIndex + 1) % words.length);
  const previous = () => setCurrentIndex((currentIndex - 1 + words.length) % words.length);
  const shuffle = () => setCurrentIndex(Math.floor(Math.random() * words.length));
  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div>
          <Flashcard word={current} revealed={revealed} onReveal={() => setRevealed(true)} onNext={next} onPrevious={previous} onShuffle={shuffle} current={currentIndex} total={words.length} isReviewed={reviewed.has(current.id)} onMarkReviewed={() => markReviewed(current.id)} onSaveWord={onSaveWord} isStarred={starred.has(current.id)} onToggleStar={() => onToggleStar(current.id)} />
         <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#9a9e94]" data-testid="text-keyboard-hint"><span className="rounded border border-[#d8d2c6] bg-[#fbf8f1] px-1.5 py-0.5 font-mono-custom text-[10px]">space</span> {t.keyboardHint} <span className="mx-1 text-[#c5c0b5]">·</span> <span className="rounded border border-[#d8d2c6] bg-[#fbf8f1] px-1.5 py-0.5 font-mono-custom text-[10px]">← →</span> {t.keyboardMove}</div>
      </div>
      <aside className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl bg-[#24635f] p-5 text-[#f9f5e9]">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border-[18px] border-[#4c8a81]/40" />
           <div className="relative flex items-start justify-between"><div><div className="font-mono-custom text-[9px] uppercase tracking-[.18em] text-[#b9d5ca]">{t.yourGoal}</div><div className="mt-2 font-display text-[38px] leading-none">{reviewed.size} <span className="font-sans text-[15px] font-medium text-[#b9d5ca]">/ 3,000</span></div></div><div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `conic-gradient(#f3d24f ${goalPercent}%, #3d7972 ${goalPercent}%)` }}><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#24635f] font-mono-custom text-[10px] text-[#f3d24f]">{goalPercent.toFixed(1)}%</div></div></div>
           <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[#1d5653]"><div className="h-full rounded-full bg-[#f3d24f] transition-all duration-500" style={{ width: `${goalPercent}%` }} /></div>
           <p className="mt-3 text-xs leading-relaxed text-[#d5e5dc]">{t.smallShelf}</p>
        </div>
        <div className="rounded-2xl border border-[#ded8ca] bg-[#fbf8f1] p-5">
           <div className="flex items-center justify-between"><h3 className="font-semibold text-[#202a40]">{t.levelMap}</h3><span className="font-mono-custom text-[9px] uppercase tracking-[.14em] text-[#858982]">{t.words}</span></div>
          <div className="mt-5 space-y-4">
             {['A1', 'A2', 'B1', 'B2'].map((level, index) => { const count = oxford3000.filter((word) => word.level === level).length; const maxLevelCount = 800; return <div key={level} className="flex items-center gap-3"><span className="w-6 font-mono-custom text-[10px] text-[#858982]">{level}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e9e3d7]"><div className={`h-full rounded-full ${index === 0 ? 'bg-[#24635f]' : index === 1 ? 'bg-[#6e9d83]' : index === 2 ? 'bg-[#e5ad48]' : 'bg-[#ef7657]'}`} style={{ width: `${(count / maxLevelCount) * 100}%` }} /></div><span className="w-8 text-right font-mono-custom text-[10px] text-[#858982]">{count}</span></div>; })}
          </div>
           <button type="button" data-testid="button-view-library" onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })} className="mt-6 flex w-full items-center justify-between border-t border-[#e8e2d7] pt-4 text-xs font-semibold text-[#24635f] hover:text-[#ef7657]">{t.exploreAllWords} <ArrowRight size={14} /></button>
        </div>
        <div className="rounded-2xl border border-[#ded8ca] bg-[#f5edda] p-5">
           <div className="flex items-center gap-2 text-[#c45a42]"><BookOpen size={15} /><span className="font-mono-custom text-[9px] uppercase tracking-[.16em]">{t.studyNote}</span></div>
           <p className="mt-3 font-display text-[19px] leading-snug text-[#202a40]">{t.quote}</p>
          <p className="mt-3 font-arabic text-[12px] text-[#858982]" dir="rtl">الكلمة تعيش في الجملة.</p>
        </div>
      </aside>
    </div>
  );
}

function reviewWordSignature(words: EditableWord[]) {
  return words.map((word) => word.id).sort((a, b) => a - b).join(',');
}

function getReviewBlocks(totalDays: number): ReviewBlock[] {
  const blocks: ReviewBlock[] = [];
  for (let endDay = 3; endDay <= totalDays; endDay += 3) {
    const dayCount = endDay % 6 === 0 ? 6 : 3;
    blocks.push({
      key: getMilestoneKey(dayCount as 3 | 6, endDay),
      dayCount: dayCount as 3 | 6,
      startDay: endDay - dayCount + 1,
      endDay,
    });
  }
  return blocks;
}

function getRequiredReviewBlockForDay(dayNumber: number, totalDays: number) {
  const blocks = getReviewBlocks(totalDays);
  const exactEndDay = Math.ceil(dayNumber / 3) * 3;
  return blocks.find((block) => block.endDay === exactEndDay) ?? blocks[blocks.length - 1];
}

function getFullyCompletedDayNumbers(days: EditableWord[][], reviewed: Set<number>, reviewMilestones: Record<string, string>) {
  const studiedDays = new Set(getCompletedDayNumbers(days, reviewed));
  return days.reduce<number[]>((completed, _dayWords, dayIndex) => {
    const dayNumber = dayIndex + 1;
    const requiredReview = getRequiredReviewBlockForDay(dayNumber, days.length);
    if (studiedDays.has(dayNumber) && requiredReview && reviewMilestones[requiredReview.key]) {
      completed.push(dayNumber);
    }
    return completed;
  }, []);
}

function getReviewWordsForBlock(days: EditableWord[][], block: ReviewBlock, avoidSignature?: string) {
  const reviewDaySets = Array.from(
    { length: block.dayCount },
    (_, index) => days[block.startDay - 1 + index] ?? [],
  );
  const targetCount = block.dayCount === 3 ? threeDayReviewWordCount : sixDayReviewWordCount;
  const wordsPerSet = Math.floor(targetCount / reviewDaySets.length);
  const extraWordCount = targetCount % reviewDaySets.length;
  const buildMix = () => {
    const extraWordSetIndexes = new Set(shuffleItems(reviewDaySets.map((_, index) => index)).slice(0, extraWordCount));
    return reviewDaySets.map((dayWords, setIndex) => {
      const countForSet = wordsPerSet + (extraWordSetIndexes.has(setIndex) ? 1 : 0);
      return shuffleItems(dayWords).slice(0, countForSet);
    });
  };

  let selectedByDay = buildMix();
  let words = shuffleItems(selectedByDay.flat());
  let attempts = 0;
  while (avoidSignature && reviewWordSignature(words) === avoidSignature && attempts < 8) {
    selectedByDay = buildMix();
    words = shuffleItems(selectedByDay.flat());
    attempts += 1;
  }
  if (avoidSignature && reviewWordSignature(words) === avoidSignature) {
    const selectedIds = new Set(words.map((word) => word.id));
    const replacementSetIndex = selectedByDay.findIndex((selected, setIndex) =>
      selected.length > 0 && reviewDaySets[setIndex].some((word) => !selectedIds.has(word.id)),
    );
    if (replacementSetIndex >= 0) {
      const replacement = shuffleItems(reviewDaySets[replacementSetIndex]).find((word) => !selectedIds.has(word.id));
      if (replacement) {
        const replacedId = selectedByDay[replacementSetIndex][0].id;
        words = shuffleItems(words.map((word) => word.id === replacedId ? replacement : word));
      }
    }
  }
  return words;
}

function ReviewMilestoneCard({ block, words, completed, locked, onStart }: { block: ReviewBlock; words: EditableWord[]; completed: boolean; locked: boolean; onStart: () => void }) {
  const { t } = useLanguage();
  const isReady = !locked && words.length > 0;
  const title = block.dayCount === 3 ? t.reviewThreeDay : t.reviewSixDay;
  return (
    <article className={`group relative overflow-hidden rounded-[26px] border p-6 transition-all duration-300 sm:p-8 ${locked ? 'border-[#ded8ca] bg-[#eeeae1] opacity-75' : block.dayCount === 3 ? 'border-[#d4cec0] bg-[#fbf8f1] hover:-translate-y-1 hover:border-[#24635f] hover:shadow-[0_16px_34px_rgba(31,41,55,.09)]' : 'border-[#d9cfae] bg-[#f5edda] hover:-translate-y-1 hover:border-[#b99a43] hover:shadow-[0_16px_34px_rgba(125,91,25,.1)]'}`} data-testid={`card-review-milestone-${block.dayCount}-${block.endDay}`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${locked ? 'bg-[#b7b8b0]' : block.dayCount === 3 ? 'bg-[#24635f]' : 'bg-[#ef7657]'}`} />
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${locked ? 'bg-[#e1ddd3] text-[#858982]' : block.dayCount === 3 ? 'bg-[#d9eee9] text-[#24635f]' : 'bg-[#f8e7ba] text-[#a04b39]'}`}><span className="font-display text-[25px] leading-none">{block.dayCount}</span></div>
      </div>
      <div className="mt-8">
        <h2 className="mt-2 font-display text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-.05em] text-[#202a40]">{title}</h2>
        <div className="mt-2 font-mono-custom text-[10px] uppercase tracking-[.14em] text-[#24635f]">{t.reviewBlockDays(block.startDay, block.endDay)}</div>
      </div>
      <div className="mt-8 flex justify-end border-t border-[#e4ded2] pt-5">
        <button type="button" data-testid={`button-start-review-${block.dayCount}-${block.endDay}`} aria-disabled={locked} disabled={!isReady} onClick={onStart} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-45 ${locked ? 'bg-[#b7b8b0] text-[#f6f2e9]' : block.dayCount === 3 ? 'bg-[#202a40] text-[#f9f5e9] hover:-translate-y-0.5 hover:bg-[#2c3852]' : 'bg-[#ef7657] text-[#fff8ee] hover:-translate-y-0.5 hover:bg-[#c95b43]'}`}>
          {locked ? t.locked : completed ? t.reviewAgain : t.reviewStart} <ArrowRight size={14} />
        </button>
      </div>
      <span className="sr-only">{block.key}</span>
    </article>
  );
}

function ReviewSession({ milestoneKey, dayCount, startDay, endDay, words, reviewed, starred, onMarkReviewed, onToggleStar, onSaveWord, onComplete, onBack }: { milestoneKey: string; dayCount: number; startDay: number; endDay: number; words: EditableWord[]; reviewed: Set<number>; starred: Set<number>; onMarkReviewed: (id: number) => void; onToggleStar: (id: number) => void; onSaveWord: (id: number, changes: WordOverrides) => void; onComplete: (key: string) => void; onBack: () => void }) {
  const { t } = useLanguage();
  const [sessionWordIds, setSessionWordIds] = useState<number[]>(() => words.map((word) => word.id));
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pendingReviewIds, setPendingReviewIds] = useState<Set<number>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [sessionComplete, setSessionComplete] = useState(false);
  const sessionWords = sessionWordIds.map((id) => words.find((word) => word.id === id)).filter((word): word is EditableWord => Boolean(word));
  const currentWord = sessionWords[flashcardIndex] ?? sessionWords[0];

  const moveNext = () => {
    setRevealed(false);
    setFlashcardIndex((current) => (current + 1) % Math.max(sessionWords.length, 1));
  };
  const movePrevious = () => {
    setRevealed(false);
    setFlashcardIndex((current) => (current - 1 + sessionWords.length) % sessionWords.length);
  };
  const shuffleCurrent = () => {
    setRevealed(false);
    setFlashcardIndex(Math.floor(Math.random() * sessionWords.length));
  };
  const completeCard = (result: 'got-it' | 'review-later') => {
    if (!currentWord || sessionComplete) return;
    const nextPendingIds = new Set(pendingReviewIds);
    const nextCompletedIds = new Set(completedIds);
    if (result === 'got-it') {
      nextPendingIds.delete(currentWord.id);
      nextCompletedIds.add(currentWord.id);
      onMarkReviewed(currentWord.id);
    } else {
      nextPendingIds.add(currentWord.id);
    }
    setPendingReviewIds(nextPendingIds);
    setCompletedIds(nextCompletedIds);
    setRevealed(false);
    if (flashcardIndex < sessionWords.length - 1) {
      setFlashcardIndex((current) => current + 1);
      return;
    }
    const nextRoundIds = sessionWords.filter((word) => nextPendingIds.has(word.id)).map((word) => word.id);
    if (nextRoundIds.length > 0) {
      setSessionWordIds(nextRoundIds);
      setFlashcardIndex(0);
      return;
    }
    setSessionComplete(true);
    onComplete(milestoneKey);
  };

  if (sessionComplete) {
    return (
      <section className="animate-celebrate" data-testid={`panel-review-session-complete-${dayCount}`}>
        <div className="relative overflow-hidden rounded-[30px] border border-[#c9e2dc] bg-[#edf7f3] px-6 py-16 text-center shadow-[0_18px_42px_rgba(31,41,55,.08)] sm:px-12">
          <div className="celebration-orbit celebration-orbit-one" />
          <div className="celebration-orbit celebration-orbit-two" />
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#24635f] text-[#f9f5e9] shadow-[0_0_0_10px_rgba(36,99,95,.08)]"><CheckCircle2 size={29} /></div>
          <div className="relative mt-6 font-mono-custom text-[10px] uppercase tracking-[.18em] text-[#24635f]">{t.reviewSessionLabel}</div>
          <h2 className="relative mt-3 font-display text-[clamp(2.3rem,6vw,4rem)] leading-none tracking-[-.055em] text-[#202a40]">{t.reviewSessionComplete}</h2>
          <p className="relative mx-auto mt-4 max-w-[390px] text-sm leading-relaxed text-[#5f675f]">{t.reviewSessionCompleteDescription}</p>
          <button type="button" data-testid="button-review-back-to-list" onClick={onBack} className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-[#202a40] px-5 py-3 text-xs font-semibold text-[#f9f5e9] transition-all hover:-translate-y-0.5 hover:bg-[#2c3852]"><ArrowLeft size={14} /> {t.reviewBack}</button>
        </div>
      </section>
    );
  }

  if (!currentWord) return null;
  return (
    <section className="animate-rise" data-testid={`panel-review-session-${dayCount}`}>
      <div className="mb-5 flex flex-col justify-between gap-4 border-b border-[#ded8ca] pb-6 sm:flex-row sm:items-end">
        <div>
          <button type="button" data-testid="button-review-session-back" onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d6d1c6] bg-[#fbf8f1] px-3.5 py-2 text-xs font-semibold text-[#5f675f] transition-colors hover:border-[#24635f] hover:text-[#24635f]"><ArrowLeft size={14} /> {t.reviewBack}</button>
          <div className="font-mono-custom text-[10px] uppercase tracking-[.18em] text-[#24635f]">{t.reviewSessionLabel} · {t.reviewBlockDays(startDay, endDay)}</div>
          <h1 className="mt-2 font-display text-[clamp(2.6rem,5vw,4.4rem)] leading-[.92] tracking-[-.06em] text-[#202a40]" data-testid="heading-review-session">{t.reviewTitle}</h1>
          <p className="mt-3 max-w-[470px] text-sm leading-relaxed text-[#71776f]">{t.reviewSessionDescription(words.length)}</p>
        </div>
        <div className="rounded-2xl border border-[#ded8ca] bg-[#f5edda] px-4 py-3 sm:text-right">
          <div className="font-mono-custom text-[9px] uppercase tracking-[.15em] text-[#858982]">{t.progress}</div>
          <div className="mt-1 font-display text-2xl text-[#202a40]" data-testid="text-review-session-progress">{completedIds.size} <span className="font-sans text-xs text-[#71776f]">/ {words.length}</span></div>
        </div>
      </div>
       <Flashcard word={currentWord} revealed={revealed} onReveal={() => setRevealed(true)} onNext={moveNext} onPrevious={movePrevious} onShuffle={shuffleCurrent} current={flashcardIndex} total={sessionWords.length} isReviewed={reviewed.has(currentWord.id)} onMarkReviewed={() => completeCard('got-it')} onSaveWord={onSaveWord} isStarred={starred.has(currentWord.id)} onToggleStar={() => onToggleStar(currentWord.id)} sessionActions={{ onGotIt: () => completeCard('got-it'), onReviewLater: () => completeCard('review-later') }} />
      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#9a9e94]" data-testid="text-review-session-status">{pendingReviewIds.size > 0 ? t.wordsToReview(pendingReviewIds.size) : t.reviewFreshMix}</div>
    </section>
  );
}

function ReviewView({ days, completedDays, reviewMilestones, reviewed, starred, onMarkReviewed, onToggleStar, onSaveWord, onCompleteReview }: { days: EditableWord[][]; completedDays: Set<number>; reviewMilestones: Record<string, string>; reviewed: Set<number>; starred: Set<number>; onMarkReviewed: (id: number) => void; onToggleStar: (id: number) => void; onSaveWord: (id: number, changes: WordOverrides) => void; onCompleteReview: (key: string) => void }) {
  const { language, t } = useLanguage();
  const [activeSession, setActiveSession] = useState<{ block: ReviewBlock; words: EditableWord[] } | null>(null);
  const previousMixSignaturesRef = useRef<Record<string, string>>({});
  const studiedDays = new Set(getCompletedDayNumbers(days, reviewed));
  const completedDayCount = getContiguousCompletedDayCount(studiedDays, days.length);
  const reviewBlocks = getReviewBlocks(days.length);
  const getFreshReviewWords = (block: ReviewBlock) => {
    const words = getReviewWordsForBlock(days, block, previousMixSignaturesRef.current[block.key]);
    previousMixSignaturesRef.current[block.key] = reviewWordSignature(words);
    return words;
  };
  const getBlockState = (block: ReviewBlock, blockIndex: number) => {
    const completed = Boolean(reviewMilestones[block.key]);
    const predecessorCompleted = blockIndex === 0 || Boolean(reviewMilestones[reviewBlocks[blockIndex - 1].key]);
    const unlocked = completed || (block.endDay <= completedDayCount && predecessorCompleted);
    return { completed, unlocked };
  };
  const startReview = (block: ReviewBlock) => {
    const { unlocked } = getBlockState(block, reviewBlocks.findIndex((item) => item.key === block.key));
    if (!unlocked) return;
    const words = getFreshReviewWords(block);
    if (words.length === 0) return;
    setActiveSession({ block, words });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  if (activeSession) {
     return <ReviewSession milestoneKey={activeSession.block.key} dayCount={activeSession.block.dayCount} startDay={activeSession.block.startDay} endDay={activeSession.block.endDay} words={activeSession.words} reviewed={reviewed} starred={starred} onMarkReviewed={onMarkReviewed} onToggleStar={onToggleStar} onSaveWord={onSaveWord} onComplete={onCompleteReview} onBack={() => setActiveSession(null)} />;
  }
  const unlockedBlockCount = reviewBlocks.filter((block, index) => getBlockState(block, index).unlocked).length;
  return (
    <section className="animate-rise" data-testid="section-review">
      <div className="relative overflow-hidden rounded-[28px] border border-[#d4cec0] bg-[#fbf8f1] px-6 py-8 shadow-[0_10px_28px_rgba(31,41,55,.04)] sm:px-10 sm:py-10">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[18px] border-[#f5edda]" />
        <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full border-[12px] border-[#d9eee9]/70" />
        <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2 font-mono-custom text-[10px] uppercase tracking-[.21em] text-[#24635f]"><RotateCcw size={14} /> {t.reviewDeskLabel}</div>
            <h1 className="mt-3 max-w-[670px] font-display text-[clamp(2.8rem,6vw,5.2rem)] leading-[.88] tracking-[-.07em] text-[#202a40]" data-testid="heading-review">{t.reviewTitle}</h1>
            <p className="mt-4 max-w-[500px] text-[14px] leading-relaxed text-[#71776f]">{t.reviewDescription}</p>
          </div>
          <div className={language === 'ar' ? 'text-right md:text-left' : 'text-left md:text-right'}>
            <div className="font-mono-custom text-[10px] uppercase tracking-[.15em] text-[#858982]">{t.dailyMap}</div>
            <div className="mt-1 font-display text-[32px] leading-none text-[#202a40]" data-testid="text-review-completed-days">{completedDayCount} <span className="font-sans text-sm font-medium text-[#71776f]">{t.days}</span></div>
          </div>
        </div>
      </div>
      <div className="mt-7 flex items-center justify-between gap-4 rounded-2xl border border-[#d4cec0] bg-[#f6f2e9] px-5 py-4">
        <div className="flex items-center gap-3 text-xs leading-relaxed text-[#71776f]"><BookOpen size={16} className="shrink-0 text-[#ef7657]" /><span>{completedDayCount < 3 ? t.reviewNeedDays(3) : t.reviewFreshMix}</span></div>
        <span className="shrink-0 font-mono-custom text-[10px] uppercase tracking-[.12em] text-[#858982]">{t.reviewBlocksProgress(unlockedBlockCount, reviewBlocks.length)}</span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reviewBlocks.map((block, blockIndex) => {
          const { completed, unlocked } = getBlockState(block, blockIndex);
          const words = unlocked ? getFreshReviewWords(block) : [];
          return <ReviewMilestoneCard key={block.key} block={block} words={words} completed={completed} locked={!unlocked} onStart={() => startReview(block)} />;
        })}
      </div>
    </section>
  );
}

function AllDaysOverview({ days, reviewed, completedDays, reviewMilestones, onSelectDay, onBlockedDay }: { days: EditableWord[][]; reviewed: Set<number>; completedDays: Set<number>; reviewMilestones: Record<string, string>; onSelectDay: (dayIndex: number) => void; onBlockedDay: (dayNumber: number) => void }) {
  const { language, t } = useLanguage();
  const studiedDays = new Set(getCompletedDayNumbers(days, reviewed));
  const fullyCompletedDays = new Set(getFullyCompletedDayNumbers(days, reviewed, reviewMilestones));
  const nextUnlockedDay = getNextUnlockedDay(studiedDays, reviewMilestones, days.length);
  return (
    <section className="animate-rise" data-testid="section-all-days">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 font-mono-custom text-[10px] uppercase tracking-[.21em] text-[#24635f]"><span className="h-2 w-2 rounded-full bg-[#ef7657]" /> {t.steadyPath}</div>
          <h1 className="mt-3 max-w-[680px] font-display text-[clamp(2.6rem,5.3vw,4.7rem)] leading-[.92] tracking-[-.065em] text-[#202a40]" data-testid="heading-all-days">{t.allDaysTitle} <em className="text-[#24635f]">{t.steadyRhythm}</em></h1>
          <p className="mt-4 max-w-[510px] text-[14px] leading-relaxed text-[#71776f]">{t.vocabularyJourney}</p>
        </div>
        <div className={language === 'ar' ? 'text-right md:text-left' : 'text-left md:text-right'}>
           <div className="font-mono-custom text-[10px] uppercase tracking-[.15em] text-[#858982]">{t.dailyMap}</div>
           <div className="mt-1 font-display text-[31px] leading-none text-[#202a40]">{days.length} <span className="font-sans text-sm font-medium text-[#71776f]">{t.days}</span></div>
        </div>
      </div>
      <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {days.map((dayWords, dayIndex) => {
          const reviewedCount = dayWords.filter((word) => reviewed.has(word.id)).length;
           const isLocked = dayIndex + 1 > nextUnlockedDay;
          const isStudied = studiedDays.has(dayIndex + 1);
          const isComplete = !isLocked && fullyCompletedDays.has(dayIndex + 1);
          const firstWord = dayWords[0]?.word ?? '';
          const lastWord = dayWords[dayWords.length - 1]?.word ?? '';
          return (
            <button
              type="button"
              key={dayIndex}
              data-testid={`button-all-days-day-${dayIndex + 1}`}
               aria-disabled={isLocked}
               onClick={() => isLocked ? onBlockedDay(dayIndex + 1) : onSelectDay(dayIndex)}
                className={`group relative overflow-hidden rounded-2xl border border-[#ded8ca] bg-[#fbf8f1] p-5 shadow-[0_2px_5px_rgba(31,41,55,.03)] transition-all duration-200 ${isLocked ? 'cursor-not-allowed opacity-65' : 'hover:-translate-y-1 hover:border-[#24635f] hover:shadow-[0_10px_22px_rgba(31,41,55,.08)]'} ${language === 'ar' ? 'text-right' : 'text-left'}`}
            >
              <div className="absolute right-0 top-0 h-1 w-14 bg-[#f3d24f] transition-all duration-200 group-hover:w-24" />
              <div className="flex items-center justify-between">
                 <span className="font-mono-custom text-[10px] uppercase tracking-[.17em] text-[#858982]">{t.dailySet}</span>
                 {isComplete ? (
                   <span className="inline-flex items-center gap-1 rounded-full bg-[#d9eee9] px-2 py-1 font-mono-custom text-[9px] uppercase tracking-[.08em] text-[#24635f]"><Check size={11} /> {t.complete}</span>
                 ) : isLocked ? (
                   <span className="inline-flex items-center gap-1 rounded-full bg-[#e9e3d7] px-2 py-1 font-mono-custom text-[9px] uppercase tracking-[.08em] text-[#858982]"><Lock size={10} /> {t.locked}</span>
                ) : (
                  <ArrowRight size={15} className="text-[#b7b8b0] transition-transform group-hover:translate-x-1 group-hover:text-[#ef7657]" />
                )}
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                 <h2 className="font-display text-[29px] leading-none tracking-[-.04em] text-[#202a40]">{t.dayLabel(dayIndex + 1)}</h2>
                 <span className="rounded-full bg-[#e9e3d7] px-2.5 py-1 font-mono-custom text-[9px] text-[#666d65]">{t.wordsCount(dayWords.length)}</span>
              </div>
               <p className="mt-4 truncate text-xs text-[#71776f]" title={`${firstWord} — ${lastWord}`}>{firstWord} <span className="text-[#c6bfb1]">{t.to}</span> {lastWord}</p>
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

function AllDaysDetail({ dayNumber, words, reviewed, starred, onBack, onMarkReviewed, onToggleStar, onSaveWord }: { dayNumber: number; words: EditableWord[]; reviewed: Set<number>; starred: Set<number>; onBack: () => void; onMarkReviewed: (id: number) => void; onToggleStar: (id: number) => void; onSaveWord: (id: number, changes: WordOverrides) => void }) {
  const { language, t } = useLanguage();
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [sessionWordIds, setSessionWordIds] = useState<number[]>(words.map((word) => word.id));
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewLaterIds, setReviewLaterIds] = useState<Set<number>>(new Set());
  const [pendingReviewIds, setPendingReviewIds] = useState<Set<number>>(new Set());
  const [sessionRound, setSessionRound] = useState(1);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [quizSelectionVisible, setQuizSelectionVisible] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [selectedQuizModes, setSelectedQuizModes] = useState<Set<QuizMode>>(new Set());
  const [quizWords, setQuizWords] = useState<EditableWord[]>([]);
  const reviewedCount = words.filter((word) => reviewed.has(word.id)).length;
  const sessionWords = sessionWordIds
    .map((id) => words.find((word) => word.id === id))
    .filter((word): word is EditableWord => Boolean(word));
  const currentWord = sessionWords[flashcardIndex] ?? sessionWords[0];
  const startFlashcardMode = () => {
    setSessionWordIds(words.map((word) => word.id));
    setFlashcardIndex(0);
    setRevealed(false);
    setReviewLaterIds(new Set());
    setPendingReviewIds(new Set());
    setSessionRound(1);
    setSessionComplete(false);
    setCelebrationVisible(false);
    setQuizSelectionVisible(false);
    setQuizStarted(false);
    setSelectedQuizModes(new Set());
    setQuizWords([]);
    setFlashcardMode(true);
  };
  const leaveFlashcardMode = () => {
    setRevealed(false);
    setReviewLaterIds(new Set());
    setPendingReviewIds(new Set());
    setSessionComplete(false);
    setCelebrationVisible(false);
    setQuizSelectionVisible(false);
    setQuizStarted(false);
    setSelectedQuizModes(new Set());
    setQuizWords([]);
    setFlashcardMode(false);
  };
  const nextFlashcard = () => {
    setRevealed(false);
    setFlashcardIndex((current) => (current + 1) % sessionWords.length);
  };
  const previousFlashcard = () => {
    setRevealed(false);
    setFlashcardIndex((current) => (current - 1 + sessionWords.length) % sessionWords.length);
  };
  const shuffleFlashcards = () => {
    setRevealed(false);
    setFlashcardIndex(Math.floor(Math.random() * sessionWords.length));
  };
  const completeCard = (result: 'got-it' | 'review-later') => {
    if (!currentWord || sessionComplete) return;

    const nextReviewLaterIds = new Set(reviewLaterIds);
    const nextPendingReviewIds = new Set(pendingReviewIds);
    if (result === 'got-it') {
      nextPendingReviewIds.delete(currentWord.id);
      onMarkReviewed(currentWord.id);
    } else {
      nextReviewLaterIds.add(currentWord.id);
      nextPendingReviewIds.add(currentWord.id);
    }

    setReviewLaterIds(nextReviewLaterIds);
    setPendingReviewIds(nextPendingReviewIds);
    setRevealed(false);

    if (flashcardIndex < sessionWords.length - 1) {
      setFlashcardIndex((current) => current + 1);
      return;
    }

    const nextRoundIds = sessionWords.filter((word) => nextPendingReviewIds.has(word.id)).map((word) => word.id);
    if (nextRoundIds.length > 0) {
      setSessionWordIds(nextRoundIds);
      setFlashcardIndex(0);
      setSessionRound((current) => current + 1);
    } else {
      setSessionComplete(true);
      setCelebrationVisible(true);
    }
  };
  const toggleQuizMode = (mode: QuizMode) => {
    setSelectedQuizModes((existing) => {
      const next = new Set(existing);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  };
  const startQuiz = () => {
    if (selectedQuizModes.size === 0) return;
    setQuizWords(chooseQuizWords(words, reviewLaterIds));
    setQuizSelectionVisible(false);
    setQuizStarted(true);
  };
  return (
    <section className="animate-rise" data-testid="section-all-days-detail">
       <button type="button" data-testid="button-all-days-back" onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-[#d6d1c6] bg-[#fbf8f1] px-3.5 py-2 text-xs font-semibold text-[#5f675f] transition-colors hover:border-[#24635f] hover:text-[#24635f]">
         <ArrowLeft size={14} /> {t.allDaysBack}
      </button>
      <div className="mt-8 flex flex-col justify-between gap-5 border-b border-[#ded8ca] pb-7 md:flex-row md:items-end">
        <div>
           <div className="font-mono-custom text-[10px] uppercase tracking-[.19em] text-[#858982]">{t.dailyVocabularySet}</div>
           <h1 className="mt-2 font-display text-[clamp(2.8rem,5vw,4.8rem)] leading-[.92] tracking-[-.065em] text-[#202a40]" data-testid="heading-day-detail">{t.dayLabel(dayNumber)}</h1>
           <p className="mt-3 font-arabic text-sm text-[#71776f]" dir="rtl">{language === 'ar' ? `${t.dayLabel(dayNumber)} · ${t.wordsCount(words.length)}` : `اليوم ${dayNumber} · ${words.length} كلمة`}</p>
        </div>
         <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
           <button type="button" data-testid="button-flashcard-mode" onClick={startFlashcardMode} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#202a40] px-4 py-2.5 text-xs font-semibold text-[#f9f5e9] shadow-[3px_3px_0_#aab1b8] transition-all hover:-translate-y-0.5 hover:bg-[#2c3852]">
             <Layers3 size={14} /> {t.flashcardMode}
           </button>
           <div className={`rounded-2xl border border-[#ded8ca] bg-[#f5edda] px-4 py-3 ${language === 'ar' ? 'text-right md:text-left' : 'text-left md:text-right'}`}>
              <div className="font-mono-custom text-[9px] uppercase tracking-[.16em] text-[#858982]">{t.progress}</div>
              <div className="mt-1 font-display text-2xl text-[#202a40]">{reviewedCount} <span className="font-sans text-xs text-[#71776f]">/ {words.length} {t.reviewed}</span></div>
           </div>
        </div>
      </div>
       {flashcardMode ? (
         <div className="mt-7" data-testid="panel-day-flashcard-session">
           <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
             <button type="button" data-testid="button-flashcard-back-to-list" onClick={leaveFlashcardMode} className="inline-flex items-center gap-2 rounded-full border border-[#d6d1c6] bg-[#fbf8f1] px-3.5 py-2 text-xs font-semibold text-[#5f675f] transition-colors hover:border-[#24635f] hover:text-[#24635f]">
               <ArrowLeft size={14} /> {t.returnToDayList}
             </button>
              <div className="flex flex-wrap items-center justify-end gap-2 font-mono-custom text-[10px] uppercase tracking-[.16em] text-[#858982]">
                <span data-testid="text-day-flashcard-round">{sessionComplete ? t.dailySessionComplete : sessionRound === 1 ? t.wordsCount(sessionWords.length) : t.reviewRound(sessionRound)}</span>
                {!sessionComplete && reviewLaterIds.size > 0 && <span className="rounded-full bg-[#f7d8cd] px-2.5 py-1 text-[#a04b39]" data-testid="text-review-later-count">{t.wordsToReview(reviewLaterIds.size)}</span>}
              </div>
           </div>
            {quizStarted ? (
              <QuizExperience words={quizWords} allWords={words} modes={[...selectedQuizModes]} onBack={() => { setQuizStarted(false); setQuizSelectionVisible(true); }} onFinish={leaveFlashcardMode} />
            ) : sessionComplete && quizSelectionVisible ? (
              <QuizSelection words={words} reviewLaterIds={reviewLaterIds} selectedModes={selectedQuizModes} onToggleMode={toggleQuizMode} onStart={startQuiz} onBack={leaveFlashcardMode} />
            ) : sessionComplete && celebrationVisible ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202a40]/45 px-5 backdrop-blur-sm" data-testid="panel-session-celebration">
                <div className="animate-celebrate relative w-full max-w-[500px] overflow-hidden rounded-[30px] border border-[#c9e2dc] bg-[#edf7f3] px-7 py-14 text-center shadow-[0_24px_70px_rgba(31,41,55,.22)] sm:px-12">
                  <div className="celebration-orbit celebration-orbit-one" />
                  <div className="celebration-orbit celebration-orbit-two" />
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#24635f] text-[#f9f5e9] shadow-[0_0_0_10px_rgba(36,99,95,.08)]"><Sparkles size={28} /></div>
                  <h2 className="relative mt-6 font-display text-[clamp(2.3rem,6vw,3.5rem)] leading-none tracking-[-.055em] text-[#202a40]">{t.dailySessionComplete}</h2>
                  <p className="relative mx-auto mt-4 max-w-[340px] text-sm leading-relaxed text-[#5f675f]">{t.dailyWordsLeft(0)}</p>
                  <button type="button" data-testid="button-continue-to-quiz" onClick={() => { setCelebrationVisible(false); setQuizSelectionVisible(true); }} className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-[#202a40] px-5 py-3 text-xs font-semibold text-[#f9f5e9] transition-all hover:-translate-y-0.5 hover:bg-[#2c3852]">{t.continueToQuiz} <ArrowRight size={14} /></button>
                </div>
              </div>
            ) : currentWord && (
             <>
               <Flashcard
                 word={currentWord}
                 revealed={revealed}
                 onReveal={() => setRevealed(true)}
                 onNext={nextFlashcard}
                 onPrevious={previousFlashcard}
                 onShuffle={shuffleFlashcards}
                 current={flashcardIndex}
                 total={words.length}
                 isReviewed={reviewed.has(currentWord.id)}
                 onMarkReviewed={() => onMarkReviewed(currentWord.id)}
                 onSaveWord={onSaveWord}
                  isStarred={starred.has(currentWord.id)}
                  onToggleStar={() => onToggleStar(currentWord.id)}
                  sessionActions={{
                    onGotIt: () => completeCard('got-it'),
                    onReviewLater: () => completeCard('review-later'),
                  }}
               />
               <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#9a9e94]" data-testid="text-day-flashcard-keyboard-hint">
                 <span className="rounded border border-[#d8d2c6] bg-[#fbf8f1] px-1.5 py-0.5 font-mono-custom text-[10px]">space</span> {t.keyboardHint} <span className="mx-1 text-[#c5c0b5]">·</span> <span className="rounded border border-[#d8d2c6] bg-[#fbf8f1] px-1.5 py-0.5 font-mono-custom text-[10px]">← →</span> {t.keyboardMove}
               </div>
             </>
           )}
         </div>
       ) : (
         <div className="mt-7 overflow-hidden rounded-2xl border border-[#ded8ca] bg-[#fbf8f1]" data-testid="list-all-days-words">
           {words.map((word, wordIndex) => (
             <article key={word.id} data-testid={`card-all-days-word-${word.id}`} className="grid gap-3 border-b border-[#e8e2d7] px-4 py-4 last:border-b-0 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-6">
               <span className="font-mono-custom text-[10px] text-[#afb1a8]">{String(wordIndex + 1).padStart(2, '0')}</span>
               <div className="min-w-0">
                 <div className="flex flex-wrap items-center gap-2">
                   <h2 className="font-display text-[25px] leading-none tracking-[-.02em] text-[#202a40]">{word.word}</h2>
                    <span className="rounded-full bg-[#e9e3d7] px-2 py-1 font-mono-custom text-[9px] uppercase text-[#666d65]">{displayPartOfSpeech(word.type, language)}</span>
                 </div>
                 <p className="font-arabic mt-2 text-sm text-[#24635f]" dir="rtl">{word.translation}</p>
               </div>
               <div className="flex items-center gap-3 sm:justify-end">
                   <StarButton isStarred={starred.has(word.id)} onToggle={() => onToggleStar(word.id)} testId={`button-star-word-${word.id}`} />
                  <span className={`rounded-full px-2.5 py-1 font-mono-custom text-[10px] ${word.level === 'A1' ? 'bg-[#d9eee9] text-[#24635f]' : word.level === 'A2' ? 'bg-[#e5e9d2] text-[#5d6732]' : word.level === 'B1' ? 'bg-[#f8e7ba] text-[#7d5b19]' : 'bg-[#f7d8cd] text-[#a04b39]'}`}>{word.level}</span>
                  {reviewed.has(word.id) && <span className="inline-flex items-center gap-1 font-mono-custom text-[9px] uppercase tracking-[.1em] text-[#24635f]"><Check size={12} /> {t.reviewed}</span>}
               </div>
             </article>
           ))}
         </div>
       )}
    </section>
  );
}

function AllDaysView({ days, reviewed, starred, completedDays, reviewMilestones, selectedDayIndex, onSelectDay, onBlockedDay, onBack, onMarkReviewed, onToggleStar, onSaveWord }: { days: EditableWord[][]; reviewed: Set<number>; starred: Set<number>; completedDays: Set<number>; reviewMilestones: Record<string, string>; selectedDayIndex: number | null; onSelectDay: (dayIndex: number) => void; onBlockedDay: (dayNumber: number) => void; onBack: () => void; onMarkReviewed: (id: number) => void; onToggleStar: (id: number) => void; onSaveWord: (id: number, changes: WordOverrides) => void }) {
  const selectedDay = selectedDayIndex === null ? undefined : days[selectedDayIndex];
  if (selectedDay && selectedDayIndex !== null) {
     return <AllDaysDetail dayNumber={selectedDayIndex + 1} words={selectedDay} reviewed={reviewed} starred={starred} onBack={onBack} onMarkReviewed={onMarkReviewed} onToggleStar={onToggleStar} onSaveWord={onSaveWord} />;
  }
  return <AllDaysOverview days={days} reviewed={reviewed} completedDays={completedDays} reviewMilestones={reviewMilestones} onSelectDay={onSelectDay} onBlockedDay={onBlockedDay} />;
}

function Home() {
  const { isLoaded: authLoaded, isSignedIn, user } = useUser();
  const { language, t } = useLanguage();
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
  const progressSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const lastQueuedProgressRef = useRef<string | null>(null);
  const queueProgressSave = useCallback((payload: ProgressInput) => {
    progressSaveQueueRef.current = progressSaveQueueRef.current
      .catch(() => undefined)
      .then(() => saveProgressMutation.mutateAsync({ data: payload }))
      .catch(() => undefined);
  }, [saveProgressMutation]);
  const [view, setView] = useState<AppView>('study');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('All levels');
  const [part, setPart] = useState('All parts');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState<Set<number>>(readReviewedIds);
  const [starred, setStarred] = useState<Set<number>>(readStarredIds);
  const [reviewDates, setReviewDates] = useState<Record<string, string>>(readReviewDates);
  const [reviewMilestones, setReviewMilestones] = useState<Record<string, string>>(readReviewMilestones);
  const [completedDays, setCompletedDays] = useState<Set<number>>(readCompletedDayNumbers);
  const [wordOverrides, setWordOverrides] = useState<Record<string, WordOverrides>>(readWordOverrides);
  const [blockedDay, setBlockedDay] = useState<number | null>(null);
  const authUserRef = useRef<string | null | undefined>(undefined);
  const hydratedUserRef = useRef<string | null>(null);
  const resetProgressUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);
  const today = localDateKey();
  const reviewedToday = Object.values(reviewDates).filter((date) => date === today).length;
  const editableWords = useMemo(() => sourceWords.map((word) => ({ ...word, ...(wordOverrides[word.id] ?? {}) })), [wordOverrides]);
  const days = useMemo(() => splitIntoDays(editableWords), [editableWords]);
  const currentStreak = getCurrentStreak(new Set(getFullyCompletedDayNumbers(days, reviewed, reviewMilestones)));
  useEffect(() => {
    if (!authLoaded) return;
    const userId = isSignedIn ? user?.id ?? null : null;
    if (authUserRef.current === userId) return;

    authUserRef.current = userId;
    hydratedUserRef.current = null;
    resetProgressUserRef.current = null;
    lastQueuedProgressRef.current = null;
    if (userId) {
      const mergedReviewed = new Set([...readReviewedIds(userId), ...readReviewedIds()]);
      const mergedStarred = new Set([...readStarredIds(userId), ...readStarredIds()]);
      const mergedReviewDates = { ...readReviewDates(userId), ...readReviewDates() };
      const mergedReviewMilestones = normalizeReviewMilestones({ ...readReviewMilestones(userId), ...readReviewMilestones() });
      const mergedCompletedDays = new Set([
        ...readCompletedDayNumbers(userId),
        ...readCompletedDayNumbers(),
        ...getCompletedDayNumbers(days, mergedReviewed),
      ]);
      setReviewed(mergedReviewed);
      setStarred(mergedStarred);
      setReviewDates(mergedReviewDates);
      setReviewMilestones(mergedReviewMilestones);
      setCompletedDays(mergedCompletedDays);
      window.localStorage.setItem(getStorageKey(reviewedStorageKey, userId), JSON.stringify([...mergedReviewed]));
      window.localStorage.setItem(getStorageKey(starredStorageKey, userId), JSON.stringify([...mergedStarred]));
      window.localStorage.setItem(getStorageKey(reviewDatesStorageKey, userId), JSON.stringify(mergedReviewDates));
      window.localStorage.setItem(getStorageKey(reviewMilestonesStorageKey, userId), JSON.stringify(mergedReviewMilestones));
      window.localStorage.setItem(getStorageKey(completedDaysStorageKey, userId), JSON.stringify([...mergedCompletedDays].sort((a, b) => a - b)));
      window.localStorage.removeItem(reviewedStorageKey);
      window.localStorage.removeItem(starredStorageKey);
      window.localStorage.removeItem(reviewDatesStorageKey);
      window.localStorage.removeItem(reviewMilestonesStorageKey);
      window.localStorage.removeItem(completedDaysStorageKey);
    } else {
      const guestReviewed = readReviewedIds();
      const guestStarred = readStarredIds();
      const guestCompletedDays = readCompletedDayNumbers();
      setReviewed(guestReviewed);
      setStarred(guestStarred);
      setReviewDates(readReviewDates());
      setReviewMilestones(readReviewMilestones());
      setCompletedDays(new Set([
        ...guestCompletedDays,
        ...getCompletedDayNumbers(days, guestReviewed),
      ]));
    }
  }, [authLoaded, isSignedIn, user?.id, days]);

  useEffect(() => {
    if (!authLoaded || !isSignedIn || !user?.id || progressQuery.isLoading || !progressQuery.data || hydratedUserRef.current === user.id) return;

    const resettingProgress = resetProgressUserRef.current === user.id;
    const serverReviewed = resettingProgress
      ? new Set<number>()
      : new Set(progressQuery.data.completedWordIds.filter((id) => sourceWords.some((word) => word.id === id)));
    const serverStarred = resettingProgress
      ? new Set<number>()
      : new Set(progressQuery.data.starredWordIds.filter((id) => sourceWords.some((word) => word.id === id)));
    const mergedReviewDates = resettingProgress ? {} : { ...(progressQuery.data.reviewDates ?? {}), ...reviewDates };
    const mergedReviewMilestones = resettingProgress ? {} : normalizeReviewMilestones({ ...(progressQuery.data.reviewMilestones ?? {}), ...reviewMilestones });
    const mergedReviewed = resettingProgress ? new Set<number>() : new Set([...reviewed, ...serverReviewed]);
    const mergedStarred = resettingProgress ? new Set<number>() : new Set([...starred, ...serverStarred]);
    const mergedCompletedDays = new Set([
      ...(resettingProgress ? [] : progressQuery.data.completedDayNumbers),
      ...(resettingProgress ? [] : readCompletedDayNumbers(user.id)),
      ...(resettingProgress ? [] : getCompletedDayNumbers(days, mergedReviewed)),
    ]);
    setReviewed(mergedReviewed);
    setStarred(mergedStarred);
    setReviewDates(mergedReviewDates);
    setReviewMilestones(mergedReviewMilestones);
    setCompletedDays(mergedCompletedDays);
    hydratedUserRef.current = user.id;
    resetProgressUserRef.current = null;
  }, [authLoaded, isSignedIn, user?.id, progressQuery.data, progressQuery.isLoading, reviewed, starred, days, reviewDates, reviewMilestones]);

  useEffect(() => {
    if (!authLoaded) return;
    const userId = isSignedIn ? user?.id : undefined;
    window.localStorage.setItem(getStorageKey(reviewedStorageKey, userId), JSON.stringify([...reviewed].sort((a, b) => a - b)));
    window.localStorage.setItem(getStorageKey(starredStorageKey, userId), JSON.stringify([...starred].sort((a, b) => a - b)));
    window.localStorage.setItem(getStorageKey(reviewDatesStorageKey, userId), JSON.stringify(reviewDates));
    window.localStorage.setItem(getStorageKey(reviewMilestonesStorageKey, userId), JSON.stringify(reviewMilestones));
    window.localStorage.setItem(getStorageKey(completedDaysStorageKey, userId), JSON.stringify([...completedDays].sort((a, b) => a - b)));
  }, [authLoaded, isSignedIn, user?.id, reviewed, starred, reviewDates, reviewMilestones, completedDays]);

  useEffect(() => {
    if (!authLoaded || !isSignedIn || !user?.id || progressQuery.isLoading || !progressQuery.data || hydratedUserRef.current !== user.id) return;
    const completedDayNumbers = [...new Set([
      ...completedDays,
      ...getCompletedDayNumbers(days, reviewed),
    ])].sort((a, b) => a - b);
    const payload: ProgressInput = {
      completedWordIds: [...reviewed].sort((a, b) => a - b),
      starredWordIds: [...starred].sort((a, b) => a - b),
      completedDayNumbers,
      reviewDates,
      reviewMilestones,
    };
    const fingerprint = JSON.stringify(payload);
    if (lastQueuedProgressRef.current === fingerprint) return;
    lastQueuedProgressRef.current = fingerprint;
    queueProgressSave(payload);
  }, [authLoaded, isSignedIn, user?.id, progressQuery.data, progressQuery.isLoading, reviewed, starred, completedDays, days, reviewDates, reviewMilestones, queueProgressSave]);
  const filteredWords = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return editableWords.filter((word) => {
      const matchesSearch = !normalized || word.word.toLocaleLowerCase().includes(normalized) || word.translation.includes(search.trim());
      const matchesLevel = level === 'All levels' || word.level === level;
      const matchesPart = part === 'All parts' || word.type.toLowerCase().includes(part.toLowerCase());
      return matchesSearch && matchesLevel && matchesPart;
    });
  }, [editableWords, search, level, part]);
  const starredWords = useMemo(() => editableWords.filter((word) => starred.has(word.id)), [editableWords, starred]);
  useEffect(() => { if (currentIndex >= filteredWords.length) setCurrentIndex(0); }, [currentIndex, filteredWords.length]);
  const markReviewed = (id: number) => {
    setReviewed((existing) => {
      const next = new Set(existing);
      next.add(id);
      const completedDayNumbers = getCompletedDayNumbers(days, next);
      setCompletedDays((existingDays) => new Set([...existingDays, ...completedDayNumbers]));
      return next;
    });
    setReviewDates((existing) => {
      const next = { ...existing, [id]: today };
      return next;
    });
  };
  const toggleStar = (id: number) => {
    setStarred((existing) => {
      const next = new Set(existing);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectWord = (word: EditableWord) => { const index = filteredWords.findIndex((item) => item.id === word.id); setCurrentIndex(Math.max(index, 0)); setView('study'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const navigate = (nextView: AppView) => { setView(nextView); if (nextView === 'all-days') setSelectedDayIndex(null); };
  const selectDay = (dayIndex: number) => { setSelectedDayIndex(dayIndex); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const blockedDayNotice = (dayNumber: number) => setBlockedDay(dayNumber);
  const saveWord = (id: number, changes: WordOverrides) => {
    setWordOverrides((existing) => {
      const next = { ...existing, [id]: changes };
      window.localStorage.setItem(overridesStorageKey, JSON.stringify(next));
      return next;
    });
  };
  const completeReviewMilestone = (key: string) => {
    setReviewMilestones((existing) => ({ ...existing, [key]: today }));
  };
  const resetAllData = () => {
    if (!window.confirm(t.resetAllDataConfirmation)) return;

    const userId = isSignedIn ? user?.id : undefined;
    const emptyProgress: ProgressInput = {
      completedWordIds: [],
      starredWordIds: [],
      completedDayNumbers: [],
      reviewDates: {},
      reviewMilestones: {},
    };
    setReviewed(new Set());
    setStarred(new Set());
    setReviewDates({});
    setReviewMilestones({});
    setCompletedDays(new Set());
    for (const key of [reviewedStorageKey, starredStorageKey, reviewDatesStorageKey, reviewMilestonesStorageKey, completedDaysStorageKey]) {
      window.localStorage.removeItem(getStorageKey(key, userId));
      window.localStorage.removeItem(getStorageKey(key));
    }
    if (userId) {
      resetProgressUserRef.current = userId;
      lastQueuedProgressRef.current = JSON.stringify(emptyProgress);
      queryClient.setQueryData(getGetProgressQueryKey(), emptyProgress);
      queueProgressSave(emptyProgress);
    }
  };
  return (
     <div className="app-shell paper-grain min-h-[100dvh] bg-background">
       <Sidebar view={view} setView={navigate} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} onReset={resetAllData} reviewedToday={reviewedToday} />
      <TopBar view={view} setView={navigate} openMenu={() => setMobileOpen(true)} mobileOpen={mobileOpen} />
       {blockedDay !== null && (
         <div role="alert" data-testid="status-blocked-day" className="fixed right-5 top-[88px] z-30 flex max-w-[360px] items-start gap-3 rounded-2xl border border-[#e6c94d] bg-[#f5edda] px-4 py-3 text-sm text-[#202a40] shadow-[0_12px_28px_rgba(31,41,55,.14)]">
           <Lock size={16} className="mt-0.5 shrink-0 text-[#a04b39]" />
           <span className="flex-1 leading-relaxed">{t.futureDayLocked(blockedDay)}</span>
           <button type="button" data-testid="button-open-review-from-lock" onClick={() => { setView('review'); setBlockedDay(null); }} className="shrink-0 rounded-full bg-[#202a40] px-2.5 py-1.5 text-[11px] font-semibold text-[#f9f5e9] transition-colors hover:bg-[#2c3852]">{t.openReview}</button>
           <button type="button" data-testid="button-dismiss-blocked-day" aria-label={t.dismiss} onClick={() => setBlockedDay(null)} className="rounded-full p-1 text-[#858982] transition-colors hover:bg-[#e9e3d7] hover:text-[#202a40]"><X size={14} /></button>
         </div>
       )}
       <main className="app-main ml-0 px-5 pb-16 pt-9 md:ml-[264px] md:px-10 md:pt-12">
        <div className="mx-auto max-w-[1250px]">
          {view === 'all-days' ? (
             <AllDaysView days={days} reviewed={reviewed} starred={starred} completedDays={completedDays} reviewMilestones={reviewMilestones} selectedDayIndex={selectedDayIndex} onSelectDay={selectDay} onBlockedDay={blockedDayNotice} onBack={() => setSelectedDayIndex(null)} onMarkReviewed={markReviewed} onToggleStar={toggleStar} onSaveWord={saveWord} />
           ) : view === 'starred' ? (
             <StarredWordsView words={starredWords} starred={starred} reviewed={reviewed} onToggleStar={toggleStar} onMarkReviewed={markReviewed} onSaveWord={saveWord} />
           ) : view === 'review' ? (
             <ReviewView days={days} completedDays={completedDays} reviewMilestones={reviewMilestones} reviewed={reviewed} starred={starred} onMarkReviewed={markReviewed} onToggleStar={toggleStar} onSaveWord={saveWord} onCompleteReview={completeReviewMilestone} />
          ) : (
            <>
           <div className="animate-rise mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
             <div><div className="flex items-center gap-2 font-mono-custom text-[10px] uppercase tracking-[.21em] text-[#24635f]"><span className="h-2 w-2 rounded-full bg-[#ef7657]" /> {t.learningDesk}</div><h1 className="mt-3 max-w-[620px] font-display text-[clamp(2.6rem,5.3vw,4.7rem)] leading-[.92] tracking-[-.065em] text-[#202a40]" data-testid="heading-page">{view === 'study' ? <>{language === 'ar' ? 'اصنع مساحة لـ' : 'Make room for '}<em className="text-[#24635f]">{t.betterEnglish}</em></> : <>{t.everyWordHasAPlace} <em className="text-[#24635f]">{t.place}</em></>}</h1><p className="mt-4 max-w-[470px] text-[14px] leading-relaxed text-[#71776f]">{view === 'study' ? t.studyDescription : t.browseDescription}</p></div>
             <div className="flex items-center gap-2 text-right"><div><div className="font-mono-custom text-[10px] uppercase tracking-[.15em] text-[#858982]">{t.currentStreak}</div><div className="mt-1 text-sm font-semibold text-[#202a40]">{currentStreak} {currentStreak === 1 ? t.day : t.days} <span className="ml-1 text-[#ef7657]">/</span> {currentStreak ? t.keepGoing : t.startToday}</div></div><div className="ml-2 flex h-11 w-11 items-center justify-center rounded-full border border-[#e6c94d] bg-[#f3d24f] font-display text-xl text-[#202a40]">{currentStreak}</div></div>
          </div>
             <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-3"><StatCard label={t.wordsMet} value={String(reviewed.size)} detail={t.wordsOfGoal} accent="bg-[#24635f]" /><StatCard label={t.inThisView} value={String(filteredWords.length)} detail={t.matchingFilters} accent="bg-[#ef7657]" /><StatCard label={t.dailyRhythm} value={`${Math.min(reviewedToday, dailyGoal)} / ${dailyGoal}`} detail={t.dailyWordsSession} accent="bg-[#f3d24f]" /></div>
          <Filters search={search} setSearch={setSearch} level={level} setLevel={setLevel} part={part} setPart={setPart} resultCount={filteredWords.length} />
           <div className="mt-8" id="library">{view === 'study' ? <StudyHome words={filteredWords} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} reviewed={reviewed} starred={starred} markReviewed={markReviewed} onToggleStar={toggleStar} onSaveWord={saveWord} /> : <BrowseList words={filteredWords} starred={starred} onSelect={selectWord} onToggleStar={toggleStar} />}</div>
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const clerkLocalization = language === 'ar'
    ? {
        ...arSA,
        developmentMode: 'وضع التطوير',
        formFieldInputPlaceholder__backupCode: 'أدخل الرمز الاحتياطي',
        formFieldInputPlaceholder__emailAddress: 'أدخل عنوان بريدك الإلكتروني',
        formFieldInputPlaceholder__emailAddress_username: 'أدخل البريد الإلكتروني أو اسم المستخدم',
        formFieldInputPlaceholder__firstName: 'الاسم الأول',
        formFieldInputPlaceholder__lastName: 'اسم العائلة',
        formFieldInputPlaceholder__password: 'أدخل كلمة المرور',
        formFieldInputPlaceholder__phoneNumber: 'أدخل رقم هاتفك',
        formFieldInputPlaceholder__signUpPassword: 'أنشئ كلمة مرور',
        formFieldInputPlaceholder__username: 'أدخل اسم المستخدم',
        formFieldInput__emailAddress_format: 'مثال للتنسيق: name@example.com',
        signIn: {
          ...arSA.signIn,
          alternativePhoneCodeProvider: {
            ...arSA.signIn?.alternativePhoneCodeProvider,
            formTitle: 'رمز التحقق',
            resendButton: 'لم يصلك الرمز؟ أعد الإرسال',
            subtitle: 'للمتابعة إلى {{applicationName}}',
            title: 'تحقق من {{provider}}',
          },
          emailLink: {
            ...arSA.signIn?.emailLink,
            verifiedTransferable: {
              ...arSA.signIn?.emailLink?.verifiedTransferable,
              subtitle: 'ارجع إلى علامة التبويب الأصلية للمتابعة',
              title: 'تم التحقق من البريد الإلكتروني',
            },
          },
          enterpriseConnections: {
            ...arSA.signIn?.enterpriseConnections,
            subtitle: 'اختر حساب المؤسسة الذي تريد المتابعة باستخدامه.',
            title: 'اختر حساب مؤسستك',
          },
          passwordCompromised: {
            ...arSA.signIn?.passwordCompromised,
            title: 'كلمة المرور مخترقة',
          },
          passwordUntrusted: {
            ...arSA.signIn?.passwordUntrusted,
            title: 'كلمة المرور غير موثوقة',
          },
          protectCheck: {
            ...arSA.signIn?.protectCheck,
            loading: 'جارٍ التحميل…',
            retryButton: 'حاول مرة أخرى',
            subtitle: 'يرجى الانتظار بينما نتحقق من طلبك.',
            title: 'جارٍ التحقق من طلبك',
          },
          start: {
            ...arSA.signIn?.start,
            actionLink__join_waitlist: 'انضم إلى قائمة الانتظار',
            actionText__join_waitlist: 'هل تريد الوصول المبكر؟',
            alternativePhoneCodeProvider: {
              ...arSA.signIn?.start?.alternativePhoneCodeProvider,
              actionLink: 'استخدم طريقة أخرى',
              label: 'رقم هاتف {{provider}}',
              subtitle: 'أدخل رقم هاتفك للحصول على رمز تحقق عبر {{provider}}.',
              title: 'سجّل الدخول إلى {{applicationName}} باستخدام {{provider}}',
            },
            title: 'مرحبًا بعودتك',
            titleCombined: 'المتابعة إلى {{applicationName}}',
            subtitle: 'سجّل الدخول للحفاظ على إيقاع تعلّمك.',
          },
        },
        signUp: {
          ...arSA.signUp,
          alternativePhoneCodeProvider: {
            ...arSA.signUp?.alternativePhoneCodeProvider,
            resendButton: 'لم يصلك الرمز؟ أعد الإرسال',
            subtitle: 'أدخل رمز التحقق المرسل إلى {{provider}}',
            title: 'تحقق من {{provider}}',
          },
          enterpriseConnections: {
            ...arSA.signUp?.enterpriseConnections,
            subtitle: 'اختر حساب المؤسسة الذي تريد المتابعة باستخدامه.',
            title: 'اختر حساب مؤسستك',
          },
          legalConsent: {
            ...arSA.signUp?.legalConsent,
            checkbox: {
              ...arSA.signUp?.legalConsent?.checkbox,
              label__onlyPrivacyPolicy: 'أوافق على {{ privacyPolicyLink || link("سياسة الخصوصية") }}',
              label__onlyTermsOfService: 'أوافق على {{ termsOfServiceLink || link("شروط الخدمة") }}',
              label__termsOfServiceAndPrivacyPolicy: 'أوافق على {{ termsOfServiceLink || link("شروط الخدمة") }} و{{ privacyPolicyLink || link("سياسة الخصوصية") }}',
            },
            continue: {
              ...arSA.signUp?.legalConsent?.continue,
              subtitle: 'يرجى قراءة الشروط والموافقة عليها للمتابعة',
              title: 'الموافقة القانونية',
            },
          },
          protectCheck: {
            ...arSA.signUp?.protectCheck,
            loading: 'جارٍ التحميل…',
            retryButton: 'حاول مرة أخرى',
            subtitle: 'يرجى الانتظار بينما نتحقق من طلبك.',
            title: 'جارٍ التحقق من طلبك',
          },
          restrictedAccess: {
            ...arSA.signUp?.restrictedAccess,
            actionLink: 'تسجيل الدخول',
            actionText: 'لديك حساب بالفعل؟',
            blockButton__emailSupport: 'راسل الدعم',
            blockButton__joinWaitlist: 'انضم إلى قائمة الانتظار',
            subtitle: 'إنشاء الحسابات متوقف حاليًا. إذا كنت تعتقد أن لديك صلاحية الوصول، يرجى التواصل مع الدعم.',
            subtitleWaitlist: 'إنشاء الحسابات متوقف حاليًا. انضم إلى قائمة الانتظار لتكون أول من يعرف عند إطلاق الخدمة.',
            title: 'الوصول مقيّد',
          },
          start: {
            ...arSA.signUp?.start,
            actionLink__use_email: 'استخدم البريد الإلكتروني بدلًا من ذلك',
            actionLink__use_phone: 'استخدم الهاتف بدلًا من ذلك',
            alternativePhoneCodeProvider: {
              ...arSA.signUp?.start?.alternativePhoneCodeProvider,
              actionLink: 'استخدم طريقة أخرى',
              label: 'رقم هاتف {{provider}}',
              subtitle: 'أدخل رقم هاتفك للحصول على رمز تحقق عبر {{provider}}.',
              title: 'سجّل حسابًا في {{applicationName}} باستخدام {{provider}}',
            },
            title: 'أنشئ حسابك',
            subtitle: 'احفظ تقدمك في قائمة أكسفورد 3000 أينما كنت.',
            subtitleCombined: 'مرحبًا! املأ التفاصيل للبدء.',
          },
        },
      }
    : {
        signIn: {
          start: {
            title: 'Welcome back',
            subtitle: 'Sign in to keep your learning rhythm.',
          },
        },
        signUp: {
          start: {
            title: 'Create your account',
            subtitle: 'Save your Oxford 3000 progress anywhere.',
          },
        },
      };

  useEffect(() => {
    const developmentLabel = language === 'ar' ? 'وضع التطوير' : 'Development mode';
    const oppositeLabel = language === 'ar' ? 'Development mode' : 'وضع التطوير';
    const replaceDevelopmentLabel = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.textContent?.trim() === oppositeLabel) {
          node.textContent = developmentLabel;
        }
        node = walker.nextNode();
      }
    };

    replaceDevelopmentLabel();
    const observer = new MutationObserver(replaceDevelopmentLabel);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      experimental={{ persistClient: true }}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={clerkLocalization}
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
  const [language, setLanguage] = useState<Language>(() => {
    const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
    if (requestedLanguage === 'ar' || requestedLanguage === 'en') return requestedLanguage;
    try {
      return window.localStorage.getItem('wordroom-language') === 'ar' ? 'ar' : 'en';
    } catch {
      return 'en';
    }
  });
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  const setThemePreference = useCallback((nextTheme: Theme) => {
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(themePreferenceStorageKey, nextTheme);
    } catch {
      // Theme preference is optional when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const direction = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = direction;
    document.body.dir = direction;
    try {
      window.localStorage.setItem('wordroom-language', language);
    } catch {
      // Language preference is optional when storage is unavailable.
    }
  }, [language]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(systemThemeQuery);
    if (!mediaQuery) return;

    const syncWithSystemTheme = (event: MediaQueryListEvent) => {
      try {
        if (window.localStorage.getItem(themePreferenceStorageKey)) return;
      } catch {
        // Continue syncing with the device when storage is unavailable.
      }
      setTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener?.('change', syncWithSystemTheme);
    return () => mediaQuery.removeEventListener?.('change', syncWithSystemTheme);
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.body.style.colorScheme = theme;

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColor?.setAttribute('content', isDark ? '#101827' : '#ffffff');

    try {
      window.localStorage.removeItem('wordroom-theme');
    } catch {
      // Clean up the legacy preference when storage is available.
    }
  }, [theme]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      <ThemeContext.Provider value={{ theme, setTheme: setThemePreference }}><WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter></ThemeContext.Provider>
    </LanguageContext.Provider>
  );
}

export default App;