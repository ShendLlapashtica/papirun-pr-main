import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import ConversationalAuth from '@/components/auth/ConversationalAuth';

// Inverse of RequireAuth: logged-out visitors see only the conversational
// login/signup flow. The gate is a fixed overlay so that when `user` flips
// after OTP verification, the storefront mounts beneath it and the gate
// animates away — children are rendered bare (no transform wrapper) so the
// sticky header keeps working.
const AuthGate = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {user ? children : null}
      <AnimatePresence>
        {!user && (
          <motion.div
            key="auth-gate"
            className="fixed inset-0 z-40 bg-background overflow-y-auto"
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          >
            <ConversationalAuth />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AuthGate;
