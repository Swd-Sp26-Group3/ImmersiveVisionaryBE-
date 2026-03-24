# Custom Production Flow — Change List

All changes needed to wire the Custom Production form to the [CreativeOrder](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/manager-dashboard/components/type.ts#44-60) table.

---

## Current Mismatch Summary

| # | FE Form Field | Current Hack | DB Column Needed | Status |
|---|---|---|---|---|
| 1 | `projectName` | → `ProductName` on `/products` | **New: `ProjectName`** on CreativeOrder | ❌ Missing |
| 2 | `productType` | → `Category` on `/products` | **New: `ProductType`** on CreativeOrder | ❌ Missing |
| 3 | `description` | → `Description` on `/products` | Maps to existing `Brief` | ⚠️ Rename only |
| 4 | `deadline` | → `SizeInfo` (hack!) | **New: `DeliverySpeed`** (text value like "standard") | ❌ Missing |
| 5 | `budget` | → `ColorInfo` (hack!) | **New: `Budget`** on CreativeOrder | ❌ Missing |
| 6 | `arOptimize` | Not sent | **New: `ArOptimize`** BIT flag | ❌ Missing |
| 7 | `animation` | Not sent | **New: `Animation`** BIT flag | ❌ Missing |
| 8 | `multiVariant` | Not sent | **New: `MultiVariant`** BIT flag | ❌ Missing |
| 9 | `sourceFiles` | Not sent | **New: `SourceFiles`** BIT flag | ❌ Missing |
| 10 | *(none)* | [ProductId](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/controllers/productController.ts#10-18) required FK | Make **nullable** (customer hasn't selected a product) | ❌ Blocking |
| 11 | *(none)* | [PackageId](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/controllers/packageController.ts#10-18) required FK | Make **nullable** (customer hasn't selected a package) | ❌ Blocking |
| 12 | Endpoint | Calls `POST /api/products` | Should call `POST /api/orders` | ❌ Wrong API |

---

## Change 1: Database Migration

> [!CAUTION]
> Run this SQL against `ImmersiveVisionary` database. Back up first.

```sql
-- 1A. Make ProductId and PackageId nullable (customer may not select them)
ALTER TABLE CreativeOrder ALTER COLUMN ProductId INT NULL;
ALTER TABLE CreativeOrder ALTER COLUMN PackageId INT NULL;

-- 1B. Add new columns matching the Custom Production form
ALTER TABLE CreativeOrder ADD ProjectName  NVARCHAR(200) NULL;
ALTER TABLE CreativeOrder ADD ProductType  NVARCHAR(100) NULL;
ALTER TABLE CreativeOrder ADD Budget       NVARCHAR(50)  NULL;
ALTER TABLE CreativeOrder ADD DeliverySpeed NVARCHAR(50) NULL;  -- 'standard', 'express', 'rush'

-- 1C. Add-on boolean flags
ALTER TABLE CreativeOrder ADD ArOptimize   BIT DEFAULT 0;
ALTER TABLE CreativeOrder ADD Animation    BIT DEFAULT 0;
ALTER TABLE CreativeOrder ADD MultiVariant BIT DEFAULT 0;
ALTER TABLE CreativeOrder ADD SourceFiles  BIT DEFAULT 0;
```

**After migration, the [CreativeOrder](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/manager-dashboard/components/type.ts#44-60) table columns are:**

| Column | Type | Nullable | Source |
|---|---|---|---|
| OrderId | INT IDENTITY PK | No | Auto |
| CompanyId | INT FK→Company | No | From logged-in user |
| ProductId | INT FK→Product | **Yes (was No)** | Optional selector |
| PackageId | INT FK→ServicePackage | **Yes (was No)** | Optional selector |
| **ProjectName** | NVARCHAR(200) | **Yes (new)** | `form.projectName` |
| **ProductType** | NVARCHAR(100) | **Yes (new)** | `form.productType` |
| Brief | NVARCHAR(MAX) | Yes | `form.description` |
| **Budget** | NVARCHAR(50) | **Yes (new)** | `form.budget` |
| **DeliverySpeed** | NVARCHAR(50) | **Yes (new)** | `form.deadline` |
| TargetPlatform | NVARCHAR(200) | Yes | *(keep for future use)* |
| **ArOptimize** | BIT | Yes (default 0) | `form.arOptimize` |
| **Animation** | BIT | Yes (default 0) | `form.animation` |
| **MultiVariant** | BIT | Yes (default 0) | `form.multiVariant` |
| **SourceFiles** | BIT | Yes (default 0) | `form.sourceFiles` |
| Status | NVARCHAR(50) | No (default 'NEW') | Auto |
| Deadline | DATE | Yes | *(keep for future use)* |
| CreatedAt | DATETIME | No | Auto |
| UpdatedAt | DATETIME | Yes | Auto |
| IsDeleted | BIT | No (default 0) | Auto |

---

## Change 2: Backend — orderService.ts

File: [src/services/orderService.ts](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/services/orderService.ts)

#### 2A. Update [CreativeOrder](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/manager-dashboard/components/type.ts#44-60) interface
```diff
 export interface CreativeOrder {
   OrderId: number
   CompanyId: number
-  ProductId: number
-  PackageId: number
+  ProductId: number | null
+  PackageId: number | null
+  ProjectName: string | null
+  ProductType: string | null
   Brief: string | null
+  Budget: string | null
+  DeliverySpeed: string | null
   TargetPlatform: string | null
+  ArOptimize: boolean
+  Animation: boolean
+  MultiVariant: boolean
+  SourceFiles: boolean
   Status: CreativeOrderStatus
   Deadline: Date | null
   ...
 }
```

#### 2B. Update [CreateOrderInput](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/services/orderService.ts#26-34) interface
```diff
 export interface CreateOrderInput {
   CompanyId?: number
-  ProductId: number
-  PackageId: number
+  ProductId?: number | null
+  PackageId?: number | null
+  ProjectName?: string | null
+  ProductType?: string | null
   Brief?: string | null
+  Budget?: string | null
+  DeliverySpeed?: string | null
   TargetPlatform?: string | null
+  ArOptimize?: boolean
+  Animation?: boolean
+  MultiVariant?: boolean
+  SourceFiles?: boolean
   Deadline?: Date | null
 }
```

#### 2C. Update [createOrder()](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/services/orderService.ts#51-101) SQL INSERT
Add new `.input()` bindings and columns in the INSERT statement.

#### 2D. Update [CreativeOrderDetail](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/manager-dashboard/components/OrdersTab.tsx#152-317) 
No change needed — it extends [CreativeOrder](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/manager-dashboard/components/type.ts#44-60), so new fields are inherited. The `SELECT o.*` in queries already picks up all columns.

---

## Change 3: Backend — orderController.ts

File: [src/controllers/orderController.ts](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/controllers/orderController.ts)

#### 3A. Update [createOrderHandler](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/controllers/orderController.ts#69-140) — remove required validation for ProductId/PackageId
```diff
-  if (!Number.isInteger(ProductId) || ProductId <= 0) {
-    res.status(400).json({ message: 'ProductId is required ...' })
-    return
-  }
+  if (ProductId !== undefined && ProductId !== null
+      && (!Number.isInteger(ProductId) || ProductId <= 0)) {
+    res.status(400).json({ message: 'ProductId must be a positive integer' })
+    return
+  }
```
Same change for [PackageId](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/controllers/packageController.ts#10-18).

#### 3B. Parse new fields from `req.body`
```diff
-  const { CompanyId, ProductId, PackageId, Brief, TargetPlatform, Deadline } = req.body
+  const {
+    CompanyId, ProductId, PackageId,
+    ProjectName, ProductType, Brief, Budget,
+    DeliverySpeed, TargetPlatform,
+    ArOptimize, Animation, MultiVariant, SourceFiles,
+    Deadline
+  } = req.body
```

Pass all new fields into the [createOrder()](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/services/orderService.ts#51-101) call.

---

## Change 4: Frontend — order/page.tsx

File: [app/order/page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/order/page.tsx)

#### 4A. Fix [handleSubmitCustom](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/order/page.tsx#49-99) — change endpoint and field mapping
```diff
-  const res = await apiFetch("/products", {
+  const res = await apiFetch("/orders", {
     method: "POST",
     body: JSON.stringify({
-      CompanyId: 1,
-      ProductName: form.projectName,
-      Description: form.description,
-      Category: form.productType || null,
-      SizeInfo: form.deadline || null,
-      ColorInfo: form.budget || null,
+      ProjectName: form.projectName,
+      ProductType: form.productType || null,
+      Brief: form.description,
+      Budget: form.budget || null,
+      DeliverySpeed: form.deadline || null,
+      ArOptimize: form.arOptimize,
+      Animation: form.animation,
+      MultiVariant: form.multiVariant,
+      SourceFiles: form.sourceFiles,
     }),
   });
```

#### 4B. Fix redirect after success
```diff
-  router.push(`/order-success?productId=${(data.data ?? data).ProductId}...`);
+  router.push(`/order-success?orderId=${(data.data ?? data).OrderId}`);
```

---

## Change 5: Frontend — order-success/page.tsx

File: [app/order-success/page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/order-success/page.tsx) **(new file)**

- Read `orderId` from URL search params
- Fetch `GET /api/orders/:id` for order detail
- Show confirmation with ProjectName, ProductType, Budget, Status, ProjectBrief

---

## Change 6: Frontend — Customer Dashboard (future)

When ready to show live orders in Customer Dashboard, replace `MOCK_ORDERS` with `GET /api/orders/my`. This is **not required now** — leave as mock data until the flow is tested end-to-end.

---

## Execution Order

| Step | Layer | What to do |
|---|---|---|
| **1** | 🗄️ Database | Run ALTER TABLE migration SQL |
| **2** | ⚙️ Backend | Update [orderService.ts](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/services/orderService.ts) (interfaces + INSERT SQL) |
| **3** | ⚙️ Backend | Update [orderController.ts](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryBE-/src/controllers/orderController.ts) (validation + parsing) |
| **4** | 🖥️ Frontend | Fix [order/page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/order/page.tsx) (endpoint + field mapping) |
| **5** | 🖥️ Frontend | Create [order-success/page.tsx](file:///c:/Users/Acs%20Toan/Documents/SWD392/Project/ImmersiveVisionaryFE/app/order-success/page.tsx) |
| **6** | 🧪 Test | Submit order → verify row in CreativeOrder table |
