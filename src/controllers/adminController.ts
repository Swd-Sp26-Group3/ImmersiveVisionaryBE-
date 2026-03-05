import { AuthRequest } from "@/middlewares/authMiddleware";
import { asyncHandler } from "../middlewares/errorMiddleware";
import { NextFunction,Response } from "express";

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
}
export const adminController = new AdminController();