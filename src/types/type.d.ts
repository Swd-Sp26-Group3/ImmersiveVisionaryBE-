// ==================== ENUMS ====================

// Enum cho Role
export enum RoleName {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ARTIST = 'ARTIST',
  CUSTOMER = 'CUSTOMER',
  SELLER = 'SELLER'
}

// Enum cho CompanyType
export enum CompanyType {
  BRAND = 'BRAND',
  AGENCY = 'AGENCY',
  STUDIO = 'STUDIO',
  SELLER = 'SELLER'
}

// Enum cho Company Status
export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED'
}

// Enum cho Creative Order Status
export enum CreativeOrderStatus {
  NEW = 'NEW',
  IN_PRODUCTION = 'IN_PRODUCTION',
  REVIEW = 'REVIEW',
  COMPLETED = 'COMPLETED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

// Enum cho Production Stage Name
export enum ProductionStageName {
  PHOTOSHOOT = 'PHOTOSHOOT',
  MODELING = 'MODELING',
  SCENE_DESIGN = 'SCENE_DESIGN',
  POST_PROCESS = 'POST_PROCESS'
}

// Enum cho Production Stage Status
export enum ProductionStageStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE'
}

// Enum cho Asset Type
export enum AssetType {
  ORDER = 'ORDER',
  MARKETPLACE = 'MARKETPLACE',
  TEMPLATE = 'TEMPLATE'
}

// Enum cho Asset Publish Status
export enum AssetPublishStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED'
}

// Enum cho File Format
export enum FileFormat {
  GLB = 'GLB',
  USDZ = 'USDZ',
  FBX = 'FBX',
  WEBAR = 'WEBAR'
}

// Enum cho Payment Type
export enum PaymentType {
  DEPOSIT = 'DEPOSIT',
  FULL = 'FULL',
  MILESTONE = 'MILESTONE',
  ASSET = 'ASSET'
}

// Enum cho Payment Status
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED'
}

// Enum cho Delivery Status
export enum DeliveryStatus {
  READY = 'READY',
  DOWNLOADED = 'DOWNLOADED'
}

// Enum cho Marketplace Order Status
export enum MarketplaceOrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  DELIVERED = 'DELIVERED',
  REFUNDED = 'REFUNDED'
}

// ==================== DATABASE INTERFACES ====================

// Interface cho Role
export interface Role {
  RoleId: number
  RoleName: string
}

// Interface cho Company
export interface Company {
  CompanyId: number
  CompanyName: string
  Address: string | null
  Email: string | null
  Phone: string | null
  Website: string | null
  CompanyType: CompanyType | null
  Status: CompanyStatus
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

// Interface cho User
export interface User {
  UserId: number
  CompanyId: number | null
  RoleId: number
  UserName: string
  Email: string
  PasswordHash: string
  Phone: string | null
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

// Interface cho Product
export interface Product {
  ProductId: number
  CompanyId: number
  ProductName: string
  Description: string | null
  Category: string | null
  SizeInfo: string | null
  ColorInfo: string | null
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

// Interface cho ServicePackage
export interface ServicePackage {
  PackageId: number
  PackageName: string
  Description: string | null
  BasePrice: number | null
  EstimatedDays: number | null
}

// Interface cho CreativeOrder
export interface CreativeOrder {
  OrderId: number
  CompanyId: number
  ProductId: number
  PackageId: number
  Brief: string | null
  TargetPlatform: string | null
  Status: CreativeOrderStatus
  Deadline: Date | null
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

// Interface cho ProductionStage
export interface ProductionStage {
  StageId: number
  OrderId: number
  StageName: ProductionStageName
  StageOrder: number
  AssignedTo: number | null
  StartDate: Date | null
  EndDate: Date | null
  Status: ProductionStageStatus
}

// Interface cho Asset3D
export interface Asset3D {
  AssetId: number
  OrderId: number | null
  AssetName: string
  PreviewImage: string | null
  CreatedBy: number
  OwnerCompanyId: number | null
  AssetType: AssetType | null
  Price: number | null
  IsMarketplace: boolean
  Category: string | null
  Industry: string | null
  PublishStatus: AssetPublishStatus
  CreatedAt: Date
  UpdatedAt: Date | null
  IsDeleted: boolean
}

// Interface cho AssetVersion
export interface AssetVersion {
  VersionId: number
  AssetId: number
  FileFormat: FileFormat
  FileUrl: string | null
  PolyCount: number | null
  TextureSize: string | null
  CreatedAt: Date
}

// Interface cho Payment
export interface Payment {
  PaymentId: number
  OrderId: number | null
  AssetId: number | null
  CompanyId: number
  Amount: number
  PaymentType: PaymentType | null
  PaymentStatus: PaymentStatus
  PaymentDate: Date | null
}

// Interface cho Delivery
export interface Delivery {
  DeliveryId: number
  OrderId: number
  AssetId: number
  DownloadUrl: string | null
  DeliveredAt: Date | null
  Status: DeliveryStatus | null
}

// Interface cho MarketplaceOrder
export interface MarketplaceOrder {
  MpOrderId: number
  AssetId: number
  BuyerCompanyId: number
  SellerCompanyId: number
  Price: number | null
  Status: MarketplaceOrderStatus | null
  CreatedAt: Date
}

// Interface cho RefreshToken
export interface RefreshToken {
  RefreshTokenId: number
  UserId: number
  Token: string
  ExpiresAt: Date
  Revoked: boolean
  CreatedAt: Date
}

// ==================== REQUEST/RESPONSE INTERFACES ====================

// Interface cho LoginRequest
export interface LoginRequest {
  Email: string
  Password: string
}

// Interface cho RegisterRequest
export interface RegisterRequest {
  UserName: string
  Email: string
  PasswordHash: string
  ConfirmPassword: string
  Phone?: string
  CompanyId?: number
}

// Interface cho ChangePasswordRequest
export interface ChangePasswordRequest {
  OldPassword: string
  NewPassword: string
  ConfirmNewPassword: string
}

// ==================== UTILITY TYPES ====================

export type PasswordActionResult = {
  success: boolean
  message: string
}

// ==================== LEGACY INTERFACES (for backward compatibility) ====================
// These are kept for existing adminService and other old code

interface Service {
  id: number
  ServiceName: string
  ServiceType: 'Administrative' | 'Civil'
  Price: number
  Description: string
  SampleCount: 2 | 3
  collectionMethod: 'Home' | 'Facility'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface DashboardStats {
  totalUsers: number
  totalTests: number
  totalServices: number
  revenue: number
  avgRating: number
  completed: number
  pending: number
  feedback: number
  monthlyRevenue: number[]
  serviceDistribution: number[]
  serviceNames: string[]
}