import { useRef, useEffect, useState } from "react";

// Свайп-жесты на карточке — ДОПОЛНЕНИЕ к кнопкам, не замена: те же действия
// доступны и тапом. Порог, после которого жест засчитывается как свайп.
export const SWIPE_THRESHOLD = 90;
const FLY_DISTANCE = 520;
const FLY_DURATION = 220;
const MAX_ROTATE = 12;

/**
 * Нативные (не React-synthetic) touch-слушатели через ref — нужны, чтобы
 * preventDefault() на touchmove реально работал (синтетический onTouchMove
 * в React вешается как passive и не может отменить скролл страницы).
 *
 * Направление жеста определяется один раз за касание (по первым ~6px
 * движения): если жест в основном вертикальный — считаем это скроллом
 * страницы и НЕ трогаем event.preventDefault(), чтобы страница листалась как
 * обычно. Если горизонтальный — карточка следует за пальцем 1:1.
 *
 * enabled=false просто не навешивает слушатели (например, пока ответ на
 * экране повторения ещё не открыт «Показать перевод»).
 */
export function useSwipeCard({ onSwipeLeft, onSwipeRight, enabled = true }) {
  const cardRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const draggingRef = useRef(false);
  const lockedAxisRef = useRef(null);
  const flyingRef = useRef(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !enabled) return;

    function handleTouchStart(e) {
      if (flyingRef.current) return;
      const t = e.touches[0];
      startXRef.current = t.clientX;
      startYRef.current = t.clientY;
      draggingRef.current = true;
      lockedAxisRef.current = null;
      setDragging(true);
    }

    function handleTouchMove(e) {
      if (!draggingRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - startXRef.current;
      const dy = t.clientY - startYRef.current;

      if (!lockedAxisRef.current) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        lockedAxisRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (lockedAxisRef.current !== "x") {
          // Вертикальный жест — отдаём странице как обычный скролл.
          draggingRef.current = false;
          setDragging(false);
          return;
        }
      }

      e.preventDefault();
      setDragX(dx);
    }

    function flingTo(direction) {
      flyingRef.current = true;
      setDragX(direction * FLY_DISTANCE);
      setTimeout(() => {
        if (direction > 0) onSwipeRight?.();
        else onSwipeLeft?.();
        setDragX(0);
        flyingRef.current = false;
      }, FLY_DURATION);
    }

    function finishGesture() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);

      setDragX((current) => {
        if (current > SWIPE_THRESHOLD) {
          flingTo(1);
        } else if (current < -SWIPE_THRESHOLD) {
          flingTo(-1);
        } else {
          return 0; // жест не дотянул до порога — карточка вернётся на место
        }
        return current;
      });
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", finishGesture);
    el.addEventListener("touchcancel", finishGesture);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", finishGesture);
      el.removeEventListener("touchcancel", finishGesture);
    };
  }, [enabled, onSwipeLeft, onSwipeRight]);

  const rotate = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, dragX / 12));
  const style = {
    transform: `translateX(${dragX}px) rotate(${rotate}deg)`,
    transition: dragging ? "none" : "transform 0.25s ease",
  };

  return { cardRef, dragX, dragging, style };
}
