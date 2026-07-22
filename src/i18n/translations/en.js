// English interface. Mirrors the key structure of ru.js. Kept short and
// natural for UI (buttons/banners), not literary — see plural.js for the
// one/many plural split used here (no "few" form in English).

export default {
  common: {
    back: "Back",
    done: "Done",
    close: "Close",
    gotIt: "Got it",
    retry: "Retry",
    activeLimit:
      "Review or learn some active words first — you already have {max} in progress.",
  },

  plural: {
    words: { one: "word", many: "words" },
  },

  lang: {
    de: "German",
    en: "English",
    el: "Greek",
    es: "Spanish",
    ru: "Russian",
    uk: "Ukrainian",
  },
  topic: {
    work: "Work",
    housing: "Housing",
    doctor: "At the doctor",
    travel: "Travel",
    daily: "Everyday conversation",
    restaurant: "Restaurant / cafe",
  },
  level: {
    a1: "A1 — beginner",
    a2: "A2 — elementary",
    b1: "B1 — intermediate",
    b2: "B2 — upper-intermediate",
    c1: "C1 — advanced",
  },

  start: {
    title: "Cards — learn words in context",
    subtitle:
      "Memorize foreign words not in isolation, but inside living examples — so they stick for good.",
    status: "App in development",
    cta: "Set up learning",
  },

  onb: {
    learnLang: { title: "Which language am I learning?" },
    nativeLang: { title: "My native language", hint: "We'll translate into this" },
    topic: { title: "Topic", hint: "What the cards will be about" },
    level: {
      title: "Level",
      hint: "CEFR level (A1 — beginner … C1 — advanced)",
    },
    start: "Start",
  },

  action: {
    take: "Take",
    know: "Know",
    skip: "Skip",
  },

  cards: {
    myWords: "My words",
    statsAria: "Statistics",
    settingsAria: "Settings",
    tutorialAria: "How to use",
    loadingTitle: "Generating cards…",
    loadingHint: "Picking words for your topic and level with AI.",
    dueTitle: "Today: {n} {word} to review",
    dueHint: "Let's review what you've already learned first",
    reviewNow: "Review now",
    allReviewed: "All reviewed for today",
    allReviewedHint: "Take new words if you're in the mood — no rush.",
    emptyTitle: "No cards yet",
    emptyHint:
      "Tap “Generate new cards” to get a batch for your topic and level.",
    doneTitle: "Batch complete",
    doneHint:
      "Taken to learn — {taken}, marked “know” — {known}. Generate a new batch.",
    generate: "Generate new cards",
    remaining: "Left in batch: {n}",
    countLabel: "Cards:",
    example: "Example",
    // Content-type toggle and the "Native context" mode note.
    modeLabel: "Generate:",
    modeWords: "Words",
    modeIdioms: "Native context",
    usageNote: "When it's used",
  },

  errors: {
    title: "Couldn't generate",
    offline: "No connection to server. Check your internet and try again.",
    noCards: "Server returned no cards. Please try again.",
    server: "Server error ({status})",
    generateFailed: "Couldn't generate cards.",
  },

  review: {
    doneTitle: "Review complete for today",
    doneHint: "New words to review will appear when they're due.",
    remaining: "Left to review: {n}",
    reveal: "Show translation",
    exampleTranslation: "Example translation",
    replayNow: "review now",
  },
  // Anki-style short terms — familiar to flashcard-app users, keeps buttons short.
  grade: {
    again: "Again",
    hard: "Hard",
    good: "Good",
    easy: "Easy",
  },

  interval: {
    today: "today",
    tomorrow: "tomorrow",
    days: { one: "in {n} day", many: "in {n} days" },
    weeks: { one: "in {n} week", many: "in {n} weeks" },
    months: { one: "in {n} month", many: "in {n} months" },
    years: { one: "in {n} year", many: "in {n} years" },
  },

  stats: {
    title: "Statistics",
    empty: "No data yet. Take your first words to learn — progress will appear here.",
    donutAria: "{percent}% of words learned",
    learnedLabel: "learned",
    learning: "Learning",
    learned: "Learned",
    totalWords: "Total words",
    activeWords: "Active words",
  },

  words: {
    mineTitle: "My words",
    knownTitle: "Known words",
    select: "Select",
    learned: "Learned",
    restore: "Restore",
    mineEmpty: "Empty for now. Take words with the “Take” button — they'll appear here.",
    knownEmpty: "Empty for now. Words marked “Know” will collect here.",
  },
  tabs: {
    mine: "My words",
    known: "Known",
  },

  selectbar: {
    cancel: "Cancel",
    delete: "Delete ({n})",
    confirmTitle: "Delete {n} {word}?",
    confirmText:
      "Words will be deleted completely — from lists and storage. This can't be undone.",
    confirmOk: "Delete",
  },

  settings: {
    title: "Settings",
    note: "New cards will appear after tapping “Generate new cards” on the main screen. Taken and known words are kept.",
    account: "Account",
    accountNotConfigured:
      "Sign-in will appear once Supabase is connected (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables). Words are stored on this device.",
    loggedInAs: "Signed in as",
    signOut: "Sign out",
    accountPrompt:
      "Sign in or sign up to prepare word syncing across devices. For now, words are stored on this device.",
    signInUp: "Sign in / Sign up",
    howto: "How to use",
    install: "Install on phone",
  },

  sync: {
    syncing: "Syncing…",
    synced: "Progress synced",
    offline:
      "No connection to the cloud — changes are saved on this device and will be sent later.",
    error: "Couldn't sync. We'll try again later.",
    errorNoTable:
      "Cloud storage isn't set up. Run the SQL from supabase/schema.sql in your Supabase project.",
    retry: "Retry",
  },

  auth: {
    signin: "Sign in",
    signup: "Sign up",
    note: "An account is for future word syncing across devices. Right now words are stored on this device.",
    tabsAria: "Sign in or sign up",
    email: "Email",
    password: "Password",
    pwPlaceholderSignup: "at least 6 characters",
    pwPlaceholderSignin: "your password",
    busy: "Please wait…",
    submitSignup: "Sign up",
    submitSignin: "Sign in",
    enterCreds: "Enter your email and password.",
    pwShort: "Password is too short (minimum 6 characters).",
    confirmSent:
      "Done! We sent an email to {email}. Follow the link to confirm your email, then sign in.",
    err: {
      invalidCreds: "Incorrect email or password.",
      notConfirmed: "Email not confirmed. Check your inbox and follow the link.",
      alreadyRegistered: "This email is already registered. Sign in instead.",
      invalidEmail: "Invalid email. Check the address and try again.",
      rateLimit: "Too many attempts. Wait a bit and try again.",
      network: "No connection to the server. Check your internet and Supabase settings.",
      generic: "Something went wrong. Please try again.",
    },
  },

  tutorial: {
    skip: "Skip",
    next: "Next",
    gotIt: "Got it",
    slide1: {
      title: "Learn words in context",
      text: "Every word comes with an example sentence. That way they stick better than in isolation.",
    },
    slide2: {
      title: "Control the card with a swipe",
      text: "Swiping is the main way — just drag with your finger. The buttons below do the same. The card wiggles gently to hint it can be moved.",
      leftDesc: "already familiar — remove for good",
      rightDesc: "to learning — you'll review it",
      skipDesc: "with the button — the word comes back later",
    },
    slide3: {
      title: "Review works on its own",
      text: "Taken words come back for review on a schedule — the app reminds you when it's time.",
      gradeHint: "Rate yourself: easier — less often, harder — more often.",
      againHint: "“Again” brings the word back later in this same session.",
    },
    slide4: {
      title: "New cards — by button",
      text: "New words appear only when you tap “Generate new cards” yourself.",
    },
    slide5: {
      title: "My words and Known",
      text: "Taken words are in “My words”, learned ones — in “Known”. Open them from the cards screen.",
    },
  },

  install: {
    title: "Install on phone",
    lead: "Add the app to your home screen to open it like a regular app — full screen.",
    iosTitle: "iPhone (Safari)",
    androidTitle: "Android (Chrome)",
    iosSteps: [
      "Tap the Share button at the bottom of the screen (square with an arrow up).",
      "Scroll down and choose “Add to Home Screen”.",
      "Tap “Add”.",
    ],
    androidSteps: [
      "Tap the menu (three dots, top right).",
      "Choose “Add to Home screen” or “Install app”.",
      "Confirm.",
    ],
    note: "Works only in Safari. If opened in Chrome, Instagram, or Telegram — open the link in Safari first.",
  },
};
