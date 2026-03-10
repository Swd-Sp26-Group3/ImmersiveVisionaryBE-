import type { Request, Response } from 'express'
import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  updateProduct
} from '../services/productService'

const parseProductId = (idParam: string): number | null => {
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

export const createProductHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { CompanyId, ProductName, Description, Category, SizeInfo, ColorInfo } = req.body

    if (!Number.isInteger(CompanyId) || CompanyId <= 0) {
      res.status(400).json({ message: 'CompanyId is required and must be a positive integer' })
      return
    }

    if (!ProductName || typeof ProductName !== 'string') {
      res.status(400).json({ message: 'ProductName is required' })
      return
    }

    const product = await createProduct({
      CompanyId,
      ProductName,
      Description: parseOptionalString(Description),
      Category: parseOptionalString(Category),
      SizeInfo: parseOptionalString(SizeInfo),
      ColorInfo: parseOptionalString(ColorInfo)
    })

    res.status(201).json({
      message: 'Create product successfully',
      data: product
    })
  } catch (error: any) {
    console.error('Error in createProductHandler:', error)

    if (error?.number === 547) {
      res.status(400).json({ message: 'CompanyId does not exist' })
      return
    }

    res.status(500).json({ message: 'Server error while creating product' })
  }
}

export const updateProductHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = parseProductId(req.params.id)

    if (!productId) {
      res.status(400).json({ message: 'Product ID is invalid' })
      return
    }

    const { CompanyId, ProductName, Description, Category, SizeInfo, ColorInfo } = req.body

    if (CompanyId !== undefined && (!Number.isInteger(CompanyId) || CompanyId <= 0)) {
      res.status(400).json({ message: 'CompanyId must be a positive integer' })
      return
    }

    if (ProductName !== undefined && (typeof ProductName !== 'string' || ProductName.trim() === '')) {
      res.status(400).json({ message: 'ProductName must be a non-empty string' })
      return
    }

    const product = await updateProduct(productId, {
      CompanyId,
      ProductName,
      Description: parseOptionalString(Description),
      Category: parseOptionalString(Category),
      SizeInfo: parseOptionalString(SizeInfo),
      ColorInfo: parseOptionalString(ColorInfo)
    })

    res.status(200).json({
      message: 'Update product successfully',
      data: product
    })
  } catch (error: any) {
    console.error('Error in updateProductHandler:', error)

    if (error.message === 'NO_UPDATE_FIELDS') {
      res.status(400).json({ message: 'At least one field is required for update' })
      return
    }

    if (error.message === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ message: 'Product not found' })
      return
    }

    if (error?.number === 547) {
      res.status(400).json({ message: 'CompanyId does not exist' })
      return
    }

    res.status(500).json({ message: 'Server error while updating product' })
  }
}

export const deleteProductHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = parseProductId(req.params.id)

    if (!productId) {
      res.status(400).json({ message: 'Product ID is invalid' })
      return
    }

    await deleteProduct(productId)

    res.status(200).json({
      message: 'Delete product successfully'
    })
  } catch (error: any) {
    console.error('Error in deleteProductHandler:', error)

    if (error.message === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ message: 'Product not found' })
      return
    }

    res.status(500).json({ message: 'Server error while deleting product' })
  }
}

export const getProductByIdHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = parseProductId(req.params.id)

    if (!productId) {
      res.status(400).json({ message: 'Product ID is invalid' })
      return
    }

    const product = await getProductById(productId)

    if (!product) {
      res.status(404).json({ message: 'Product not found' })
      return
    }

    res.status(200).json({
      message: 'Get product successfully',
      data: product
    })
  } catch (error) {
    console.error('Error in getProductByIdHandler:', error)
    res.status(500).json({ message: 'Server error while getting product' })
  }
}

export const listProductsHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await listProducts()

    res.status(200).json({
      message: 'Get products successfully',
      data: products
    })
  } catch (error) {
    console.error('Error in listProductsHandler:', error)
    res.status(500).json({ message: 'Server error while getting products' })
  }
}

export const productController = {
  create: createProductHandler,
  update: updateProductHandler,
  delete: deleteProductHandler,
  getById: getProductByIdHandler,
  list: listProductsHandler
}

export default productController
