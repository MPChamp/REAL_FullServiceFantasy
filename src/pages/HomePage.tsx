import { useMemo } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, TrendingUp, Users, Target, Crown } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import ScrollableTable from '@/components/common/ScrollableTable';
import Reveal from '@/components/motion/Reveal';
import CountUp from '@/components/motion/CountUp';
import TiltCard from '@/components/motion/TiltCard';
import AmbientBackground from '@/components/motion/AmbientBackground';
import NewsTicker from '@/components/home/NewsTicker';
import CurrentSeasonPanel from '@/components/home/CurrentSeasonPanel';
import { formatRecord, formatPercent, formatScore } from '@/utils/formatting';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { Player, Championship, AllTimeRecord, WeeklyMatchup, ToiletBowl } from '@/data/types';
import playersData from '@/data/players.json';
import championshipsData from '@/data/championships.json';
import allTimeRecordsData from '@/data/all-time-records.json';
import matchupsData from '@/data/matchups.json';
import toiletBowlsData from '@/data/toilet-bowls.json';
import currentSeasonData from '@/data/current-season.json';

const players = playersData as Player[];
const championships = championshipsData as Championship[];
const allTimeRecords = allTimeRecordsData as AllTimeRecord[];
const matchups = matchupsData as WeeklyMatchup[];
const toiletBowls = toiletBowlsData as ToiletBowl[];

function getPlayerName(id: number): string {
  return players.find((p) => p.player_id === id)?.name ?? 'Unknown';
}

function clickOrigin(e: MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };
}

function fireGoldConfetti(e: MouseEvent<HTMLElement>) {
  confetti({
    particleCount: 140,
    spread: 80,
    startVelocity: 35,
    origin: clickOrigin(e),
    colors: ['#f59e0b', '#fbbf24', '#fff7e0', '#d97706', '#ffffff'],
  });
}

function firePoopConfetti(e: MouseEvent<HTMLElement>) {
  const poop = confetti.shapeFromText({ text: '\u{1F4A9}', scalar: 2 });
  confetti({
    particleCount: 25,
    spread: 70,
    startVelocity: 30,
    gravity: 1.3,
    origin: clickOrigin(e),
    shapes: [poop],
    scalar: 2,
  });
}

// Hero title words — the middle chunk gets the animated gold shimmer
const titleWords: { text: string; shimmer?: boolean }[] = [
  { text: 'Full' },
  { text: 'Service' },
  { text: 'Fantasy Football', shimmer: true },
  { text: 'League' },
];

