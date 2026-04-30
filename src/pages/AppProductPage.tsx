import AppShell from '@/components/AppShell';
import AppProductView from '@/components/app/AppProductView';

/**
 * AppProductPage — wraps AppProductView in the AppShell so that the BottomNav
 * stays visible while browsing a product. This route is dedicated to the
 * mobile/app experience (`/product/:id` for users coming from /home).
 */
const AppProductPage = () => (
  <AppShell>
    <AppProductView />
  </AppShell>
);

export default AppProductPage;
