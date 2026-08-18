// ============================================================================
// Демо-карточка туториала — по одной заготовке на каждый ИЗУЧАЕМЫЙ язык.
// ----------------------------------------------------------------------------
// Зачем данные, а не генерация. Туториал — самый первый экран после онбординга.
// Ждать ответа модели там нельзя (человек смотрит в пустоту), да и квоту тратить
// не за что: карточка нужна только чтобы показать механику. Поэтому набор лежит
// в коде — как и остальные данные онбординга (см. data/onboarding.js).
//
// Зачем по языкам. Раньше пример был всегда греческий, какой бы язык человек ни
// выбрал: тот, кто пришёл учить английский, видел незнакомый алфавит и решал,
// что ошибся приложением. Демо должно быть на ЕГО языке.
//
// Слово одно и то же во всех языках — «хлеб»: простое, бытовое и уместное для
// мигранта (магазин, пекарня), не требует пояснений и одинаково работает в любой
// паре. Заголовочное слово даётся так же, как его даёт генератор: с артиклем
// там, где артикль есть в языке (греч. «το ψωμί», нем. «das Brot»).
//
// Структура одной записи:
//   word     — заголовочное слово на изучаемом языке;
//   example  — живой пример с ним же;
//   native   — что показать поверх этого НА РОДНОМ языке (ru | uk | en):
//     translit            — подсказка по произношению (правило то же, что у
//                           генератора, см. lib/generateCards.js: латиница с
//                           ударением заглавными, если родной латинский, а
//                           письменность изучаемого своя; иначе — средствами
//                           родного);
//     translation         — перевод заголовочного слова;
//     exampleTranslation  — перевод примера;
//     gloss               — перевод КАЖДОГО слова примера: это данные для
//                           демо-всплывашки (тап по слову), настоящий словарь
//                           её не спрашивает.
//
// Пара «учу тот же язык, что и родной» (en+en, ru+ru) в выборе не запрещена.
// Перевод сам в себя выглядел бы сломанным, поэтому там даны короткие
// толкования на том же языке — ровно так и выглядит одноязычная карточка.
// ============================================================================

