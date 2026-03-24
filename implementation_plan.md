# Custom Production Flow — Implementation Plan (v2)

Wire up the **customer-facing Custom Order flow** to the existing backend APIs. Manager and Artist dashboards are already fully built with real API integrations.

---

## What's Already Done ✅

| Component | Status |
|---|---|
| **Manager Dashboard** — Orders tab (creative + marketplace), assign-to-artist, status transitions, production tracker, catalog mgmt, companies, team | ✅ Complete |
| **Artist Dashboard** — JobsTab, JobDetailView (status updates), AssetTab (create/submit/publish flow) | ✅ Complete |
| **Backend APIs** — All endpoints for orders, products, packages, assets, payments | ✅ Complete |

## What Needs Work 🔧

| Component | Problem |
|---|---|
| **Order Page** ([app/order/page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/order/page.tsx)) | Submits to `POST /products` instead of `POST /orders`. Form fields don't match CreateOrder contract. No product/package selectors. |
| **Customer Dashboard OrderTab** ([customer-dashboard/components/OrderTab.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/customer-dashboard/components/OrderTab.tsx)) | Uses hardcoded `MOCK_ORDERS` instead of `GET /api/orders/my` |
| **Customer Dashboard Stats** ([customer-dashboard/page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/customer-dashboard/page.tsx)) | Stats derived from `MOCK_ORDERS` counts |
| **Order Success Page** (`app/order-success/`) | Empty directory — no confirmation page |

---

## Proposed Changes

### Component 1: Order Page

#### [MODIFY] [page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/order/page.tsx)

Rewrite the **Custom Production** form section:

1. **Fetch on mount**: `GET /api/products` and `GET /api/packages` for dropdown data
2. **Replace form fields** to match `POST /api/orders` contract:
   - **Product** — `<Select>` from fetched products → `ProductId`
   - **Package** — `<Select>` from fetched packages (name + price + estimated days) → `PackageId`
   - **Brief** — `<Textarea>` detailed description → `Brief`
   - **Target Platform** — `<Select>` (Web / iOS / Android / All) → `TargetPlatform`
   - **Deadline** — `<Input type="date">` → `Deadline` (ISO string)
3. **Fix submission**: `POST /api/orders` with `{ ProductId, PackageId, Brief, TargetPlatform, Deadline }`
4. **Redirect** to `/order-success?orderId=X` with real order ID
5. Keep file upload UI, add-ons, and existing dark theme styling

---

### Component 2: Order Success Page

#### [NEW] [page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/order-success/page.tsx)

- Read `orderId` from URL query params
- Fetch `GET /api/orders/:id` for order detail
- Show confirmation: order ID, product/package names, status, deadline
- "What happens next" timeline
- Links: "View My Orders" → `/customer-dashboard`, "New Order" → `/order`

---

### Component 3: Customer Dashboard — Live Orders

#### [MODIFY] [types.ts](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/customer-dashboard/components/types.ts)

- Add `ApiOrder` interface (reuse same shape as artist-dashboard `CreativeOrder`)
- Add `ORDER_STATUS_CONFIG` for status → color/label mapping
- Remove `MOCK_ORDERS`, keep `MOCK_PURCHASES` and `UserProfile`

#### [MODIFY] [OrderTab.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/customer-dashboard/components/OrderTab.tsx)

- Fetch `GET /api/orders/my` on mount, show loading/empty/error states
- Render real order cards with BE status badges (NEW / IN_PRODUCTION / REVIEW / etc.)
- Add "Cancel Order" button → `PUT /api/orders/:id/cancel`
- Show product name, package, deadline, created date from real data

#### [MODIFY] [page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/customer-dashboard/page.tsx)

- Derive stats from live order count (fetched via same `/orders/my` call)
- Remove `MOCK_ORDERS` stats references

---

## Verification Plan

### Manual Browser Testing
1. Navigate to `/order` → select Custom → verify product/package dropdowns load
2. Submit order → verify redirect to `/order-success` with real data
3. Navigate to `/customer-dashboard` → verify Orders tab shows live data
4. Test "Cancel Order" on a NEW order
5. Check stats cards reflect real counts

> [!NOTE]
> Requires backend running at `http://localhost:5000`. The dev server is already running.
