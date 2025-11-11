import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTrpc } from './api/trpcProvider.js';
import { LoginPage } from './pages/LoginPage.js';
import { BookListPage } from './pages/BookListPage.js';
import { BookCreatePage } from './pages/BookCreatePage.js';
import { BookEditPage } from './pages/BookEditPage.js';
import { AdminLayout } from './components/AdminLayout.js';

function RequireAuth({ children }: { children: React.ReactNode }): JSX.Element {
  const { secret } = useTrpc();
  const location = useLocation();

  if (!secret) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="books" replace />} />
        <Route path="books">
          <Route index element={<BookListPage />} />
          <Route path="new" element={<BookCreatePage />} />
          <Route path=":bookId/edit" element={<BookEditPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
