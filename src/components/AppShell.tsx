import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Trophy, Menu, X } from 'lucide-react';
import ThemeToggle from './common/ThemeToggle';

const navLinks = [
  { to: '/seasons', label: 'Seasons' },
  { to: '/players', label: 'Players' },
  { to: '/head-to-head', label: 'Head-to-Head' },
  { to: '/records', label: 'Records' },
  { to: '/championships', label: 'Championships' },
  { to: '/playoffs', label: 'Playoffs' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/simulator', label: 'What If?' },
];

function NavLinkItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `relative text-sm font-medium tracking-wide transition-colors duration-200 pb-1 ${
          isActive
            ? 'text-[#f59e0b]'
            : 'text-on-surface-muted hover:text-on-surface'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {isActive && (
            <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-gold rounded-full" />
          )}
        </>
      )}
    </NavLink>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {/* ========== Navbar ========== */}
      <header className="sticky top-0 z-50 border-b border-border-default bg-surface/90 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <Trophy className="h-6 w-6 text-[#f59e0b] transition-transform duration-200 group-hover:scale-110" />
            <span className="font-heading text-xl font-bold tracking-wider text-on-surface">
              FSFFL
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <NavLinkItem key={link.to} to={link.to} label={link.label} />
            ))}
            <ThemeToggle />
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-on-surface-muted hover:text-on-surface"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </nav>
      </header>

      {/* ========== Mobile slide-out panel ========== */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          mobileMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-72 flex-col border-l border-border-default bg-surface p-6 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Close button */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Trophy className="h-5 w-5 text-[#f59e0b]" />
            <span className="font-heading text-lg font-bold tracking-wider text-on-surface">
              FSFFL
            </span>
          </Link>
          <button
            type="button"
            className="rounded-md p-1 text-on-surface-muted hover:text-on-surface"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile links */}
        <div className="flex flex-col gap-5">
          {navLinks.map((link) => (
            <NavLinkItem
              key={link.to}
              to={link.to}
              label={link.label}
              onClick={() => setMobileMenuOpen(false)}
            />
          ))}
        </div>
      </div>

      {/* ========== Main Content ========== */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>

      {/* ========== Footer ========== */}
      <footer className="border-t border-border-default py-8">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="font-heading text-sm font-medium tracking-wider text-on-surface-faint">
            Full Service Fantasy Football League
          </p>
          <p className="mt-1 text-xs text-on-surface-faint">
            Est. 2016 &mdash; 10 Seasons of Glory
          </p>
        </div>
      </footer>
    </div>
  );
}
