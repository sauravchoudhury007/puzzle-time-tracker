export type NavLink = {
  href: string
  /** Short label for the Pulse nav rail. */
  label: string
  /** Spoken-out name, used for page headings and aria labels. */
  title: string
}

export const navLinks: NavLink[] = [
  { href: '/', label: 'Today', title: 'Today' },
  { href: '/dashboard', label: 'Almanac', title: 'Stats deck' },
  { href: '/tracker', label: 'Grid', title: 'Activity grid' },
  { href: '/frame', label: 'Frame', title: 'Printable poster' },
  { href: '/entry', label: 'Log', title: 'Log a time' },
  { href: '/data', label: 'Data', title: 'Import & export' },
]

export const findNavLink = (href: string): NavLink | undefined =>
  navLinks.find(link => link.href === href)
