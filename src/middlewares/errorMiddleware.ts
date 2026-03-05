import type { Request, Response, NextFunction } from 'express'
import { MESSAGES } from '../constants/messages'

export interface CustomError extends Error {
  statusCode?: number
  code?: string
  details?: any
}

export const errorMiddleware = (error: CustomError, req: Request, res: Response, next: NextFunction): void => {
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  })

  // Default error
  let statusCode = error.statusCode || 500
  let message = error.message || MESSAGES.ERROR.SERVER_ERROR

  // Handle specific error types
  switch (error.code) {
    case 'EREQUEST':
      statusCode = 500
      message = MESSAGES.ERROR.SERVER_ERROR
      break
    case 'ELOGIN':
      statusCode = 500
      message = MESSAGES.ERROR.SERVER_ERROR
      break
    case 'ETIMEOUT':
      statusCode = 408
      message = 'Request timeout'
      break
    case 'ECONNRESET':
      statusCode = 500
      message = 'Connection reset'
      break
    case 'DUPLICATE_ENTRY':
      statusCode = 409
      message = 'Duplicate entry found'
      break
    case 'VALIDATION_ERROR':
      statusCode = 400
      message = MESSAGES.VALIDATION.VALIDATION_ERROR
      break
    case 'UNAUTHORIZED':
      statusCode = 401
      message = MESSAGES.ERROR.UNAUTHORIZED
      break
    case 'FORBIDDEN':
      statusCode = 403
      message = 'Access forbidden'
      break
    case 'NOT_FOUND':
      statusCode = 404
      message = MESSAGES.ERROR.NOT_FOUND
      break
    case 'EMAIL_EXISTS':
      statusCode = 409
      message = MESSAGES.PROFILE.EMAIL_ALREADY_IN_USE
      break
    case 'INVALID_CREDENTIALS':
      statusCode = 401
      message = MESSAGES.AUTHENTICATION.LOGIN_FAILED
      break
    case 'ACCOUNT_INACTIVE':
      statusCode = 401
      message = MESSAGES.AUTHENTICATION.ACCOUNT_INACTIVE
      break
    case 'INVALID_TOKEN':
      statusCode = 401
      message = MESSAGES.ERROR.INVALID_TOKEN
      break
    case 'PASSWORD_MISMATCH':
      statusCode = 400
      message = MESSAGES.AUTHENTICATION.PASSWORD_CHANGE_FAILED
      break
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401
    message = MESSAGES.ERROR.INVALID_TOKEN
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401
    message = MESSAGES.ERROR.INVALID_TOKEN
  }
}

// Async error handler wrapper
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// Create custom error
export const createError = (message: string, statusCode = 500, code?: string, details?: any): CustomError => {
  const error = new Error(message) as CustomError
  error.statusCode = statusCode
  error.code = code
  error.details = details
  return error
}