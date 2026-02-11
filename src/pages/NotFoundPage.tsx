import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function NotFoundPage() {
  usePageTitle('Page Not Found');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Trophy className="h-16 w-16 text-on-surface-faint mb-6" />
      <h1 className="font-heading text-6xl font-bold text-on-surface mb-2">404</h1>
      <p className="text-on-surface-muted text-lg mb-8">
        This page doesn't exist — kind of like your playoff chances.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#f59e0b] text-black font-heading font-semibold transition-colors hover:bg-[#d97706]"
      >
        Back to Home
      </Link>
    </div>
  );
}
