/**
 * Page geometry for the PDFs. Pure arithmetic — no JSX, no react-pdf.
 *
 * This module exists because of three bugs in the first lookbook, all of which
 * came from the layout being decided inside the render:
 *
 *  1. Grey bands around photos. Pictures were poured into fixed-ratio boxes, so
 *     anything that wasn't the assumed 4:5 was either cropped or matted against
 *     the page. Here a photo's frame is *derived from the photo*: rows are
 *     justified to the exact content width and the row's height falls out of the
 *     aspect ratios in it, the way a printed contact sheet works. Nothing is
 *     letterboxed because nothing is forced into a shape it doesn't have.
 *
 *  2. Half-empty pages. A gallery of five photos filled one page and left the
 *     next three-quarters blank. Rows are now packed against a known height
 *     budget and the leftover space is distributed *between* rows rather than
 *     dumped at the bottom.
 *
 *  3. An index that pointed at the wrong pages. The old code assumed the index
 *     was exactly one sheet and started counting articles at page 3; past about
 *     twenty-five articles the index spilled over and every number in it was
 *     wrong. Page counts are now computed here, before anything renders, and
 *     the renderer is handed the finished plan — so the numbers cannot drift
 *     from what is actually printed.
 *
 * Every constant below is duplicated by nothing: documents.tsx imports these
 * rather than re-declaring its own, which is what keeps the plan and the print
 * in agreement.
 */

export const A4 = { width: 595.28, height: 841.89 } as const;

export const MARGIN = 46;
/** Content width between the margins. */
export const CONTENT = A4.width - MARGIN * 2;
/** Reserved strip at the foot of every page for the wordmark and folio. */
export const FOOTER_SPACE = 62;
/**
 * Slack kept between the content and the true bottom of the page.
 *
 * react-pdf breaks a page when content is *at or over* the limit, and its
 * measurements differ from these by fractions of a point. Filling the body to
 * the last point therefore spills a second, near-empty sheet after every
 * article — and every folio after it, including the ones printed in the index,
 * shifts by one. Six points is invisible and makes that impossible.
 */
const SAFETY = 6;
/** Usable height between the top margin and the footer strip. */
export const BODY = A4.height - MARGIN - FOOTER_SPACE - SAFETY;

/** Height of the white band carrying the wordmark on a cover. */
export const COVER_BAND = 172;
/** Height of the photograph on a cover: everything above the band. */
export const COVER_IMAGE = A4.height - COVER_BAND - SAFETY;

/** Gap between photos, horizontally and vertically. */
export const GUTTER = 10;

/* Heights of the fixed furniture, measured from the rendered type sizes.
 * If you change a heading in documents.tsx, change its budget here too — the
 * page-count arithmetic depends on these being honest, and a budget that is
 * too small pushes content onto an extra sheet, which would put every folio in
 * the index out by one. Each is set a little above the measured height so a
 * rounding difference can never tip a page over. */
export const INDEX_HEAD = 58;
export const MOSAIC_HEAD = 42;

/** Two-column split on an article page: picture column, gutter, spec column. */
export const HERO_COL = CONTENT * 0.46;
export const SPEC_COL = CONTENT * 0.5;
export const COLUMN_GAP = CONTENT - HERO_COL - SPEC_COL;

/**
 * Height of both columns on an article page.
 *
 * The article's heading sits at the top of the spec column rather than in a
 * band across the page, so the columns get the full body height — the earlier
 * layout reserved a strip for a heading that no longer exists there and left
 * seventy points of nothing above the footer on every single page.
 */
export const COLUMN_HEIGHT = BODY;

/** A hero may not eat the whole column — thumbnails need somewhere to live. */
const HERO_MAX_SHARE = 0.74;
/** Nor may it be a stamp when the photo is a wide landscape. */
const HERO_MIN_HEIGHT = 190;

/** Row heights aimed for. Actual heights come out of the aspect ratios. */
const MOSAIC_TARGET = 212;
/**
 * Smallest a thumbnail may be before it stops being worth printing. Photos
 * that would have to go below this are given a full-width page of their own
 * instead of being shrunk into confetti.
 */
const MIN_THUMB = 76;
/** A single wide photo on its own row would otherwise become absurdly tall. */
const ROW_MAX_HEIGHT = 420;

/** Portrait, the safe assumption for a garment shot we couldn't measure. */
export const FALLBACK_ASPECT = 0.75;

