import bcrypt from 'bcrypt'
import { getDbPool } from '../config/database'
import jwt from 'jsonwebtoken'
import { config } from '../config/config'

// Interface payload token
export interface Payload {
  userId: number
  email: string
  role: string
}

const REGISTERABLE_ROLES = ['ARTIST', 'CUSTOMER'] as const
const COMPANY_APPROVAL_ROLES = ['ADMIN', 'MANAGER'] as const

const normalizeRoleName = (role: string): string => role.trim().toUpperCase()

// Thời gian hết hạn token
const ACCESS_TOKEN_EXPIRES_IN = '1m'
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000 // 7 ngày (ms)

// Hàm đăng ký user
export const register = async (
  UserName: string,
  Email: string,
  Password: string,
  RoleName: string,
  Phone: string | null = null,
  CompanyId: number | null = null
) => {
  const passwordRegex = /^.{6,12}$/
  if (!passwordRegex.test(Password)) {
    throw new Error('Mật khẩu phải từ 6 đến 12 ký tự')
  }

  const pool = await getDbPool()

  // Kiểm tra UserName tồn tại
  const existingUserName = await pool.request().input('userName', UserName).query(`
    SELECT UserName FROM [User] WHERE UserName = @userName
  `)

  if (existingUserName.recordset.length > 0) {
    throw new Error('UserName đã tồn tại')
  }

  // Kiểm tra email tồn tại
  const existingEmail = await pool.request().input('email', Email).query(`
    SELECT Email FROM [User] WHERE Email = @email
  `)

  if (existingEmail.recordset.length > 0) {
    throw new Error('Email đã tồn tại')
  }

  const normalizedRoleName = normalizeRoleName(RoleName)
  if (!REGISTERABLE_ROLES.includes(normalizedRoleName as (typeof REGISTERABLE_ROLES)[number])) {
    throw new Error('Role không hợp lệ. Chỉ được chọn ARTIST hoặc CUSTOMER')
  }

  // Lấy RoleId theo role người dùng chọn khi đăng ký
  const roleRes = await pool.request().input('name', normalizedRoleName).query(`
    SELECT RoleId FROM [Role] WHERE RoleName = @name
  `)

  if (roleRes.recordset.length === 0) {
    throw new Error(`Role ${normalizedRoleName} không tồn tại`)
  }

  const roleId = roleRes.recordset[0].RoleId

  // Nếu CompanyId được cung cấp, kiểm tra nó tồn tại
  if (CompanyId) {
    const companyExists = await pool.request().input('companyId', CompanyId).query(`
      SELECT CompanyId FROM [Company] WHERE CompanyId = @companyId
    `)
    if (companyExists.recordset.length === 0) {
      throw new Error('Company không tồn tại')
    }
  }

  // Mã hóa mật khẩu
  const passwordHash = await bcrypt.hash(Password, 10)

  // Thêm user mới
  await pool
    .request()
    .input('userName', UserName)
    .input('email', Email)
    .input('passwordHash', passwordHash)
    .input('roleId', roleId)
    .input('phone', Phone)
    .input('companyId', CompanyId)
    .query(`
      INSERT INTO [User] (UserName, Email, PasswordHash, RoleId, Phone, CompanyId)
      VALUES (@userName, @email, @passwordHash, @roleId, @phone, @companyId)
    `)

  // Lấy lại user vừa tạo
  const newUser = await pool.request().input('email', Email).query(`
    SELECT u.UserId, u.UserName, u.Email, u.Phone, u.CompanyId, r.RoleName
    FROM [User] u
    INNER JOIN [Role] r ON r.RoleId = u.RoleId
    WHERE u.Email = @email
  `)

  return newUser.recordset[0]
}

