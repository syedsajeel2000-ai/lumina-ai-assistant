/* Central icon set — consistent 24x24 stroke icons, no external deps. */

const base = (props) => ({
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round',
  ...props
});

export const IconSpark = (p) => (
  <svg {...base(p)}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const IconMenu = (p) => (<svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16"/></svg>);
export const IconPlus = (p) => (<svg {...base(p)}><path d="M12 5v14M5 12h14"/></svg>);
export const IconChat = (p) => (<svg {...base(p)}><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.9 8.9 0 0 1-4-.9L3 20l1.2-4.3A8.3 8.3 0 1 1 21 11.5z"/></svg>);
export const IconHistory = (p) => (
  <svg {...base(p)}><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 3"/></svg>
);
export const IconBookmark = (p) => (
  <svg {...base(p)}><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
);
export const IconBookmarkFilled = (p) => (
  <svg {...base(p)}><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="currentColor"/></svg>
);
export const IconGrid = (p) => (
  <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
);
export const IconSettings = (p) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
export const IconHelp = (p) => (<svg {...base(p)}><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4"/><path d="M12 17h.01"/></svg>);
export const IconLogout = (p) => (
  <svg {...base(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
);
export const IconSend = (p) => (<svg {...base(p)}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>);
export const IconStop = (p) => (<svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/></svg>);
export const IconCopy = (p) => (
  <svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
);
export const IconCheckSimple = (p) => (<svg {...base(p)}><path d="M20 6L9 17l-5-5"/></svg>);
export const IconRefreshAlt = (p) => (
  <svg {...base(p)}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/></svg>
);
export const IconTrash = (p) => (
  <svg {...base(p)}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
);
export const IconEdit = (p) => (<svg {...base(p)}><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 3 21.5l1-4.5z"/></svg>);
export const IconClose = (p) => (<svg {...base(p)}><path d="M18 6L6 18M6 6l12 12"/></svg>);
export const IconGlobe = (p) => (<svg {...base(p)}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/></svg>);
export const IconSearch = (p) => (<svg {...base(p)}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>);
export const IconUserRound = (p) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
);
export const IconSun = (p) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
);
export const IconMoon = (p) => (<svg {...base(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>);
export const IconMonitor = (p) => (<svg {...base(p)}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>);
export const IconMail = (p) => (<svg {...base(p)}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>);
export const IconBriefcase = (p) => (<svg {...base(p)}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/></svg>);
export const IconMessage = (p) => (<svg {...base(p)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></svg>);
export const IconPen = (p) => (<svg {...base(p)}><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" opacity=".5"/></svg>);
export const IconBook = (p) => (<svg {...base(p)}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>);
export const IconBug = (p) => (
  <svg {...base(p)}><rect x="8" y="6" width="8" height="12" rx="4"/><path d="M12 6V3M8 8L5 6m3 6H2m6 4l-3 2m7-10l3-2m-3 6h5m-5 4l3 2"/></svg>
);
export const IconCode = (p) => (<svg {...base(p)}><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>);
export const IconZap = (p) => (<svg {...base(p)}><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg>);
export const IconRepeat = (p) => (
  <svg {...base(p)}><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4  0 0 1-4 4H3"/></svg>
);
export const IconFile = (p) => (<svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>);
export const IconList = (p) => (<svg {...base(p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>);
export const IconCalendar = (p) => (<svg {...base(p)}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>);
export const IconBulb = (p) => (
  <svg {...base(p)}><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>
);
export const IconThumbsUp = (p) => (
  <svg {...base(p)}><path d="M7 10v12M15 5.9L14 10h5.4a2 2 0 0 1 1.9 2.6l-2.2 6.6a2 2 0 0 1-1.9 1.4H7V10l4.4-7.4A2 2 0 0 1 15 5.9z"/></svg>
);
export const IconThumbsDown = (p) => (
  <svg {...base(p)}><path d="M17 14V2M9 18.1L10 14H4.6a2 2 0 0 1-1.9-2.6l2.2-6.6A2 2 0 0 1 6.8 3H17v4l-4.4 7.4A2 2 0 0 1 9 18.1z"/></svg>
);
export const IconArrowRight = (p) => (<svg {...base(p)}><path d="M5 12h14M13 5l7 7-7 7"/></svg>);
export const IconArrowLeft = (p) => (<svg {...base(p)}><path d="M19 12H5M11 19l-7-7 7-7"/></svg>);
export const IconArrowDown = (p) => (<svg {...base(p)}><path d="M12 5v14M5 12l7 7 7-7"/></svg>);
export const IconAlert = (p) => (
  <svg {...base(p)}><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
);
export const IconClock = (p) => (<svg {...base(p)}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>);
export const IconLock = (p) => (<svg {...base(p)}><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
export const IconKey = (p) => (<svg {...base(p)}><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L19 3m-3.5 3.5L18 9"/></svg>);
export const IconPalette = (p) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/><circle cx="15.5" cy="10" r="1" fill="currentColor"/><path d="M12 21a2 2 0 0 0 2-2c0-1-1-1.5-1-2.5s.8-1.5 2-1.5h2a4 4 0 0 0 4-4"/></svg>
);
export const IconCpu = (p) => (
  <svg {...base(p)}><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>
);
export const IconChevronDown = (p) => (<svg {...base(p)}><path d="M6 9l6 6 6-6"/></svg>);
export const IconSave = (p) => (
  <svg {...base(p)}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
);
