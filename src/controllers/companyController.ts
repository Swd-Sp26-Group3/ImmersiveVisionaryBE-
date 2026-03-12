import type { Request, Response } from 'express'
import {
  createCompany,
  getCompanyById,
  listCompanies,
  updateCompany,
  type CompanyStatus,
  type CompanyType
} from '../services/companyService'

const ALLOWED_COMPANY_TYPES: CompanyType[] = ['BRAND', 'AGENCY', 'STUDIO', 'SELLER']
const ALLOWED_STATUS: CompanyStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED']

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const parseCompanyId = (idParam: string): number | null => {
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

export const createCompanyHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { CompanyName, Address, Email, Phone, Website, CompanyType, Status } = req.body

    if (!CompanyName || typeof CompanyName !== 'string') {
      res.status(400).json({ message: 'CompanyName is required' })
      return
    }

    if (Email !== undefined && Email !== null && (!Email || !isValidEmail(Email))) {
      res.status(400).json({ message: 'Email is invalid' })
      return
    }

    if (CompanyType !== undefined && CompanyType !== null && !ALLOWED_COMPANY_TYPES.includes(CompanyType)) {
      res.status(400).json({ message: `CompanyType must be one of: ${ALLOWED_COMPANY_TYPES.join(', ')}` })
      return
    }

    if (Status !== undefined && Status !== null && !ALLOWED_STATUS.includes(Status)) {
      res.status(400).json({ message: `Status must be one of: ${ALLOWED_STATUS.join(', ')}` })
      return
    }

    const company = await createCompany({
      CompanyName,
      Address,
      Email,
      Phone,
      Website,
      CompanyType,
      Status
    })

    res.status(201).json({
      message: 'Create company successfully',
      data: company
    })
  } catch (error) {
    console.error('Error in createCompanyHandler:', error)
    res.status(500).json({ message: 'Server error while creating company' })
  }
}

export const getCompanyByIdHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = parseCompanyId(req.params.id)

    if (!companyId) {
      res.status(400).json({ message: 'Company ID is invalid' })
      return
    }

    const company = await getCompanyById(companyId)

    if (!company) {
      res.status(404).json({ message: 'Company not found' })
      return
    }

    res.status(200).json({
      message: 'Get company successfully',
      data: company
    })
  } catch (error) {
    console.error('Error in getCompanyByIdHandler:', error)
    res.status(500).json({ message: 'Server error while getting company' })
  }
}

export const listCompaniesHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const companies = await listCompanies()

    res.status(200).json({
      message: 'Get companies successfully',
      data: companies
    })
  } catch (error) {
    console.error('Error in listCompaniesHandler:', error)
    res.status(500).json({ message: 'Server error while getting companies' })
  }
}

export const updateCompanyHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = parseCompanyId(req.params.id)

    if (!companyId) {
      res.status(400).json({ message: 'Company ID is invalid' })
      return
    }

    const { CompanyName, Address, Email, Phone, Website, CompanyType, Status } = req.body

    if (Email !== undefined && Email !== null && !isValidEmail(Email)) {
      res.status(400).json({ message: 'Email is invalid' })
      return
    }

    if (CompanyType !== undefined && CompanyType !== null && !ALLOWED_COMPANY_TYPES.includes(CompanyType)) {
      res.status(400).json({ message: `CompanyType must be one of: ${ALLOWED_COMPANY_TYPES.join(', ')}` })
      return
    }

    if (Status !== undefined && Status !== null && !ALLOWED_STATUS.includes(Status)) {
      res.status(400).json({ message: `Status must be one of: ${ALLOWED_STATUS.join(', ')}` })
      return
    }

    const company = await updateCompany(companyId, {
      CompanyName,
      Address,
      Email,
      Phone,
      Website,
      CompanyType,
      Status
    })

    res.status(200).json({
      message: 'Update company successfully',
      data: company
    })
  } catch (error: any) {
    console.error('Error in updateCompanyHandler:', error)

    if (error.message === 'NO_UPDATE_FIELDS') {
      res.status(400).json({ message: 'At least one field is required for update' })
      return
    }

    if (error.message === 'COMPANY_NOT_FOUND') {
      res.status(404).json({ message: 'Company not found' })
      return
    }

    res.status(500).json({ message: 'Server error while updating company' })
  }
}

export const companyController = {
  create: createCompanyHandler,
  getById: getCompanyByIdHandler,
  update: updateCompanyHandler,
  list: listCompaniesHandler
}

export default companyController
