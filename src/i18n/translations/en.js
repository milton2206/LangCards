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
      "You have {max} words in progress — there's no room for more. Keep reviewing what you took: the ones you know well can move to your known words and free up space.",
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
    title: "Learn words in context",
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
    myWords: "Learning",
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
    // Room for active words: the ceiling is full — nothing to generate.
    slotsFull: "No room · {max} of {max}",
    // Short batch: fewer cards arrived than asked for.
    shortBatch: "Only {got} of {asked} words turned out to be new.",
    plural: "pl.",
    // Collapsed card "Details" (transcription and plural), example translation
    // behind a tap, and the secondary-actions block under the card.
    details: "Details",
    showTranslation: "Translation",
    more: "More",
    // Verb conjugation table (on request, verbs only).
    conjugation: "Conjugation",
    conjLoading: "Building the table…",
    conjFailed: "Couldn't build the conjugation table. Please try again.",
    conjNotVerb: "No conjugation for this word.",
    conjBase: "Base form",
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
    addedHint: "It's in your “Learning” list and will show up for review.",
    addMore: "Add another",
    openMyWords: "Open “Learning”",
    notRecognized: "Couldn't recognize the word. Check the spelling and try again.",
    failed: "Couldn't create the card. Please try again.",
  },

  // Looking up a word from the example (tap a word → translation → add to study).
  lookup: {
    loading: "Looking up…",
    added: "Added to studying",
    // Extending the selection into a phrase (arrows in the lookup sheet).
    spanAria: "Extend selection",
    extendLeft: "Add the word on the left",
    extendRight: "Add the word on the right",
    resetWord: "Back to a single word",
    extendHint: "Use the arrows to grab neighbouring words",
    phrase: "Translation of the whole phrase",
    phraseLoading: "Translating the phrase…",
    // Taking a phrase into study — via confirmation.
    takePhrase: "Take the phrase into study",
    confirmTitle: "Save it like this?",
    inText: "In the text:",
    confirmSave: "Save",
    alreadyTaken: "This phrase is already in your list.",
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
    // Скорость озвучки текста: тот же набор, что в аудировании.
    speedLabel: "Speed:",
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
    // The topic ran out. Calm tone, no apology: running a topic dry is an
    // achievement, not a failure of the app.
    exhaustedSwitched:
      "You've used up the words on “{from}” — switched to “{to}”. Pick another topic or set your own.",
    exhaustedAll:
      "You've used up the words on “{from}”, and you've been through the other topics too. Set your own topic — that opens up new words.",
    narrowHint:
      "The narrower the topic, the more useful the words: “doctor's appointment” gives you more of what you need than “medicine”.",
    openPicker: "Pick a topic",
    hidePicker: "Collapse",
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
    // The verdict is no longer shown as a plaque (the highlighted option says
    // it) — these strings are kept for screen readers only.
    right: "Correct",
    wrong: "Not quite",
    translationLabel: "Translation:",
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
    // The verdict is no longer shown as a plaque: it repeated what the button
    // colour already said, and next to a "False" answer it was confusing.
    // These strings are kept for screen readers only.
    right: "Your answer is correct",
    wrong: "Your answer is wrong",
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
    // No room for new words — the new-words block is left out, this line instead.
    noRoomForNew:
      "No new words today — {max} already in progress. Let's reinforce what you took.",
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
    // Progress of the new-words task: how many are already taken. Shown only
    // while the block is unfinished.
    taskProgress: "{taken} of {total}",
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
    // Daily audio quota is used up: buttons go quiet, the session carries on.
    quotaOut: "Audio is unavailable today",
    quotaOutHint:
      "Audio is unavailable today — it comes back tomorrow. Cards and your session work as usual.",
  },

  // Long-audio player (listening, whole text, single sentence).
  audio: {
    player: "Audio player",
    play: "Play",
    pause: "Pause",
    restart: "Restart",
    seek: "Seek",
    unavailable: "Audio unavailable",
    // Short label in place of the timer — by failure reason.
    failedShort: "No audio",
    offlineShort: "Offline",
    limitShort: "Limit",
    emptyShort: "No text",
    // Full explanation under the player + retry of the AUDIO only.
    retry: "Retry audio",
    retrying: "Loading…",
    errFailed: "Couldn't get the audio. The exercise itself is still here.",
    errOffline: "Can't reach the server. Check your connection and try again.",
    // The device is online but the request didn't land — offer a retry, not a
    // connection check.
    errNetwork: "The server didn't respond. Try the audio again.",
    errLimit:
      "You've used today's audio limit. It resets tomorrow (at 00:00 UTC).",
    errCooldown: "Too often. Wait {seconds}s and try again.",
    errSession: "Your session has expired. Please sign in again.",
    // This used to be one line for two different cases — "This text can't be
    // voiced": neither what happened nor what to do. Now they are separate and
    // both say it plainly.
    errEmpty:
      "There is nothing to voice: this exercise has no text. Questions and the breakdown still work.",
    errTooLong:
      "This phrase is longer than {max} characters — too long to voice in one go.",
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
    // Quota met — a calm marker, not a stop: you can keep taking words.
    normMet: "Today's quota is met · {taken} of {quota}",
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
    // The device is online but the request didn't get through: the server went
    // quiet, the connection dropped. Nothing to check — just try again.
    network: "The server didn't respond. Please try again.",
    noCards: "Server returned no cards. Please try again.",
    server: "Server error ({status})",
    generateFailed: "Couldn't generate cards.",
    // Not a failure: the model worked, but you already know everything it offered.
    noNewWordsTitle: "No new words found",
    noNewWords:
      "For this topic and level you already know almost everything that came back. Try again, switch the topic, or take “Native context” — those are living expressions rather than single words.",
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
    // Reverse direction: the front shows the translation, the word is the answer.
    askWord: "Which word is this?",
    revealWord: "Show word",
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

  // Multiple-choice quiz. Two modes, shared strings: some review words are shown
  // as a quiz question, and there is a separate practice run outside the lesson.
  quiz: {
    entry: "Multiple choice",
    title: "Multiple choice",
    // What to do — short, in the interface language. The formats rotate on their
    // own (you don't pick one), so the line just names the current question.
    promptWord: "Pick the translation",
    promptTranslation: "Pick the word",
    promptCloze: "Pick the missing word",
    // The gap is drawn as a dash — screen readers get the word instead, or the
    // sentence would be read without a break.
    blankAria: "blank",
    // Result for screen readers: on screen the colour and the icon say it.
    right: "Correct",
    wrong: "Wrong",
    next: "Next",
    finish: "Finish",
    progress: "Question {n} of {total}",
    doneTitle: "Round finished",
    score: "Correct: {n} of {total}",
    again: "Play again",
    // The threshold stays visible: while you have few words, we say how many are
    // still missing instead of hiding the feature.
    locked: "{n} more {word} and the quiz opens",
    lockedShort: "The quiz opens once you have {n} more {word}",
    lockedHint:
      "Questions are built from your own words — the wrong options come from them too. With fewer than {min} words the options would start repeating and the quiz would turn into guesswork.",
    noSrsNote:
      "Practice for its own sake: nothing is saved here — neither your review dates nor your progress move.",
    reviewNote:
      "A correct answer counts as “Good”, a wrong one as “Again”.",
    empty:
      "Nothing to build a question from yet: your words need translations. Add a few more words and come back.",
  },

  // "Looks like you know it" checkpoint: an offer to move a mature word to the
  // known list. Tone — a calm question, not a congratulation or a reward.
  knownOffer: {
    aria: "Offer to move the word to your known words",
    title: "Looks like you know “{word}”",
    // The span comes from the interval that was just applied (formatInterval),
    // never from a hardcoded string — the threshold may change.
    hint: "You recall it without slipping, and it won't come back until {interval}. Move it to your known words?",
    yes: "Yes, I know it",
    later: "Keep it for now",
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
    mineTitle: "Learning",
    knownTitle: "Known words",
    select: "Select",
    learned: "Learned",
    restore: "Restore",
    // Row disclosure arrow: label for screen readers only.
    expandAria: "Show details for “{word}”",
    collapseAria: "Hide details for “{word}”",
    mineEmpty: "Empty for now. Take words with the “Take” button — they'll appear here.",
    knownEmpty: "Empty for now. Words marked “Know” will collect here.",
    emptyTitle: "Nothing here yet",
    dueToday: "today",
    dueInDays: "in {n}d",
  },
  tabs: {
    mine: "Learning",
    known: "Known",
  },

  // Bulk review of mature words (the "Learning" list). Same meaning as the
  // checkpoint during reviews, but decided over the whole list at once.
  promote: {
    entry: "Review mature words",
    readyTitle: "Mature words: {n}",
    readyHint:
      "You recall these at long intervals now. You can move them to your known words and free up room for new ones.",
    none: "Nothing to move yet: these words haven't reached long intervals. That's how it should be — moving them early means quietly forgetting them.",
    pickTitle: "Mature words: {n}",
    selectAll: "Select all",
    clearAll: "Clear all",
    action: "Move ({n})",
    confirmTitle: "Move {n} {word} to your known words?",
    confirmText:
      "They'll move to “Known” with their review history intact and free up room. If one slips away, bring it back to studying — the progress is kept.",
    confirmOk: "Move",
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
    theme: { dark: "Dark", light: "Light" },
    // Font size — the app's own setting, not the system one.
    fontSize: "Text size",
    fontSizes: { normal: "Normal", large: "Large", xlarge: "Extra large" },
    fontSample:
      "This is how text will look in the app: words on cards, examples and captions.",
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
    showAll: "Show full history",
    entries: {
      clearerForms: {
        title: "One pronunciation format, and forms with their own pronouns",
        desc: "The pronunciation hint used to arrive sometimes in Latin letters, sometimes in Cyrillic, sometimes in phonetic-alphabet symbols — occasionally all of them mixed into one line. The format is now fixed in advance for each pair of languages: if the language you're learning uses the Latin alphabet, the hint is always in Latin letters, written the way the word sounds — [uh-POINT-muhnt]. It is never written in Cyrillic any more: Cyrillic cannot carry th, æ or ŋ and teaches the wrong pronunciation. For Greek with a Russian or Ukrainian interface it is always Cyrillic instead. Cards you already saved stay as they are — the rule applies to new ones. Alongside that, the verb-forms table now shows the pronoun in the language you're learning with the translation beneath it, so you learn “I go” rather than “я go”.",
      },
      bothDirections: {
        title: "Words are asked both ways",
        desc: "Until now a word always appeared the same way: a sentence in the language you're learning, with the translation a tap away. With that sameness you end up memorising the card rather than the word — you recognise it by its familiar shape and the answer comes back, yet the word never surfaces in real life. The direction now alternates: one session you recall the translation, the next you recall the word itself from its translation. The reverse card shows the translation and nothing else — no example, no transcription, no audio, or the answer would be sitting right there. The very first review of a word is always the old way: you've only just picked it up.",
      },
      simplerGeneration: {
        title: "No more choosing how many cards",
        desc: "The three buttons “5 / 10 / 20” next to the generate button are gone: the app now takes as many cards as will fit. Usually that's ten, but if only three places are left before the active-words ceiling, exactly three arrive instead of ten with seven thrown away. Before, generation simply refused to start in that case and you had to clear the list first. Everything else stays: the content type (words or “Native context”), “Surprise me”, and your daily norm per language.",
      },
      topicSwitch: {
        title: "Ran out of words on a topic? We'll take another",
        desc: "There's a finite number of words on any one topic at your level, and sooner or later you use them all up — that's normal, you've been through it. The app now picks another topic itself and tells you, instead of quietly handing you two cards at a time. From that same message you can choose a different topic or set your own — “doctor's appointment”, “renting a flat”, anything. The narrower the topic, the more useful the words.",
      },
      quizFixes: {
        title: "The quiz plays fair now",
        desc: "Fill-in-the-blank questions no longer break on word forms. The blank used to cut an inflected form out of the sentence while the options offered the dictionary one — so none of the four answers was actually correct. Such a question is now built only when the form in the sentence matches the dictionary form; otherwise the word goes to a different question type. The quiz also sticks to single words now: long phrases and list-style translations were unreadable as options. They stay in review and in your lists, where they still have a sentence around them.",
      },
      cleanWords: {
        title: "Words without stray marks or missing letters",
        desc: "Stress marks sometimes slipped into the words themselves, and in older cards they simply stayed there. They are now removed as the word is shown — on the card, in review, in your lists and in the quiz. Your progress on those words is fully intact: only what appears on screen is cleaned up. Greek is left alone, where the mark is part of the spelling. And if the generator ever builds a card whose word and example don't match, that card is no longer shown.",
      },
      quiz: {
        title: "Multiple-choice quiz",
        desc: "There's a quiz now: a word and four options. Some of your review words are shown this way instead of the self-rated card — a correct answer counts as “Good”, a wrong one as “Again”. The cards haven't gone anywhere: the quiz alternates with them. And if you just feel like drilling words, the quiz also opens on its own — nothing is saved there and your progress doesn't move.",
      },
      warmLookup: {
        title: "Translations are prepared ahead of time",
        desc: "As soon as a reading text opens, the app quietly prepares translations for the words you don't know yet — while you're still reading the title and the first lines. Tapping a word then shows the translation right away, with no wait. With no connection nothing changes: the translation arrives on tap, as before.",
      },
      instantLookup: {
        title: "Instant translation for words you know",
        desc: "Tap a word you're already learning or already know and the translation opens instantly — the app has that card, there's no one to ask again. The word is recognised in other forms too: “Rechnungen” finds your “die Rechnung”. And a word you looked up earlier in the same session opens without waiting the second time.",
      },
      compactWordList: {
        title: "The word list is more compact",
        desc: "In “Learning” and “Known” each row is now collapsed: the word, its translation, the review due date and the action stay in view. Transcription, the example with its translation and the verb forms open with the arrow on the right — one word at a time. Twice as many words fit on a phone screen, and none of the details went away.",
      },
      newWordsProgress: {
        title: "You can see how many words you've taken",
        desc: "The new-words task now shows a counter next to its size — “8 of 10”. As you work through the deck you can see how many are still left before the task is done. It counts words you actually take: “I know it” and “Skip” don't move it. Once the task is complete, the block gets a checkmark like the others.",
      },
      steadierAudio: {
        title: "Listening audio holds up better",
        desc: "A dialogue is voiced line by line, and until now a single line failing was enough to stop the whole conversation from playing. Each line now gets a second attempt, so a passing network glitch usually goes unnoticed. And when the audio really doesn't arrive, the app is clearer about why: “the server didn't respond” and “you're offline” are different things.",
      },
      voiceGender: {
        title: "The voice fits the speaker",
        desc: "Listening dialogues are a conversation between two people, and each one now sounds like themselves: a woman gets a female voice, a man a male one. Voices used to be handed out in turn, so a male voice could say “I arrived” in the feminine — in Russian and Greek that was audible immediately.",
      },
      dialogueVoices: {
        title: "A conversation in two voices",
        desc: "In listening dialogues the speakers now sound different — you can hear where one turn ends and the next begins without looking at the transcript. We also went through the voices themselves: English and Russian now sound warmer and more natural.",
      },
      livelierAudio: {
        title: "Dialogues in two voices",
        desc: "In listening, the two speakers finally sound different: until now one voice read both sides and the conversation came out as a robot's monologue. And a word you skip comes back far less insistently — each skip pushes it further away, first by a day, then two, and so on up to a month. It never disappears for good: a skip can always be accidental.",
      },
      cleanerCards: {
        title: "Cards without stray marks or invented phrases",
        desc: "Words and translations used to pick up random stress marks. They're gone now: stress stays only in the pronunciation hint, while Greek keeps its tonos — there it's part of the spelling. And invented expressions like a word-for-word “not my cup of tea” no longer make it into cards: only what native speakers actually say.",
      },
      readableAndSlower: {
        title: "Bigger, clearer, slower",
        desc: "The “My words” list is now “Learning” — a fair pair with “Known”. Settings gained a text size control: three steps that apply across the whole app at once. And in reading you can slow the audio down, just like in listening.",
      },
      lighterAudio: {
        title: "Audio got lighter and stopped going quiet",
        desc: "The app used to prepare audio for a whole batch up front — every word and every example — even though people rarely work through a batch in one sitting. Now only the nearest cards are prepared, and examples play on tap. And when the day's audio allowance runs out, the app says so plainly: the button used to just stop working.",
      },
      smarterGeneration: {
        title: "Generation no longer comes up short in silence",
        desc: "Cards with words you already knew used to be dropped quietly — so instead of ten you got two or three with no explanation. Now the app asks for replacements, and if there are still fewer new words, it says how many. It also explains plainly when there simply were no new words for the topic.",
      },
      realComprehension: {
        title: "Comprehension questions are real now",
        desc: "Statements used to repeat the source word for word, so the answer could be found by matching strings. Now they're rephrased, and some require connecting two places and drawing a conclusion — you can't answer without understanding the content. This applies to both reading and listening.",
      },
      bulkPromote: {
        title: "Move words to known as a list",
        desc: "Words you remember confidently no longer have to be moved one at a time: the “Learning” list now has a mature-word review — checkboxes, “select all”, and a bulk move. It frees up room for new words in a single pass.",
      },
      knownCheckpoint: {
        title: "You can see when a word is learned",
        desc: "When a word has been coming back to you without errors for a long time, the app quietly asks after a review whether to move it to your known words. It's your call: say yes and a slot frees up for new words, say not yet and the question won't return for a long while.",
      },
      softDailyNorm: {
        title: "The daily quota guides, it doesn't block",
        desc: "A session never asks for more new words than the quota you picked, and the quota now counts every source: the deck, reading, an example on a card, your own words, and words brought back from the known list. Once it's met, cards keep coming — just a calm marker next to the counter.",
      },
      roomForWords: {
        title: "Up to 150 words at once",
        desc: "The limit went up from 50. When there's no room, the app says so plainly instead of offering new words.",
      },
      highlightForms: {
        title: "Highlighting catches any form",
        desc: "The word you're learning is highlighted in the example even when it appears in a different form or was saved as a phrase.",
      },
      reviewFrontExample: {
        title: "Review starts with context",
        desc: "You see the sentence with the word highlighted first. The translation opens when you're ready.",
      },
      conjugationInList: {
        title: "Verb forms in lists",
        desc: "The conjugation table now opens right in your word lists, not only on the card.",
      },
      phraseToStudy: {
        title: "Save whole phrases",
        desc: "Keep a selected phrase: the app shows its dictionary form and uses the sentence as the example.",
      },
      phraseLookup: {
        title: "Translate a phrase",
        desc: "Use the arrows to stretch the selection from one word to a phrase and translate it whole.",
      },
      audioRetry: {
        title: "Retry the audio",
        desc: "If the sound didn't load, retry it with one button. No need to create a new dialogue.",
      },
      migrationOnlyWhenNeeded: {
        title: "Fewer pointless questions",
        desc: "We only ask about transferring words when there are any. \"Start fresh\" now really clears them.",
      },
      setupAfterConfirm: {
        title: "Setup right after email",
        desc: "Confirming your email takes you to language setup and the intro, not straight into the app.",
      },
      flatterComprehension: {
        title: "Clearer answer breakdown",
        desc: "In comprehension questions the explanation is shorter and reads at a glance, without extra boxes.",
      },
      calmerCard: {
        title: "A calmer card",
        desc: "Word, translation and example up front; the rest under \"Details\". The card fits on one screen.",
      },
      audioStuckFix: {
        title: "Audio no longer sticks",
        desc: "After an error or a pause the sound works again — no page reload needed.",
      },
      steadyGeneration: {
        title: "Generation that recovers",
        desc: "If a request fails, the app retries by itself. Errors now speak your language.",
      },
      sessionAutoRefresh: {
        title: "You stay signed in",
        desc: "Your session renews itself. \"Sign in again\" only appears when it's genuinely needed.",
      },
      onboardingBeforeTutorial: {
        title: "Setup, then intro",
        desc: "Languages first, then the short intro — and in a language you actually read.",
      },
      emberOnboardingAddWord: {
        title: "A warmer first screen",
        desc: "Choosing languages and adding your own word look as calm as the rest of the app.",
      },
      lightThemeBack: {
        title: "Light theme is back",
        desc: "Switch between light and dark in settings — colours are fixed in both.",
      },
      verbAnyForm: {
        title: "Conjugation from any form",
        desc: "Tap a verb in any form to see the full table, with your form highlighted in it.",
      },
      darkThemeOnly: {
        title: "Dark theme",
        desc: "The app moved to a single calm dark theme — easier on the eyes in the evening.",
      },
      logoAndIcon: {
        title: "Its own icon",
        desc: "The app has a mark of its own, so it's easy to spot on your home screen.",
      },
      reviewCardCentered: {
        title: "Word in the centre",
        desc: "During review the word is bigger, with less empty space around it.",
      },
      sessionLangFlag: {
        title: "Flag of today's language",
        desc: "The session screen shows at a glance which language you're studying today.",
      },
      emberDialogs: {
        title: "Clearer confirmation windows",
        desc: "Deleting your account and reporting a problem now read more calmly.",
      },
      whatsNewSessions: {
        title: "History of updates",
        desc: "Updates are grouped by date: open any day to see what changed.",
      },
      themeToggle: {
        title: "Choose a theme",
        desc: "Light, dark or match your system — switch it in settings and it's remembered.",
      },
      emberTutorial: {
        title: "A new intro",
        desc: "Four screens on first launch plus a detailed guide in settings — everything is hands-on.",
      },
      emberStart: {
        title: "Warmer welcome screen",
        desc: "The welcome screen is calmer and easier to read.",
      },
      emberHelperScreens: {
        title: "Helper screens refreshed",
        desc: "Updates, errors and \"install on your phone\" now look like the rest of the app.",
      },
      emberPassword: {
        title: "Password screens",
        desc: "Changing and resetting your password is simpler and clearer.",
      },
      emberPlacement: {
        title: "Clearer level test",
        desc: "Answers light up immediately, and the result places your level on a scale.",
      },
      emberReview: {
        title: "Review screen refreshed",
        desc: "The word is bigger and the rating buttons carry meaningful colours.",
      },
      distinctVariedContent: {
        title: "Texts stop repeating",
        desc: "Reading and listening give different stories, and your words are woven in selectively.",
      },
      verbConjugationReading: {
        title: "Conjugation while reading",
        desc: "Tap a verb in the text and its forms table opens right there.",
      },
      verbConjugation: {
        title: "Conjugation table",
        desc: "Verb cards now carry a table of forms by person and tense.",
      },
      pluralForm: {
        title: "Plural form",
        desc: "Noun cards now show the plural form of the word.",
      },
      emberOverscroll: {
        title: "No flashing background",
        desc: "Scrolling past the edge no longer reveals a stray dark background.",
      },
      emberNoFrame: {
        title: "Extra frame removed",
        desc: "The cold border around the screens is gone.",
      },
      emberLanguages: {
        title: "Languages screen refreshed",
        desc: "Your language pairs and study week are easier to take in.",
      },
      emberListening: {
        title: "Listening refreshed",
        desc: "The player and the speech-speed picker are easier to use.",
      },
      emberPauseIcon: {
        title: "Pause icon",
        desc: "The pause button no longer stands out from everything else.",
      },
      answersNeutralBeforeAnswer: {
        title: "The answer isn't hinted",
        desc: "In true/false questions both options look the same until you answer — colour comes only after.",
      },
      readingGrammarPerSentence: {
        title: "Breakdown per sentence",
        desc: "Grammar is explained one sentence at a time again, not for the whole text at once.",
      },
      emberReading: {
        title: "Reading refreshed",
        desc: "The text flows as one piece, with the breakdown and questions close at hand.",
      },
      emberMyWords: {
        title: "Word lists refreshed",
        desc: "Your words and known words sit in tabs, each showing when it's due.",
      },
      emberStats: {
        title: "Clearer statistics",
        desc: "Progress is shown as a ring with counters — you can see how many words you've learned.",
      },
      emberLevelBars: {
        title: "Level badge",
        desc: "Your level is shown on a scale, so you can see how far you've come.",
      },
      emberSettings: {
        title: "Settings are easier",
        desc: "Topics, levels and languages are laid out in clear blocks.",
      },
      emberSession: {
        title: "Session as a path",
        desc: "The session blocks form a path — you see what's done and what's next.",
      },
      emberHeaderFlags: {
        title: "Less clutter on top",
        desc: "Duplicate flags are gone, so the card header is cleaner.",
      },
      emberWeekStrip: {
        title: "Your study week",
        desc: "Days of the week carry language flags, so you see which language falls when.",
      },
      emberCardPolish: {
        title: "A tidier card",
        desc: "The top bar sits on one line, with buttons and flags aligned.",
      },
      emberCard: {
        title: "New look for cards",
        desc: "The word card is warmer and easier on the eyes.",
      },
      emberFoundation: {
        title: "A new look",
        desc: "The app started moving to calm warm colours and new type.",
      },
      simplerSession: {
        title: "Fewer session settings",
        desc: "The workload slider and word-source picker are gone — the app decides for you.",
      },
      rotatingSession: {
        title: "A different session daily",
        desc: "Each day puts a different format in focus, so sessions don't get stale.",
      },
      editableSchedule: {
        title: "Edit your schedule",
        desc: "Assign a language to any day of the week, or make that day a rest day.",
      },
      sessionCompletion: {
        title: "Marks for what's done",
        desc: "A block marks itself once you've really finished it. You can also tick it yourself.",
      },
      sessionEngine: {
        title: "A plan for today",
        desc: "The app builds your session from review, new words, reading and listening.",
      },
      listeningVariety: {
        title: "Varied dialogues",
        desc: "Listening stories stopped repeating themselves.",
      },
      readingVariety: {
        title: "Varied texts",
        desc: "Swap the text and get a new story on the same topic.",
      },
      listeningComprehension: {
        title: "Dialogues with questions",
        desc: "Listen to a short conversation and answer questions about it, like in a language exam.",
      },
      readingComprehension: {
        title: "Questions about the text",
        desc: "After reading you can check what you understood with true-or-false questions.",
      },
      audioPlayer: {
        title: "Player with seeking",
        desc: "Long audio can be paused, rewound and replayed.",
      },
      deleteAccount: {
        title: "Delete your account",
        desc: "Your account and all its data can be deleted from settings.",
      },
      feedback: {
        title: "Report a problem",
        desc: "Write to us from settings if something goes wrong.",
      },
      wordSource: {
        title: "Choose word source",
        desc: "Pick which words tasks are built from: yours, new ones, or a mix.",
      },
      customTopics: {
        title: "Your own topics",
        desc: "Add a topic of your own and get cards and texts about what you actually need.",
      },
      listening: {
        title: "Listening",
        desc: "Listen to phrases in your target language and check what you caught.",
      },
      placement: {
        title: "Level test",
        desc: "A short test finds your level so tasks match your ability.",
      },
      reading: {
        title: "Reading",
        desc: "Short texts at your level: tap any word to see its translation.",
      },
      tts: {
        title: "Pronunciation",
        desc: "Hear how words and examples sound, on cards and while reading.",
      },
      multiLang: {
        title: "Several languages",
        desc: "Study several language pairs side by side, with a weekly schedule.",
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
    resend: "Send the email again",
    resendWait: "You can retry in {n} s",
    resendSent: "Email sent to {email}. Check your inbox.",
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
      alreadyRegistered: "This email is already registered. Sign in — or reset your password if you forgot it.",
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
    openDetailed: "How to use",
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
      tapHint: "Tap a word in the example — the translation shows below.",
      swipeHint: "Drag the card left or right.",
      knowConfirm: "“Know” — word removed (this is a demo, your progress is safe).",
      takeConfirm: "“Take” — word added to learning (this is a demo, your progress is safe).",
      gradeHint: "Rate yourself: easier — less often, harder — more often. Nothing here is saved.",
      glossFallback: "a word from the example",
    },
    session: {
      // The preview title and block labels come from session.* — the very
      // strings the real session screen uses.
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
        text: "Left — already know it. Right — take it into your “Learning” list. Drag the card to feel it.",
      },
      sessionReady: {
        title: "Today's session is ready",
        text: "We put together today's plan for you — review, new words, a bit of reading, and a dialogue. It's a little different every day.",
      },
      d_swipe: {
        title: "The card and the swipe",
        text: "A word with its translation and a living example. Left — “Know”, right — “Take”. Try it right here.",
      },
      d_lookup: {
        title: "Tap a word for its meaning",
        text: "Any word in the example is tappable: translation, audio, and on a real card — “Add to learning” too.",
      },
      d_cardExtras: {
        title: "More on the card",
        text: "The card adapts to the word — it shows only what's relevant.",
        points: [
          "Transcription and the plural form — under “Details”",
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
        text: "Each day the app assembles a short plan for you: review, new words, a bit of reading, and a dialogue.",
      },
      d_reading: {
        title: "Reading",
        text: "A short text in your target language — with a breakdown right inside it.",
        points: [
          "Tap a word for its translation in context",
          "The ¶ mark breaks a sentence down by grammar",
          "At the end — the “Check comprehension” button: questions about the text",
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
          "Sign in with the same account on your phone — your progress comes along",
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
