# Multi-Vendor Cart System Implementation

## Overview
A complete multi-vendor cart system that allows users to add products from different vendors into a single cart, then checkout once to create separate orders per vendor automatically.

## Features Implemented

### ✅ Database (Supabase)

#### Cart Items Table
**File**: `supabase/migrations/20251105_create_cart_items_table.sql`

**Schema**:
```sql
CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vendor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, vendor_id, product_id) -- Prevents duplicate items
);
```

**RLS Policies**:
- ✅ Users can view their own cart items
- ✅ Users can insert their own cart items
- ✅ Users can update their own cart items
- ✅ Users can delete their own cart items

**Real-time**: Enabled for instant cart updates

### ✅ Frontend Integration

#### Cart Context (`src/app/context/CartContex.tsx`)
- **Supabase Integration**: Cart items are stored in Supabase, not local storage
- **Real-time Updates**: Automatic cart updates when items are added/removed
- **Functions**:
  - `addToCart(productId, vendorId, quantity)`: Adds item to cart or increments quantity
  - `removeFromCart(cartItemId)`: Removes item from cart
  - `updateQuantity(cartItemId, quantity)`: Updates item quantity
  - `clearCart()`: Clears all items from cart
  - `refreshCart()`: Manually refresh cart items
- **Properties**:
  - `cartItems`: Array of cart items with product and vendor info
  - `cartCount`: Total quantity of all items (for cart icon badge)
  - `loading`: Loading state

#### Explore Page (`src/app/explore/page.tsx`)
- ✅ **Add to Cart Button**: Added alongside "Order Now" button
- ✅ **Toast Notifications**: Shows "Item added to cart!" notification
- ✅ **Error Handling**: Handles login required, invalid vendor/product
- ✅ **Loading States**: Shows "Adding..." while adding to cart

#### Cart Page (`src/app/cart/page.tsx`)
- ✅ **Vendor Grouping**: Items grouped by vendor with vendor header
- ✅ **Vendor Information**: Shows vendor name, image, location
- ✅ **Product Display**: Shows product image, name, quantity, price
- ✅ **Quantity Controls**: Increase/decrease quantity buttons
- ✅ **Remove Items**: Remove button for each item
- ✅ **Subtotals**: Shows subtotal per vendor
- ✅ **Overall Total**: Shows total across all vendors
- ✅ **Checkout Button**: Single checkout button for all vendors
- ✅ **Success Message**: Shows "Checkout successful" message
- ✅ **Empty State**: Friendly message when cart is empty

#### Navbar (`src/components/Navbar.tsx`)
- ✅ **Cart Icon**: Shows cart icon with item count badge
- ✅ **Live Count**: Updates automatically via real-time subscription
- ✅ **Badge Display**: Shows "99+" for counts over 99
- ✅ **Hover Effects**: Smooth transitions

### ✅ Checkout Logic

#### Multi-Vendor Order Creation
When user clicks "Checkout":
1. Groups cart items by `vendor_id`
2. Creates separate orders for each vendor
3. Each order contains all items from that vendor
4. Sets order status to "Pending"
5. Clears cart after successful order creation
6. Redirects to payment

#### Order Structure
- One order per product (orders table design)
- All orders for the same vendor are created together
- Orders are linked by `vendor_id` for vendor dashboard filtering

### ✅ Real-Time Updates

#### Cart Real-time Subscription
- Subscribes to `cart_items` table changes
- Filters by `user_id = auth.uid()`
- Automatically updates cart when:
  - Item is added
  - Item is removed
  - Item quantity is updated
  - Cart is cleared

#### Cart Icon Updates
- Cart count badge updates instantly
- No page refresh needed
- Works across all pages

### ✅ Payment Flow

#### Payment Integration
- Redirects to Paystack payment after checkout
- Uses total amount from all vendors
- Payment reference stored with first order
- On success: Orders remain "Pending" (vendor needs to accept)

#### Payment Updates
- Payment status can be tracked
- Orders can be updated with payment reference
- Vendor sees payment status on their dashboard

## Database Schema

### Cart Items Table
```sql
cart_items
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── vendor_id (uuid, FK → auth.users)
├── product_id (uuid, FK → menu_items)
├── quantity (integer)
├── price (numeric)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

### Orders Table (Existing)
```sql
orders
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── vendor_id (uuid, FK → auth.users)
├── product_id (uuid, FK → menu_items)
├── quantity (integer)
├── total_price (numeric)
├── status (text: Pending, Accepted, Confirmed, Rejected, Completed, Cancelled)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

## User Flow

### Adding to Cart
1. User browses menu items on Explore page
2. Clicks "Add to Cart" button
3. Item is added to `cart_items` table
4. Cart icon badge updates instantly
5. Toast notification appears: "Item added to cart!"

