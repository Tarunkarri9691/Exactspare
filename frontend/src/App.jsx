import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { NotificationProvider } from './context/NotificationContext';
import { CompareProvider } from './context/CompareContext';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Module 1 & 2 Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import CustomerRegisterPage from './pages/CustomerRegisterPage';
import OwnerRegisterPage from './pages/OwnerRegisterPage';
import CustomerDashboardPage from './pages/CustomerDashboardPage';
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';

// Module 3 Pages
import ShopApplicationPage from './pages/ShopApplicationPage';
import AdminApplicationsPage from './pages/AdminApplicationsPage';

// Module 4 Pages: Shop Management & Inventory
import OwnerInventoryPage from './pages/OwnerInventoryPage';
import AddEditPartPage from './pages/AddEditPartPage';
import OwnerShopPage from './pages/OwnerShopPage';
import PublicShopsPage from './pages/PublicShopsPage';
import ShopDetailsPage from './pages/ShopDetailsPage';
import PublicPartsPage from './pages/PublicPartsPage';
import PartDetailsPage from './pages/PartDetailsPage';

// Module 6 Pages: Shopping Cart, Checkout, Customer Orders & Shop Owner Orders
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import CustomerOrdersPage from './pages/CustomerOrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import OwnerOrdersPage from './pages/OwnerOrdersPage';

// Module 7 Pages: Wishlist & Notifications
import WishlistPage from './pages/WishlistPage';
import NotificationsPage from './pages/NotificationsPage';

// Module 8 Pages: Admin Analytics, Reports, Moderation & Platform Management
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import AdminShopsPage from './pages/AdminShopsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminPartsModerationPage from './pages/AdminPartsModerationPage';
import AdminReviewModerationPage from './pages/AdminReviewModerationPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';

// Module 10 Pages: Comparison
import ComparePage from './pages/ComparePage';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <NotificationProvider>
            <CompareProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<MainLayout />}>
                    {/* Public Routes */}
                    <Route index element={<HomePage />} />
                    <Route path="login" element={<LoginPage />} />
                    <Route path="register" element={<CustomerRegisterPage />} />
                    <Route path="register-owner" element={<OwnerRegisterPage />} />
                    <Route path="shop-owner" element={<OwnerRegisterPage />} />
                    <Route path="unauthorized" element={<UnauthorizedPage />} />

                    {/* Module 10: Product Comparison */}
                    <Route path="compare" element={<ComparePage />} />

                    {/* Public Shop & Inventory Discovery (Module 4 & 5) */}
                    <Route path="shops" element={<PublicShopsPage />} />
                    <Route path="shops/:id" element={<ShopDetailsPage />} />
                    <Route path="parts" element={<PublicPartsPage />} />
                    <Route path="parts/:id" element={<PartDetailsPage />} />

                    {/* Module 6: Shopping Cart */}
                    <Route path="cart" element={<CartPage />} />

                    {/* Authenticated Notifications (All roles) */}
                    <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'OWNER', 'ADMIN']} />}>
                      <Route path="notifications" element={<NotificationsPage />} />
                    </Route>

                  {/* Role-Protected Customer Routes (Module 6 & 7) */}
                  <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
                    <Route path="wishlist" element={<WishlistPage />} />
                    <Route path="customer/dashboard" element={<CustomerDashboardPage />} />
                    <Route path="checkout" element={<CheckoutPage />} />
                    <Route path="orders" element={<CustomerOrdersPage />} />
                    <Route path="orders/:orderId" element={<OrderDetailsPage />} />
                    <Route path="orders/:orderId/confirmation" element={<OrderConfirmationPage />} />
                  </Route>

                  {/* Role-Protected Shop Owner Routes (Module 3, 4 & 6) */}
                  <Route element={<ProtectedRoute allowedRoles={['OWNER']} />}>
                    <Route path="owner/dashboard" element={<OwnerDashboardPage />} />
                    <Route path="owner/application" element={<ShopApplicationPage />} />
                    <Route path="shop-application" element={<ShopApplicationPage />} />
                    
                    {/* Module 4: Inventory & Shop Management */}
                    <Route path="owner/inventory" element={<OwnerInventoryPage />} />
                    <Route path="owner/inventory/new" element={<AddEditPartPage />} />
                    <Route path="owner/inventory/:id/edit" element={<AddEditPartPage />} />
                    <Route path="owner/shop" element={<OwnerShopPage />} />

                    {/* Module 6: Shop Owner Orders Fulfillment */}
                    <Route path="owner/orders" element={<OwnerOrdersPage />} />
                  </Route>

                  {/* Role-Protected Administrator Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                    <Route path="admin/dashboard" element={<AdminDashboardPage />} />
                    <Route path="admin/analytics" element={<AdminAnalyticsPage />} />
                    <Route path="admin/applications" element={<AdminApplicationsPage />} />
                    <Route path="admin/shops" element={<AdminShopsPage />} />
                    <Route path="admin/users" element={<AdminUsersPage />} />
                    <Route path="admin/moderation/parts" element={<AdminPartsModerationPage />} />
                    <Route path="admin/moderation/reviews" element={<AdminReviewModerationPage />} />
                    <Route path="admin/audit-logs" element={<AdminAuditLogsPage />} />
                  </Route>

                  {/* Catch-all 404 Route */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              </BrowserRouter>
            </CompareProvider>
          </NotificationProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
