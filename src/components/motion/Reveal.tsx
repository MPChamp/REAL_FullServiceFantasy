import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  /** Seconds to wait after entering view */
  delay?: number;
  /** Initial vertical offset in px */
  y?: number;
  /** Initial horizontal offset in px */
  x?: number;
  className?: string;
}

/**
 * Scroll-triggered entrance: fades/springs in the first time the element
 * enters the viewport. Use for whole sections or individual cards.
 */
export default function Reveal({ children, delay = 0, y = 24, x = 0, className }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
