import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import type { ReactNode, MouseEvent } from 'react';

interface TiltCardProps {
  children: ReactNode;
  /** Max tilt in degrees */
  max?: number;
  className?: string;
}

/**
 * 3D mouse-tracking tilt with a moving glare highlight.
 * Wrap a card in this to make it feel physical on hover.
 */
export default function TiltCard({ children, max = 10, className }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Normalized cursor position within the card, -0.5 .. 0.5
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), {
    stiffness: 250,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), {
    stiffness: 250,
    damping: 20,
  });
  const glareX = useTransform(px, [-0.5, 0.5], ['20%', '80%']);
  const glareY = useTransform(py, [-0.5, 0.5], ['20%', '80%']);
  const glare = useTransform(
    [glareX, glareY],
    ([gx, gy]) =>
      `radial-gradient(280px circle at ${gx} ${gy}, rgba(255,255,255,0.14), transparent 65%)`
  );

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!ref.current || reduceMotion) return;
    const rect = ref.current.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: reduceMotion ? 0 : rotateX,
        rotateY: reduceMotion ? 0 : rotateY,
        transformStyle: 'preserve-3d',
        perspective: 800,
      }}
      whileHover={reduceMotion ? undefined : { scale: 1.04, zIndex: 10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`group/tilt relative ${className ?? ''}`}
    >
      {children}
      {/* Glare that follows the cursor */}
      {!reduceMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
          style={{ background: glare }}
        />
      )}
    </motion.div>
  );
}
