import { StrictMode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';

import { AuthProvider } from './auth/AuthContext';
import AdminPage from './auth/pages/AdminPage';
import LoggedOutPage from './auth/pages/LoggedOutPage';
import OrganizationPage from './auth/pages/OrganizationPage';
import SharedPage from './auth/pages/SharedPage';
import VolunteerPage from './auth/pages/VolunteerPage';
import { PostingViewModeProvider } from './components/postings/PostingViewModeContext';
import { ModalProvider } from './contexts/ModalContext.tsx';
import { NotificationsProvider } from './notifications/NotificationsContext';
import AdminCrises from './pages/admin/AdminCrises';
import AdminHome from './pages/admin/AdminHome';
import AdminReportDetail from './pages/admin/AdminReportDetail';
import AdminReports from './pages/admin/AdminReports';
import AdminRequests from './pages/admin/AdminRequests';
import AdminSettings from './pages/admin/AdminSettings';
import AdminLogin from './pages/AdminLogin';
import CalendarInfoDemoPage from './pages/CalendarInfoDemoPage';
import CertificateVerification from './pages/CertificateVerification';
import ForgotPassword from './pages/ForgotPassword';
import GuidePage from './pages/GuidePage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import OrganizationHome from './pages/organization/OrganizationHome';
import OrganizationPostingAttendance from './pages/organization/OrganizationPostingAttendance';
import OrganizationPostingCreate from './pages/organization/OrganizationPostingCreate';
import OrganizationOwnProfile from './pages/organization/OrganizationProfile';
import OrganizationSettings from './pages/organization/OrganizationSettings';
import OrganizationVolunteerProfile from './pages/organization/OrganizationVolunteerProfile';
import OrganizationProfile from './pages/OrganizationProfile';
import OrganizationRequest from './pages/OrganizationRequest';
import Posting from './pages/Posting';
import UserLogin from './pages/UserLogin';
import VolunteerCertificateRequest from './pages/volunteer/VolunteerCertificateRequest';
import VolunteerCrisisPostings from './pages/volunteer/VolunteerCrisisPostings';
import VolunteerEnrollments from './pages/volunteer/VolunteerEnrollments';
import VolunteerForYou from './pages/volunteer/VolunteerForYou';
import VolunteerHome from './pages/volunteer/VolunteerHome';
import VolunteerProfile from './pages/volunteer/VolunteerProfile';
import VolunteerSearch from './pages/volunteer/VolunteerSearch';
import VolunteerSettings from './pages/volunteer/VolunteerSettings';
import VolunteerCreate from './pages/VolunteerCreate';
import VolunteerVerifyEmail from './pages/VolunteerVerifyEmail';

function App() {
  return (
    <StrictMode>
      <BrowserRouter>
        <NotificationsProvider>
          <ModalProvider>
            <AuthProvider>
              <PostingViewModeProvider>
                <Routes>
                  <Route index element={<HomePage />} />

                  <Route element={<LoggedOutPage />}>
                    <Route path="login" element={<UserLogin />} />
                    <Route path="admin/login" element={<AdminLogin />} />
                    <Route path="volunteer/create" element={<VolunteerCreate />} />
                    <Route path="volunteer/verify-email" element={<VolunteerVerifyEmail />} />
                    <Route path="organization/request" element={<OrganizationRequest />} />
                    <Route path="forgot-password" element={<ForgotPassword />} />
                  </Route>

                  <Route path="admin" element={<AdminPage />}>
                    <Route index element={<AdminHome />} />
                    <Route path="requests" element={<AdminRequests />} />
                    <Route path="reports" element={<AdminReports />} />
                    <Route path="reports/:reportType/:reportId" element={<AdminReportDetail />} />
                    <Route path="crises" element={<AdminCrises />} />
                    <Route path="settings" element={<AdminSettings />} />
                  </Route>

                  <Route path="organization" element={<OrganizationPage />}>
                    <Route index element={<OrganizationHome />} />
                    <Route path="posting" element={<OrganizationPostingCreate />} />
                    <Route path="posting/:id/attendance" element={<OrganizationPostingAttendance />} />
                    <Route path="profile" element={<OrganizationOwnProfile />} />
                    <Route path="settings" element={<OrganizationSettings />} />
                    <Route path="volunteer/:volunteerId" element={<OrganizationVolunteerProfile />} />
                  </Route>

                  <Route path="volunteer" element={<VolunteerPage />}>
                    <Route index element={<VolunteerHome />} />
                    <Route path="certificate" element={<VolunteerCertificateRequest />} />
                    <Route path="enrollments" element={<VolunteerEnrollments />} />
                    <Route path="for-you" element={<VolunteerForYou />} />
                    <Route path="crises/:crisisId/postings" element={<VolunteerCrisisPostings />} />
                    <Route path="profile" element={<VolunteerProfile />} />
                    <Route path="search" element={<VolunteerSearch />} />
                    <Route path="settings" element={<VolunteerSettings />} />
                  </Route>

                  <Route path="guide" element={<GuidePage />} />
                  <Route path="certificate/verify" element={<CertificateVerification />} />
                  <Route path="calendar-demo" element={<CalendarInfoDemoPage />} />

                  <Route element={<SharedPage roles={['volunteer', 'organization']} />}>
                    <Route path="posting/:id" element={<Posting />} />
                    <Route path="organization/:id" element={<OrganizationProfile />} />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </PostingViewModeProvider>
            </AuthProvider>
          </ModalProvider>
        </NotificationsProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

export default App;
