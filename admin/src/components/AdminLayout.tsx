import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTrpc } from '../api/trpcProvider.js';
import './AdminLayout.css';

export function AdminLayout(): JSX.Element {
  const { setToken } = useTrpc();
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken(null);
    navigate('/login', { replace: true });
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="sidebar__title">Talegram Admin</h1>
        <nav className="sidebar__nav">
          <NavLink to="/books" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Books
          </NavLink>
          <NavLink to="/books/new" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            New book
          </NavLink>
          <NavLink to="/authors" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Authors
          </NavLink>
          <NavLink to="/community" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Community members
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}>
            Project settings
          </NavLink>
        </nav>
        <button type="button" className="sidebar__logout" onClick={handleLogout}>
          Log out
        </button>
      </aside>
      <main className="layout__content">
        <Outlet />
      </main>
    </div>
  );
}
