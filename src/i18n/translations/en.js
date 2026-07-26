// English interface. Mirrors the key structure of ru.js. Kept short and
// natural for UI (buttons/banners), not literary — see plural.js for the
// one/many plural split used here (no "few" form in English).

export default {
  common: {
    back: "Back",
    done: "Done",
    close: "Close",
    cancel: "Cancel",
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
    surprise: "Surprise me",
    remaining: "Left in batch: {n}",
    countLabel: "Cards:",
    example: "Example",
    // Content-type toggle and the "Native context" mode note.
    modeLabel: "Generate:",
    modeWords: "Words",
    modeIdioms: "Native context",
    usageNote: "When it's used",
  },

  // Manually adding your own word (card generated from user input).
  addWord: {
    entry: "Add your own word",
    title: "Your word",
    hint: "Enter a word or phrase — in the language you're learning or your native one. AI will build a card with translation, transcription and an example.",
    placeholder: "word or phrase",
    generate: "Create card",
    generating: "Creating card…",
    add: "Add to studying",
    another: "Another word",
    addedTitle: "Word added",
    addedHint: "It's in “My words” and will show up for review.",
    addMore: "Add another",
    openMyWords: "Open “My words”",
    notRecognized: "Couldn't recognize the word. Check the spelling and try again.",
    failed: "Couldn't create the card. Please try again.",
  },

  // Looking up a word from the example (tap a word → translation → add to study).
  lookup: {
    loading: "Looking up…",
    added: "Added to studying",
  },

  // Migrating local (anonymous) progress into the account on first sign-in.
  migrate: {
    title: "Move your progress to the account?",
    text: "This device already has learned words. We'll move them into your account — they merge with the cloud, nothing gets lost or duplicated.",
    transfer: "Move my progress",
    fresh: "Start fresh",
    hint: "“Start fresh” removes the local words from this device.",
  },

  // Language pair switcher (multi-language mode).
  langSwitch: {
    aria: "Switch language",
  },

  // "My languages" screen (phase 4.4): pairs and multi-language mode management.
  languages: {
    title: "My languages",
    entry: "Manage languages",
    multiToggle: "I'm learning several languages",
    addFirstHint:
      "Mode is on. Add a second pair whenever you're ready — no rush.",
    activePair: "Active pair",
    changePair: "Change pair",
    addPair: "Add a pair",
    listTitle: "Active pairs",
    submitAdd: "Add",
    submitChange: "Change",
    priorityBadge: "priority",
    makePriority: "Make priority",
    limitLabel: "New words per day:",
    remove: "Remove",
    removeConfirmText:
      "The pair will be hidden and all progress kept — bring the language back anytime by adding it again.",
    lastPairNote: "You can't remove the last pair — at least one language must stay.",
    offConfirmTitle: "Turn off multi-language mode?",
    offConfirmText:
      "{lang} will stay. Other pairs get hidden, their progress is kept.",
    offConfirm: "Turn off",
  },

  // Reading mode (phase 6.1).
  reading: {
    entry: "Read a text",
    title: "Reading",
    generate: "New text",
    generating: "Writing your text…",
    emptyHint:
      "A short text for your topic and level, weaving in words you're already learning. Tap a word for its translation, tap ¶ for the grammar of that sentence.",
    newShare: "New words:",
    playAll: "Play the whole text",
    grammarAria: "Explain this sentence's grammar",
    grammarLoading: "Looking at the sentence…",
    grammarFailed: "Couldn't explain this sentence. Please try again.",
    failed: "Couldn't write the text. Please try again.",
    offline: "Reading mode needs a connection. Cards and reviews still work.",
    tipNoWords:
      "Tap any unfamiliar word — you'll see its translation and can take it into study. That's how your vocabulary grows.",
    tipFewWords:
      "Take a few more words and the next text will feel noticeably more familiar.",
    toCards: "Go to cards",
    saved: "Text {n} of {total}",
    older: "Earlier text",
    newer: "Later text",
  },

  // Custom generation topics (presets live in code, custom ones per pair).
  topics: {
    myTopics: "My topics",
    placeholder: "e.g. cycling",
    addAria: "Custom topic name",
    add: "Add",
    remove: "Remove topic “{topic}”",
    hint: "Up to 3 words. At most {max} custom topics per language.",
    limitReached:
      "No more than {max} custom topics per language. Remove one to add another.",
    duplicate: "You already have that topic.",
    needAccount:
      "Custom topics appear once you're signed in — they're stored on the language pair.",
  },

  // Placement test (phase 6.3).
  placement: {
    title: "Level check",
    entry: "Check my level",
    entryOnboarding: "Take the test",
    entryOnboardingHint:
      "15–18 short questions, no timer — we'll suggest a level and you can adjust it.",
    chooseSelf: "Pick it myself",
    chooseSelfHint: "If you already know your level, just choose it from the list.",
    chooseManually: "Choose a level myself",
    preparing: "Preparing the questions…",
    preparingHint:
      "For a new language this happens once — after that the test opens right away.",
    progress: "{n} of {total}",
    promptVocab: "Which word fits the meaning?",
    promptCloze: "Which word is missing?",
    dontKnow: "I don't know",
    noTimer: "No timer — take your time. \"I don't know\" is a fine answer too.",
    resultTitle: "Looks like {level}",
    resultHint: "Correct answers: {n} of {total}.",
    startWith: "Start at {level}",
    chooseOther: "Choose a different level",
    manualTitle: "Your level:",
    retest: "Check my level again",
    currentResult: "Tested level for this pair: {level}.",
    neverTested:
      "This language pair hasn't been tested yet — the level was chosen by hand.",
    retestWithLevel: "Test again ({level})",
    newPairTitle: "Check your level: {lang}",
    newPairText:
      "Every language has its own level. The test takes a couple of minutes, or you can simply pick a level in settings.",
    later: "Later",
    offline: "The test needs a connection. Cards, reviews and settings still work.",
    failed: "Couldn't prepare the test. Try later or pick a level yourself.",
    empty: "No questions for this language yet. Pick a level yourself — the test will come later.",
    noTable:
      "The question bank isn't set up. Run the SQL from supabase/schema.sql in your Supabase project.",
    noAccount: "The test is available once you're signed in.",
  },

  // Listening practice (phase 6.2): two formats — fill-the-gap and sound-alike.
  listening: {
    entry: "Listening",
    title: "Listening",
    start: "Start a round ({n})",
    restart: "New round ({n})",
    generating: "Preparing your tasks…",
    emptyHintGap:
      "A whole sentence plays with one word hidden on screen. You listen and type the missing word — the first words won't give it away. Tasks are built around the words you're already learning.",
    emptyHintSoundalike:
      "A word plays, and the options sound alike — the first sound won't give it away. An advanced format. Words come from the ones you're already learning.",
    progress: "Task {n} of {total}",
    listen: "Play",
    replay: "Play again",
    gapPrompt: "Which word is missing?",
    soundalikePrompt: "What did you hear?",
    inputPlaceholder: "the missing word",
    check: "Check",
    modeType: "Type",
    modeChoice: "Pick",
    right: "Correct",
    wrong: "Not quite",
    youWrote: "You typed: {word}",
    explain: "Explain",
    next: "Next",
    finish: "Finish the round",
    doneTitle: "Round complete",
    doneHint: "Heard correctly: {n} of {total}. You can start a new round.",
    levelLabel: "Speed and length:",
    level: { slow: "Slow", normal: "Normal", fast: "Fast" },
    levelHint:
      "Speed changes right away; phrase length applies to the next round.",
    formatLabel: "Format:",
    format: { gap: "Missing word", soundalike: "By ear" },
    formatHintGap: "A sentence plays; you type the hidden word.",
    formatHintSoundalike:
      "A word plays; the options sound alike — harder.",
    audioFailed: "Couldn't load the audio. Please try again.",
    failed: "Couldn't prepare the tasks. Please try again.",
    offline: "Listening needs a connection. Cards and reviews still work.",
    needWords:
      "Take some words on the cards first — both formats are built around your active words.",
    gapEmpty:
      "Couldn't build tasks from your words. Please try again or take more words.",
    soundalikeEmpty:
      "No sound-alike pairs were found for your words. Try the missing-word format.",
    tipNoWords:
      "You have no words of your own yet. Take some on the cards — that's what the tasks are built from.",
    tipFewWords:
      "Take a few more words and you'll get more varied tasks.",
  },

  // Word source for reading and listening (one setting for both modes).
  wordSource: {
    label: "Word source:",
    mine: "My words",
    mixed: "Mixed",
    new: "New",
    hint: {
      mine: "Mostly your words; if there aren't enough for a phrase, a little new is added.",
      mixed: "Familiar words mixed with new ones — best for learning.",
      new: "Unfamiliar words at your level — growing your vocabulary.",
    },
    fewMine:
      "You have few taken words yet — there won't be much variety and words will start to repeat.",
    switchMixed: "Switch to “Mixed”",
  },

  // Card audio (phase 5.1).
  tts: {
    playWord: "Play word",
    playExample: "Play example",
    unavailable: "Audio unavailable",
  },

  // Weekly language schedule (phase 4.5).
  schedule: {
    setupTitle: "How many days a week do you study?",
    setupMode: "How should languages be arranged?",
    modeByDay: "By day",
    modeMixed: "All at once",
    modeByDayHint:
      "One language per study day; the priority one comes up more often.",
    modeMixedHint:
      "All languages every day, the daily quota is split between them (as before).",
    enable: "Turn on",
    title: "Week schedule",
    daysLabel: "Study days:",
    today: "Today: {lang}",
    restToday: "Rest day today",
    restTitle: "Today is a rest day",
    restHint:
      "Due reviews are always available — the schedule never limits them. Want new words anyway? Pick a language.",
    studyAnyway: "Study anyway:",
    days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    aria: "Weekly language schedule",
  },

  // Daily load balancing (phase 4.3): new-word quota per language.
  balance: {
    today: "Today:",
    aria: "Daily new-word quota per language",
    quotaDoneTitle: "Daily quota reached",
    quotaDoneHint:
      "You've taken today's new words for this language. Switch to a language with quota left, or review what you've taken — reviews are never limited.",
    takeMore: "Take beyond the quota",
  },

  // Reviewing known words — optional self-check of the "Know" list.
  knownReview: {
    entry: "Review known words",
    remember: "I remember",
    restore: "Back to studying",
    doneTitle: "All words reviewed",
    doneHint: "Whatever slipped away is back in studying. The rest you truly know.",
  },

  errors: {
    title: "Couldn't generate",
    offline: "No connection to server. Check your internet and try again.",
    noCards: "Server returned no cards. Please try again.",
    server: "Server error ({status})",
    generateFailed: "Couldn't generate cards.",
    rateLimit:
      "You've hit today's limit. It resets tomorrow (at 00:00 UTC). Thanks for helping keep the app free.",
    rateCooldown: "Too fast. Wait {seconds}s and try again.",
    sessionExpired: "Your session expired. Please sign in again.",
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
    feedback: "Report a problem",
    changePassword: "Change password",
    deleteAccount: "Delete account",
    // Multi-language mode (explicit choice, phase 4.2).
    multiLang: "Multi-language mode",
    multiLangHint:
      "Learn several languages in parallel: a pair switcher appears on the main screen. Each pair keeps its own progress.",
    multiLangOn: "On",
    multiLangOff: "Off",
    // Priority pair (phase 4.3).
    priorityTitle: "Priority pair",
    priorityHint:
      "The priority language gets the bigger share of the total daily new-word quota.",
  },

  // Feedback ("Report a problem" button, phase 7.1).
  feedback: {
    title: "Report a problem",
    lead:
      "Describe what went wrong or what's missing. We'll add the app version and browser automatically — it makes things easier to sort out.",
    placeholder: "What happened?",
    send: "Send",
    sending: "Sending…",
    thanks: "Thanks! Your feedback was received.",
    failed: "Couldn't send. Please try again later.",
    notConfigured: "Sending unavailable: account not connected.",
  },

  // Account deletion (phase 7.1). Irreversible — we say so plainly.
  account: {
    deleteTitle: "Delete account",
    deleteWarning:
      "This action is irreversible. Your account and data cannot be restored.",
    deleteWhat:
      "Permanently deleted: account {email}, all your words and progress, languages, topics, and submitted feedback. The shared audio cache is not affected.",
    deleteConfirm: "Delete permanently",
    deleting: "Deleting…",
    deleteFailed: "Couldn't delete the account. Please try again later.",
  },

  // "What's new" screen shown on visit (once per visit).
  whatsnew: {
    title: "What's new",
    greetingTitle: "Welcome!",
    greeting:
      "Learn words with cards, read texts, train your listening, and check your level — all in one app. Happy studying!",
    start: "Get started",
    entries: {
      deleteAccount: {
        title: "Account deletion",
        desc: "You can now delete your account and all your data right from Settings.",
      },
      feedback: {
        title: "Report a problem",
        desc: "A feedback button in Settings — tell us what to improve.",
      },
      wordSource: {
        title: "Word source",
        desc: "In reading and listening, choose: only your words, mixed, or new only.",
      },
      customTopics: {
        title: "Custom topics",
        desc: "Add your own topics for card generation, not just the presets.",
      },
      listening: {
        title: "Listening practice",
        desc: "Train by ear: fill in the missing word or pick the similar-sounding one.",
      },
      placement: {
        title: "Placement test",
        desc: "Find your level (A1–C1) in a couple of minutes — per language.",
      },
      reading: {
        title: "Reading mode",
        desc: "Texts built from your words, with grammar explained on sentence tap.",
      },
      tts: {
        title: "Pronunciation audio",
        desc: "Hear words and examples spoken — on cards and in reading.",
      },
      multiLang: {
        title: "Multiple languages",
        desc: "Learn several language pairs in parallel, with a weekly schedule.",
      },
    },
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
    note: "An account keeps your progress safe and syncs it across devices.",
    tabsAria: "Sign in or sign up",
    email: "Email",
    password: "Password",
    pwPlaceholderSignup: "at least 6 characters",
    pwPlaceholderSignin: "your password",
    busy: "Please wait…",
    submitSignup: "Sign up",
    submitSignin: "Sign in",
    enterCreds: "Enter your email and password.",
    enterEmail: "Enter your email.",
    forgot: "Forgot your password?",
    pwShort: "Password is too short (minimum 6 characters).",
    confirmSent:
      "Done! We sent an email to {email}. Follow the link to confirm your email, then sign in.",
    // Password recovery: request the email and set a new password via the link.
    reset: {
      title: "Reset password",
      lead: "Enter your email — we'll send a password reset link.",
      submit: "Send reset link",
      backToSignin: "Back to sign in",
      sent:
        "If {email} is registered, we've sent a reset link. Check your inbox (and the Spam folder).",
      newTitle: "New password",
      newLead: "Choose a new password to sign in with.",
      newPassword: "New password",
      confirm: "Repeat password",
      save: "Save password",
      saved: "Password updated. You're now signed in.",
      continue: "Continue",
      enterBoth: "Enter the new password and confirmation.",
      mismatch: "Passwords don't match.",
      expired: "The link has expired. Request a new reset link.",
      invalid: "The link is invalid. Request a new reset link.",
    },
    err: {
      invalidCreds: "Incorrect email or password.",
      notConfirmed: "Email not confirmed. Check your inbox and follow the link.",
      alreadyRegistered: "This email is already registered. Sign in instead.",
      invalidEmail: "Invalid email. Check the address and try again.",
      samePassword: "The new password must be different from the old one.",
      sessionExpired: "Your session expired. Sign in again to change your password.",
      rateLimit: "Too many attempts. Wait a bit and try again.",
      network: "No connection to the server. Check your internet and Supabase settings.",
      generic: "Something went wrong. Please try again.",
    },
  },

  // Change password from settings (for a signed-in user).
  password: {
    title: "Change password",
    lead: "Enter a new password. Use it to sign in next time.",
    new: "New password",
    confirm: "Repeat password",
    save: "Save",
    saving: "Saving…",
    saved: "Password changed.",
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
