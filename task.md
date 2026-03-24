# Custom Production Flow — Task Checklist

## Phase 1: Analysis & Planning
- [x] Analyze FE + BE project structures
- [x] Re-analyze after user added manager/artist dashboards
- [x] Identify remaining gaps (order page, customer dashboard, order-success)
- [x] Write updated implementation plan

## Phase 2: Fix Order Page ([app/order/page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/order/page.tsx))
- [x] Fetch products + packages from BE on mount
- [x] Replace form to use ProductId/PackageId selectors + Brief + TargetPlatform + Deadline
- [x] Fix submission to `POST /api/orders`
- [x] Redirect to `/order-success?orderId=X`

## Phase 3: Create Order Success Page
- [x] New [app/order-success/page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/order-success/page.tsx)
- [x] Fetch order detail + show confirmation

## Phase 4: Customer Dashboard — Live Orders
- [x] Update [types.ts](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/artist-dashboard/types.ts) — add ApiOrder, remove MOCK_ORDERS
- [x] Rewrite [OrderTab.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/customer-dashboard/components/OrderTab.tsx) — fetch `/orders/my`, show real data, cancel button
- [x] Update [page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/page.tsx) — derive stats from live data

## Phase 5: Verification
- [x] Verify no MOCK_ORDERS references remain
- [x] Verify no broken imports across all customer-dashboard components
