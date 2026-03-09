import type { Response, Request } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import {
  register,
  login,
  verifyRefreshToken,
  generateAccessToken,
  PasswordChange
  // forgotPassword,
  // resetPassword
} from '../services/authService'
import { getDbPool } from '../config/database'

export const registerHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { UserName, Email, PasswordHash, ConfirmPassword, Phone, CompanyId, Role, role } = req.body
  const selectedRole = (Role || role || '').toString().trim().toUpperCase()
 
  // Kiểm tra các tham số đầu vào bắt buộc
  if (!UserName || !Email || !PasswordHash || !ConfirmPassword || !selectedRole) {
    res.status(400).json({ message: 'UserName, Email, PasswordHash, ConfirmPassword và Role là bắt buộc' })
    return
  }

  if (!['ARTIST', 'CUSTOMER'].includes(selectedRole)) {
    res.status(400).json({ message: 'Role chỉ được chọn ARTIST hoặc CUSTOMER' })
    return
  }

  // Kiểm tra độ dài mật khẩu
  const passwordRegex = /^.{6,12}$/
  if (!passwordRegex.test(PasswordHash)) {
    res.status(400).json({ message: 'Mật khẩu phải có độ dài từ 6 đến 12 ký tự' })
    return
  }

  // Kiểm tra mật khẩu xác nhận
  if (PasswordHash !== ConfirmPassword) {
    res.status(400).json({ message: 'Mật khẩu không trùng khớp' })
    return
  }

  // Kiểm tra định dạng email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(Email)) {
    res.status(400).json({ message: 'Email không hợp lệ' })
    return
  }

  try {
    const user = await register(
      UserName,
      Email,
      PasswordHash,
      selectedRole,
      Phone || null,
      CompanyId || null
    )

    res.status(201).json({ 
      message: 'Đăng ký thành công', 
      success: true,
      user: {
        userId: user.UserId,
        userName: user.UserName,
        email: user.Email,
        role: user.RoleName
      }
    })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes('UNIQUE KEY') || error.message.includes('tồn tại')) {
        res.status(409).json({ message: error.message })
      } else {
        res.status(500).json({ message: error.message })
      }
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

export const loginHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { Email, PasswordHash } = req.body

  if (!Email || !PasswordHash) {
    res.status(400).json({ message: 'Thiếu email hoặc mật khẩu' })
    return
  }

  try {
    const tokens = await login(Email, PasswordHash)
    if (!tokens) {
      res.status(401).json({ message: 'Thông tin đăng nhập không hợp lệ' })
      return
    }

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      success: true,
      user: tokens.payload
    })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes('không khớp email công ty') || error.message.includes('phê duyệt')) {
        res.status(403).json({ message: error.message })
        return
      }

      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

export const PasswordChangeHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user
  if (!user) {
    res.status(401).json({ message: 'Không có quyền truy cập' })
    return
  }
  const { password, NewPassword, confirmNewPassword } = req.body

  // Kiểm tra mật khẩu cũ và mật khẩu mới
  if (!password) {
    res.status(400).json({ message: 'Mật khẩu cũ là bắt buộc' })
    return
  }
  if (!NewPassword) {
    res.status(400).json({ message: 'Mật khẩu mới là bắt buộc' })
    return
  }
  if (NewPassword !== confirmNewPassword) {
    res.status(400).json({ message: 'Mật khẩu không trùng khớp' })
    return
  }

  try {
    await PasswordChange(user.userId, password, NewPassword)
    res.json({ message: 'Yêu cầu thay đổi mật khẩu đã thành công' })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

export const refreshAccessTokenHandler = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body
  if (!refreshToken) {
    res.status(400).json({ message: 'Thiếu refresh token' })
    return
  }

  try {
    const payload = await verifyRefreshToken(refreshToken)
    if (!payload) {
      res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' })
      return
    }

    // Đảm bảo bạn truyền đầy đủ thông tin trong payload
    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    })

    res.json({ accessToken: newAccessToken })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

// Add the missing getCurrentUserInfo endpoint
export const getCurrentUserInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ message: 'Không có quyền truy cập' })
      return
    }

    // Get additional user information from database if needed
    const pool = await getDbPool()
    const result = await pool.request().input('userId', user.userId).query(`
    SELECT 
      u.UserId AS userId,
      u.UserName AS userName,
      u.Email AS email,
      u.Phone AS phone,
      u.CompanyId AS companyId,
      r.RoleName AS role,
      u.CreatedAt AS createdAt
    FROM [User] u
    INNER JOIN [Role] r ON u.RoleId = r.RoleId
    WHERE u.UserId = @userId AND u.IsDeleted = 0
  `)

    if (result.recordset.length === 0) {
      res.status(404).json({ message: 'Không tìm thấy thông tin người dùng' })
      return
    }

    const userInfo = result.recordset[0]
    res.json({ success: true, user: userInfo })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

// Add logout handler
export const logoutHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.user?.userId

    // Revoke the refresh token in the database
    const pool = await getDbPool()
    await pool.request().input('id', id).query(`
        DELETE FROM RefreshToken WHERE UserId = @id
      `)

    res.json({ success: true, message: 'Đăng xuất thành công' })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: 'Đã xảy ra lỗi không xác định' })
    }
  }
}

