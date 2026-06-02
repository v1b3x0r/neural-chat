// Shared DOM builder — createElement + textContent only (never innerHTML with data),
// so user-provided persona names and fetched model ids can never be injected as HTML.
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  kids: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
}
