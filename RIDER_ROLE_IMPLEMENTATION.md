# Rider Role Implementation - Complete Guide

## Overview
This document describes the complete implementation of the Rider role and portal system for the Hospeniel platform.

## ✅ Completed Features

### 1. Database Migrations
Three new migrations have been created:

#### `20250116_add_rider_role_and_approval_status.sql`
- Adds `rider_approval_status` field to `profiles` table
- Values: `pending`, `approved`, `rejected`
- Creates trigger to notify admin when a rider registers
- Creates indexes for efficient queries

#### `20250116_add_rider_fields_to_orders.sql`
- Adds `rider_id` field to `orders` table (references `auth.users`)
- Adds `rider_assigned_at` timestamp
- Adds `rider_picked_up_at` timestamp
- Adds `rider_delivered_at` timestamp
- Updates status constraint to include delivery statuses: `Assigned`, `Picked Up`, `In Transit`, `Delivered`
- Creates indexes for rider order queries

#### `20250116_add_rider_availability.sql`
- Adds `is_available` boolean field to `profiles` table
- Default: `true`
- Creates index for rider availability queries

### 2. Registration Flow

#### Registration Form (`src/app/register/page.tsx`)
- ✅ Added "Rider" option to account type selection
- ✅ Rider registration requires address and phone number
- ✅ Shows appropriate success message for pending approval

#### Registration API (`src/app/api/register/route.ts`)
- ✅ Handles rider role registration
- ✅ Sets `rider_approval_status` to `pending` for new riders
- ✅ Stores phone number and address for riders
- ✅ Triggers admin notification via database trigger

### 3. Admin Approval System

#### Admin Riders Page (`src/app/admin/riders/page.tsx`)
- ✅ Lists all riders with their approval status
- ✅ Search functionality (name, email, phone, address)
- ✅ Filter by status (all, pending, approved, rejected)
- ✅ Approve/Reject buttons
- ✅ Sends notification to rider when status changes
- ✅ Added to admin navigation menu

### 4. Rider Portal

#### Portal Layout (`src/app/portal/layout.tsx`)
- ✅ Sidebar navigation styled like Explore page
- ✅ Authentication check: only approved riders can access
- ✅ Blocks access if status is not `approved`
- ✅ Responsive mobile sidebar
- ✅ User profile display in header

#### Portal Pages

**Dashboard (`src/app/portal/page.tsx`)**
- ✅ Task statistics (pending, in progress, completed, total)
- ✅ Quick action links
- ✅ Summary cards with icons

**Tasks (`src/app/portal/tasks/page.tsx`)**
- ✅ Lists all assigned delivery tasks
- ✅ Filter by status (all, pending, in progress, completed)
- ✅ Accept/Claim task functionality
- ✅ Mark as Picked Up
- ✅ Mark as Delivered
- ✅ Displays customer information and delivery address
- ✅ Shows order total

**Notifications (`src/app/portal/notifications/page.tsx`)**
- ✅ Real-time notifications via Supabase subscriptions
- ✅ Filter by all/unread
- ✅ Mark as read functionality
- ✅ Mark all as read
- ✅ Unread count display

**Settings (`src/app/portal/settings/page.tsx`)**
- ✅ Update personal information (name, phone, address)
- ✅ Toggle availability status
- ✅ Email display (read-only)
- ✅ Save changes with success/error feedback

**Support (`src/app/portal/support/page.tsx`)**
- ✅ Contact information display
- ✅ Common questions FAQ
- ✅ Support message form
- ✅ Integrates with `support_messages` table

## 🔧 Setup Instructions

### Step 1: Run Database Migrations

Run these migrations in order in your Supabase SQL Editor:

1. `supabase/migrations/20250116_add_rider_role_and_approval_status.sql`
2. `supabase/migrations/20250116_add_rider_fields_to_orders.sql`
3. `supabase/migrations/20250116_add_rider_availability.sql`

### Step 2: Verify Schema

After running migrations, verify the schema:

```sql
-- Check rider_approval_status column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'rider_approval_status';

-- Check rider fields in orders
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders'
  AND column_name IN ('rider_id', 'rider_assigned_at', 'rider_picked_up_at', 'rider_delivered_at');

-- Check is_available column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'is_available';
```

