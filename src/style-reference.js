export function styleReferenceLocation(command) {
  const match = String(command || '').match(/\bsame\s+style(?:\s+(?:button|as\s+(?:the\s+)?button))?\s+as\s+(\d+)\s*[/.]\s*(\d+)\s*[/.]\s*(\d+)\b/i)
    || String(command || '').match(/\bcopy\s+(?:the\s+)?style\s+from\s+(\d+)\s*[/.]\s*(\d+)\s*[/.]\s*(\d+)\b/i);
  return match ? { page: Number(match[1]), row: Number(match[2]), column: Number(match[3]) } : null;
}

export function applyReferencedStyle(plan, source) {
  if (!plan?.button?.appearance || !source) return plan;
  plan.button.appearance = {
    ...plan.button.appearance,
    textColor: source.textColor,
    backgroundColor: source.backgroundColor,
    textSize: source.textSize ?? 'auto',
  };
  plan.styleSource = { page: source.page, row: source.row, column: source.column };
  return plan;
}
