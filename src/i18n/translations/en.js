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
    plural: "pl.",
    // Verb conjugation table (on request, verbs only).
    conjugation: "Conjugation",
    conjLoading: "Building the table…",
    conjFailed: "Couldn't build the conjugation table. Please try again.",
    conjNotVerb: "No conjugation for this word.",
    tense: { present: "Present", future: "Future", past: "Past" },
    pron: {
      "1sg": "I",
      "2sg": "you",
      "3sg": "he · she",
      "1pl": "we",
      "2pl": "you (pl.)",
      "3pl": "they",
    },
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
    multiTitle: "Several languages",
    multiSubtitle: "a week plan picks the language",
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
    limitLabel: "New per day",
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
      "A short text for your topic and level, weaving in words you're already learning. Tap a word for its translation, or Grammar to see how it works.",
    newShare: "New words:",
    playAll: "Play the whole text",
    legend: "green — words you already know · tap any word for a translation",
    grammar: "Grammar",
    noScore: "No score, no timer. A wrong answer just explains itself.",
    grammarAria: "Explain this sentence's grammar",
    grammarLoading: "Looking at the sentence…",
    grammarFailed: "Couldn't explain this sentence. Please try again.",
    failed: "Couldn't write the text. Please try again.",
    // Comprehension check (Igor's feedback).
    checkBtn: "Check comprehension",
    checkHint:
      "A few questions about the text — true/false, with an explanation when you miss.",
    generatingQuestions: "Writing the questions…",
    questionsFailed: "Couldn't write the questions. Please try again.",
    offline: "Reading mode needs a connection. Cards and reviews still work.",
    tipNoWords:
      "Tap any unfamiliar word — you'll see its translation and can take it into study. That's how your vocabulary grows.",
    tipFewWords:
      "Take a few more words and the next text will feel noticeably more familiar.",
    toCards: "Go to cards",
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
    next: "Next",
    finish: "See result",
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
    // Main choice: comprehension (dialogue) / words (older formats).
    modeLabel: "What we check:",
    mode: { comprehension: "Comprehension", words: "Words" },
    modeHintComprehension:
      "A short dialogue plays, then comprehension questions. Like a language exam.",
    modeHintWords:
      "A single word by ear: type the missing one or pick the sound-alike.",
    // Comprehension (dialogue + questions).
    emptyHintDialogue:
      "A short dialogue plays, built around words you're already learning. Listen (you can pause and replay), then answer questions about what was said. If you're wrong, we explain why — with a reference to the dialogue.",
    startDialogue: "Play the dialogue",
    newDialogue: "New dialogue",
    generatingDialogue: "Writing the dialogue…",
    listenPrompt: "Listen to the dialogue, then answer the questions.",
    transcript: "Dialogue transcript",
    dialogueFailed: "Couldn't build the dialogue. Please try again.",
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
    levelHintSpeed: "Speaking speed in the dialogue. Heard on the next play.",
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

  // Comprehension questions (phase 6.2): one mechanism for listening and reading.
  comprehension: {
    title: "Did you get it?",
    prompt: "True or false?",
    true: "True",
    false: "False",
    right: "Correct",
    wrong: "Not quite",
    why: "Why",
    next: "Next",
    finish: "Finish",
    progress: "Question {n} of {total}",
    doneTitle: "Done",
    score: "Correct answers: {n} of {total}.",
    retake: "Take it again",
  },

  // Session engine: today's session assembled from available formats.
  session: {
    title: "Today's session",
    // Friendly subtitle: "<weekday> <part of day>" (weekday comes from the date).
    greeting: "{day} {part}",
    partOfDay: {
      morning: "morning",
      afternoon: "afternoon",
      evening: "evening",
      night: "night",
    },
    progress: "{n} of {total}",
    allDoneShort: "All done",
    start: "Start session",
    continue: "Continue: {block}",
    allDone: "Session complete. Great work!",
    empty:
      "Nothing to review today, and texts and dialogues aren't available right now. You can pick an activity yourself.",
    manual: "I want something else",
    studyAnyway: "Study anyway",
    backToSession: "To session",
    secondaryNote:
      "A secondary language today — the base is a bit denser to catch up: you study it less often.",
    // Day accent (base rotation) and extras on top.
    accentNote: "Today's focus: {block}",
    accentBadge: "focus",
    extrasTitle: "Want more?",
    extraItem: "More: {block}",
    extrasHint: "Finished the base — you can keep going with another format.",
    restTitle: "A rest day by your schedule",
    restHint: "Reviews are always available. Want to study — start manually.",
    block: {
      review: "Review",
      reading: "Reading with questions",
      newWords: "New words",
      listening: "Dialogue with questions",
    },
    // Concrete task for the block (not just a title).
    task: {
      review: "Review · {n}",
      reading: "Reading · 1 text · answer questions",
      newWords: "New words · {n}",
      newWordsRandom: "Surprise words · {n}",
      listening: "Dialogue · listen and answer",
    },
    checkAria: "Mark block “{block}” done",
    uncheckAria: "Unmark block “{block}”",
    newBlockTitle: "Session · new words",
    newBlockHint: "Take about {n} new words, then return to the plan.",
    newBlockRandomTitle: "Session · surprise words",
    newBlockRandomHint:
      "Take ~{n} surprise words (“🎲 Surprise me”), then return to the plan.",
    blockDone: "Done, back to session",
  },

  // Card audio (phase 5.1).
  tts: {
    playWord: "Play word",
    playExample: "Play example",
    unavailable: "Audio unavailable",
  },

  // Long-audio player (listening, whole text, single sentence).
  audio: {
    player: "Audio player",
    play: "Play",
    pause: "Pause",
    restart: "Restart",
    seek: "Seek",
    unavailable: "Audio unavailable",
    failedShort: "No audio",
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
    todayLabel: "Today:",
    restToday: "Rest day today",
    restTitle: "Today is a rest day",
    restHint:
      "Due reviews are always available — the schedule never limits them. Want new words anyway? Pick a language.",
    studyAnyway: "Study anyway:",
    days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    aria: "Weekly language schedule",
    // Manual schedule editing (tap a day → pick language / rest).
    editHint: "Tap a day to change its language or make it a rest day.",
    editDay: "Change language on {day}",
    pickForDay: "{day} — pick a language:",
    restOption: "Rest day",
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
    activeHint:
      "A comfortable ceiling — when it fills up, review comes before new words.",
  },

  words: {
    mineTitle: "My words",
    knownTitle: "Known words",
    select: "Select",
    learned: "Learned",
    restore: "Restore",
    mineEmpty: "Empty for now. Take words with the “Take” button — they'll appear here.",
    knownEmpty: "Empty for now. Words marked “Know” will collect here.",
    emptyTitle: "Nothing here yet",
    dueToday: "today",
    dueInDays: "in {n}d",
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
    appearance: "Appearance",
    theme: {
      system: "System",
      light: "Light",
      dark: "Dark",
    },
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
      sessionLangFlag: {
        title: "Session: day's language with a flag",
        desc: "On the “Today's session” screen we removed the manual language switcher at the top — it was redundant, since the day's language is set by the schedule anyway. The language now shows next to the “Today: [language]” label with a round flag beside the name, like elsewhere. The active-language logic is unchanged.",
      },
      emberDialogs: {
        title: "Delete and feedback dialogs restyled",
        desc: "“Delete account” and “Report a problem” now use the warm Ember look like the rest of the app: a soft background with no blue, headings in Alegreya, and line-drawn icons. In delete account, the irreversibility warning is a readable reddish panel and the delete button is red (a dangerous action). In feedback, the input is a warm field with a terracotta focus, the send button is terracotta, and the “thank you” after sending shows in olive. It works in both dark and light themes. The logic itself — account-scoped deletion, sending feedback — is unchanged.",
      },
      whatsNewSessions: {
        title: "Update history collapses",
        desc: "The “What's new” window now shows the whole update history grouped by date: the latest session on top, older ones below. Each date is a collapsible block — everything starts collapsed, so you see a compact list of dates, and a tap expands the session you want (and collapses it again). A quick, tidy way to look back at what changed.",
      },
      themeToggle: {
        title: "Light and dark theme",
        desc: "Settings now has an “Appearance” switch: dark (warm charcoal), light (warm clay), or “System”. Switching recolors the whole app at once — background, cards, text, buttons and statuses, along with the page background, with no dark edges in the light theme. The meaningful colors stay the same on either background: “Know” terracotta, “Take”/learned olive, errors reddish. Your choice is remembered between visits.",
      },
      emberTutorial: {
        title: "New tutorial",
        desc: "The app's intro is fully redone in the warm Ember style. On first entry — a short four-screen welcome: “words live in examples” (tap a word right in the tutorial and see the translation) and “one movement” (a real card you can swipe left or right). It all runs on the app's live components, not pictures, and in a sandbox — demo actions don't touch your progress. From settings, under “How to use”, and from the last screen, a detailed guide opens covering every feature: cards, review, the daily session, reading, listening, several languages, level and topics, and installing on your phone. You can skip on any step.",
      },
      emberStart: {
        title: "Start screen restyled",
        desc: "The first screen — the welcome before signing up or in — now uses the warm Ember look like the rest of the app: a soft background with no blue and no black frame, the “LangCards” name and greeting in Alegreya, and a terracotta sign-in/sign-up button. The mood is warm and encouraging — it greets you kindly. Signing up, signing in, and moving into the app all work exactly as before.",
      },
      emberHelperScreens: {
        title: "Three more screens restyled",
        desc: "The “What's new” window, the error screen, and the “Install on phone” guide now use the warm Ember look like the rest of the app: a soft background with no blue, headings in Alegreya, and line-drawn icons. “What's new” lists items as warm plates with a terracotta accent; the error screen uses a reddish icon (not blue) with terracotta “Retry”/“Back” buttons; and the install guide keeps its steps readable with a terracotta action button. The logic — showing updates, handling errors, and installing the PWA — works exactly as before.",
      },
      emberPassword: {
        title: "Password screens restyled",
        desc: "Changing your password in settings and resetting a forgotten one (requesting the link on the sign-in screen and setting a new password from the email link) now use the warm Ember look like the rest of the app: a soft background with no blue, headings in Alegreya, input fields as warm plates with a terracotta focus, and a line-drawn lock icon. Action buttons are terracotta, errors show in reddish and success or the “email sent” message in olive. The logic itself — the neutral reset message, the recovery link, and entering and saving the new password — works exactly as before.",
      },
      emberPlacement: {
        title: "Level test restyled",
        desc: "The placement test now uses the warm Ember look like the rest of the app: a soft background with no blue and no black frame, the question shown large in Alegreya, and a “5 of 18” progress with a terracotta bar. Answer options are plates: before you answer they all look the same (the correct one isn't hinted), and after answering the right one turns olive, a wrong pick turns reddish, and a “Next” button appears. The “Looks like B1” result shows with a level-ladder badge. The test logic itself — adaptive difficulty, stop rule, scoring and saving your level — works exactly as before.",
      },
      emberReview: {
        title: "Word review screen restyled",
        desc: "Reviewing due words now uses the warm Ember look like the rest of the app: a soft background with no blue and no black frame at the edges, and the word shown large in Alegreya. The self-rating buttons use meaningful colors — “Forgot” terracotta (repeat now), “Hard” amber, “Good” neutral, “Easy” olive (learned). The review logic, intervals, swipes, and audio all work exactly as before.",
      },
      distinctVariedContent: {
        title: "Reading and listening no longer overlap",
        desc: "A reading text and a listening dialogue on the same topic now come out different — each generation is told about recent stories of the other format and asked for a distinct one. And instead of cramming every one of your words in, each piece weaves in just a few of them naturally; novelty and coherence win over stuffing in more vocabulary. Regenerating gives a fresh piece, not a repeat of the last text or a copy of the dialogue.",
      },
      verbConjugationReading: {
        title: "Conjugation table in reading too",
        desc: "In a reading text, tap a word for its translation — and if it's a verb, the popup now has a “Conjugation” button that opens the same table (pronouns × present/future/past, forms only) as on the card. It's the same shared table and cache: a verb you already opened on a card won't be generated again in a text, and the other way round.",
      },
      verbConjugation: {
        title: "Conjugation table for verbs",
        desc: "Verb cards now have a “Conjugation” button. Tap it for a plain table — rows are the pronouns (I / you / he·she / we / you / they), columns are three tenses (present / future / past), forms only, no lesson. It's built only when you ask (to save the daily limit) and cached per word, so opening it again is instant. Works at least for Greek (ο γιατρός is a noun, so no button — but πληρώνω → θα πληρώσω → πλήρωσα). Nouns and other words don't show the button.",
      },
      pluralForm: {
        title: "Plural form on noun cards",
        desc: "Noun cards now show the plural form next to the singular — handy for languages where the article and ending change (Greek: ο γιατρός → οι γιατροί, το νοσοκομείο → τα νοσοκομεία). It's generated together with the card, and words without a plural (verbs, expressions) simply don't show one.",
      },
      emberOverscroll: {
        title: "Warm background even when you pull past the edge",
        desc: "The page background now matches the warm Ember background, so when you pull the screen past the top or bottom (the rubber-band scroll) you no longer see the old dark background peeking through — it stays warm everywhere.",
      },
      emberNoFrame: {
        title: "No more dark edge around the screen",
        desc: "On the redesigned screens the app frame now shares the warm Ember background, so there's no cold dark border around the edges — the background runs evenly to full width and the screen no longer looks cropped.",
      },
      emberLanguages: {
        title: "My languages got the warm look — and the redesign is complete",
        desc: "The last screen, “My languages”, moved to the Ember design: a terracotta multi-language toggle, Study days and By day / All at once as warm tiles, the week as a row of round language flags (no more blue blocks) with today ringed in terracotta, and each pair as a warm card with a round flag, a terracotta “priority” badge, New-per-day tiles and a red-tinted Remove. Everything works exactly as before. With this the whole app is on Ember.",
      },
      emberListening: {
        title: "Listening got the warm look",
        desc: "The Listening screen moved to the Ember design: the “Comprehension” and “Words” tabs with the active one in terracotta, a warm hint plate, a round language flag, a terracotta audio player, neutral True/False buttons before you answer, and speed as a segmented control. Everything works exactly as before — dialogues with questions, the older word formats, speed, replay and new dialogue.",
      },
      emberPauseIcon: {
        title: "A warm pause icon",
        desc: "In the player (text audio, listening), the pause icon now matches the Ember play button — no more default blue glyph. Play and pause are a single toggling element.",
      },
      answersNeutralBeforeAnswer: {
        title: "The answer is no longer given away",
        desc: "In comprehension questions (reading and listening), the “True” and “False” buttons now look identically neutral before you answer — the correct option isn't visible in advance. Green with a check marks the right answer and a red tint the wrong pick, only AFTER you answer.",
      },
      readingGrammarPerSentence: {
        title: "Grammar, one sentence at a time",
        desc: "In reading, the grammar breakdown works per sentence again: tap the “¶” next to a sentence and just that one is explained, with no length error. Tapping a word still gives its translation.",
      },
      emberReading: {
        title: "A warmer reading screen",
        desc: "Reading got the new look: the text in a warm card, familiar words in green, a terracotta button to play the whole text, a separate “Grammar” button, and a “Did you get it?” block with True/False. Tapping a word gives a translation and wrong answers still explain themselves — all as before.",
      },
      emberMyWords: {
        title: "A warmer word list",
        desc: "The “My words” and “Known” screens got the new look: tabs with the active one in terracotta, a review-due label on words in progress (“today” in terracotta, greener as the review nears), and a warm empty state. The actions are unchanged: “Learned”, “Restore”, select-and-delete, and reviewing known words.",
      },
      emberStats: {
        title: "A warmer statistics screen",
        desc: "Statistics got the new look: a big progress ring in olive (learned), counter tiles (learning in terracotta, learned in olive), and a terracotta active-words bar. The numbers are counted just as before.",
      },
      emberLevelBars: {
        title: "The level icon reads like a signal",
        desc: "The little ladder next to a level now fills by how high the level is: the higher the CEFR level, the more steps light up. A1/A2 — one, B1/B2 — two, C1 — all three.",
      },
      emberSettings: {
        title: "A warmer settings screen",
        desc: "Settings got the new look: topics and levels are chips with line icons, the selected one in terracotta; a “Manage languages” row with round flags; and a “My topics” block with its own input. Choosing a topic, adding your own topics, and picking a level all work as before.",
      },
      emberSession: {
        title: "A warmer session screen",
        desc: "The “Today's session” screen got the new look: blocks are shown as a path — a status circle on the left of each block, connected by a line, so you can see where you are. Line icons for formats and a warm terracotta “Start” button. The session logic is unchanged: a block counts only after you actually complete it.",
      },
      emberHeaderFlags: {
        title: "Fewer duplicate flags",
        desc: "Removed duplicate flags in the card header: the “Today” label and the collapsed language chip now show just text and the code (the flag there repeated the flags in the week strip). The flags in the week strip stay put.",
      },
      emberWeekStrip: {
        title: "A warm week strip",
        desc: "The schedule row on the word card got the new look: warm tiles instead of blue, round language flags instead of letter codes, today highlighted in terracotta, and a neutral marker for rest days. Looks only — the schedule works as before.",
      },
      emberCardPolish: {
        title: "A tidier word card",
        desc: "Polished the top of the card: language flags are now round, the top bar fits on a single line without wrapping, the example’s audio button got a filled circle, and the settings icon is cleaner. Looks only — everything works as before.",
      },
      emberCard: {
        title: "A warmer word card",
        desc: "The word card is the first screen with the new look: a warm background, the word in a large humanist typeface, the transcription in a terracotta accent, and “Know” (terracotta) and “Take” (olive) buttons. Actions and swipes are unchanged — only the look is new.",
      },
      emberFoundation: {
        title: "A new look is on the way",
        desc: "We started making the app warmer and cozier: a warm color palette, new fonts for words and the interface, and tidy line icons instead of emoji. This is a groundwork step — screens still look the same for now, and we'll roll out the changes gradually.",
      },
      simplerSession: {
        title: "Simpler session and generation",
        desc: "Dropped the session load slider (the base is already sensible; want more — “I want something else”) and the word-source picker in reading/listening: content now always matches your topic, weaving in your words plus a little new.",
      },
      rotatingSession: {
        title: "A different session every day",
        desc: "The session base is now full every day but with a rotating focus: today listening, tomorrow reading, the day after surprise words. Finished the base? The engine offers extras on top.",
      },
      editableSchedule: {
        title: "Edit your schedule by hand",
        desc: "In the weekly language schedule you can now tap any day and pick a different language or make it a rest day. Auto-fill stays as the starting layout.",
      },
      sessionCompletion: {
        title: "Session blocks, for real",
        desc: "A block is marked done only when you actually finish the exercise, not just from opening it. Each block has a checkbox you can also set or clear by hand if you did it outside the session.",
      },
      sessionEngine: {
        title: "Today's session",
        desc: "The app now assembles your day — review, reading, new words and a dialogue. A load slider makes it lighter or heavier, and “I want something else” opens manual choice.",
      },
      listeningVariety: {
        title: "More varied dialogues",
        desc: "Listening dialogues no longer repeat one storyline: even at the same topic and level, each one has a different situation, place and participants.",
      },
      readingVariety: {
        title: "More varied reading texts",
        desc: "“New text” now replaces the previous one — one text on screen. And texts on the same topic no longer repeat one storyline: a different situation and characters each time.",
      },
      listeningComprehension: {
        title: "Listening for comprehension",
        desc: "A short dialogue plays around your words, then true/false questions about it. Get one wrong and we explain why, with a reference to the dialogue. The older word formats live under “Words”.",
      },
      readingComprehension: {
        title: "Reading comprehension tests",
        desc: "After a text in reading mode, questions about its content — check that you really understood what you read.",
      },
      audioPlayer: {
        title: "Pause and seek audio",
        desc: "In listening and reading, long audio can be paused, scrubbed along the bar, and played from any point.",
      },
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
        "If this email is registered, we've sent it a password reset link. Check your inbox.",
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
    skipStep: "Skip step",
    next: "Got it, next",
    gotIt: "Done",
    begin: "Let's go",
    alreadyKnow: "I'll figure it out myself",
    startSession: "Start session",
    openDetailed: "Detailed guide",
    tryIt: "Try it yourself",
    groups: {
      cards: "Cards & words",
      review: "Review",
      session: "Daily session",
      reading: "Reading",
      listening: "Listening",
      languages: "Several languages",
      level: "Level & topics",
      install: "Install on phone",
    },
    demo: {
      translit: "[to paRAthiro]",
      translation: "window",
      exampleTranslation: "I open the window every morning.",
      tapHint: "Tap a word in the example — the translation shows below.",
      swipeHint: "Drag the card left or right.",
      knowConfirm: "“Know” — word removed (this is a demo, your progress is safe).",
      takeConfirm: "“Take” — word added to learning (this is a demo, your progress is safe).",
      gradeHint: "Rate yourself: easier — less often, harder — more often. Nothing here is saved.",
      glossFallback: "a word from the example",
      gloss: {
        "Ανοίγω": "I open",
        "το": "the (article)",
        "παράθυρο": "window",
        "κάθε": "every",
        "πρωί": "morning",
      },
    },
    session: {
      label: "Today · {lang}",
      minutes: "≈ {n} min",
      cards: "{n} cards",
      text: "text",
      dialogue: "dialogue",
      coreTitle: "This is the core",
      coreText:
        "The full walkthrough is in settings, under “How to use”. Open it anytime.",
    },
    steps: {
      welcome: {
        title: "Hello! This is LangCards",
        text: "A language builds up little by little — a few minutes a day. We'll point you to what's next, and won't rush you.",
        lead: "We'll show the essentials in four screens. You can skip on any of them.",
      },
      examples: {
        title: "Words live in examples",
        text: "Tap any word in the phrase — we'll show the translation. It sticks better this way than as a list.",
      },
      swipe: {
        title: "One movement — and done",
        text: "Left — already know it. Right — take it into your words. Drag the card to feel it.",
      },
      sessionReady: {
        title: "Today's session is ready",
        text: "We put together today's plan for you — cards, a bit of reading, and a dialogue. It's a little different every day.",
      },
      d_swipe: {
        title: "The card and the swipe",
        text: "A word with its translation and a living example. Left — “Know”, right — “Take into learning”. Try it right here.",
      },
      d_lookup: {
        title: "Tap a word for its meaning",
        text: "Any word in the example is tappable: translation, audio, and on a real card — “Add to learning” too.",
      },
      d_cardExtras: {
        title: "More on the card",
        text: "The card adapts to the word — it shows only what's relevant.",
        points: [
          "Plural form for nouns",
          "A conjugation table for verbs — on request",
          "Add your own word straight from an example",
        ],
      },
      d_review: {
        title: "Review on a schedule",
        text: "Taken words come back for review when it's time. After you answer — rate yourself in meaningful colors.",
      },
      d_session: {
        title: "Daily session",
        text: "Each day the app assembles a short plan for you: review, a bit of reading, and a dialogue.",
      },
      d_reading: {
        title: "Reading",
        text: "A short text in your target language — with a breakdown right inside it.",
        points: [
          "Tap a word for its translation in context",
          "The ¶ mark breaks a sentence down by grammar",
          "At the end — “Did you get it?” questions",
        ],
      },
      d_listening: {
        title: "Listening",
        text: "Short dialogues by ear — with questions and a handy player.",
        points: [
          "Dialogues with comprehension questions",
          "Choose the speech speed",
          "Pause, rewind, and replay",
        ],
      },
      d_languages: {
        title: "Several languages",
        text: "You can learn several pairs at once — the app spreads out the load.",
        points: [
          "A priority language — it gets more attention",
          "A schedule by day of the week",
        ],
      },
      d_level: {
        title: "Level & topics",
        text: "The material adapts to you.",
        points: [
          "The level test — take it anytime",
          "Your own generation topics on top of the ready ones",
        ],
      },
      d_install: {
        title: "Install on phone",
        text: "LangCards can be installed like a regular app.",
        points: [
          "Add to the home screen (PWA) — full screen",
          "An account is required — sign up once",
          "Your progress syncs across devices",
        ],
      },
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
