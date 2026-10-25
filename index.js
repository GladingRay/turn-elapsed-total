/**
 * Host half of the session total-time bundle.
 *
 * The Client cannot sum every turn from its paged conversation window, so the
 * whole-log total is folded here, on the Session projection seam: every
 * committed `turn/start` opens a boundary, every matching `turn/end` adds its
 * wall time, and the finished `{ totalMs, turns }` value reaches the Client as
 * a wire view. Paging, compaction, reload, resume, and fork all keep the same
 * figure because the fold only reads the durable log.
 */
/** Cordis plugin name. */
export const name = 'turn-elapsed-total';

/** The projection registry is this plugin's delivery channel. */
export const inject = ['sessionProjections'];

/** @param {unknown} value - candidate number. */
function assertNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`turnElapsedTotal ${field} must be a non-negative finite number`);
  }
}

/** @param {unknown} value - candidate integer. */
function isNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Local structural validator; the registry only needs `parse`. */
function parseState(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('turnElapsedTotal state must be an object');
  }
  assertNonNegative(value.totalMs, 'totalMs');
  if (!isNonNegativeInteger(value.turns)) {
    throw new TypeError('turnElapsedTotal turns must be a non-negative integer');
  }
  if (value.openTurn !== null && !isNonNegativeInteger(value.openTurn)) {
    throw new TypeError('turnElapsedTotal openTurn must be null or a non-negative integer');
  }
  if (value.openStart !== null) assertNonNegative(value.openStart, 'openStart');
  return value;
}

/** Local structural validator for the client-visible value. */
function parseView(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('turnElapsedTotal view must be an object');
  }
  assertNonNegative(value.totalMs, 'totalMs');
  if (!isNonNegativeInteger(value.turns)) {
    throw new TypeError('turnElapsedTotal view turns must be a non-negative integer');
  }
  return value;
}

/** Persisted fold state: closed totals plus the currently open turn boundary. */
const stateSchema = { parse: parseState };

/** Client-visible value: only the settled figures, never the open boundary. */
const viewSchema = { parse: parseView };

/**
 * Sum completed Turn wall time over the whole Session log.
 *
 * A Turn contributes when its `turn/end` matches the open `turn/start`; an
 * unmatched end (a truncated or repaired boundary) is ignored rather than
 * guessed. Unrelated events return the same state reference, so the registry
 * does no downstream work for them.
 */
const turnElapsedTotal = {
  key: 'turnElapsedTotal',
  stateVersion: 1,
  stateSchema,
  init: () => ({
    totalMs: 0,
    turns: 0,
    openTurn: null,
    openStart: null,
  }),
  apply(state, event) {
    if (event.type === 'turn/start') {
      return {
        ...state,
        openTurn: event.data.turn,
        openStart: event.time,
      };
    }
    if (event.type === 'turn/end') {
      if (state.openStart === null || state.openTurn !== event.data.turn) return state;
      return {
        ...state,
        totalMs: state.totalMs + Math.max(0, event.time - state.openStart),
        turns: state.turns + 1,
        openTurn: null,
        openStart: null,
      };
    }
    return state;
  },
  wire: {
    viewSchema,
    view: (state) => ({
      totalMs: state.totalMs,
      turns: state.turns,
    }),
  },
};

/**
 * Register the whole-log turn-duration fold.
 * @param ctx - owning Host context carrying the projection registry.
 */
export function apply(ctx) {
  ctx.sessionProjections.register(turnElapsedTotal);
}
