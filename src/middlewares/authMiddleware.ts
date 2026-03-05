import { config } from '../config/config'
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export type Role = 'ADMIN' | 'STAFF' | 'EVDRIVER' | 'BUSINESS'

export interface AuthUser {
  userId: number
  email: string
  roleName: Role
}

// Extend Request interface để thêm user property


export interface AuthRequest extends Request {
  user?: AuthUser
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']

  if (!authHeader) {
    res.status(401).json({ message: 'Authorization header is missing' })
    return
  }

  // Kiểm tra token có phải là dạng "Bearer <token>"
  const token = authHeader.split(' ')[1]
  if (!token) {
    res.status(401).json({ message: 'Token is missing in the Authorization header' })
    return
  }

  try {
    // Giải mã token và gán vào req.user
    const payload = jwt.verify(token, config.jwt.secret) as AuthUser
    req.user = payload
    next() // Chuyển tiếp đến middleware tiếp theo
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export const authorize = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user

    if (!user) {
      res.status(401).json({ message: 'Unauthorized: No user found in request' })
      return
    }

    // Convert role to lowercase for case-insensitive comparison
    const userRole = user.roleName.toLowerCase()
    const normalizedAllowedRoles = allowedRoles.map((role) => role.toLowerCase())

    if (!normalizedAllowedRoles.includes(userRole)) {
      res.status(403).json({
        message: `Forbidden: User role '${user.roleName}' is not allowed to access this resource`
      })
      return
    }

    next()
  }
}
