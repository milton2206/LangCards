import "./StartScreen.css";

export default function StartScreen({ onStart }) {
  return (
    <section className="start" aria-labelledby="start-title">
      <div className="start__badge">🗂️ LangCards</div>

      <div className="start__body">
        <h1 id="start-title" className="start__title">
          Карточки — учи слова в контексте
        </h1>
        <p className="start__subtitle">
          Запоминай иностранные слова не по отдельности, а внутри живых
          примеров — так они остаются в памяти надолго.
        </p>
      </div>

      <div className="start__footer">
        <span className="start__status" role="status">
          Приложение в разработке
        </span>
        <button type="button" className="start__cta" onClick={onStart}>
          Настроить обучение
        </button>
      </div>
    </section>
  );
}
