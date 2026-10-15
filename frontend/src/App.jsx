import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
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

function App() {
  return (
    <AuthProvider>
      <CartProvider>
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

              {/* Public Shop & Inventory Discovery (Module 4 & 5) */}
              <Route path="shops" element={<PublicShopsPage />} />
              <Route path="shops/:id" element={<ShopDetailsPage />} />
              <Route path="parts" element={<PublicPartsPage />} />
              <Route path="parts/:id" element={<PartDetailsPage />} />

              {/* Module 6: Shopping Cart (Publicly viewable, prompts checkout login) */}
              <Route path="cart" element={<CartPage />} />

              {/* Role-Protected Customer Routes */}
              <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
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
                <Route path="admin/applications" element={<AdminApplicationsPage />} />
              </Route>

              {/* Catch-all 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
