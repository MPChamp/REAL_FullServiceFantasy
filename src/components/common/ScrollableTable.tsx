import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

export default function ScrollableTable({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setShowLeft(el.scrollLeft > 10);
      setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      <div
        className={`pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-surface to-transparent transition-opacity duration-200 ${
          showLeft ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>
      <div
        className={`pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-surface to-transparent transition-opacity duration-200 ${
          showRight ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
