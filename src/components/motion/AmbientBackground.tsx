import { motion, useReducedMotion } from 'framer-motion';

/**
 * Ambient hero atmosphere: slow-drifting glow orbs over faint field
 * yard-lines. Position inside a `relative overflow-hidden` container.
 */
export default function AmbientBackground() {
  const reduceMotion = useReducedMotion();

  const orbs = [
    {
      className:
        'absolute -top-24 left-[10%] h-96 w-96 rounded-full bg-gold/15 blur-3xl',
      animate: { x: [0, 60, -20, 0], y: [0, 30, 60, 0], scale: [1, 1.15, 0.95, 1] },
      duration: 26,
    },
    {
      className:
        'absolute top-10 right-[8%] h-80 w-80 rounded-full bg-[#8b5cf6]/12 blur-3xl',
      animate: { x: [0, -50, 20, 0], y: [0, 50, 10, 0], scale: [1, 0.9, 1.1, 1] },
      duration: 32,
    },
    {
      className:
        'absolute -bottom-20 left-[40%] h-72 w-72 rounded-full bg-[#06b6d4]/10 blur-3xl',
      animate: { x: [0, 40, -40, 0], y: [0, -30, 20, 0], scale: [1, 1.1, 1, 1] },
      duration: 28,
    },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Faint football-field yard lines */}
      <div className="yard-lines absolute inset-0" />
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={orb.className}
          animate={reduceMotion ? undefined : orb.animate}
          transition={{ duration: orb.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Vignette so content stays readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface" />
    </div>
  );
}
