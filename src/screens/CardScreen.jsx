import { useState } from "react";
import { CARDS } from "../data/cards.js";
import "./CardScreen.css";

/**
 * Главный экран: показывает карточки по одной.
 * Слово всегда даётся в контексте примера. Пока один переход — «Дальше»
 * (три действия взять/пропустить/знаю появятся в следующей фазе).
 * Когда карточки кончились — экран «На сегодня всё».
 */
export default function CardScreen({ onOpenSettings }) {
  const [index, setIndex] = useState(0);
  const total = CARDS.length;

  if (index >= total) {
    return (
      <section className="cards cards--done">
        <div className="cards__done-emoji" aria-hidden="true">
          🎉
        </div>
        <h1 className="cards__done-title">На сегодня всё</h1>
        <p className="cards__done-hint">
          Вы просмотрели все {total} карточек. Возвращайтесь завтра за новой
          порцией слов!
        </p>
        <button
          type="button"
          className="cards__restart"
          onClick={() => setIndex(0)}
        >
          Пройти заново
        </button>
      </section>
    );
  }

  const card = CARDS[index];

  return (
    <section className="cards" aria-labelledby="card-word">
      <header className="cards__header">
        <span className="cards__progress">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          className="cards__settings"
          onClick={onOpenSettings}
          aria-label="Настройки"
        >
          ⚙️
        </button>
      </header>

      <div className="cards__progressbar" aria-hidden="true">
        <span
          className="cards__progressbar-fill"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <article className="cards__card">
        <div className="cards__word-block">
          <h1 id="card-word" className="cards__word">
            {card.word}
          </h1>
          {card.translit && (
            <p className="cards__translit">{card.translit}</p>
          )}
          <p className="cards__translation">{card.translation}</p>
        </div>

        <div className="cards__divider" />

        <div className="cards__example">
          <span className="cards__example-label">Пример</span>
          <p className="cards__example-text">{card.example}</p>
          <p className="cards__example-translation">
            {card.exampleTranslation}
          </p>
        </div>
      </article>

      <div className="cards__footer">
        <button
          type="button"
          className="cards__next"
          onClick={() => setIndex((i) => i + 1)}
        >
          Дальше
        </button>
      </div>
    </section>
  );
}
