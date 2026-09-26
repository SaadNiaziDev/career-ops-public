import { useEffect, type RefObject } from "react";

/** Keep keyboard focus inside an open modal and restore it to the opener. */
export function useDialogFocus<T extends HTMLElement>(open: boolean, ref: RefObject<T | null>) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const changed: { node: HTMLElement; inert: boolean; ariaHidden: string | null }[] = [];
    let child: HTMLElement = dialog;
    while (child.parentElement && child.parentElement !== document.body) {
      const parent = child.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === child || !(sibling instanceof HTMLElement)) continue;
        changed.push({ node: sibling, inert: sibling.inert, ariaHidden: sibling.getAttribute("aria-hidden") });
        sibling.inert = true;
        sibling.setAttribute("aria-hidden", "true");
      }
      child = parent;
    }

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((el) => !el.hidden && el.getAttribute("aria-hidden") !== "true");
    const first = focusable()[0];
    (first ?? dialog).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === firstItem || !dialog.contains(document.activeElement))) {
        event.preventDefault(); lastItem.focus();
      } else if (!event.shiftKey && (document.activeElement === lastItem || !dialog.contains(document.activeElement))) {
        event.preventDefault(); firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      for (const item of changed.reverse()) {
        item.node.inert = item.inert;
        if (item.ariaHidden === null) item.node.removeAttribute("aria-hidden");
        else item.node.setAttribute("aria-hidden", item.ariaHidden);
      }
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, ref]);
}