### Viewing Cart
1. User clicks cart icon or navigates to `/cart`
2. Cart page loads items from Supabase
3. Items are grouped by vendor
4. Each vendor section shows:
   - Vendor name and image
   - Products from that vendor
   - Subtotal for that vendor
5. Bottom shows overall total

### Checkout
1. User clicks "Checkout" button
2. System creates orders:
   - Groups items by vendor
   - Creates one order per product
   - All orders for same vendor are linked
3. Cart is cleared
4. Success message appears
5. Redirects to payment

### Payment
1. Paystack payment window opens
2. User completes payment
3. Payment reference is stored
4. Orders remain "Pending" (vendor accepts)

## Vendor Flow

### Viewing Orders
1. Vendor navigates to `/vendor/orders`
2. Sees only their orders (filtered by `vendor_id = auth.uid()`)
3. Orders are displayed with:
   - Customer information
   - Product details
   - Order status
   - Payment status

### Managing Orders
- **Accept Order**: Changes status from "Pending" to "Accepted"
- **Confirm Order**: Changes status to "Confirmed"
- **Complete Order**: Changes status to "Completed"
- **Reject/Cancel**: Changes status to "Rejected" or "Cancelled"

## Real-Time Features

### Cart Updates
- Cart count updates instantly when items are added/removed
- Cart page updates automatically
- Works across multiple browser tabs

### Order Updates
- Vendors see new orders in real-time
- Users see order status changes in real-time
- No page refresh needed

## Files Created/Modified

### Database Migrations
1. `supabase/migrations/20251105_create_cart_items_table.sql`
   - Creates cart_items table
   - Sets up RLS policies
   - Enables real-time

### Frontend Files
1. `src/app/context/CartContex.tsx`
   - Complete rewrite to use Supabase
   - Real-time subscriptions
   - Cart management functions

2. `src/app/cart/page.tsx`
   - Vendor grouping
   - Multi-vendor checkout
   - Enhanced UI

3. `src/app/explore/page.tsx`
   - Add to Cart button
   - Toast notifications
   - Error handling

4. `src/app/vendors/[id]/page.tsx`
   - Add to Cart functionality
   - Toast notifications

5. `src/components/Navbar.tsx`
   - Cart icon with live count
   - Real-time updates

## Testing

### Test Adding to Cart
1. Log in as a user
2. Navigate to Explore page
3. Click "Add to Cart" on multiple items from different vendors
4. Verify cart icon badge updates
5. Verify toast notification appears
6. Navigate to cart page
7. Verify items are grouped by vendor

### Test Cart Management
1. View cart page
2. Update quantity of an item
3. Verify quantity updates in real-time
4. Remove an item
5. Verify item is removed immediately
6. Verify cart count updates

### Test Checkout
1. Add items from multiple vendors to cart
2. Click "Checkout"
3. Verify orders are created (one per product)
4. Verify cart is cleared
5. Verify success message appears
6. Verify payment window opens

### Test Real-time Updates
1. Open cart in one browser tab
2. Add item to cart in another tab
3. Verify cart updates in first tab automatically
4. Verify cart icon updates in both tabs

## Troubleshooting

### Cart Not Updating
- Check if user is authenticated
- Verify RLS policies are correct
- Check browser console for errors
- Verify real-time subscription is active

### Items Not Adding to Cart
- Check if user is logged in
- Verify product_id and vendor_id are valid UUIDs
- Check browser console for errors
- Verify menu_items table has the product

### Checkout Failing
- Verify all cart items have valid vendor_id and product_id
- Check foreign key constraints
- Verify user is authenticated
- Check RLS policies allow order creation

### Real-time Not Working
- Verify real-time is enabled in Supabase
- Check browser console for subscription errors
- Verify user is authenticated
- Check network connectivity

## Next Steps

### Potential Enhancements
- [ ] Save cart items to localStorage as backup
- [ ] Add cart persistence across sessions
- [ ] Add "Save for Later" functionality
- [ ] Add cart expiration (clear after X days)
- [ ] Add cart sharing (share cart with others)
- [ ] Add cart notes/comments
- [ ] Add delivery address selection
- [ ] Add order tracking
- [ ] Add order history
- [ ] Add reorder functionality

## Notes

- Cart items are stored in Supabase, not localStorage
- Cart is user-specific (tied to auth.users)
- Each user has their own cart
- Cart persists across sessions
- Real-time updates work across all pages
- Cart count updates instantly
- Multi-vendor checkout creates separate orders per vendor
- Orders are linked by vendor_id for vendor dashboard filtering







