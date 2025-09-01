# Nicsan CRM Backend

A robust, enterprise-grade backend API for the Nicsan CRM insurance operations management system.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Policy Management**: Complete CRUD operations for insurance policies
- **PDF Processing**: PDF upload and review flow (external extraction TBD)
- **File Upload**: S3 integration for secure file storage
- **Analytics Dashboard**: Comprehensive KPI and performance metrics
- **User Management**: Role-based user administration
- **Real-time Processing**: Asynchronous PDF processing with status tracking

## 🏗️ Architecture

- **Framework**: Node.js + Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (AWS RDS)
- **Cloud Services**: AWS S3
- **Authentication**: JWT with bcrypt password hashing
- **File Handling**: Multer for multipart/form-data

## 📋 Prerequisites

- Node.js 18+ LTS
- PostgreSQL database (AWS RDS recommended)
- AWS Account with S3 access
- AWS CLI configured (optional, for local development)

## 🛠️ Installation

1. **Clone and install dependencies**
   ```bash
   cd nicsan-crm-backend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Run the schema file in your PostgreSQL database
   psql -h your-rds-endpoint -U your_username -d your_database -f src/config/schema.sql
   ```

4. **Build and Run**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

## 🔧 Configuration

### Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Database (AWS RDS PostgreSQL)
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=5432
DB_NAME=nicsan_crm
DB_USER=your_username
DB_PASSWORD=your_password
DB_SSL=true

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# AWS
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# S3
S3_BUCKET_NAME=nicsan-crm-pdfs
S3_REGION=ap-south-1

# CORS
CORS_ORIGIN=http://localhost:5173
```

## 🗄️ Database Schema

### Core Tables

- **users**: User accounts with role-based access
- **policies**: Insurance policy data with comprehensive fields
- **pdf_uploads**: PDF file uploads and processing status
- **audit_logs**: Complete audit trail for compliance

### Key Features

- **UUID primary keys** for security
- **Automatic timestamps** with triggers
- **Performance indexes** on frequently queried fields
- **JSONB storage** for flexible data (extracted PDF content)
- **Referential integrity** with foreign key constraints

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration (Founder only)
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/change-password` - Change password

### Policies
- `GET /api/policies` - List policies with pagination and filters
- `GET /api/policies/:id` - Get policy by ID
- `POST /api/policies` - Create new policy
- `PUT /api/policies/:id` - Update policy
- `DELETE /api/policies/:id` - Delete policy
- `POST /api/policies/bulk` - Bulk create policies (grid entry)

### File Upload
- `POST /api/upload/pdf` - Upload PDF (processing handled externally)
- `GET /api/upload/pdf/:id` - Get upload status
- `GET /api/upload/pdf` - List all uploads
- `POST /api/upload/pdf/:id/retry` - Retry failed processing

### Dashboard (Founder only)
- `GET /api/dashboard/metrics` - Overall metrics
- `GET /api/dashboard/sales-reps` - Sales representative performance
- `GET /api/dashboard/trends` - Time-series data for charts
- `GET /api/dashboard/data-sources` - Data source analysis
- `GET /api/dashboard/vehicle-analysis` - Vehicle make/model insights
- `GET /api/dashboard/kpis` - Comprehensive KPI calculations

### User Management (Founder only)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## 🔐 Security Features

- **JWT Authentication** with configurable expiration
- **Role-based Access Control** (Ops vs Founder)
- **Password Hashing** with bcrypt (12 rounds)
- **Input Validation** and sanitization
- **CORS Protection** with configurable origins
- **Helmet.js** for security headers
- **Rate Limiting** (configurable)
- **SQL Injection Protection** with parameterized queries

## 📊 PDF Processing Flow

1. **Upload**: PDF uploaded via multipart/form-data
2. **Validation**: File size, type, and metadata validation
3. **S3 Storage**: File stored in configured S3 bucket
4. **Database Record**: Upload record created with status 'UPLOADED'
5. **Processing**: External extraction pipeline (to be integrated)
6. **Review**: Ops review and confirmation

## 🚀 Performance Features

- **Connection Pooling** for database efficiency
- **Asynchronous Processing** for PDF operations
- **Efficient Queries** with proper indexing
- **Pagination** for large datasets
- **Caching Ready** architecture for future Redis integration

## 🧪 Development

### Scripts
```bash
npm run dev          # Development with nodemon
npm run build        # TypeScript compilation
npm run start        # Production server
npm run dev:build    # Build and run
```

### Code Quality
- **TypeScript** with strict mode
- **ESLint** configuration
- **Prettier** ready
- **Error handling** middleware
- **Request logging** middleware

## 📈 Monitoring & Logging

- **Request Logging** with timestamps
- **Error Logging** with stack traces
- **Database Connection** monitoring
- **File Upload** progress tracking
PDF processing status updates

## 🔄 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database schema deployed
- [ ] AWS credentials configured
- [ ] S3 bucket created and configured
- [ ] External processing pipeline configured
- [ ] SSL certificates configured
- [ ] Process manager (PM2) configured
- [ ] Monitoring and alerting set up

### Docker Support
```dockerfile
# Dockerfile available for containerized deployment
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is proprietary software for Nicsan CRM operations.

## 🆘 Support

For technical support or questions:
- Check the API documentation
- Review error logs
- Contact the development team

---

**Built with ❤️ for Nicsan CRM Team**
