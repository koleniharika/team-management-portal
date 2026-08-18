import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout, { ProtectedRoute } from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import CompletedTasks from './pages/CompletedTasks';
import TaskDetail from './pages/TaskDetail';
import Team from './pages/Team';
import ReportCard from './pages/ReportCard';
import Brands from './pages/Brands';
import Salary from './pages/Salary';
import Payslip from './pages/Payslip';
import Invoices from './pages/Invoices';
import InvoiceView from './pages/InvoiceView';
import Analytics from './pages/Analytics';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/me" element={<EmployeeDashboard />} />
                <Route path="/tasks/:id" element={<TaskDetail />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute adminOnly />}>
              <Route element={<Layout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/completed-tasks" element={<CompletedTasks />} />
                <Route path="/team" element={<Team />} />
                <Route path="/team/:userId" element={<ReportCard />} />
                <Route path="/brands" element={<Brands />} />
                <Route path="/salary" element={<Salary />} />
                <Route path="/salary/:userId/:month" element={<Payslip />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/invoices/:id" element={<InvoiceView />} />
                <Route path="/analytics" element={<Analytics />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
