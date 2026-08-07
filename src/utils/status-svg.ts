export const VALID_STATUSES = new Set(["Backlog", "Todo", "In Progress", "Done", "Cancelled"]);

export function statusToClass(status: string): string {
  switch (status) {
    case "Backlog":     return 'ffc-status-backlog';
    case "Todo":        return 'ffc-status-todo';
    case "In Progress": return 'ffc-status-in-progress';
    case "Done":        return 'ffc-status-done';
    case "Cancelled":   return 'ffc-status-cancelled';
    default:            return '';
  }
}

const STATUS_SVG_MARKUP: Record<string, string> = {
  "Backlog": `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#A1A1A1" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 4"/></svg>`,
  "Todo": `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#A1A1A1" stroke-width="2" stroke-linecap="round"/></svg>`,
  "In Progress": `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#BD8E37" stroke-width="2" stroke-linecap="round"/><path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6V18Z" fill="#BD8E37"/></svg>`,
  "Done": `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM15.707 9.29297C15.3165 8.90244 14.6835 8.90244 14.293 9.29297L11 12.5859L9.70703 11.293C9.31651 10.9024 8.68349 10.9024 8.29297 11.293C7.90244 11.6835 7.90244 12.3165 8.29297 12.707L10.293 14.707C10.6835 15.0976 11.3165 15.0976 11.707 14.707L15.707 10.707C16.0976 10.3165 16.0976 9.68349 15.707 9.29297Z" fill="#8E68F5"/></svg>`,
  "Cancelled": `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM15.707 8.29297C15.3165 7.90244 14.6835 7.90244 14.293 8.29297L12 10.5859L9.70703 8.29297C9.31651 7.90244 8.68349 7.90244 8.29297 8.29297C7.90244 8.68349 7.90244 9.31651 8.29297 9.70703L10.5859 12L8.29297 14.293C7.90244 14.6835 7.90244 15.3165 8.29297 15.707C8.68349 16.0976 9.31651 16.0976 9.70703 15.707L12 13.4141L14.293 15.707C14.6835 16.0976 15.3165 16.0976 15.707 15.707C16.0976 15.3165 16.0976 14.6835 15.707 14.293L13.4141 12L15.707 9.70703C16.0976 9.31651 16.0976 8.68349 15.707 8.29297Z" fill="#A1A1A1"/></svg>`,
};

const parser = new DOMParser();
const statusSvgElCache = new Map<string, SVGElement>();

/**
 * Returns a fresh SVG element for the given status, built via DOMParser
 * rather than string concatenation so callers never need `innerHTML`.
 */
export function statusSvg(status: string): SVGElement | null {
  const cached = statusSvgElCache.get(status);
  if (cached) return cached.cloneNode(true) as SVGElement;

  const markup = STATUS_SVG_MARKUP[status];
  if (!markup) return null;

  const svg = parser.parseFromString(markup, 'image/svg+xml').documentElement as unknown as SVGElement;
  statusSvgElCache.set(status, svg);
  return svg.cloneNode(true) as SVGElement;
}
