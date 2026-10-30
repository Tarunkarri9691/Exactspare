import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { NotificationProvider } from './context/NotificationContext';
import { CompareProvider } from './context/CompareContext';
import { VehicleProvider } from './context/VehicleContext';
import MainLayout from './layouts/MainLayout';
import OwnerLayout from './layouts/OwnerLayout';
import ProtectedRoute from './components/ProtectedRoute';
import RouteLoadingFallback from './components/RouteLoadingFallback';

// Primary Eager-Loaded Entry Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';

// Auth Gate: Opens Sign-In first if not signed in; after sign-in, opens the pages
const RootRouteGate = () => {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoadingFallback />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <HomePage />;
};

// Route-Split Lazy-Loaded Pages for Optimized Initial Bundle Size
const CustomerRegisterPage = lazy(() => import('./pages/CustomerRegisterPage'));
const OwnerRegisterPage = lazy(() => import('./pages/OwnerRegisterPage'));
const CustomerDashboardPage = lazy(() => import('./pages/CustomerDashboardPage'));
const CustomerSettingsPage = lazy(() => import('./pages/CustomerSettingsPage'));
const OwnerDashboardPage = lazy(() => import('./pages/OwnerDashboardPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Merchant Onboarding & Catalog
const ShopApplicationPage = lazy(() => import('./pages/ShopApplicationPage'));
const AdminApplicationsPage = lazy(() => import('./pages/AdminApplicationsPage'));
const OwnerInventoryPage = lazy(() => import('./pages/OwnerInventoryPage'));
const AddEditPartPage = lazy(() => import('./pages/AddEditPartPage'));
const OwnerShopPage = lazy(() => import('./pages/OwnerShopPage'));
const PublicShopsPage = lazy(() => import('./pages/PublicShopsPage'));
const ShopDetailsPage = lazy(() => import('./pages/ShopDetailsPage'));
const ShopDirectionsPage = lazy(() => import('./pages/ShopDirectionsPage'));
const PublicPartsPage = lazy(() => import('./pages/PublicPartsPage'));
const PartDetailsPage = lazy(() => import('./pages/PartDetailsPage'));

// Owner Operations
const OwnerOrdersPage = lazy(() => import('./pages/OwnerOrdersPage'));
const OwnerEnquiriesPage = lazy(() => import('./pages/OwnerEnquiriesPage'));
const OwnerLocationPage = lazy(() => import('./pages/OwnerLocationPage'));
const OwnerSettingsPage = lazy(() => import('./pages/OwnerSettingsPage'));
const OwnerPaymentMethodPage = lazy(() => import('./pages/OwnerPaymentMethodPage'));

// Admin Management, Analytics & Governance
const AdminSubscriptionsPage = lazy(() => import('./pages/AdminSubscriptionsPage'));

// Account, Wishlist, Notifications & Support
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const CustomerEnquiriesPage = lazy(() => import('./pages/CustomerEnquiriesPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const CustomerSupportPage = lazy(() => import('./pages/CustomerSupportPage'));
const TicketDetailsPage = lazy(() => import('./pages/TicketDetailsPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const EmailVerificationPage = lazy(() => import('./pages/EmailVerificationPage'));

// Admin Management, Analytics & Governance
const AdminAnalyticsPage = lazy(() => import('./pages/AdminAnalyticsPage'));
const AdminShopsPage = lazy(() => import('./pages/AdminShopsPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminPartsModerationPage = lazy(() => import('./pages/AdminPartsModerationPage'));
const AdminReviewModerationPage = lazy(() => import('./pages/AdminReviewModerationPage'));
const AdminAuditLogsPage = lazy(() => import('./pages/AdminAuditLogsPage'));
const AdminSupportPage = lazy(() => import('./pages/AdminSupportPage'));
const AdminTrustSafetyPage = lazy(() => import('./pages/AdminTrustSafetyPage'));

function App() {
  return (
    <AuthProvider>
      <VehicleProvider>
        <CartProvider>
          <WishlistProvider>
            <NotificationProvider>
              <CompareProvider>
                <BrowserRouter>
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <Routes>
                      {/* Role-Protected Shop Owner Routes (Dedicated Owner Layout & Navigation) */}
                      <Route element={<ProtectedRoute allowedRoles={['OWNER']} />}>
                        <Route path="owner" element={<OwnerLayout />}>
                          <Route index element={<Navigate to="/owner/dashboard" replace />} />
                          <Route path="dashboard" element={<OwnerDashboardPage />} />
                          <Route path="application" element={<ShopApplicationPage />} />
                          <Route path="shop" element={<OwnerShopPage />} />
                          <Route path="location" element={<OwnerLocationPage />} />
                          <Route path="shop-location" element={<OwnerLocationPage />} />
                          <Route path="inventory" element={<OwnerInventoryPage />} />
                          <Route path="inventory/add" element={<AddEditPartPage />} />
                          <Route path="inventory/new" element={<AddEditPartPage />} />
                          <Route path="inventory/:id/edit" element={<AddEditPartPage />} />
                          <Route path="enquiries" element={<OwnerEnquiriesPage />} />
                          <Route path="notifications" element={<NotificationsPage />} />
                          <Route path="settings" element={<OwnerSettingsPage />} />
                          <Route path="orders" element={<OwnerOrdersPage />} />
                          <Route path="subscription" element={<OwnerPaymentMethodPage />} />
                          <Route path="payment-method" element={<OwnerPaymentMethodPage />} />
                          <Route path="payment" element={<OwnerPaymentMethodPage />} />
                        </Route>
                      </Route>

                      <Route path="/" element={<MainLayout />}>
                        {/* Root Route: Opens Sign-In First if not signed in */}
                        <Route index element={<RootRouteGate />} />

                        {/* Public Auth & Registration Routes */}
                        <Route path="login" element={<LoginPage />} />
                        <Route path="register" element={<CustomerRegisterPage />} />
                        <Route path="register-owner" element={<OwnerRegisterPage />} />
                        <Route path="shop-owner" element={<OwnerRegisterPage />} />
                        <Route path="unauthorized" element={<UnauthorizedPage />} />
                        <Route path="forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="reset-password" element={<ResetPasswordPage />} />
                        <Route path="verify-email" element={<EmailVerificationPage />} />
                        <Route path="shop-application" element={<ShopApplicationPage />} />

                        {/* Authenticated Marketplace Pages (Must sign in first to open pages) */}
                        <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'OWNER', 'ADMIN']} />}>
                          <Route path="compare" element={<ComparePage />} />
                          <Route path="shops" element={<PublicShopsPage />} />
                          <Route path="shops/:id" element={<ShopDetailsPage />} />
                          <Route path="shops/:id/directions" element={<ShopDirectionsPage />} />
                          <Route path="parts" element={<PublicPartsPage />} />
                          <Route path="parts/:id" element={<PartDetailsPage />} />
                          <Route path="cart" element={<Navigate to="/parts" replace />} />
                          <Route path="notifications" element={<NotificationsPage />} />
                          <Route path="support" element={<CustomerSupportPage />} />
                          <Route path="support/tickets/:ticketId" element={<TicketDetailsPage />} />
                          <Route path="orders/:orderId/track" element={<Navigate to="/parts" replace />} />
                          <Route path="orders/:orderId/tracking" element={<Navigate to="/parts" replace />} />
                          <Route path="account/security" element={<ChangePasswordPage />} />
                          <Route path="change-password" element={<ChangePasswordPage />} />
                        </Route>

                        {/* Role-Protected Customer Routes */}
                        <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
                          <Route path="wishlist" element={<WishlistPage />} />
                          <Route path="customer/dashboard" element={<CustomerDashboardPage />} />
                          <Route path="customer/enquiries" element={<CustomerEnquiriesPage />} />
                          <Route path="enquiries" element={<CustomerEnquiriesPage />} />
                          <Route path="settings" element={<CustomerSettingsPage />} />
                          <Route path="customer/settings" element={<CustomerSettingsPage />} />
                          <Route path="checkout" element={<Navigate to="/parts" replace />} />
                          <Route path="orders" element={<Navigate to="/parts" replace />} />
                          <Route path="orders/:orderId" element={<Navigate to="/parts" replace />} />
                          <Route path="orders/:orderId/confirmation" element={<Navigate to="/parts" replace />} />
                        </Route>

                        {/* Role-Protected Administrator Routes */}
                        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                          <Route path="admin/dashboard" element={<AdminDashboardPage />} />
                          <Route path="admin/analytics" element={<AdminAnalyticsPage />} />
                          <Route path="admin/subscriptions" element={<AdminSubscriptionsPage />} />
                          <Route path="admin/applications" element={<AdminApplicationsPage />} />
                          <Route path="admin/shops" element={<AdminShopsPage />} />
                          <Route path="admin/users" element={<AdminUsersPage />} />
                          <Route path="admin/moderation/parts" element={<AdminPartsModerationPage />} />
                          <Route path="admin/moderation/reviews" element={<AdminReviewModerationPage />} />
                          <Route path="admin/audit-logs" element={<AdminAuditLogsPage />} />
                          <Route path="admin/support" element={<AdminSupportPage />} />
                          <Route path="admin/trust-safety" element={<AdminTrustSafetyPage />} />
                        </Route>

                        {/* Catch-all 404 Route */}
                        <Route path="*" element={<NotFoundPage />} />
                      </Route>
                    </Routes>
                </Suspense>
              </BrowserRouter>
            </CompareProvider>
          </NotificationProvider>
        </WishlistProvider>
      </CartProvider>
    </VehicleProvider>
  </AuthProvider>
);
}

export default App;
