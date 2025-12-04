# TwinAI API

AI-powered digital twin API - Create your personal AI clone that learns and evolves with you.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 16+ with pgvector extension
- Google Gemini API key

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Create vector indexes (run in pgAdmin or psql)
# See: prisma/migrations/create_vector_indexes.sql

# Start development server
npm run dev
```

## 🧠 Vector Search (pgvector)

This API uses pgvector for semantic memory search. After `db:push`, run the SQL in `prisma/migrations/create_vector_indexes.sql` to create HNSW indexes for fast similarity search.

```sql
-- In pgAdmin Query Tool
CREATE EXTENSION IF NOT EXISTS vector;

-- Then run create_vector_indexes.sql
```

## 📁 Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middlewares/     # Express middlewares
├── routes/          # API routes
├── services/        # Business logic
│   ├── auth.service.js
│   ├── chat.service.js
│   ├── embedding.service.js  # Gemini embeddings
│   ├── gemini.service.js     # AI responses
│   ├── memory.service.js     # Semantic memory
│   └── user.service.js
├── utils/           # Utility functions
│   └── prompts/     # AI prompt templates
├── validations/     # Request validations
└── app.js           # Express app
```

## 🔑 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register with email/password |
| POST | `/api/v1/auth/login` | Login with email/password |
| POST | `/api/v1/auth/google` | Google OAuth login |
| POST | `/api/v1/auth/apple` | Apple Sign-In |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users/me` | Get current user profile |
| PATCH | `/api/v1/users/me` | Update profile |
| POST | `/api/v1/users/me/change-password` | Change password |
| DELETE | `/api/v1/users/me` | Delete account |

### Chat (AI Twin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/chat` | Send message to AI twin |
| GET | `/api/v1/chat/conversations` | List conversations |
| GET | `/api/v1/chat/conversations/:id` | Get conversation details |
| DELETE | `/api/v1/chat/conversations/:id` | Delete conversation |

### Memories (Semantic)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/memories` | Create a memory manually |
| GET | `/api/v1/memories` | List memories |
| GET | `/api/v1/memories/search?q=` | Semantic search memories |
| DELETE | `/api/v1/memories/:id` | Delete a memory |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

## 🔐 Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

## 📝 Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Environment (development/production) |
| `PORT` | Server port |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry (e.g., 15m) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry (e.g., 7d) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `APPLE_CLIENT_ID` | Apple Sign-In client ID |
| `APPLE_TEAM_ID` | Apple Team ID |
| `APPLE_KEY_ID` | Apple Key ID |

## 🛠️ Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with hot reload
npm run db:generate # Generate Prisma client
npm run db:push    # Push schema to database
npm run db:migrate # Run migrations
npm run db:studio  # Open Prisma Studio
npm run lint       # Run ESLint
npm run lint:fix   # Fix ESLint errors
npm run format     # Format code with Prettier
```

## 🧬 How Twin Learning Works

1. **Chat**: User sends message → AI responds
2. **Analyze**: Background job extracts insights & memories
3. **Embed**: Important info converted to vectors (768-dim)
4. **Store**: Saved to PostgreSQL with pgvector
5. **Recall**: Future chats search relevant memories
6. **Context**: Twin uses memories for personalized responses

## 📜 License

MIT
