"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction } from "react";

type Box = { left: number; top: number; width: number; height: number };

/**
 * Multi-select by dragging, for row lists.
 * - Marquee: press on an element marked `data-selection-surface` and drag; every
 *   `[data-selection-row="<id>"]` the box touches is added to the selection.
 * - Checkbox sweep: press a row checkbox (`checkboxMouseDown(id)`) and move over other
 *   rows (`rowMouseEnter(id)`); they all take the pressed checkbox's new state.
 */
export function useDragSelect({
  selected,
  setSelected,
  disabled = false,
}: {
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  disabled?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<Box | null>(null);
  const suppressClick = useRef(false);
  const sweep = useRef<{ start: string; checked: boolean } | null>(null);

  useEffect(() => {
    const stop = () => { sweep.current = null; };
    window.addEventListener("mouseup", stop);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("blur", stop);
    };
  }, []);

  const setOne = useCallback((id: string, checked: boolean) => {
    setSelected((previous) => {
      if (previous.has(id) === checked) return previous;
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, [setSelected]);

  const onMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || disabled || !target.closest("[data-selection-surface]")) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = new Set(selected);
    let moved = false;
    const move = (moveEvent: MouseEvent) => {
      if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 6) return;
      moved = true;
      const left = Math.min(startX, moveEvent.clientX);
      const top = Math.min(startY, moveEvent.clientY);
      const right = Math.max(startX, moveEvent.clientX);
      const bottom = Math.max(startY, moveEvent.clientY);
      setSelectionBox({ left, top, width: right - left, height: bottom - top });
      const next = new Set(initial);
      listRef.current?.querySelectorAll<HTMLElement>("[data-selection-row]").forEach((element) => {
        const rect = element.getBoundingClientRect();
        const id = element.dataset.selectionRow;
        if (id && rect.left <= right && rect.right >= left && rect.top <= bottom && rect.bottom >= top) next.add(id);
      });
      setSelected(next);
    };
    const end = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      setSelectionBox(null);
      if (moved) {
        suppressClick.current = true;
        window.setTimeout(() => { suppressClick.current = false; }, 0);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  };

  const checkboxMouseDown = (id: string, event: ReactMouseEvent) => {
    if (event.button !== 0 || disabled) return;
    event.preventDefault();
    sweep.current = { start: id, checked: !selected.has(id) };
  };

  const rowMouseEnter = (id: string) => {
    const drag = sweep.current;
    if (!drag || drag.start === id || disabled) return;
    setOne(drag.start, drag.checked);
    setOne(id, drag.checked);
  };

  return {
    listRef,
    selectionBox,
    listProps: { ref: listRef, onMouseDown, onClickCapture },
    checkboxMouseDown,
    rowMouseEnter,
  };
}
