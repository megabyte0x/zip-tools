export type PaginatedResults<T> = {
  items: T[];
  page: number;
  pageCount: number;
  start: number;
  end: number;
};

export function paginateResults<T>(
  items: T[],
  requestedPage: number,
  pageSize = 25,
): PaginatedResults<T> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError("pageSize must be a positive integer");
  }

  const pageCount = Math.ceil(items.length / pageSize);
  const page = pageCount === 0
    ? 1
    : Math.min(Math.max(1, Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1), pageCount);
  const start = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, items.length);

  return {
    items: items.slice(start === 0 ? 0 : start - 1, end),
    page,
    pageCount,
    start,
    end,
  };
}