export const TUTORIAL_DEMO = {
  de: {
    word: "das Brot",
    example: "Ich kaufe jeden Morgen Brot.",
    native: {
      ru: {
        translit: "[дас брот]",
        translation: "хлеб",
        exampleTranslation: "Я покупаю хлеб каждое утро.",
        gloss: {
          Ich: "я",
          kaufe: "покупаю",
          jeden: "каждый",
          Morgen: "утро",
          Brot: "хлеб",
        },
      },
      uk: {
        translit: "[дас брот]",
        translation: "хліб",
        exampleTranslation: "Я купую хліб щоранку.",
        gloss: {
          Ich: "я",
          kaufe: "купую",
          jeden: "кожен",
          Morgen: "ранок",
          Brot: "хліб",
        },
      },
      en: {
        translit: "[das broht]",
        translation: "bread",
        exampleTranslation: "I buy bread every morning.",
        gloss: {
          Ich: "I",
          kaufe: "buy",
          jeden: "every",
          Morgen: "morning",
          Brot: "bread",
        },
      },
    },
  },

  en: {
    word: "bread",
    example: "I buy bread every morning.",
    native: {
      ru: {
        translit: "[бред]",
        translation: "хлеб",
        exampleTranslation: "Я покупаю хлеб каждое утро.",
        gloss: {
          I: "я",
          buy: "покупаю",
          bread: "хлеб",
          every: "каждое",
          morning: "утро",
        },
      },
      uk: {
        translit: "[бред]",
        translation: "хліб",
        exampleTranslation: "Я купую хліб щоранку.",
        gloss: {
          I: "я",
          buy: "купую",
          bread: "хліб",
          every: "кожного",
          morning: "ранку",
        },
      },
      // Английский поверх английского — толкования, а не перевод (см. шапку).
      en: {
        translit: "[bred]",
        translation: "baked food made from flour",
        exampleTranslation: "Every day starts with a trip to the bakery.",
        gloss: {
          I: "the person speaking",
          buy: "pay money for",
          bread: "baked food made from flour",
          every: "each one, without exception",
          morning: "the early part of the day",
        },
      },
    },
  },

  el: {
    word: "το ψωμί",
    example: "Αγοράζω ψωμί κάθε πρωί.",
    native: {
      ru: {
        translit: "[то псоМИ]",
        translation: "хлеб",
        exampleTranslation: "Я покупаю хлеб каждое утро.",
        gloss: {
          Αγοράζω: "покупаю",
          ψωμί: "хлеб",
          κάθε: "каждое",
          πρωί: "утро",
        },
      },
      uk: {
        translit: "[то псоМІ]",
        translation: "хліб",
        exampleTranslation: "Я купую хліб щоранку.",
        gloss: {
          Αγοράζω: "купую",
          ψωμί: "хліб",
          κάθε: "кожного",
          πρωί: "ранку",
        },
      },
      en: {
        translit: "[to pso-MI]",
        translation: "bread",
        exampleTranslation: "I buy bread every morning.",
        gloss: {
          Αγοράζω: "I buy",
          ψωμί: "bread",
          κάθε: "every",
          πρωί: "morning",
        },
      },
    },
  },

  ru: {
    word: "хлеб",
    example: "Я покупаю хлеб каждое утро.",
    native: {
      // Русский поверх русского — толкования, а не перевод (см. шапку).
      ru: {
        translit: "[хлеп]",
        translation: "выпечка из муки",
        exampleTranslation: "Каждый день начинается с похода в пекарню.",
        gloss: {
          Я: "тот, кто говорит",
          покупаю: "беру за деньги",
          хлеб: "выпечка из муки",
          каждое: "всякое, без пропусков",
          утро: "начало дня",
        },
      },
      uk: {
        translit: "[хлеп]",
        translation: "хліб",
        exampleTranslation: "Я купую хліб щоранку.",
        gloss: {
          Я: "я",
          покупаю: "купую",
          хлеб: "хліб",
          каждое: "кожного",
          утро: "ранку",
        },
      },
      en: {
        translit: "[KHLYEP]",
        translation: "bread",
        exampleTranslation: "I buy bread every morning.",
        gloss: {
          Я: "I",
          покупаю: "buy",
          хлеб: "bread",
          каждое: "every",
          утро: "morning",
        },
      },
    },
  },
};

// Язык демо, когда у пары нет заготовки. Такое бывает только у выключенного
// языка (напр. испанский у тех, кто выбрал его раньше): прогресс и генерация у
// них работают, а демо-карточки нет — показываем греческую, как было всегда.
const FALLBACK_LEARN = "el";

// Родной, на который падаем, если он вне ru/uk/en. Тот же английский, что и у
// интерфейса (см. i18n/index.js, UI_FALLBACK_LANG) — иначе демо было бы на
// одном языке, а кнопки вокруг него на другом.
const FALLBACK_NATIVE = "en";

/**
 * Демо-карточка для пары «изучаю → родной».
 *
 * @returns {{learnLang: string, card: object, gloss: Record<string, string>}}
 *   learnLang — язык, на котором В ИТОГЕ показан пример (может отличаться от
 *   запрошенного, если заготовки нет); card — в том же виде, что настоящая
 *   карточка колоды (WordCard/ExampleBlock); gloss — перевод слов примера.
 */
export function tutorialDemoCard(learnLang, nativeLang) {
  const lang = TUTORIAL_DEMO[learnLang] ? learnLang : FALLBACK_LEARN;
  const entry = TUTORIAL_DEMO[lang];
  const native = entry.native[nativeLang] || entry.native[FALLBACK_NATIVE];
  return {
    learnLang: lang,
    card: {
      word: entry.word,
      translit: native.translit,
      translation: native.translation,
      example: entry.example,
      exampleTranslation: native.exampleTranslation,
    },
    gloss: native.gloss,
  };
}

/**
 * Перевод одного слова примера. Регистр не важен: в примере слово может стоять
 * с большой буквы («Я», «Ich»), а в наборе — как в словаре.
 */
export function tutorialDemoGloss(gloss, word) {
  const key = String(word ?? "").trim();
  if (!key) return null;
  if (gloss[key]) return gloss[key];
  const lower = key.toLowerCase();
  const hit = Object.keys(gloss).find((k) => k.toLowerCase() === lower);
  return hit ? gloss[hit] : null;
}
