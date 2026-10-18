import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import 'mapbox-gl/dist/mapbox-gl.css';
import './index.css';

import { Layout } from './components/Layout';
import { AuthProvider } from './lib/auth';
import { Cities } from './pages/Cities';
import { Inbox } from './pages/Inbox';
import { Matching } from './pages/Matching';
import { NewWork } from './pages/NewWork';
import { Reports } from './pages/Reports';
import { Points } from './pages/Points';
import { RouteTest } from './pages/RouteTest';
import { Texts } from './pages/Texts';
import { WorkEdit } from './pages/WorkEdit';
import { Works } from './pages/Works';

// Panel service worker kullanmaz. Aynı adreste (localhost:3000) daha önce çalışan başka bir projenin
// service worker'ı kalırsa tüm istekleri kendi CSP'siyle engeller: kaldırılır ve sayfa bir kez yenilenir.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    if (registrations.length === 0) return;
    await Promise.all(registrations.map((r) => r.unregister()));
    if (navigator.serviceWorker.controller) window.location.reload();
  });
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/eserler" replace /> },
      { path: 'eserler', element: <Works /> },
      { path: 'eserler/yeni', element: <NewWork /> },
      { path: 'eserler/:slug', element: <WorkEdit /> },
      { path: 'eslestirme', element: <Matching /> },
      { path: 'metinler', element: <Texts /> },
      { path: 'fotograflar', element: <Inbox /> },
      { path: 'bildirimler', element: <Reports /> },
      { path: 'noktalar', element: <Points /> },
      { path: 'rota-testi', element: <RouteTest /> },
      { path: 'iller', element: <Cities /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
