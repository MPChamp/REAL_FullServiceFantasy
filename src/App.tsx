import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import ScrollToTop from './components/common/ScrollToTop';
import ScrollToTopButton from './components/common/ScrollToTopButton';

// Lazy-loaded page components
const HomePage = React.lazy(() => import('./pages/HomePage'));
const SeasonsPage = React.lazy(() => import('./pages/SeasonsPage'));
const SeasonDetailPage = React.lazy(() => import('./pages/SeasonDetailPage'));
const PlayersPage = React.lazy(() => import('./pages/PlayersPage'));
const PlayerProfilePage = React.lazy(() => import('./pages/PlayerProfilePage'));
const HeadToHeadPage = React.lazy(() => import('./pages/HeadToHeadPage'));
const RecordsPage = React.lazy(() => import('./pages/RecordsPage'));
const ChampionshipsPage = React.lazy(() => import('./pages/ChampionshipsPage'));
const PlayoffsPage = React.lazy(() => import('./pages/PlayoffsPage'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const SimulatorPage = React.lazy(() => import('./pages/SimulatorPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-surface-inset border-t-gold rounded-full animate-spin" />
        <p className="text-sm text-on-surface-muted font-body">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <AppShell>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/seasons" element={<SeasonsPage />} />
            <Route path="/seasons/:year" element={<SeasonDetailPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/players/:id" element={<PlayerProfilePage />} />
            <Route path="/head-to-head" element={<HeadToHeadPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/championships" element={<ChampionshipsPage />} />
            <Route path="/playoffs" element={<PlayoffsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AppShell>
      <ScrollToTopButton />
    </>
  );
}

export default App;
