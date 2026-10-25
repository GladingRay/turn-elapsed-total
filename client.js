/**
 * Client half of the session total-time bundle.
 *
 * Reads the Host's whole-log `turnElapsedTotal` projection (so paging and
 * compaction cannot shrink the figure) and renders it as a quiet stat pill in
 * the composer footer, before the shipped activity and usage pills. Every
 * completed Turn adds its wall time; a Turn still streaming is not counted
 * until its `turn/end` lands.
 */
window.__ModuleLoader__.load({
  id: '@local/turn-elapsed-total',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'turn-elapsed-total';

    /** Runtime dictionaries; metadata lives in locale/<id>.json. */
    const zh = {
      'total.label': '总耗时 {duration}',
      'total.title': '已完成 {turns} 轮',
      'duration.seconds': '{value} 秒',
      'duration.minutes': '{minutes} 分 {seconds} 秒',
      'duration.hours': '{hours} 小时 {minutes} 分',
    };
    const en = {
      'total.label': 'Total time {duration}',
      'total.title': 'Completed turns: {turns}',
      'duration.seconds': '{value}s',
      'duration.minutes': '{minutes}m {seconds}s',
      'duration.hours': '{hours}h {minutes}m',
    };

    /** Two-digit padding for the subordinate unit. */
    function pad2(value) {
      return value < 10 ? `0${value}` : String(value);
    }

    /**
     * Humanize a non-negative duration, matching the host's compact style.
     * @param ms - elapsed milliseconds.
     * @param t - locale seat.
     * @returns localized duration text.
     */
    function formatDuration(ms, t) {
      const elapsed = Math.max(0, ms);
      if (elapsed < 60000) {
        const seconds = elapsed / 1000;
        const value = seconds < 10 ? seconds.toFixed(1) : String(Math.round(seconds));
        return t('duration.seconds', { value });
      }
      const total = Math.round(elapsed / 1000);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor(total / 60) % 60;
      if (hours > 0) {
        return t('duration.hours', { hours: String(hours), minutes: pad2(minutes) });
      }
      return t('duration.minutes', {
        minutes: String(minutes),
        seconds: pad2(total % 60),
      });
    }

    /** Decorative clock matching the surrounding stat pills. */
    function ClockGlyph({ size = 14 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          'aria-hidden': true,
          focusable: 'false',
          style: { display: 'block', flex: '0 0 auto' },
        },
        h('circle', {
          cx: 8,
          cy: 8,
          r: 6.25,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
        }),
        h('path', {
          d: 'M8 4.75V8l2.25 1.5',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    /** Typography and spacing copied from the host's stat pill row. */
    const pillStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      flex: '0 1 auto',
      minWidth: 0,
      maxWidth: '100%',
      padding: '1px 8px',
      color: 'var(--dsw-alias-label-tertiary)',
      fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 1px)',
      lineHeight: 'calc(20px + var(--dsh-content-font-delta-secondary, 0px))',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
    };

    /**
     * Whole-session total of settled Turn durations.
     * @param props - standard seat props, including the projection reader and locale seat.
     * @returns the stat pill, or null before the first Turn settles.
     */
    function TotalElapsed({ useProjection, t }) {
      const total = useProjection('turnElapsedTotal');
      if (total === undefined || total === null || total.turns === 0) return null;
      return h(
        'span',
        {
          'data-turn-elapsed-total': '',
          style: pillStyle,
          title: t('total.title', { turns: total.turns }),
        },
        h(ClockGlyph, { size: 14 }),
        h(
          'span',
          { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } },
          t('total.label', { duration: formatDuration(total.totalMs, t) }),
        ),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { zh, en }),
          'turn-elapsed-total: dictionaries',
        );
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'turn-elapsed-total',
          order: -10,
          locale: NS,
        }, TotalElapsed));
      },
    };
  },
});
