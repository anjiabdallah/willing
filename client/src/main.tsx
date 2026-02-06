import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import HomePage from './pages/HomePage';
import AdminPage from './pages/admin/AdminPage';
import OrgReqPage from './pages/OrgReqPage';
import VolunteerCreate from './pages/volunteers/VolunteerCreate';
import VolunteerPage from './pages/volunteers/VolunteerPage';

import './index.css';
import { BrowserRouter, Route, Routes } from 'react-router';
import AdminHome from './pages/admin/AdminHome';
import AdminLogin from './pages/admin/AdminLogin';

import './index.css';
import VolunteerHome from './pages/volunteers/VolunteerHome';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="admin" element={<AdminPage />}>
          <Route index element={<AdminHome />} />
          <Route path="login" element={<AdminLogin />} />
        </Route>
        <Route path="organizationrequest" element={<OrgReqPage />} />
        <Route path="volunteer" element={<VolunteerPage />}>
          <Route index element={<VolunteerHome />}></Route>
          <Route path="create" element={<VolunteerCreate />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
