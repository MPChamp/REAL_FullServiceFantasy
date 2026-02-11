import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Award, Target, TrendingUp, Calendar, Crown } from 'lucide-react';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { formatScore } from '@/utils/formatting';
import { usePageTitle } from '@/hooks/usePageTitle';

import recordsData from '@/data/records.json';

// Typed record structure for the different record types
interface SingleWeekRecord {
  player_id: number;
  player_name: string;
  value: number;
  season_id: number;
  week: number;
  opponent?: string;
  game_type?: string;
}

interface BlowoutRecord {
  margin: number;
  winner_id: number;
  loser_id: number;
  winner_score: number;
  loser_score: number;
  season_id: number;
  week: number;
  game_type: string;
  winner_name: string;
  loser_name: string;
}

interface CombinedScoreRecord {
  combined: number;
  player1_id: number;
  player2_id: number;
  player1_score: number;
  player2_score: number;
  season_id: number;
  week: number;
  game_type: string;
  player1_name: string;
  player2_name: string;
}

interface SeasonRecord {
  player_id: number;
  player_name: string;
  value: number;
  season_id: number;
  record?: string;
}

interface CountRecord {
  player_id: number;
  player_name: string;
  value: number;
}

const records = recordsData as {
  highest_regular_score: SingleWeekRecord[];
  lowest_regular_score: SingleWeekRecord[];
  highest_playoff_score: SingleWeekRecord[];
  biggest_blowouts: BlowoutRecord[];
  closest_games: BlowoutRecord[];
  highest_combined_scores: CombinedScoreRecord[];
  most_wins_season: SeasonRecord[];
  highest_ppg_season: SeasonRecord[];
  most_points_season: SeasonRecord[];
  most_moves_season: SeasonRecord[];
  most_losses_season: SeasonRecord[];
  last_place_counts: CountRecord[];
  toilet_bowl_appearances: CountRecord[];
  toilet_bowl_wins: CountRecord[];
  toilet_bowl_losses: CountRecord[];
};

type Tab = 'single-week' | 'season' | 'career' | 'matchups' | 'dubious';

const tabConfig: { id: Tab; label: string; icon: typeof Award }[] = [
  { id: 'single-week', label: 'Single Week', icon: Target },
  { id: 'matchups', label: 'Matchups', icon: Crown },
  { id: 'season', label: 'Season', icon: Calendar },
  { id: 'career', label: 'Career', icon: TrendingUp },
  { id: 'dubious', label: 'Dubious', icon: Award },
];

function RecordCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass-card p-5">
      <h3 className="font-heading text-sm font-semibold text-[#f59e0b] uppercase tracking-wide mb-3">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function GameTypeBadge({ gameType }: { gameType?: string }) {
  if (!gameType || gameType === 'regular') return null;
  const labels: Record<string, string> = {
    championship: 'Champ',
    semifinal: 'Semi',
    '3rd_place': '3rd',
    toilet_bowl: 'TB',
  };
  const isTB = gameType === 'toilet_bowl';
  return (
    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase leading-none ${
      isTB
        ? 'bg-[#b45309]/15 text-[#b45309] border border-[#b45309]/30'
        : 'bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/30'
    }`}>
      {labels[gameType] ?? gameType}
    </span>
  );
}

function SingleWeekEntry({ entry, rank }: { entry: SingleWeekRecord; rank: number }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className={`font-score text-xs w-5 ${rank === 1 ? 'text-[#f59e0b]' : 'text-on-surface-faint'}`}>
        {rank}.
      </span>
      <PlayerAvatar playerId={entry.player_id} size="sm" showRing />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-heading text-sm text-on-surface font-semibold">{entry.player_name}</span>
          <GameTypeBadge gameType={entry.game_type} />
        </div>
        <span className="text-on-surface-faint text-xs">
          {entry.season_id} Wk {entry.week}
          {entry.opponent && ` vs ${entry.opponent}`}
        </span>
      </div>
      <span className="font-score text-sm text-on-surface font-semibold shrink-0">
        {formatScore(entry.value)}
      </span>
    </div>
  );
}

function BlowoutEntry({ entry, rank }: { entry: BlowoutRecord; rank: number }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className={`font-score text-xs w-5 ${rank === 1 ? 'text-[#f59e0b]' : 'text-on-surface-faint'}`}>
        {rank}.
      </span>
      <PlayerAvatar playerId={entry.winner_id} size="sm" showRing />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-heading text-sm text-on-surface font-semibold">{entry.winner_name}</span>
          <GameTypeBadge gameType={entry.game_type} />
        </div>
        <span className="text-on-surface-faint text-xs">
          vs {entry.loser_name} ({entry.season_id} Wk {entry.week})
        </span>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-score text-xs text-on-surface-muted">
          {formatScore(entry.winner_score)}-{formatScore(entry.loser_score)}
        </div>
        <div className="font-score text-sm text-on-surface font-semibold">
          +{entry.margin.toFixed(1)}
        </div>
      </div>
    </div>
  );
}

function CombinedEntry({ entry, rank }: { entry: CombinedScoreRecord; rank: number }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className={`font-score text-xs w-5 ${rank === 1 ? 'text-[#f59e0b]' : 'text-on-surface-faint'}`}>
        {rank}.
      </span>
      <div className="flex -space-x-2">
        <PlayerAvatar playerId={entry.player1_id} size="sm" />
        <PlayerAvatar playerId={entry.player2_id} size="sm" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-heading text-sm text-on-surface font-semibold">
            {entry.player1_name} vs {entry.player2_name}
          </span>
          <GameTypeBadge gameType={entry.game_type} />
        </div>
        <span className="text-on-surface-faint text-xs">
          {entry.season_id} Wk {entry.week}
        </span>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-score text-xs text-on-surface-muted">
          {formatScore(entry.player1_score)}-{formatScore(entry.player2_score)}
        </div>
        <div className="font-score text-sm text-on-surface font-semibold">
          {formatScore(entry.combined)}
        </div>
      </div>
    </div>
  );
}

function SeasonRecordEntry({ entry, rank, unit = '' }: { entry: SeasonRecord; rank: number; unit?: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className={`font-score text-xs w-5 ${rank === 1 ? 'text-[#f59e0b]' : 'text-on-surface-faint'}`}>
        {rank}.
      </span>
      <PlayerAvatar playerId={entry.player_id} size="sm" showRing />
      <div className="flex-1 min-w-0">
        <span className="font-heading text-sm text-on-surface font-semibold">{entry.player_name}</span>
        <span className="text-on-surface-faint text-xs ml-2">{entry.season_id}</span>
        {entry.record && <span className="text-on-surface-faint text-xs ml-1">({entry.record})</span>}
      </div>
      <span className="font-score text-sm text-on-surface font-semibold shrink-0">
        {typeof entry.value === 'number' ? formatScore(entry.value) : entry.value}{unit}
      </span>
    </div>
  );
}

function CountEntry({ entry, rank, label = '' }: { entry: CountRecord; rank: number; label?: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className={`font-score text-xs w-5 ${rank === 1 ? 'text-[#f59e0b]' : 'text-on-surface-faint'}`}>
        {rank}.
      </span>
      <PlayerAvatar playerId={entry.player_id} size="sm" showRing />
      <div className="flex-1 min-w-0">
        <span className="font-heading text-sm text-on-surface font-semibold">{entry.player_name}</span>
      </div>
      <span className="font-score text-sm text-on-surface font-semibold shrink-0">
        {entry.value}{label}
      </span>
    </div>
  );
}

export default function RecordsPage() {
  usePageTitle('Records');
  const [activeTab, setActiveTab] = useState<Tab>('single-week');

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-heading text-4xl font-bold text-on-surface flex items-center gap-3">
          <Award className="h-8 w-8 text-[#f59e0b]" />
          Records
        </h1>
        <p className="text-on-surface-muted mt-2">The best (and worst) performances in league history</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-heading font-semibold shrink-0 transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#f59e0b] text-black'
                  : 'bg-surface-inset/50 text-on-surface-muted hover:bg-surface-inset hover:text-on-surface'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'single-week' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecordCard title="Highest Regular Season Score">
              {records.highest_regular_score.slice(0, 5).map((entry, idx) => (
                <SingleWeekEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
            <RecordCard title="Lowest Regular Season Score">
              {records.lowest_regular_score.slice(0, 5).map((entry, idx) => (
                <SingleWeekEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
            <RecordCard title="Highest Postseason Score">
              {records.highest_playoff_score.slice(0, 5).map((entry, idx) => (
                <SingleWeekEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
          </div>
        )}

        {activeTab === 'matchups' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecordCard title="Biggest Blowouts">
              {records.biggest_blowouts.slice(0, 5).map((entry, idx) => (
                <BlowoutEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
            <RecordCard title="Closest Games">
              {records.closest_games.slice(0, 5).map((entry, idx) => (
                <BlowoutEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
            <RecordCard title="Highest Combined Scores">
              {records.highest_combined_scores.slice(0, 5).map((entry, idx) => (
                <CombinedEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
          </div>
        )}

        {activeTab === 'season' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecordCard title="Most Wins in a Season">
              {records.most_wins_season.slice(0, 5).map((entry, idx) => (
                <SeasonRecordEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
            <RecordCard title="Highest PPG in a Season">
              {records.highest_ppg_season.slice(0, 5).map((entry, idx) => (
                <SeasonRecordEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
            <RecordCard title="Most Points in a Season">
              {records.most_points_season.slice(0, 5).map((entry, idx) => (
                <SeasonRecordEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
            <RecordCard title="Most Moves in a Season">
              {records.most_moves_season.slice(0, 5).map((entry, idx) => (
                <SeasonRecordEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
          </div>
        )}

        {activeTab === 'career' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecordCard title="Most Wins in a Season (All-Time)">
              {records.most_wins_season.slice(0, 10).map((entry, idx) => (
                <SeasonRecordEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
            <RecordCard title="Highest PPG Season (All-Time)">
              {records.highest_ppg_season.slice(0, 10).map((entry, idx) => (
                <SeasonRecordEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
          </div>
        )}

        {activeTab === 'dubious' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecordCard title="Last Place Finishes">
              {records.last_place_counts.filter((e) => e.value > 0).map((entry, idx) => (
                <CountEntry key={idx} entry={entry} rank={idx + 1} label="x" />
              ))}
            </RecordCard>
            <RecordCard title="Toilet Bowl Losses (Last Place)">
              {records.toilet_bowl_losses.filter((e) => e.value > 0).map((entry, idx) => (
                <CountEntry key={idx} entry={entry} rank={idx + 1} label="x" />
              ))}
            </RecordCard>
            <RecordCard title="Toilet Bowl Appearances">
              {records.toilet_bowl_appearances.filter((e) => e.value > 0).map((entry, idx) => (
                <CountEntry key={idx} entry={entry} rank={idx + 1} label="x" />
              ))}
            </RecordCard>
            <RecordCard title="Toilet Bowl Legends (Escaped Last Place)">
              {records.toilet_bowl_wins.filter((e) => e.value > 0).map((entry, idx) => (
                <CountEntry key={idx} entry={entry} rank={idx + 1} label="x" />
              ))}
            </RecordCard>
            <RecordCard title="Most Losses in a Season">
              {records.most_losses_season.slice(0, 5).map((entry, idx) => (
                <SeasonRecordEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
            <RecordCard title="Lowest Regular Season Scores">
              {records.lowest_regular_score.slice(0, 5).map((entry, idx) => (
                <SingleWeekEntry key={idx} entry={entry} rank={idx + 1} />
              ))}
            </RecordCard>
          </div>
        )}
      </motion.div>
    </div>
  );
}
