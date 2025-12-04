export const navLinks = [
  { href: '/', label: 'Home', accent: 'emerald' },
  { href: '/entry', label: 'Log a puzzle time', accent: 'emerald' },
  { href: '/dashboard', label: 'Dashboard', accent: 'sky' },
  { href: '/tracker', label: 'Tracker', accent: 'indigo' },
  { href: '/data', label: 'Data', accent: 'amber' },
];

export const getNavAccent = (href: string) => {
  const match = navLinks.find(l => l.href === href);
  switch (match?.accent) {
    case 'emerald':
      return 'bg-emerald-400';
    case 'sky':
      return 'bg-sky-300';
    case 'indigo':
      return 'bg-indigo-300';
    case 'amber':
      return 'bg-amber-300';
    default:
      return 'bg-emerald-300';
  }
};
