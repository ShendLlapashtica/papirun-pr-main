import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import RequireAuth from "@/components/RequireAuth";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Home from "./pages/Home";
import ProductViewWrapper from "./pages/ProductViewWrapper";
import AppProductPage from "./pages/AppProductPage";
import OfferViewWrapper from "./pages/OfferViewWrapper";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";
import OrderTrackingPill from "@/components/OrderTrackingPill";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <FavoritesProvider>
            <CartProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  {/* Legacy redirects — single passwordless flow now */}
                  <Route path="/signup" element={<Navigate to="/login" replace />} />
                  <Route path="/verify" element={<Navigate to="/login" replace />} />
                  <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/admin" element={<Admin />} />
                  {/* Web product page (desktop + mobile browser visiting papirun.net) */}
                  <Route path="/product/:id" element={<ProductViewWrapper />} />
                  {/* App product page (PWA / logged-in /home users) */}
                  <Route path="/app/product/:id" element={<RequireAuth><AppProductPage /></RequireAuth>} />
                  <Route path="/offer/:id" element={<OfferViewWrapper />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                {/* Global pending overlay + status pill — visible on every route */}
                <OrderTrackingPill />
              </TooltipProvider>
            </CartProvider>
          </FavoritesProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
