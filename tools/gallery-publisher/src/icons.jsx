const paths = {
  upload: <><path d="M4 15.5V19h16v-3.5"/><path d="M12 4v11m0-11-4 4m4-4 4 4"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="m5.5 17 4.5-5 3.2 3.2 2.2-2.2 3.1 4"/><circle cx="15.5" cy="8.5" r="1.5"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  branch: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m2-8h4a6 6 0 0 1 6 6v2"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <path d="M6 6l12 12M18 6 6 18"/>,
  trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7"/><path d="M10 11v6m4-6v6"/></>,
  play: <path d="m8 5 11 7-11 7V5Z"/>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  shield: <path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>,
  refresh: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></>,
  grip: <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"/>,
  arrowLeft: <path d="m15 18-6-6 6-6"/>,
  arrowRight: <path d="m9 18 6-6-6-6"/>,
  external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.1 2.3c-.8.3-.9.9-.9 1.7M12 17h.01"/></>,
};

export function Icon({ name, size = 20, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
