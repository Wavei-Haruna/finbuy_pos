// components/home/site-config.ts
// One place to edit links, nav items, pricing and button styles for the home page.

export const LOGO_SRC = '/logo.png';

export const LOGIN_HREF = '/login';
export const SIGNUP_HREF = '/signup';
export const DASHBOARD_HREF = '/dashboard';

// Flip to true once the real prices are confirmed.
// The tiers below are placeholders taken from the reference design, not real Kashora prices.
export const SHOW_PRICING = false;

export const PRICING = [
  { name: 'Starter', price: '79', note: 'One branch, one cashier.', featured: false },
  { name: 'Growth', price: '199', note: 'Up to 3 branches, unlimited cashiers.', featured: true },
  { name: 'Scale', price: '449', note: 'Unlimited branches.', featured: false },
];

export const NAV_ITEMS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  ...(SHOW_PRICING ? [{ label: 'Pricing', href: '#pricing' }] : []),
  { label: 'FAQ', href: '#faq' },
];

type Variant = 'primary' | 'secondary' | 'lime';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border border-border bg-card text-foreground hover:bg-accent',
  lime: 'bg-brand-lime text-brand-deep hover:brightness-95',
};

const sizes: Record<Size, string> = {
  sm: 'h-10 px-4',
  md: 'h-11 px-5',
  lg: 'h-12 px-6',
};

export const button = (variant: Variant, size: Size = 'md') =>
  `${base} ${variants[variant]} ${sizes[size]}`;
