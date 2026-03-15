import { AuthRequest } from "@/middlewares/authMiddleware";
import { asyncHandler } from "../middlewares/errorMiddleware";
import { NextFunction,Response } from "express";
import { adminService } from '../services/adminService'

class AdminController{
      
getDashboardStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            
            res.status(200).json({ message: 'Dashboard stats fetched successfully' });
        } catch (error) {
          next(error);
        }
      })
    
    promotion = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            res.status(200).json({ message: 'Promotion created successfully' });
        } catch (error) {
          next(error);
        }       
      })

    createUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { UserName, Email, PasswordHash, ConfirmPassword, Phone, CompanyId, roleId } = req.body

            if (!UserName || !Email || !PasswordHash || !ConfirmPassword || roleId === undefined) {
              res.status(400).json({
                message: 'UserName, Email, PasswordHash, ConfirmPassword và roleId là bắt buộc'
              })
              return
            }

            if (!Number.isInteger(roleId) || roleId <= 0) {
              res.status(400).json({ message: 'roleId phải là số nguyên dương' })
              return
            }

            const passwordRegex = /^.{6,12}$/
            if (!passwordRegex.test(PasswordHash)) {
              res.status(400).json({ message: 'Mật khẩu phải có độ dài từ 6 đến 12 ký tự' })
              return
            }

            if (PasswordHash !== ConfirmPassword) {
              res.status(400).json({ message: 'Mật khẩu không trùng khớp' })
              return
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(Email)) {
              res.status(400).json({ message: 'Email không hợp lệ' })
              return
            }

            const user = await adminService.createUserByAdmin({
              UserName,
              Email,
              Password: PasswordHash,
              Phone: Phone || null,
              CompanyId: CompanyId || null,
              RoleId: roleId
            })

            res.status(201).json({
              message: 'Admin tạo account thành công',
              success: true,
              user
            })
        } catch (error: unknown) {
          if (error instanceof Error) {
            if (
              error.message.includes('đã tồn tại') ||
              error.message.includes('được sử dụng') ||
              error.message.includes('không tồn tại')
            ) {
              res.status(400).json({ message: error.message })
              return
            }
            res.status(500).json({ message: error.message })
            return
          }
          next(error)
        }
      })

    updateUserRole = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = Number(req.params.id)
            const { roleId } = req.body

            if (!Number.isInteger(userId) || userId <= 0) {
              res.status(400).json({ message: 'User ID không hợp lệ' })
              return
            }

            if (!Number.isInteger(roleId) || roleId <= 0) {
              res.status(400).json({ message: 'roleId phải là số nguyên dương' })
              return
            }

            const updatedUser = await adminService.updateUserRoleByAdmin(userId, roleId)

            res.status(200).json({
              message: 'Cập nhật role cho user thành công',
              success: true,
              user: updatedUser
            })
        } catch (error: unknown) {
          if (error instanceof Error) {
            if (error.message.includes('không tồn tại')) {
              res.status(404).json({ message: error.message })
              return
            }
            res.status(500).json({ message: error.message })
            return
          }
          next(error)
        }
      })
}
export const adminController = new AdminController();