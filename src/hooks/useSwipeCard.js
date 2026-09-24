import { useRef, useEffect, useState } from "react";

// Свайп-жесты на карточке новых слов: вправо — Взять, влево — Знаю (кнопок
// для этих действий нет, свайп — основной способ). Порог, после которого
// жест засчитывается как свайп.
export const SWIPE_THRESHOLD = 90;
const FLY_DISTANCE = 520;
const FLY_DURATION = 220;
const MAX_ROTATE = 12;

/**
 * Начался ли жест внутри области, которая сама прокручивается вбок (таблица
 * спряжения в карточке — `.conj__table-wrap`). Такой жест принадлежит этой
 * области, а не карточке: иначе попытка посмотреть спряжение уезжает в свайп,
 * то есть в «Знаю»/«Взять», и слово разбирается случайно.
 *
 * Проверяем не класс, а саму способность прокручиваться: элемент с
 * `overflow-x: auto|scroll`, у которого содержимое ШИРЕ видимой части. Когда
 * таблица помещается целиком (широкий экран), прокручивать нечего — жест
 * остаётся свайпом карточки, как раньше. Запас в 1px — от дробных ширин при
 * масштабировании.
 *
 * Идём от точки касания вверх до самой карточки (её не проверяем — она не
 * прокручиваемая), поэтому правило работает для любой такой области, а не
 * только для спряжения.
 */
function startsInHorizontalScroller(target, root) {
  let node = target instanceof Element ? target : null;
  while (node && node !== root) {
    if (node.scrollWidth - node.clientWidth > 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

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
 * Жест, начатый внутри области с собственной горизонтальной прокруткой
 * (таблица спряжения), карточке не принадлежит — см.
 * startsInHorizontalScroller.
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
      // Жест из прокручиваемой вбок области (таблица спряжения) — не наш:
      // карточка за пальцем не идёт, браузер листает эту область сам.
      if (startsInHorizontalScroller(e.target, el)) {
        draggingRef.current = false;
        return;
      }
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
