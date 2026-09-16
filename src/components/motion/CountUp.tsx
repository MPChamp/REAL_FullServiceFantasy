import { useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Number that counts up from 0 the first time it scrolls into view.
 * Writes to textContent directly so it never re-renders mid-animation.
 */
export default function CountUp({
  value,
  decimals = 0,
  duration = 1.6,
  prefix = '',
  suffix = '',
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduceMotion = useReducedMotion();

  const format = (v: number) => `${prefix}${v.toFixed(decimals)}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduceMotion) {
      el.textContent = format(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, decimals, duration, reduceMotion]);

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  );
}
