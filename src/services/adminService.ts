import { getDbPool } from '../config/database'
import type { User, Service, DashboardStats } from '../types/type'

class AdminService {
  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const pool = await getDbPool()

    try {
      // Get total users
      const usersResult = await pool.request().query(`
      SELECT COUNT(*) as totalUsers FROM Accounts
    `)

      // Get total tests
      const testsResult = await pool.request().query(`
      SELECT COUNT(*) as totalTests FROM TestRequests
    `)

      // Get total services
      const servicesResult = await pool.request().query(`
      SELECT COUNT(*) as totalServices FROM Services 
    `)

      // Get monthly revenue (last 6 months)
      const revenueResult = await pool.request().query(`
      SELECT 
        MONTH(tr.CreatedAt) as month,
        SUM(s.Price) as revenue
      FROM TestRequests tr
      JOIN Services s ON tr.ServiceID = s.ServiceID
      WHERE tr.CreatedAt >= DATEADD(month, -6, GETDATE())
      
      GROUP BY MONTH(tr.CreatedAt)
      ORDER BY MONTH(tr.CreatedAt)
    `)

      // Get service distribution (exclude "Other" category)
      const distributionResult = await pool.request().query(`
      SELECT 
        s.ServiceName,
        COUNT(*) as count
      FROM TestRequests tr
      JOIN Services s ON tr.ServiceID = s.ServiceID
      GROUP BY s.ServiceName, s.ServiceID
      ORDER BY COUNT(*) DESC
    `)

      // Get completed tests
      const completedResult = await pool.request().query(`
      SELECT COUNT(*) as completed 
      FROM TestRequests 
      WHERE Status = 'Completed'
    `)

      // Get pending tests
      const pendingResult = await pool.request().query(`
      SELECT COUNT(*) as pending 
      FROM TestRequests 
      WHERE Status = 'Pending'
    `)

      // Get total feedback
      const feedbackResult = await pool.request().query(`
      SELECT COUNT(*) as feedback FROM Feedbacks
    `)

      // Get average rating
      const avgRatingResult = await pool.request().query(`
      SELECT AVG(CAST(Rating as FLOAT)) as avgRating 
      FROM Feedbacks
    `)

      // Get total revenue
      const totalRevenueResult = await pool.request().query(`
      SELECT SUM(s.Price) as totalRevenue
      FROM TestRequests tr
      JOIN Services s ON tr.ServiceID = s.ServiceID
    
    `)

      // Process monthly revenue data
      const monthlyRevenue = Array(6).fill(0)
      revenueResult.recordset.forEach((row) => {
        const currentMonth = new Date().getMonth() + 1
        const monthIndex = (row.month - currentMonth + 6) % 6
        if (monthIndex >= 0 && monthIndex < 6) {
          monthlyRevenue[monthIndex] = row.revenue || 0
        }
      })

      // Process service distribution data (only actual services, no "Other")
      const serviceDistribution = distributionResult.recordset.map((row) => row.count)
      const serviceNames = distributionResult.recordset.map((row) => row.ServiceName)

      return {
        totalUsers: usersResult.recordset[0].totalUsers,
        totalTests: testsResult.recordset[0].totalTests,
        totalServices: servicesResult.recordset[0].totalServices,
        revenue: totalRevenueResult.recordset[0].totalRevenue || 0,
        avgRating: Number((avgRatingResult.recordset[0]?.avgRating || 0).toFixed(1)),
        completed: completedResult.recordset[0].completed,
        pending: pendingResult.recordset[0].pending,
        feedback: feedbackResult.recordset[0].feedback,
        monthlyRevenue,
        serviceDistribution,
        serviceNames
      }
    } catch (error) {
      console.error('Error getting dashboard stats:', error)
      throw error
    }
  }
  // Get user by ID with full details
  async getUserById(accountId: number) {
    const pool = await getDbPool()

    try {
      const result = await pool.request().input('accountId', accountId).query(`
        SELECT 
          a.AccountID as accountId,
          up.FullName as name,
          a.Email as email,
          r.RoleName as role,
          up.PhoneNumber
        FROM Accounts a
        LEFT JOIN UserProfiles up ON a.AccountID = up.AccountID
        JOIN Roles r ON a.RoleID = r.RoleID  WHERE a.AccountID = @accountId
      `)

      if (result.recordset.length === 0) {
        throw new Error('User not found')
      }

      const record = result.recordset[0]
      return record
    } catch (error) {
      console.error('Error getting user by ID:', error)
      throw error
    }
  }

  // User Management
  async getAllUsers(search?: string): Promise<User[]> {
    const pool = await getDbPool()

    try {
      const result = await pool.request().input('search', `%${search || ''}%`).query(`
        SELECT 
          a.AccountID as accountId,
          up.FullName as name,
          a.Email as email,
          r.RoleName as role,
          up.PhoneNumber
        FROM Accounts a
        LEFT JOIN UserProfiles up ON a.AccountID = up.AccountID
        JOIN Roles r ON a.RoleID = r.RoleID  WHERE a.Email LIKE @search
      `)
      return result.recordset
    } catch (error) {
      console.error('Error getting all users:', error)
      throw error
    }
  }

  async updateUserRole(userId: number, roleId: number): Promise<void> {
    const pool = await getDbPool()

    try {
      await pool.request().input('userId', userId).input('roleId', roleId).query(`
          UPDATE Accounts 
          SET RoleID = @roleId 
          WHERE AccountID = @userId
        `)
    } catch (error) {
      console.error('Error updating user role:', error)
      throw error
    }
  }

  async deleteUser(userId: number): Promise<void> {
    const pool = await getDbPool()

    try {
      // Delete user profile first
      await pool.request().input('userId', userId).query(`DELETE FROM UserProfiles WHERE AccountID = @userId`)

      // Delete account
      await pool.request().input('userId', userId).query(`DELETE FROM Accounts WHERE AccountID = @userId`)
    } catch (error) {
      console.error('Error deleting user:', error)
      throw error
    }
  }

  // Service Management
  async getAllServices(): Promise<Service[]> {
    const pool = await getDbPool()

    try {
      const result = await pool.request().query(`
        SELECT 
          ServiceID,
          ServiceName,
          ServiceType,
          Description,
          Price,
          SampleCount,
          CreatedAt,
          UpdatedAt
        FROM Services 
        
        ORDER BY ServiceType, ServiceName
      `)

      return result.recordset
    } catch (error) {
      console.error('Error getting all services:', error)
      throw error
    }
  }

  async createService(serviceData: Omit<Service, 'ServiceID' | 'CreatedAt' | 'UpdatedAt'>): Promise<Service> {
    const pool = await getDbPool()

    try {
      const result = await pool
        .request()
        .input('serviceName', serviceData.ServiceName)
        .input('serviceType', serviceData.ServiceType)
        .input('description', serviceData.Description)
        .input('price', serviceData.Price)
        .input('sampleCount', serviceData.SampleCount).query(`
          INSERT INTO Services (
            ServiceName, ServiceType, Description, Price, 
            SampleCount
          )
          VALUES (
            @serviceName, @serviceType, @description, @price,
            @sampleCount
          )
        `)
      const created = await pool.request().input('serviceName', serviceData.ServiceName).query('SELECT * FROM Services')

      return created.recordset[0]
    } catch (error) {
      console.error('Error creating service:', error)
      throw error
    }
  }

  async updateService(serviceId: number, serviceData: Partial<Service>): Promise<Service> {
    const pool = await getDbPool()

    try {
      const setParts = []
      const request = pool.request().input('serviceId', serviceId)

      if (serviceData.ServiceName) {
        setParts.push('ServiceName = @serviceName')
        request.input('serviceName', serviceData.ServiceName)
      }

      if (serviceData.ServiceType) {
        setParts.push('ServiceType = @serviceType')
        request.input('serviceType', serviceData.ServiceType)
      }

      if (serviceData.Description) {
        setParts.push('Description = @description')
        request.input('description', serviceData.Description)
      }

      if (serviceData.Price !== undefined) {
        setParts.push('Price = @price')
        request.input('price', serviceData.Price)
      }

      if (serviceData.SampleCount) {
        setParts.push('SampleCount = @sampleCount')
        request.input('sampleCount', serviceData.SampleCount)
      }

      setParts.push('UpdatedAt = GETDATE()')

      const result = await request.query(`
        UPDATE Services 
        SET ${setParts.join(', ')}
        OUTPUT INSERTED.*
        WHERE ServiceID = @serviceId 
      `)

      return result.recordset[0]
    } catch (error) {
      console.error('Error updating service:', error)
      throw error
    }
  }

  async deleteService(serviceId: number): Promise<void> {
    const pool = await getDbPool()

    try {
      await pool.request().input('serviceId', serviceId).query(`
          DELETE Services 
          WHERE ServiceID = @serviceId
        `)
    } catch (error) {
      console.error('Error deleting service:', error)
      throw error
    }
  }
}

export const adminService = new AdminService()
