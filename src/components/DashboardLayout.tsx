import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type AppRole = 'patient' | 'doctor' | 'admin' | 'family';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

const navConfig: Record<AppRole, NavItem[]> = {
  patient: [
    { icon: '🏠', label: 'Dashboard', path: '/patient/dashboard' },
    { icon: '💬', label: 'Chat with AI', path: '/patient/chat' },
    { icon: '📅', label: 'Appointments', path: '/patient/appointments' },
    { icon: '💊', label: 'Medications', path: '/patient/medications' },
    { icon: '🔔', label: 'Notifications', path: '/patient/notifications' },
  ],
  doctor: [
    { icon: '🏠', label: 'Dashboard', path: '/doctor/dashboard' },
    { icon: '📋', label: 'SOAP Notes', path: '/doctor/soap-notes' },
    { icon: '👥', label: 'My Patients', path: '/doctor/patients' },
    { icon: '📅', label: 'Schedule', path: '/doctor/schedule' },
  ],
  admin: [
    { icon: '🏠', label: 'Operations', path: '/admin/dashboard' },
    { icon: '🛏️', label: 'Bed Management', path: '/admin/beds' },
    { icon: '👥', label: 'Staff Schedule', path: '/admin/staff' },
    { icon: '💰', label: 'Billing', path: '/admin/billing' },
  ],
  family: [
    { icon: '💙', label: 'Health Status', path: '/family/dashboard' },
    { icon: '📅', label: 'Visit Schedule', path: '/family/visits' },
    { icon: '💬', label: 'Chat with AI', path: '/family/chat' },
    { icon: '🔔', label: 'Notifications', path: '/family/notifications' },
  ],
};

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { role, profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const items = role ? navConfig[role] : [];
  const displayName = profile?.full_name || 'User';
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';

  const sidebar = (
    <aside className="flex h-full w-64 flex-col" style={{ background: '#0C0F1A' }}>
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 pt-6 pb-2">
        <span className="text-2xl">🧠</span>
        <span className="text-lg font-bold tracking-tight text-white font-display">MedFlow AI</span>
      </div>

      {/* User info */}
      <div className="px-5 py-4 border-b border-white/10">
        <p className="text-sm font-semibold text-white truncate">{displayName}</p>
        <Badge className="mt-1 bg-primary/20 text-primary border-primary/30 text-[10px] uppercase tracking-wider">
          {roleLabel}
        </Badge>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {items.map((item) => {
            const active = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => isMobile && setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-l-[3px] border-[#14B8A6] text-[#14B8A6] bg-white/5'
                    : 'border-l-[3px] border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Sign out */}
      <div className="px-3 pb-5 pt-2 border-t border-white/10">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: '#060810' }}>
      {/* Desktop sidebar */}
      {!isMobile && sidebar}

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="h-full">{sidebar}</div>
          <div className="flex-1 bg-black/60" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {isMobile && (
          <header className="flex h-12 items-center border-b border-white/10 px-4" style={{ background: '#0C0F1A' }}>
            <button onClick={() => setSidebarOpen(true)} className="text-white">
              <Menu size={20} />
            </button>
            <span className="ml-3 text-sm font-bold text-white">🧠 MedFlow AI</span>
          </header>
        )}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