### Step 3: Test Registration

1. Go to `/register`
2. Select "Rider" as account type
3. Fill in required fields (name, email, password, address, phone)
4. Submit registration
5. Verify admin receives notification
6. Check that rider status is `pending` in database

### Step 4: Test Admin Approval

1. Log in as admin
2. Navigate to `/admin/riders`
3. Find the pending rider
4. Click "Approve"
5. Verify rider receives notification
6. Verify rider can now access `/portal`

### Step 5: Test Rider Portal

1. Log in as approved rider
2. Navigate to `/portal`
3. Verify all pages load correctly:
   - Dashboard shows stats
   - Tasks page shows assigned orders
   - Notifications page works
   - Settings page allows updates
   - Support page allows messaging

## 📋 Order Assignment Flow

### Current Implementation
The tasks page queries orders where `rider_id = current_user.id`. 

**To assign orders to riders:**
1. Admin or system can update an order's `rider_id` field
2. Order status should be set to `Pending` or `Assigned`
3. Rider will see the order in their Tasks page
4. Rider can accept/claim the task
5. Rider updates status as they progress:
   - `Assigned` → `Picked Up` → `In Transit` → `Delivered`

### Future Enhancement
Consider creating an API endpoint or admin interface to:
- Assign orders to available riders automatically
- Show available riders for order assignment
- Filter by rider location/availability

## 🔐 Security & Access Control

### Authentication
- ✅ Portal layout checks user authentication
- ✅ Verifies user role is `rider`
- ✅ Verifies `rider_approval_status` is `approved`
- ✅ Redirects unauthorized users

### RLS Policies
The existing RLS policies should work for riders since:
- Riders are stored in `profiles` table with `role = 'rider'`
- Notifications use `user_id` which works for riders
- Orders can be queried by `rider_id`

## 📝 Notes

### Order Status Values
The orders table now supports these delivery-related statuses:
- `Pending` - Order placed, awaiting assignment
- `Assigned` - Assigned to rider, awaiting pickup
- `Picked Up` - Rider has picked up the order
- `In Transit` - Order is being delivered
- `Delivered` - Order successfully delivered
- `Completed` - Order fully completed

### Notification Types
Riders receive notifications for:
- Account approval/rejection
- New task assignments
- Order status updates
- System messages

### Availability Toggle
Riders can toggle their availability in Settings. When unavailable:
- They won't receive new task assignments (if automatic assignment is implemented)
- They can still view and manage existing tasks

## 🚀 Next Steps (Optional Enhancements)

1. **Automatic Order Assignment**
   - Create API endpoint to assign orders to available riders
   - Implement location-based matching
   - Consider rider workload balancing

2. **Rider Earnings Dashboard**
   - Track delivery fees earned
   - Payment history
   - Earnings summary

3. **Delivery Tracking**
   - Real-time location tracking
   - Estimated delivery time
   - Customer notifications

4. **Rider Ratings**
   - Customer feedback system
   - Rating display in portal
   - Performance metrics

## ✅ Verification Checklist

- [ ] All migrations run successfully
- [ ] Rider registration works
- [ ] Admin receives notification on rider registration
- [ ] Admin can approve/reject riders
- [ ] Approved riders can access portal
- [ ] Pending riders are blocked from portal
- [ ] Dashboard shows correct stats
- [ ] Tasks page displays assigned orders
- [ ] Task actions (accept, pick up, deliver) work
- [ ] Notifications page works
- [ ] Settings page allows profile updates
- [ ] Support page allows messaging
- [ ] All pages are responsive

## 🐛 Troubleshooting

### Rider cannot access portal
- Check `rider_approval_status` in profiles table (must be `approved`)
- Verify user role is `rider`
- Check browser console for errors

### Tasks not showing
- Verify orders have `rider_id` set
- Check order status is appropriate
- Verify RLS policies allow rider to view orders

### Notifications not working
- Verify notifications table has `user_id` field
- Check RLS policies for notifications
- Verify real-time subscription is active

### Settings not saving
- Check RLS policies for profiles table
- Verify user has UPDATE permission
- Check browser console for errors






