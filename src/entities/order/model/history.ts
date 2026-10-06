import type { OrderHistoryEntry } from './types';

const EMPLOYEE_MARKER = /\[employee_id:(\d+)\]/g;

export interface ParsedHistoryComment {
  text: string;
  employeeId: number | null;
}

export function parseHistoryComment(comment: string | null | undefined): ParsedHistoryComment {
  if (!comment) return { text: '', employeeId: null };
  let employeeId: number | null = null;
  const text = comment
    .replace(EMPLOYEE_MARKER, (_match, id: string) => {
      employeeId = Number(id);
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { text, employeeId };
}

export function sortHistoryAscending(entries: OrderHistoryEntry[]): OrderHistoryEntry[] {
  return [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}
