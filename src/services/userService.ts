import { getDbPool } from '../config/database'

// Interface cho User Profile
export interface UserProfile {
  UserId: number
  UserName: string
  Email: string
  Phone: string | null
  CompanyId: number | null
  RoleId: number
  RoleName: string
  CompanyName?: string | null
  CreatedAt: Date
  UpdatedAt: Date | null
}

// Interface cho Update Profile Data
export interface UpdateProfileData {
  UserName?: string
  Email?: string
  Phone?: string | null
}

export interface UserListItem {
  UserId: number
  UserName: string
  Email: string
  Phone: string | null
  CompanyId: number | null
  CompanyName: string | null
  RoleId: number
  RoleName: string
  CreatedAt: Date
  UpdatedAt: Date | null
}

// Lấy profile của user (bao gồm thông tin Role và Company)
export const getUserProfile = async (userId: number): Promise<UserProfile | null> => {
  const pool = await getDbPool()

  const result = await pool.request().input('userId', userId).query(`
    SELECT 
      u.UserId,
      u.UserName,
      u.Email,
      u.Phone,
      u.CompanyId,
      u.RoleId,
      u.CreatedAt,
      u.UpdatedAt,
      r.RoleName,
      c.CompanyName
    FROM [User] u
    INNER JOIN [Role] r ON u.RoleId = r.RoleId
    LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
    WHERE u.UserId = @userId AND u.IsDeleted = 0
  `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}

// Cập nhật profile của user
export const updateUserProfile = async (
  userId: number,
  updateData: UpdateProfileData
): Promise<UserProfile | null> => {
  const pool = await getDbPool()

  // Kiểm tra user tồn tại
  const userExists = await pool.request().input('userId', userId).query(`
    SELECT UserId FROM [User] WHERE UserId = @userId AND IsDeleted = 0
  `)

  if (userExists.recordset.length === 0) {
    throw new Error('User không tồn tại')
  }

  // Kiểm tra email đã tồn tại (nếu có email mới)
  if (updateData.Email) {
    const emailExists = await pool
      .request()
      .input('email', updateData.Email)
      .input('userId', userId)
      .query(`
        SELECT Email FROM [User] 
        WHERE Email = @email AND UserId != @userId
      `)

    if (emailExists.recordset.length > 0) {
      throw new Error('Email đã được sử dụng bởi user khác')
    }
  }

  // Kiểm tra UserName đã tồn tại (nếu có UserName mới)
  if (updateData.UserName) {
    const userNameExists = await pool
      .request()
      .input('userName', updateData.UserName)
      .input('userId', userId)
      .query(`
        SELECT UserName FROM [User] 
        WHERE UserName = @userName AND UserId != @userId
      `)

    if (userNameExists.recordset.length > 0) {
      throw new Error('UserName đã được sử dụng bởi user khác')
    }
  }

  // Build dynamic update query
  const updateFields: string[] = []
  const request = pool.request().input('userId', userId).input('updatedAt', new Date())

  if (updateData.UserName !== undefined) {
    updateFields.push('UserName = @userName')
    request.input('userName', updateData.UserName)
  }

  if (updateData.Email !== undefined) {
    updateFields.push('Email = @email')
    request.input('email', updateData.Email)
  }

  if (updateData.Phone !== undefined) {
    updateFields.push('Phone = @phone')
    request.input('phone', updateData.Phone)
  }

  if (updateFields.length === 0) {
    throw new Error('Không có thông tin nào để cập nhật')
  }

  updateFields.push('UpdatedAt = @updatedAt')

  const updateQuery = `
    UPDATE [User]
    SET ${updateFields.join(', ')}
    WHERE UserId = @userId
  `

  await request.query(updateQuery)

  // Lấy lại thông tin user sau khi update
  return await getUserProfile(userId)
}

// Lấy thông tin user theo ID (cho admin hoặc manager)
export const getUserById = async (userId: number): Promise<UserProfile | null> => {
  return await getUserProfile(userId)
}

// Lấy danh sách user (trừ user đã xóa mềm)
export const getAllUsers = async (): Promise<UserListItem[]> => {
  const pool = await getDbPool()

  const result = await pool.request().query(`
    SELECT
      u.UserId,
      u.UserName,
      u.Email,
      u.Phone,
      u.CompanyId,
      c.CompanyName,
      u.RoleId,
      r.RoleName,
      u.CreatedAt,
      u.UpdatedAt
    FROM [User] u
    INNER JOIN [Role] r ON u.RoleId = r.RoleId
    LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
    WHERE u.IsDeleted = 0
    ORDER BY u.CreatedAt DESC
  `)

  return result.recordset
}

// Cập nhật user theo ID (dùng cho owner hoặc admin/manager)
export const updateUserById = async (
  userId: number,
  updateData: UpdateProfileData
): Promise<UserProfile | null> => {
  return await updateUserProfile(userId, updateData)
}

// Xóa mềm user theo ID
export const softDeleteUser = async (userId: number): Promise<void> => {
  const pool = await getDbPool()

  const result = await pool
    .request()
    .input('userId', userId)
    .input('updatedAt', new Date())
    .query(`
      UPDATE [User]
      SET IsDeleted = 1, UpdatedAt = @updatedAt
      WHERE UserId = @userId AND IsDeleted = 0
    `)

  if (result.rowsAffected[0] === 0) {
    throw new Error('User không tồn tại')
  }
}

// Approve business account: đổi role sang ARTIST
export const approveBusinessAccount = async (userId: number): Promise<UserProfile | null> => {
  const pool = await getDbPool()

  const roleResult = await pool.request().input('roleName', 'ARTIST').query(`
    SELECT RoleId FROM [Role] WHERE RoleName = @roleName
  `)

  if (roleResult.recordset.length === 0) {
    throw new Error('Role ARTIST không tồn tại')
  }

  const artistRoleId = roleResult.recordset[0].RoleId

  const updateResult = await pool
    .request()
    .input('userId', userId)
    .input('roleId', artistRoleId)
    .input('updatedAt', new Date())
    .query(`
      UPDATE [User]
      SET RoleId = @roleId, UpdatedAt = @updatedAt
      WHERE UserId = @userId AND IsDeleted = 0
    `)

  if (updateResult.rowsAffected[0] === 0) {
    throw new Error('User không tồn tại')
  }

  return await getUserProfile(userId)
}
