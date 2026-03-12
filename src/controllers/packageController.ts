import type { Request, Response } from 'express'
import {
  createPackage,
  deletePackage,
  getPackageById,
  listPackages,
  updatePackage
} from '../services/packageService'

const parsePackageId = (idParam: string): number | null => {
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return null
  }

  return id
}

const parseOptionalString = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    return undefined
  }

  return value
}

const parseOptionalNumber = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined
  }

  return value
}

export const createPackageHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { PackageName, Description, BasePrice, EstimatedDays } = req.body

    if (!PackageName || typeof PackageName !== 'string') {
      res.status(400).json({ message: 'PackageName is required' })
      return
    }

    if (BasePrice !== undefined && BasePrice !== null && (typeof BasePrice !== 'number' || BasePrice < 0)) {
      res.status(400).json({ message: 'BasePrice must be a number greater than or equal to 0' })
      return
    }

    if (
      EstimatedDays !== undefined &&
      EstimatedDays !== null &&
      (!Number.isInteger(EstimatedDays) || EstimatedDays < 0)
    ) {
      res.status(400).json({ message: 'EstimatedDays must be an integer greater than or equal to 0' })
      return
    }

    const servicePackage = await createPackage({
      PackageName,
      Description: parseOptionalString(Description),
      BasePrice: parseOptionalNumber(BasePrice),
      EstimatedDays: parseOptionalNumber(EstimatedDays)
    })

    res.status(201).json({
      message: 'Create package successfully',
      data: servicePackage
    })
  } catch (error) {
    console.error('Error in createPackageHandler:', error)
    res.status(500).json({ message: 'Server error while creating package' })
  }
}

export const updatePackageHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const packageId = parsePackageId(req.params.id)

    if (!packageId) {
      res.status(400).json({ message: 'Package ID is invalid' })
      return
    }

    const { PackageName, Description, BasePrice, EstimatedDays } = req.body

    if (PackageName !== undefined && (typeof PackageName !== 'string' || PackageName.trim() === '')) {
      res.status(400).json({ message: 'PackageName must be a non-empty string' })
      return
    }

    if (BasePrice !== undefined && BasePrice !== null && (typeof BasePrice !== 'number' || BasePrice < 0)) {
      res.status(400).json({ message: 'BasePrice must be a number greater than or equal to 0' })
      return
    }

    if (
      EstimatedDays !== undefined &&
      EstimatedDays !== null &&
      (!Number.isInteger(EstimatedDays) || EstimatedDays < 0)
    ) {
      res.status(400).json({ message: 'EstimatedDays must be an integer greater than or equal to 0' })
      return
    }

    const servicePackage = await updatePackage(packageId, {
      PackageName,
      Description: parseOptionalString(Description),
      BasePrice: parseOptionalNumber(BasePrice),
      EstimatedDays: parseOptionalNumber(EstimatedDays)
    })

    res.status(200).json({
      message: 'Update package successfully',
      data: servicePackage
    })
  } catch (error: any) {
    console.error('Error in updatePackageHandler:', error)

    if (error.message === 'NO_UPDATE_FIELDS') {
      res.status(400).json({ message: 'At least one field is required for update' })
      return
    }

    if (error.message === 'PACKAGE_NOT_FOUND') {
      res.status(404).json({ message: 'Package not found' })
      return
    }

    res.status(500).json({ message: 'Server error while updating package' })
  }
}

export const deletePackageHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const packageId = parsePackageId(req.params.id)

    if (!packageId) {
      res.status(400).json({ message: 'Package ID is invalid' })
      return
    }

    await deletePackage(packageId)

    res.status(200).json({
      message: 'Delete package successfully'
    })
  } catch (error: any) {
    console.error('Error in deletePackageHandler:', error)

    if (error.message === 'PACKAGE_NOT_FOUND') {
      res.status(404).json({ message: 'Package not found' })
      return
    }

    res.status(500).json({ message: 'Server error while deleting package' })
  }
}

export const getPackageByIdHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const packageId = parsePackageId(req.params.id)

    if (!packageId) {
      res.status(400).json({ message: 'Package ID is invalid' })
      return
    }

    const servicePackage = await getPackageById(packageId)

    if (!servicePackage) {
      res.status(404).json({ message: 'Package not found' })
      return
    }

    res.status(200).json({
      message: 'Get package successfully',
      data: servicePackage
    })
  } catch (error) {
    console.error('Error in getPackageByIdHandler:', error)
    res.status(500).json({ message: 'Server error while getting package' })
  }
}

export const listPackagesHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const packages = await listPackages()

    res.status(200).json({
      message: 'Get packages successfully',
      data: packages
    })
  } catch (error) {
    console.error('Error in listPackagesHandler:', error)
    res.status(500).json({ message: 'Server error while getting packages' })
  }
}

export const packageController = {
  create: createPackageHandler,
  update: updatePackageHandler,
  delete: deletePackageHandler,
  getById: getPackageByIdHandler,
  list: listPackagesHandler
}

export default packageController
