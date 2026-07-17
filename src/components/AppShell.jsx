import "./AppShell.css";

/**
 * Каркас приложения: центрирует содержимое по горизонтали
 * и ограничивает ширину на десктопе (mobile-first).
 */
export default function AppShell({ children }) {
  return (
    <div className="app-shell">
      <main className="app-shell__inner">{children}</main>
    </div>
  );
}
