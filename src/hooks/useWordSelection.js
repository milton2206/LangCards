import { useState, useCallback } from "react";

/**
 * Режим выбора для списков слов («Мои слова» / «Известные слова»):
 * включение/выключение, набор выбранных слов, тоггл, окно подтверждения
 * удаления. Логика одинакова для обоих экранов — держим в одном месте.
 */
export function useWordSelection() {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const enter = useCallback(() => setSelectMode(true), []);

  // Полный сброс режима выбора (выход без удаления).
  const cancel = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmOpen(false);
  }, []);

  const toggle = useCallback((word) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }, []);

  const openConfirm = useCallback(() => setConfirmOpen(true), []);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);

  return {
    selectMode,
    selected,
    confirmOpen,
    enter,
    cancel,
    toggle,
    openConfirm,
    closeConfirm,
  };
}
