/**
 * Tour page definitions — ordered to define the full tour sequence.
 * Each step uses a data-tour attribute selector.
 */
export const tourPages = [
  {
    path: '/',
    pageKey: 'dashboard',
    steps: [
      { selector: '[data-tour="stats-grid"]',       titleKey: 'tour.dashboard.stats.title',        bodyKey: 'tour.dashboard.stats.body' },
      { selector: '[data-tour="pnl-cards"]',         titleKey: 'tour.dashboard.pnl.title',          bodyKey: 'tour.dashboard.pnl.body' },
      { selector: '[data-tour="occupancy-chart"]',   titleKey: 'tour.dashboard.chart.title',        bodyKey: 'tour.dashboard.chart.body' },
      { selector: '[data-tour="console-status-grid"]', titleKey: 'tour.dashboard.consoleGrid.title', bodyKey: 'tour.dashboard.consoleGrid.body' },
      { selector: '[data-tour="active-sessions"]',   titleKey: 'tour.dashboard.activeSessions.title', bodyKey: 'tour.dashboard.activeSessions.body' },
    ],
  },
  {
    path: '/consoles',
    pageKey: 'consoles',
    steps: [
      { selector: '[data-tour="console-list"]',      titleKey: 'tour.consoles.list.title',   bodyKey: 'tour.consoles.list.body' },
      { selector: '[data-tour="add-console"]',       titleKey: 'tour.consoles.add.title',    bodyKey: 'tour.consoles.add.body' },
      { selector: '[data-tour="start-session"]',     titleKey: 'tour.consoles.start.title',  bodyKey: 'tour.consoles.start.body' },
      { selector: '[data-tour="status-indicators"]', titleKey: 'tour.consoles.status.title', bodyKey: 'tour.consoles.status.body' },
    ],
  },
  {
    path: '/sessions',
    pageKey: 'sessions',
    steps: [
      { selector: '[data-tour="earnings-summary"]',  titleKey: 'tour.sessions.earnings.title', bodyKey: 'tour.sessions.earnings.body' },
      { selector: '[data-tour="filter-tabs"]',       titleKey: 'tour.sessions.filters.title',  bodyKey: 'tour.sessions.filters.body' },
      { selector: '[data-tour="sessions-list"]',     titleKey: 'tour.sessions.list.title',     bodyKey: 'tour.sessions.list.body' },
    ],
  },
  {
    path: '/players',
    pageKey: 'players',
    steps: [
      { selector: '[data-tour="player-list"]',  titleKey: 'tour.players.list.title',  bodyKey: 'tour.players.list.body' },
      { selector: '[data-tour="add-player"]',   titleKey: 'tour.players.add.title',   bodyKey: 'tour.players.add.body' },
      { selector: '[data-tour="player-stats"]', titleKey: 'tour.players.stats.title', bodyKey: 'tour.players.stats.body' },
    ],
  },
  {
    path: '/expenses',
    pageKey: 'expenses',
    steps: [
      { selector: '[data-tour="expense-list"]',     titleKey: 'tour.expenses.list.title',       bodyKey: 'tour.expenses.list.body' },
      { selector: '[data-tour="add-expense"]',      titleKey: 'tour.expenses.add.title',        bodyKey: 'tour.expenses.add.body' },
      { selector: '[data-tour="category-labels"]',  titleKey: 'tour.expenses.categories.title', bodyKey: 'tour.expenses.categories.body' },
    ],
  },
  {
    path: '/analytics',
    pageKey: 'analytics',
    steps: [
      { selector: '[data-tour="charts"]',      titleKey: 'tour.analytics.charts.title', bodyKey: 'tour.analytics.charts.body' },
      { selector: '[data-tour="date-filter"]', titleKey: 'tour.analytics.filter.title', bodyKey: 'tour.analytics.filter.body' },
    ],
  },
  {
    path: '/report',
    pageKey: 'report',
    steps: [
      { selector: '[data-tour="report-sections"]',  titleKey: 'tour.report.sections.title',  bodyKey: 'tour.report.sections.body' },
      { selector: '[data-tour="date-range"]',        titleKey: 'tour.report.dateRange.title', bodyKey: 'tour.report.dateRange.body' },
      { selector: '[data-tour="export-controls"]',   titleKey: 'tour.report.export.title',    bodyKey: 'tour.report.export.body' },
    ],
  },
  {
    path: '/settings',
    pageKey: 'settings',
    steps: [
      { selector: '[data-tour="pricing-form"]',  titleKey: 'tour.settings.pricing.title',  bodyKey: 'tour.settings.pricing.body' },
      { selector: '[data-tour="currency-field"]', titleKey: 'tour.settings.currency.title', bodyKey: 'tour.settings.currency.body' },
      { selector: '[data-tour="restart-tour"]',  titleKey: 'tour.settings.restart.title',  bodyKey: 'tour.settings.restart.body' },
    ],
  },
];