// Hàm đăng nhập
export const login = async (email: string, password: string) => {
  const pool = await getDbPool()

  const result = await pool.request().input('email', email).query(`
    SELECT u.UserId, u.Email, u.PasswordHash, u.RoleId, r.RoleName, c.Email AS CompanyEmail
    FROM [User] u
    INNER JOIN [Role] r ON u.RoleId = r.RoleId
    LEFT JOIN [Company] c ON c.CompanyId = u.CompanyId
    WHERE u.Email = @email
  `)

  if (result.recordset.length === 0) return null

  const user = result.recordset[0]

  const valid = await bcrypt.compare(password, user.PasswordHash)
  if (!valid) return null

  const normalizedRole = normalizeRoleName(user.RoleName)
  if (COMPANY_APPROVAL_ROLES.includes(normalizedRole as (typeof COMPANY_APPROVAL_ROLES)[number])) {
    const loginEmail = String(email).trim().toLowerCase()
    const companyEmail = String(user.CompanyEmail || '').trim().toLowerCase()

    if (!companyEmail) {
      throw new Error('Tài khoản ADMIN/MANAGER chưa được gán email công ty để phê duyệt')
    }

    if (loginEmail !== companyEmail) {
      throw new Error('Email đăng nhập không khớp email công ty đã cấu hình')
    }
  }

  const payload: Payload = {
    userId: user.UserId,
    email: user.Email,
    role: normalizedRole
  }

  const accessToken = generateAccessToken(payload)
  const refreshToken = await generateRefreshToken(payload)

  return { accessToken, refreshToken, payload }
}

// Tạo Access Token
export const generateAccessToken = (payload: Payload): string => {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: ACCESS_TOKEN_EXPIRES_IN })
}

// Tạo Refresh Token và lưu vào DB
export const generateRefreshToken = async (payload: Payload): Promise<string> => {
  const pool = await getDbPool()

  const refreshToken = jwt.sign(payload, config.jwt.secret, { expiresIn: `${REFRESH_TOKEN_EXPIRES_IN / 1000}s` })
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN)

  try {
    await pool
      .request()
      .input('token', refreshToken)
      .input('userId', payload.userId) // Lưu đúng userId
      .input('expiresAt', expiresAt)
      .query(`
        INSERT INTO RefreshToken (Token, UserId, ExpiresAt, Revoked)
        VALUES (@token, @userId, @expiresAt, 0)
      `)
  } catch (error) {
    throw new Error('Error saving refresh token to the database')
  }

  return refreshToken
}

// Xác minh Refresh Token
export const verifyRefreshToken = async (
  refreshToken: string
): Promise<{ userId: number; email: string; role: string } | null> => {
  const pool = await getDbPool()

  try {
    const result = await pool
      .request()
      .input('token', refreshToken)
      .query('SELECT TOP 1 * FROM RefreshToken WHERE Token = @token AND Revoked = 0')

    if (result.recordset.length === 0) return null

    const tokenRecord = result.recordset[0]

    if (new Date(tokenRecord.ExpiresAt) < new Date()) return null

    const decoded = jwt.verify(refreshToken, config.jwt.secret) as Payload

    const userResult = await pool.request().input('userId', decoded.userId).query(`
      SELECT Email FROM [User] WHERE UserId = @userId
    `)

    if (userResult.recordset.length === 0) return null

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    }
  } catch (error) {
    console.error('Error verifying refresh token:', error)
    return null
  }
}

// Thu hồi Refresh Token
export const revokeRefreshToken = async (token: string): Promise<void> => {
  const pool = await getDbPool()

  try {
    await pool.request().input('token', token).query('UPDATE RefreshToken SET Revoked = 1 WHERE Token = @token')
  } catch (error) {
    throw new Error('Error revoking refresh token')
  }
}

// Đổi mật khẩu
export const PasswordChange = async (userId: number, password: string, newPassword: string) => {
  const pool = await getDbPool()

  const Result = await pool
    .request()
    .input('userId', userId)
    .query('SELECT PasswordHash, Email FROM [User] WHERE UserId = @userId')

  if (Result.recordset.length === 0) {
    throw new Error('Account not found')
  }

  const user = Result.recordset[0]

  const match = await bcrypt.compare(password, user.PasswordHash)
  if (!match) {
    throw new Error('Mật khẩu cũ không đúng')
  }

  const passwordregex = /^.{6,12}$/
  if (!passwordregex.test(newPassword)) {
    throw new Error('Mật khẩu mới phải từ 6 đến 12 ký tự')
  }

  if (password === newPassword) {
    throw new Error('Mật khẩu mới không được trùng mật khẩu cũ')
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10)

  try {
    await pool
      .request()
      .input('userId', userId)
      .input('newPasswordHash', newPasswordHash)
      .query('UPDATE [User] SET PasswordHash = @newPasswordHash WHERE UserId = @userId')

    return { message: 'Password change is successful' }
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error('Error updating password: ' + error.message)
    } else {
      throw new Error('Error updating password: Unknown error')
    }
  }
}