/* ------------------------------------------------------------------ types */

/** Anything that knows its own shape can be laid out. */
export interface Sized {
  /** width ÷ height. Portrait is < 1. */
  aspect: number;
}

export interface Tile<T> {
  item: T;
  width: number;
  height: number;
}

export interface Row<T> {
  tiles: Tile<T>[];
  height: number;
}

/* ------------------------------------------------------------ justification */

/**
 * Packs items into rows that each span `width` exactly.
 *
 * This is the same idea a photo grid uses: keep adding pictures to the row
 * until, scaled to a common height, they fill the width — then fix that
 * height and move on. Because the height is solved for rather than assumed,
 * every picture keeps its own proportions and no picture needs a background
 * behind it.
 *
 * The final row usually has fewer items than it needs to fill the width. It is
 * allowed to run taller instead, up to `ROW_MAX_HEIGHT`, so it still reaches
 * both margins; only a single very wide photo hits that ceiling and is then
 * centred by the renderer.
 */
export function justify<T extends Sized>(
  items: T[],
  width: number,
  target: number,
  gap: number = GUTTER,
): Row<T>[] {
  const rows: Row<T>[] = [];
  let run: T[] = [];
  let aspectSum = 0;

  const close = (list: T[], sum: number, cap: number) => {
    if (!list.length) return;
    const free = width - gap * (list.length - 1);
    const height = Math.min(free / sum, cap);
    rows.push({
      tiles: list.map((item) => ({
        item,
        width: height * item.aspect,
        height,
      })),
      height,
    });
  };

  for (const item of items) {
    run.push(item);
    aspectSum += item.aspect || FALLBACK_ASPECT;
    const free = width - gap * (run.length - 1);
    // Once the run would be shorter than the target it is wide enough to fill
    // the line, so stop here rather than squeezing another picture in.
    if (free / aspectSum <= target) {
      close(run, aspectSum, target);
      run = [];
      aspectSum = 0;
    }
  }
  close(run, aspectSum, ROW_MAX_HEIGHT);

  return rows;
}

/** Total height a run of rows occupies, gaps included. */
export function stackHeight<T>(rows: Row<T>[], gap: number = GUTTER): number {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + row.height, 0) + gap * (rows.length - 1);
}

/**
 * Splits rows across pages of `available` height.
 *
 * A row is never broken; if one cannot fit an empty page it is placed anyway,
 * because dropping a customer's photograph silently would be worse than a
 * slightly tight page.
 */
export function paginateRows<T>(
  rows: Row<T>[],
  available: number,
  gap: number = GUTTER,
): Row<T>[][] {
  const pages: Row<T>[][] = [];
  let page: Row<T>[] = [];
  let used = 0;

  for (const row of rows) {
    const cost = row.height + (page.length ? gap : 0);
    if (page.length && used + cost > available) {
      pages.push(page);
      page = [row];
      used = row.height;
    } else {
      page.push(row);
      used += cost;
    }
  }
  if (page.length) pages.push(page);
  return pages;
}

/* -------------------------------------------------------- article geometry */

export interface ArticlePlan<P extends Sized> {
  hero: P | null;
  heroHeight: number;
  /** Thumbnails that fit under the hero, in the picture column. */
  columnRows: Row<P>[];
  /** Everything that didn't fit, already split into full-width pages. */
  overflowPages: Row<P>[][];
  /** 1 for the article's own page, plus one per overflow page. */
  pageCount: number;
}

/**
 * Decides how one article's photographs are arranged.
 *
 * The picture column is filled to its full height: the hero takes its natural
 * proportions, and thumbnails fill whatever remains beneath it. Photos that
 * still don't fit spill onto full-width pages rather than being dropped or
 * shrunk into illegibility.
 */
