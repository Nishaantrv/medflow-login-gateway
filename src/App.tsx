import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const RoleRedirect = () => {
  const { session, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  if (!session) return <Login />;
  if (role) return <Navigate to={`/${role}/dashboard`} replace />;
  return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading role...</div>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RoleRedirect />} />
            <Route path="/patient/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/doctor/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/family/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
