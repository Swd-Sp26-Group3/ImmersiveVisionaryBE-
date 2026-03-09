import type { Response } from 'express'
import type { AuthRequest } from '../middlewares/authMiddleware'
import {
  getUserProfile,
  updateUserProfile,
  getUserById,
  getAllUsers,
  updateUserById,
  softDeleteUser,
  approveBusinessAccount
} from '../services/userService'

// Handler: Lấy thông tin profile của user đang đăng nhập
export const getProfileHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // req.user được set bởi authenticate middleware
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const userId = req.user.userId
    const profile = await getUserProfile(userId)

    if (!profile) {
      res.status(404).json({ message: 'User không tồn tại' })
      return
    }

    res.status(200).json({
      message: 'Lấy thông tin profile thành công',
      data: profile
    })
  } catch (error) {
    console.error('Error in getProfileHandler:', error)
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin profile' })
  }
}

// Handler: Cập nhật profile của user đang đăng nhập
export const updateProfileHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const userId = req.user.userId
    const { UserName, Email, Phone } = req.body

    // Kiểm tra ít nhất có một trường để cập nhật
    if (!UserName && !Email && Phone === undefined) {
      res.status(400).json({ message: 'Cần ít nhất một trường để cập nhật (UserName, Email, hoặc Phone)' })
      return
    }

    // Kiểm tra định dạng email nếu có
    if (Email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(Email)) {
        res.status(400).json({ message: 'Email không hợp lệ' })
        return
      }
    }

    const updatedProfile = await updateUserProfile(userId, {
      UserName,
      Email,
      Phone
    })

    res.status(200).json({
      message: 'Cập nhật profile thành công',
      data: updatedProfile
    })
  } catch (error: any) {
    console.error('Error in updateProfileHandler:', error)
    
    // Xử lý các lỗi cụ thể từ service
    if (error.message === 'Email đã được sử dụng bởi user khác') {
      res.status(409).json({ message: error.message })
      return
    }
    
    if (error.message === 'UserName đã được sử dụng bởi user khác') {
      res.status(409).json({ message: error.message })
      return
    }
    
    if (error.message === 'Không có thông tin nào để cập nhật') {
      res.status(400).json({ message: error.message })
      return
    }

    res.status(500).json({ message: 'Lỗi server khi cập nhật profile' })
  }
}

// Handler: Lấy thông tin user theo ID
// Chỉ cho phép ADMIN, MANAGER xem thông tin user khác
// User thường chỉ xem được thông tin của chính mình
export const getUserByIdHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const targetUserId = parseInt(req.params.id, 10)

    if (isNaN(targetUserId)) {
      res.status(400).json({ message: 'User ID không hợp lệ' })
      return
    }

    const currentUserId = req.user.userId
    const currentUserRole = req.user.roleName

    // Nếu không phải ADMIN hoặc MANAGER, chỉ cho phép xem thông tin của chính mình
    if (currentUserRole !== 'ADMIN' && currentUserRole !== 'MANAGER') {
      if (currentUserId !== targetUserId) {
        res.status(403).json({ message: 'Bạn không có quyền xem thông tin user này' })
        return
      }
    }

    const user = await getUserById(targetUserId)

    if (!user) {
      res.status(404).json({ message: 'User không tồn tại' })
      return
    }

    res.status(200).json({
      message: 'Lấy thông tin user thành công',
      data: user
    })
  } catch (error) {
    console.error('Error in getUserByIdHandler:', error)
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin user' })
  }
}

const getAll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const users = await getAllUsers()
    res.status(200).json({
      message: 'Lấy danh sách user thành công',
      data: users
    })
  } catch (error) {
    console.error('Error in getAll:', error)
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách user' })
  }
}

const getById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const userId = parseInt(req.params.id, 10)
    if (isNaN(userId)) {
      res.status(400).json({ message: 'User ID không hợp lệ' })
      return
    }

    const user = await getUserById(userId)
    if (!user) {
      res.status(404).json({ message: 'User không tồn tại' })
      return
    }

    res.status(200).json({
      message: 'Lấy thông tin user thành công',
      data: user
    })
  } catch (error) {
    console.error('Error in getById:', error)
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin user' })
  }
}

const update = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const targetUserId = parseInt(req.params.id, 10)
    if (isNaN(targetUserId)) {
      res.status(400).json({ message: 'User ID không hợp lệ' })
      return
    }

    const { UserName, Email, Phone } = req.body

    if (!UserName && !Email && Phone === undefined) {
      res.status(400).json({ message: 'Cần ít nhất một trường để cập nhật (UserName, Email, hoặc Phone)' })
      return
    }

    if (Email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(Email)) {
        res.status(400).json({ message: 'Email không hợp lệ' })
        return
      }
    }

    // Owner hoặc ADMIN/MANAGER được phép update
    const isPrivilegedRole = req.user.roleName === 'ADMIN' || req.user.roleName === 'MANAGER'
    const isOwner = req.user.userId === targetUserId
    if (!isPrivilegedRole && !isOwner) {
      res.status(403).json({ message: 'Bạn không có quyền cập nhật user này' })
      return
    }

    const updatedUser = await updateUserById(targetUserId, { UserName, Email, Phone })

    res.status(200).json({
      message: 'Cập nhật user thành công',
      data: updatedUser
    })
  } catch (error: any) {
    console.error('Error in update:', error)

    if (error.message === 'Email đã được sử dụng bởi user khác') {
      res.status(409).json({ message: error.message })
      return
    }

    if (error.message === 'UserName đã được sử dụng bởi user khác') {
      res.status(409).json({ message: error.message })
      return
    }

    if (error.message === 'Không có thông tin nào để cập nhật') {
      res.status(400).json({ message: error.message })
      return
    }

    if (error.message === 'User không tồn tại') {
      res.status(404).json({ message: error.message })
      return
    }

    res.status(500).json({ message: 'Lỗi server khi cập nhật user' })
  }
}

const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const targetUserId = parseInt(req.params.id, 10)
    if (isNaN(targetUserId)) {
      res.status(400).json({ message: 'User ID không hợp lệ' })
      return
    }

    await softDeleteUser(targetUserId)
    res.status(200).json({ message: 'Xóa user thành công' })
  } catch (error: any) {
    console.error('Error in delete:', error)

    if (error.message === 'User không tồn tại') {
      res.status(404).json({ message: error.message })
      return
    }

    res.status(500).json({ message: 'Lỗi server khi xóa user' })
  }
}

const approve = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }

    const targetUserId = parseInt(req.params.id, 10)
    if (isNaN(targetUserId)) {
      res.status(400).json({ message: 'User ID không hợp lệ' })
      return
    }

    const approvedUser = await approveBusinessAccount(targetUserId)
    res.status(200).json({
      message: 'Approve business account thành công',
      data: approvedUser
    })
  } catch (error: any) {
    console.error('Error in approve:', error)

    if (error.message === 'User không tồn tại') {
      res.status(404).json({ message: error.message })
      return
    }

    if (error.message === 'Role SELLER không tồn tại') {
      res.status(400).json({ message: error.message })
      return
    }

    res.status(500).json({ message: 'Lỗi server khi approve business account' })
  }
}

const userController = {
  getAll,
  getById,
  update,
  delete: deleteUser,
  approve
}

export default userController
