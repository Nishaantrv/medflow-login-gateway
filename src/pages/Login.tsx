import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

const demoAccounts = [
  { label: 'Patient Demo', email: 'patient@demo.com', password: 'demo1234' },
  { label: 'Doctor Demo', email: 'doctor@demo.com', password: 'demo1234' },
  { label: 'Admin Demo', email: 'admin@demo.com', password: 'demo1234' },
  { label: 'Family Demo', email: 'family@demo.com', password: 'demo1234' },
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      toast.success('Signed in successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[hsl(174,72%,35%)] to-[hsl(200,50%,45%)] items-end p-10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center mix-blend-overlay opacity-60" />
        <div className="relative z-10 text-white">
          <div className="text-4xl mb-2">🧠</div>
          <h2 className="text-2xl font-bold font-display tracking-tight">MEDFLOW AI</h2>
          <p className="mt-4 text-white/90 text-sm leading-relaxed max-w-md">
            Empowering Healthcare, One Click at a Time:<br />
            Your Health, Your Records, Your Control.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-background p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div>
            <div className="text-4xl mb-4">🧠</div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">Login</h1>
            <p className="text-muted-foreground text-sm mt-1">Log in to your account.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="h-12 rounded-xl border-border bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-12 rounded-xl border-border bg-background pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="text-right">
                <a href="#" className="text-sm text-primary hover:underline">Forgot Password?</a>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base"
            >
              {isLoading ? 'Logging in...' : 'Log In'}
            </Button>
          </form>

          {/* Demo buttons */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center mb-3">Quick Demo Access</p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => fillDemo(demo.email, demo.password)}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border border-border text-muted-foreground hover:border-primary hover:text-primary cursor-pointer bg-background"
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