export function planArticle<P extends Sized>(photos: P[]): ArticlePlan<P> {
  const hero = photos[0] ?? null;
  if (!hero) {
    return { hero: null, heroHeight: 0, columnRows: [], overflowPages: [], pageCount: 1 };
  }

  const natural = HERO_COL / (hero.aspect || FALLBACK_ASPECT);
  const heroHeight = clamp(
    natural,
    Math.min(HERO_MIN_HEIGHT, COLUMN_HEIGHT),
    COLUMN_HEIGHT * HERO_MAX_SHARE,
  );

  const rest = photos.slice(1);
  const roomBelow = COLUMN_HEIGHT - heroHeight - GUTTER;

  let columnRows: Row<P>[] = [];
  let remaining = rest;

  if (roomBelow > MIN_THUMB && rest.length) {
    // Rather than assume a thumbnail height and leave whatever is left over as
    // a hole above the footer, solve for the tallest rows that still fit the
    // space beneath the hero. Thumbnails are capped at the hero's own height so
    // the hero stays the picture the page is about.
    const fitted = fillHeight(rest, HERO_COL, roomBelow, MIN_THUMB, heroHeight);

    if (fitted) {
      columnRows = fitted;
      remaining = [];
    } else {
      // Too many photographs to show legibly in one column: fill it with as
      // many as fit at the minimum size and give the rest their own pages.
      let used = 0;
      let taken = 0;
      for (const row of justify(rest, HERO_COL, MIN_THUMB)) {
        const cost = row.height + (columnRows.length ? GUTTER : 0);
        if (used + cost > roomBelow) break;
        columnRows.push(row);
        used += cost;
        taken += row.tiles.length;
      }
      remaining = rest.slice(taken);
    }
  }

  const overflowPages = remaining.length
    ? paginateRows(
        justify(remaining, CONTENT, MOSAIC_TARGET),
        BODY - MOSAIC_HEAD,
      )
    : [];

  return {
    hero,
    heroHeight,
    columnRows,
    overflowPages,
    pageCount: 1 + overflowPages.length,
  };
}

/* ---------------------------------------------------------- index geometry */

const GROUP_HEAD = 24;
const INDEX_ROW = 16;
const GROUP_GAP = 12;

export interface IndexEntry<A> {
  article: A;
  startPage: number;
}

export interface IndexBlock<A> {
  collection: string;
  /** True when the collection's list was cut by a page break. */
  continued: boolean;
  entries: IndexEntry<A>[];
}

/**
 * Lays the index out across as many pages as it needs, splitting a long
 * collection across a page break rather than leaving a gaping hole at the foot
 * of a page — which is what `wrap={false}` used to do.
 *
 * Returns only the shape; page numbers are filled in afterwards, once the
 * number of index pages is known. That ordering is the whole point: the index
 * cannot cite a page number until it knows how long it is itself.
 */
export function planIndex<A>(
  groups: [string, A[]][],
): { pages: IndexBlock<A>[][] } {
  const available = BODY - INDEX_HEAD;
  const pages: IndexBlock<A>[][] = [];

  let page: IndexBlock<A>[] = [];
  let used = 0;

  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
  };

  for (const [collection, articles] of groups) {
    let queue = articles;
    let continued = false;

    while (queue.length) {
      const overhead = GROUP_HEAD + (page.length ? GROUP_GAP : 0);
      const room = available - used - overhead;
      const fits = Math.floor(room / INDEX_ROW);

      // Not enough room for a heading and at least two lines under it — a
      // heading stranded at the foot of a page is the classic widow.
      if (fits < 2) {
        flush();
        continue;
      }

      const take = Math.min(fits, queue.length);
      page.push({
        collection,
        continued,
        entries: queue.slice(0, take).map((article) => ({ article, startPage: 0 })),
      });
      used += overhead + take * INDEX_ROW;
      queue = queue.slice(take);
      continued = true;
    }
  }
  flush();

  return { pages: pages.length ? pages : [[]] };
}

/**
 * Finds the tallest justified rows that hold *every* item inside `room`.
 *
 * Row height rises with the target, so the search is a plain bisection: the
 * largest target that still fits is the one that leaves the least dead space.
 * Returns null when even the smallest allowed row overflows — the caller then
 * knows this article has more photographs than one column can carry.
 */
function fillHeight<T extends Sized>(
  items: T[],
  width: number,
  room: number,
  min: number,
  max: number,
): Row<T>[] | null {
  const ceiling = Math.max(min, Math.min(max, room));
  const fits = (target: number) => {
    const rows = justify(items, width, target);
    return stackHeight(rows) <= room ? rows : null;
  };

  const smallest = fits(min);
  if (!smallest) return null;

  let low = min;
  let high = ceiling;
  let best = smallest;
  // ~0.1pt of precision is far finer than anything visible in print.
  for (let i = 0; i < 24 && high - low > 0.1; i += 1) {
    const mid = (low + high) / 2;
    const rows = fits(mid);
    if (rows) {
      best = rows;
      low = mid;
    } else {
      high = mid;
    }
  }
  return best;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
