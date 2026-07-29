import "./AppShell.css";

/**
 * Каркас приложения: центрирует содержимое по горизонтали
 * и ограничивает ширину на десктопе (mobile-first).
 *
 * ember — ТОЛЬКО фон каркаса: на экранах, уже переведённых на дизайн Ember,
 * красим каркас (и его отступы/рамку на десктопе) тёплым фоном темы, чтобы
 * вокруг экрана не было холодной каймы старого фона. Не-Ember экраны (повторение,
 * добавление слова, вход и т.п.) проп не получают и остаются на прежнем фоне.
 */
export default function AppShell({ children, ember = false }) {
  return (
    <div className={"app-shell" + (ember ? " app-shell--ember" : "")}>
      <main className="app-shell__inner">{children}</main>
    </div>
  );
}