export default function HomePage() {
  usePageTitle();
  const champCards = useMemo(() => {
    return championships
      .slice()
      .sort((a, b) => a.season_id - b.season_id)
      .map((champ) => {
        const champGame = matchups.find(
          (m) => m.season_id === champ.season_id && m.game_type === 'championship'
        );
        return { ...champ, champGame };
      });
  }, []);

  const reigningChamp = champCards[champCards.length - 1];

  const toiletBowlCards = useMemo(() => {
    return toiletBowls.slice().sort((a, b) => a.season_id - b.season_id);
  }, []);

  const totalGames = useMemo(() => {
    const sum = allTimeRecords.reduce((acc, r) => acc + r.total_games, 0);
    return Math.round(sum / 2);
  }, []);

  const totalPointsK = useMemo(() => {
    const sum = allTimeRecords.reduce((acc, r) => acc + r.total_points_for, 0);
    return sum / 1000;
  }, []);

  const mostChampions = useMemo(() => {
    const sorted = [...allTimeRecords].sort((a, b) => b.championships - a.championships);
    return sorted[0];
  }, []);

  const winsLeader = useMemo(() => {
    const sorted = [...allTimeRecords].sort((a, b) => b.total_wins - a.total_wins);
    return sorted[0];
  }, []);

  const leagueAvgPPG = useMemo(() => {
    const totalPPG = allTimeRecords.reduce((acc, r) => acc + r.career_ppg, 0);
    return totalPPG / allTimeRecords.length;
  }, []);

  const mostToiletBowls = useMemo(() => {
    const sorted = [...allTimeRecords].sort(
      (a, b) =>
        b.toilet_bowl_wins + b.toilet_bowl_losses - (a.toilet_bowl_wins + a.toilet_bowl_losses)
    );
    return sorted[0];
  }, []);

  const standings = useMemo(() => {
    return [...allTimeRecords].sort((a, b) => b.win_percentage - a.win_percentage);
  }, []);

  return (
    <div className="space-y-16">
      {/* ========== Hero ========== */}
      <section className="relative -mx-4 -mt-8 overflow-hidden px-4 pb-10 pt-20 text-center md:pt-24">
        <AmbientBackground />
        <div className="relative">
          <h1 className="font-display text-5xl tracking-wider md:text-7xl">
            {titleWords.map((word, i) => (
              <motion.span
                key={word.text}
                initial={{ opacity: 0, y: 40, rotateX: 60 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ type: 'spring', stiffness: 110, damping: 16, delay: 0.15 * i }}
                className={`inline-block ${
                  word.shimmer ? 'text-shimmer-gold' : 'text-on-surface'
                }`}
              >
                {word.text}
                {i < titleWords.length - 1 && <span>&nbsp;</span>}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-4 font-body text-lg tracking-wide text-on-surface-muted md:text-xl"
          >
            A Decade of Dominance &bull; 2016&ndash;{currentSeasonData.season_id}
          </motion.p>

          {/* Reigning champion chip */}
          {reigningChamp && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 1 }}
              className="mt-8 flex justify-center"
            >
              <Link
                to={`/seasons/${reigningChamp.season_id}`}
                className="champ-pulse group flex items-center gap-3 rounded-full border border-gold/40 bg-surface-card/70 py-2 pl-2.5 pr-5 backdrop-blur-sm transition-colors hover:border-gold"
              >
                <PlayerAvatar playerId={reigningChamp.winner_id} size="sm" showRing />
                <span className="float-gentle text-lg leading-none">{'\u{1F451}'}</span>
                <span className="text-left">
                  <span className="block font-heading text-[10px] font-bold uppercase tracking-widest text-gold">
                    Reigning Champion
                  </span>
                  <span className="block font-heading text-sm font-semibold text-on-surface">
                    {getPlayerName(reigningChamp.winner_id)} &bull; {reigningChamp.season_id}
                  </span>
                </span>
              </Link>
            </motion.div>
          )}

          {/* Hero count-up stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="mt-10 flex items-center justify-center gap-8 md:gap-14"
          >
            {[
              { value: championships.length, decimals: 0, suffix: '', label: 'Seasons' },
              { value: totalGames, decimals: 0, suffix: '', label: 'Games' },
              { value: totalPointsK, decimals: 1, suffix: 'K', label: 'Points Scored' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <CountUp
                  value={stat.value}
                  decimals={stat.decimals}
                  suffix={stat.suffix}
                  className="font-display text-3xl text-on-surface md:text-4xl"
                />
                <div className="mt-1 font-heading text-[10px] font-semibold uppercase tracking-widest text-on-surface-faint md:text-xs">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== Breaking-news ticker ========== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.4 }}
        className="!mt-8"
      >
        <NewsTicker />
      </motion.div>

      {/* ========== Season in progress ========== */}
      <Reveal>
        <CurrentSeasonPanel />
      </Reveal>

      {/* ========== Champions Wall ========== */}
      <section>
        <Reveal>
          <h2 className="mb-6 flex items-center gap-2 font-heading text-2xl font-semibold text-on-surface">
            <motion.button
              type="button"
              onClick={fireGoldConfetti}
              whileHover={{ rotate: [0, -12, 12, -8, 0], scale: 1.15 }}
              transition={{ duration: 0.5 }}
              className="cursor-pointer"
              title="Go ahead. Click it."
              aria-label="Celebrate the champions"
            >
              <Trophy className="h-6 w-6 text-gold" />
            </motion.button>
            Champions Wall
          </h2>
        </Reveal>
        <div className="scrollbar-thin -mx-4 flex gap-4 overflow-x-auto px-4 pb-6 pt-2">
          {champCards.map((champ, idx) => {
            const winnerName = getPlayerName(champ.winner_id);
            const loserName = getPlayerName(champ.runner_up_id);
            const winnerScore = champ.champGame
              ? champ.champGame.player1_id === champ.winner_id
                ? champ.champGame.player1_score
                : champ.champGame.player2_score
              : null;
            const loserScore = champ.champGame
              ? champ.champGame.player1_id === champ.runner_up_id
                ? champ.champGame.player1_score
                : champ.champGame.player2_score
              : null;

            return (
              <motion.div
                key={champ.season_id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ type: 'spring', stiffness: 130, damping: 18, delay: 0.06 * idx }}
              >
                <TiltCard max={12}>
                  <Link
                    to={`/seasons/${champ.season_id}`}
                    className="glass-card card-shine flex min-w-[160px] flex-col items-center border border-gold/20 p-5 transition-all hover:border-gold/60"
                  >
                    <span className="font-display text-3xl text-gold">{champ.season_id}</span>
                    <div className="my-3">
                      <PlayerAvatar playerId={champ.winner_id} size="lg" showRing />
                    </div>
                    <span className="float-gentle mb-1" style={{ animationDelay: `${idx * 0.3}s` }}>
                      <Trophy className="h-5 w-5 text-gold" />
                    </span>
                    <span className="font-heading text-sm font-semibold text-on-surface">
                      {winnerName}
                    </span>
                    {winnerScore !== null && loserScore !== null && (
                      <span className="font-score mt-1 text-xs text-on-surface-muted">
                        {formatScore(winnerScore)} - {formatScore(loserScore)}
                      </span>
                    )}
                    <span className="mt-0.5 text-xs text-on-surface-faint">vs {loserName}</span>
                  </Link>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ========== Wall of Shame ========== */}
      <section>
        <Reveal>
          <div className="mb-6">
            <h2 className="flex items-center gap-2 font-heading text-2xl font-semibold text-on-surface">
              <motion.button
                type="button"
                onClick={firePoopConfetti}
                whileHover={{ scale: 1.25, rotate: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                className="cursor-pointer text-2xl"
                title="You know you want to."
                aria-label="Rain shame"
              >
                {'\u{1F4A9}'}
              </motion.button>
              Wall of Shame
            </h2>
            <p className="mt-1 text-sm text-on-surface-muted">Where Legends Hit Rock Bottom</p>
          </div>
        </Reveal>
        <div className="scrollbar-thin -mx-4 flex gap-4 overflow-x-auto px-4 pb-6 pt-2">
          {toiletBowlCards.map((tb, idx) => {
            const loserName = getPlayerName(tb.loser_id);
            return (
              <motion.div
                key={tb.season_id}
                initial={{ opacity: 0, y: -40, rotate: idx % 2 === 0 ? -4 : 4 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.06 * idx }}
              >
                <Link
                  to={`/seasons/${tb.season_id}`}
                  className="shame-card group relative flex min-w-[160px] flex-col items-center p-5 transition-all"
                >
                  {/* Flies that buzz on hover */}
                  <span
                    aria-hidden
                    className="fly-buzz absolute right-4 top-3 text-xs opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  >
                    {'\u{1FAB0}'}
                  </span>
                  <span
                    aria-hidden
                    className="fly-buzz absolute left-5 top-8 text-[10px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ animationDelay: '0.4s' }}
                  >
                    {'\u{1FAB0}'}
                  </span>
                  <span className="font-display text-3xl text-toilet-shame">{tb.season_id}</span>
                  <div className="my-3 transition-all duration-300 group-hover:grayscale">
                    <PlayerAvatar playerId={tb.loser_id} size="lg" />
                  </div>
                  <span className="mb-1 text-xs font-bold uppercase tracking-wider text-red-500/80">
                    Last Place
                  </span>
                  <span className="font-heading text-sm font-semibold text-on-surface">
                    {loserName}
                  </span>
                  <span className="font-score mt-1 text-xs text-on-surface-muted">
                    Lost {formatScore(tb.loser_score)} - {formatScore(tb.winner_score)}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ========== Toilet Bowl Legends ========== */}
      <section>
        <Reveal>
          <div className="mb-6">
            <h2 className="flex items-center gap-2 font-heading text-2xl font-semibold text-toilet-glory">
              <span style={{ filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)' }}>
                {'\u{1F6BD}'}
              </span>
              Toilet Bowl Legends
            </h2>
            <p className="mt-1 text-sm text-on-surface-muted">
              They Stared Into the Abyss and Survived
            </p>
          </div>
        </Reveal>
        <div className="scrollbar-thin -mx-4 flex gap-4 overflow-x-auto px-4 pb-6 pt-2">
          {toiletBowlCards.map((tb, idx) => {
            const winnerName = getPlayerName(tb.winner_id);
            return (
              <motion.div
                key={tb.season_id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ type: 'spring', stiffness: 130, damping: 18, delay: 0.06 * idx }}
              >
                <Link
                  to={`/seasons/${tb.season_id}`}
                  className="glass-card card-shine group flex min-w-[160px] flex-col items-center border border-toilet-glory/20 p-5 transition-all hover:border-toilet-glory/50"
                >
                  <span className="font-display text-3xl text-toilet-glory">{tb.season_id}</span>
                  {/* Avatar does a full "flush" spin on hover */}
                  <div className="my-3 transition-transform duration-700 ease-in-out group-hover:rotate-[360deg]">
                    <PlayerAvatar playerId={tb.winner_id} size="lg" />
                  </div>
                  <span className="mb-1 text-xs font-bold uppercase tracking-wider text-toilet-glory">
                    Survived
                  </span>
                  <span className="font-heading text-sm font-semibold text-on-surface">
                    {winnerName}
                  </span>
                  <span className="font-score mt-1 text-xs text-on-surface-muted">
                    {formatScore(tb.winner_score)} - {formatScore(tb.loser_score)}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ========== Quick Stats ========== */}
      <section>
        <Reveal>
          <h2 className="mb-6 font-heading text-2xl font-semibold text-on-surface">Quick Stats</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            {
              icon: <Target className="mb-2 h-6 w-6 text-gold" />,
              value: totalGames,
              decimals: 0,
              color: 'text-on-surface',
              label: 'Total Games Played',
            },
            {
              icon: <Trophy className="mb-2 h-6 w-6 text-gold" />,
              value: mostChampions?.championships ?? 0,
              decimals: 0,
              color: 'text-on-surface',
              label: `Most Championships (${mostChampions?.name})`,
            },
            {
              icon: <TrendingUp className="mb-2 h-6 w-6 text-win" />,
              value: winsLeader?.total_wins ?? 0,
              decimals: 0,
              color: 'text-on-surface',
              label: `All-Time Wins Leader (${winsLeader?.name})`,
            },
            {
              icon: <Users className="mb-2 h-6 w-6 text-[#06b6d4]" />,
              value: leagueAvgPPG,
              decimals: 1,
              color: 'text-on-surface',
              label: 'League Average PPG',
            },
            {
              icon: <span className="mb-2 text-2xl">{'\u{1F6BD}'}</span>,
              value: mostToiletBowls
                ? mostToiletBowls.toilet_bowl_wins + mostToiletBowls.toilet_bowl_losses
                : 0,
              decimals: 0,
              color: 'text-[#b45309]',
              label: `Most Toilet Bowls (${mostToiletBowls?.name})`,
            },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              whileHover={{ y: -4, scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.07 * idx }}
              className="stat-card flex flex-col items-center p-4 text-center"
            >
              {stat.icon}
              <CountUp
                value={stat.value}
                decimals={stat.decimals}
                className={`font-display text-3xl ${stat.color}`}
              />
              <span className="mt-1 text-xs text-on-surface-muted">{stat.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ========== All-Time Standings ========== */}
      <section>
        <Reveal>
          <h2 className="mb-6 font-heading text-2xl font-semibold text-on-surface">
            All-Time Standings
          </h2>
        </Reveal>
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-on-surface-muted">
                <th className="w-8 py-3 px-1.5 text-left font-medium sm:w-12 sm:px-2">#</th>
                <th className="py-3 px-1.5 text-left font-medium sm:px-2">Player</th>
                <th className="whitespace-nowrap py-3 px-1.5 text-right font-medium sm:px-2">W-L-T</th>
                <th className="py-3 px-2 text-right font-medium">Win%</th>
                <th className="py-3 px-2 text-right font-medium">PPG</th>
                <th className="py-3 px-2 text-center font-medium">Titles</th>
                <th className="py-3 px-2 text-center font-medium">TB W</th>
                <th className="py-3 px-2 text-center font-medium">Last</th>
                <th className="py-3 px-2 text-right font-medium">Playoffs</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((record, idx) => (
                <motion.tr
                  key={record.player_id}
                  initial={{ opacity: 0, x: -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.05 * idx }}
                  className={`group/row transition-colors hover:bg-gold/5 ${
                    idx === 0 ? 'bg-gold/[0.04]' : ''
                  }`}
                >
                  <td className="py-3 px-1.5 sm:px-2">
                    <Link to={`/players/${record.player_id}`} className="contents">
                      <span className="font-score text-on-surface-faint">{idx + 1}</span>
                    </Link>
                  </td>
                  <td className="py-3 px-1.5 sm:px-2">
                    <Link
                      to={`/players/${record.player_id}`}
                      className="flex items-center gap-2 transition-colors hover:text-gold sm:gap-3"
                    >
                      <span className="transition-transform duration-300 group-hover/row:scale-110">
                        <PlayerAvatar playerId={record.player_id} size="sm" showRing />
                      </span>
                      <span className="font-heading font-semibold text-on-surface">
                        {record.name}
                      </span>
                      {idx === 0 && (
                        <span className="float-gentle inline-flex" title="Best in league history">
                          <Crown className="h-4 w-4 text-gold" />
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="font-score whitespace-nowrap py-3 px-1.5 text-right text-on-surface sm:px-2">
                    <Link to={`/players/${record.player_id}`}>
                      {formatRecord(record.total_wins, record.total_losses, record.total_ties)}
                    </Link>
                  </td>
                  <td className="font-score py-3 px-2 text-right text-on-surface">
                    {formatPercent(record.win_percentage)}
                  </td>
                  <td className="font-score py-3 px-2 text-right text-on-surface">
                    {record.career_ppg.toFixed(1)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {record.championships > 0 ? (
                        Array.from({ length: record.championships }).map((_, i) => (
                          <motion.span
                            key={i}
                            initial={{ scale: 0, rotate: -30 }}
                            whileInView={{ scale: 1, rotate: 0 }}
                            viewport={{ once: true }}
                            transition={{
                              type: 'spring',
                              stiffness: 300,
                              damping: 14,
                              delay: 0.3 + 0.12 * i,
                            }}
                          >
                            <Trophy className="h-4 w-4 text-gold" />
                          </motion.span>
                        ))
                      ) : (
                        <span className="text-on-surface-faint">-</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {record.toilet_bowl_wins > 0 ? (
                      <div className="flex items-center justify-center gap-0.5">
                        {Array.from({ length: record.toilet_bowl_wins }).map((_, i) => (
                          <span
                            key={i}
                            className="text-base"
                            style={{
                              filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)',
                            }}
                          >
                            {'\u{1F6BD}'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-on-surface-faint">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {record.toilet_bowl_losses > 0 ? (
                      <div className="flex items-center justify-center gap-0.5">
                        {Array.from({ length: record.toilet_bowl_losses }).map((_, i) => (
                          <span key={i} className="text-base">
                            {'\u{1F4A9}'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-on-surface-faint">-</span>
                    )}
                  </td>
                  <td className="font-score py-3 px-2 text-right text-on-surface">
                    {record.playoff_appearances}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </section>
    </div>
  );
}
