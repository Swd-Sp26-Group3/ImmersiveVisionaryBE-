# Electric Verhicle Charging Station

A comprehensive DNA testing service backend built with Node.js, Express, and TypeScript.

## 🚀 Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **User Management**: Support for multiple user roles (Admin, Manager, Staff, Customer)
- **DNA Test Management**: Complete workflow for DNA test requests and processing
- **Payment Integration**: VNPay payment gateway integration
- **Email Services**: Automated email notifications
- **File Management**: PDF report generation and file handling
- **Database**: MySQL database with proper relationships

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: SQLServer
- **Authentication**: JWT (JSON Web Tokens)
- **Payment**: VNPay
- **Email**: Nodemailer
- **PDF Generation**: Custom PDF utilities
- **Development**: Nodemon for hot reloading

## 📁 Project Structure

```bash
src/
├── config/ # Database and app configuration
├── constants/ # Application constants and enums
├── controllers/ # Route controllers
├── middlewares/ # Custom middlewares
├── routes/ # API routes
├── services/ # Business logic layer
├── utils/ # Utility functions
├── types/ # TypeScript type definitions
├── fonts/ # Font files for PDF generation
└── public/ # Static assets
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- SQLServer database
- npm or yarn package manager

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone <repository-url>
   cd bloodline-dna-backend
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up environment variables:
   Create a \`.env\` file in the root directory with the following variables:

\`\`\`env

# Database Configuration

DB_HOST=localhost
DB_PORT=3306
DB_NAME=bloodline_dna
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT Configuration

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# Email Configuration

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_email_password

# VNPay Configuration

VNPAY_TMN_CODE=your_vnpay_tmn_code
VNPAY_SECRET_KEY=your_vnpay_secret_key
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/payment/vnpay-return

# Server Configuration

PORT=5000
NODE_ENV=development
\`\`\`


4. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

The server will start on \`http://localhost:5000\`

## 📚 API Documentation

### Authentication Endpoints

- \`POST /api/auth/register\` - User registration
- \`POST /api/auth/login\` - User login
- \`POST /api/auth/forgot-password\` - Request password reset
- \`POST /api/auth/reset-password\` - Reset password

### User Management

- \`GET /api/users/profile\` - Get user profile
- \`PUT /api/users/profile\` - Update user profile
- \`GET /api/users/history\` - Get user service history

### Test Request Management

- \`POST /api/test-requests\` - Create new test request
- \`GET /api/test-requests\` - Get test requests (filtered by role)
- \`PUT /api/test-requests/:id/status\` - Update test request status
- \`GET /api/test-requests/:id/result\` - Get test result

### Admin Endpoints

- \`GET /api/admin/users\` - Get all users
- \`PUT /api/admin/users/:id/role\` - Update user role
- \`GET /api/admin/statistics\` - Get system statistics

### Manager Endpoints

- \`GET /api/manager/test-results\` - Manage test results
- \`POST /api/manager/blogs\` - Create blog posts
- \`GET /api/manager/feedback\` - View customer feedback

### Staff Endpoints

- \`GET /api/staff/requests\` - Get assigned test requests
- \`PUT /api/staff/requests/:id/process\` - Process test request
- \`POST /api/staff/requests/:id/result\` - Submit test result

### Payment Endpoints

- \`POST /api/payment/create\` - Create payment
- \`GET /api/payment/vnpay-return\` - Handle VNPay return

## 🔧 Available Scripts

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build the TypeScript project
- \`npm start\` - Start production server
- \`npm run lint\` - Run ESLint
- \`npm test\` - Run tests

## 🏗 Database Schema

The application uses MySQL with the following main tables:

- \`users\` - User accounts and profiles
- \`test_requests\` - DNA test requests
- \`test_results\` - Test results and reports
- \`services\` - Available DNA testing services
- \`payments\` - Payment transactions
- \`feedback\` - Customer feedback
- \`blogs\` - Blog posts and articles

## 🔐 Authentication & Authorization

The API uses JWT tokens for authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

### User Roles:

- **Admin**: Full system access
- **Manager**: Manage test results, blogs, and feedback
- **Staff**: Process test requests and submit results
- **Customer**: Create test requests and view results

## 🚀 Deployment

### Production Build

\`\`\`bash
npm run build
npm start
\`\`\`
