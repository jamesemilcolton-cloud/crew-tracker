import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProfilesProvider } from "@/contexts/ProfilesContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ModuleSelection from "./pages/ModuleSelection";
import Index from "./pages/Index";
import Sales from "./pages/Sales";
import LinkedInPage from "./pages/LinkedIn";
import LeaderboardPage from "./pages/LeaderboardPage";
import WeekSummaryPage from "./pages/WeekSummaryPage";
import Manager from "./pages/Manager";
import Auth from "./pages/Auth";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><span className="text-muted-foreground text-sm">Loading...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RoleRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, userRole, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><span className="text-muted-foreground text-sm">Loading...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!userRole || !allowedRoles.includes(userRole.role)) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { user, userRole, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><span className="text-muted-foreground text-sm">Loading...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!userRole || userRole.role !== "manager" || !userRole.super_admin) {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ProfilesProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<ProtectedRoute><ModuleSelection /></ProtectedRoute>} />
                <Route path="/week-summary" element={<ProtectedRoute><WeekSummaryPage /></ProtectedRoute>} />
                <Route path="/recruitment" element={<RoleRoute allowedRoles={["leader", "manager"]}><Index /></RoleRoute>} />
                <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
                <Route path="/linkedin" element={<RoleRoute allowedRoles={["leader", "manager"]}><LinkedInPage /></RoleRoute>} />
                <Route path="/leaderboards" element={<RoleRoute allowedRoles={["leader", "manager"]}><LeaderboardPage /></RoleRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/manager" element={<ManagerRoute><Manager /></ManagerRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ProfilesProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
