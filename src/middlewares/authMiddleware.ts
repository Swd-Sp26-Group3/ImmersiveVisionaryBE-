import { config } from '../config/config'
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export type Role = 'ADMIN' | 'MANAGER' | 'ARTIST' | 'CUSTOMER'

export interface AuthUser {
  userId: number
  email: string
  roleName: Role | string
}

interface DecodedToken {
  userId?: number
  email?: string
  roleName?: string
  role?: string
  RoleName?: string
  [key: string]: unknown
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

const readCookieValue = (cookieHeader: string | undefined, cookieName: string): string | undefined => {
  if (!cookieHeader) {
    return undefined
  }

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))

  if (!cookie) {
    return undefined
  }

  return cookie.slice(cookieName.length + 1)
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']
  const headerToken = authHeader?.split(' ')[1]
  const cookieToken = readCookieValue(req.headers.cookie, 'accessToken')
  const token = headerToken || cookieToken

  if (!token) {
    res.status(401).json({ message: 'Token is missing from Authorization header or accessToken cookie' })
    return
  }

  try {

    const payload = jwt.verify(token, config.jwt.secret) as DecodedToken

    if (!payload.userId || !payload.email) {
      res.status(401).json({ message: 'Invalid token payload' })
      return
    }

    const resolvedRole = payload.roleName || payload.role || payload.RoleName

    req.user = {
      userId: payload.userId,
      email: payload.email,
      roleName: resolvedRole || ''
    }

    next() 
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

    const userRoleRaw = user.roleName
    if (typeof userRoleRaw !== 'string' || userRoleRaw.trim() === '') {
      res.status(401).json({ message: 'Unauthorized: Missing role in token' })
      return
    }

    // Convert role to lowercase for case-insensitive comparison
    const userRole = userRoleRaw.toLowerCase()
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
