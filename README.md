# Collab AI

Collab AI is a collaborative product management platform that merges Slack-style communication with Notion-style workspace organization. It enables teams to chat, create structured pages, comment, and share files inside secure workspaces with role-based access control.

## Features

* Real-time chat inside workspaces
* Create and manage multiple workspaces
* Notion-style page creation
* Comment system for collaboration
* Role hierarchy: Owner / Admin / Member
* Token-based authentication (JWT)
* Admin and user authorization
* Internal file and page sharing
* Redis-backed real-time features

## Tech Stack

**Frontend**

* Next.js
* React
* WebSockets

**Backend**

* Node.js
* Express
* TypeScript
* Drizzle ORM
* PostgreSQL (Neon)
* Redis
* JWT authentication

## Project Structure

### Backend

```
src/
  controllers/
  services/
  middlewares/
  db/
  utils/
  types/
dist/ (compiled output)
drizzle/ (database config)
```

The backend follows a controller → service architecture:

* Controllers handle HTTP/WebSocket requests
* Services contain business logic
* Middlewares handle auth and validation
* Redis is used for real-time messaging

### Frontend

```
frontend/
  public/
  types/
  app / components / pages
```

The frontend communicates with the backend via REST + WebSockets.

## Installation

### Prerequisites

* Node.js 18+
* PostgreSQL database
* Redis server running locally
* npm / pnpm / yarn

---

## Backend Setup

Clone the repository and install dependencies:

```bash
cd backend
npm install
```

Create `.env`:

```env
DATABASE_URL=your_database_url
JWT_SECRET=your_secret
API_PORT=4000
REDIS_URL=redis://localhost:6379
```

Run backend:

```bash
npm run dev
```

---

## Frontend Setup

```bash
cd frontend
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
JWT_SECRET=your_secret
```

Run frontend:

```bash
npm run dev
```

Frontend runs on:

```
http://localhost:3000
```

Backend runs on:

```
http://localhost:4000
```

---

## Usage

1. Register or login
2. Create a workspace
3. Invite members
4. Start chatting
5. Create pages
6. Comment and collaborate
7. Share files internally

---

## Future Improvements

* Live collaborative page editing
* Notifications system
* Mobile UI support
* Advanced permission controls
* External integrations

---

## Author

Amish Kumar

## License

MIT

---