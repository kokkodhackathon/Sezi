import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';

import { Layout } from './components/Layout';
import { AuthProvider } from './lib/auth';
import { WorkEdit } from './pages/WorkEdit';
import { Works } from './pages/Works';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/eserler" replace /> },
      { path: 'eserler', element: <Works /> },
      { path: 'eserler/:slug', element: <WorkEdit /> },
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
