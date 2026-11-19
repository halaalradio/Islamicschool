# IslamicSchool API (Node.js)

A Node.js/Express starter API shaped around the endpoints used by the supplied
`IslamicSchool` Android project.

## Render Web Service

- Runtime: Node
- Root Directory: leave blank when these files are at the repository root
- Build Command: `npm install`
- Start Command: `npm start`
- Environment variable: `JWT_SECRET` = a long random secret value

The service listens on `process.env.PORT`.

## Implemented Android API routes

### Authentication
- `POST /api/auth/student/signup`
- `POST /api/auth/teacher/signup`
- `POST /api/auth/verify-code`
- `POST /api/auth/regenerate-code`
- `POST /api/auth/login`
- `POST /api/auth/reset-password`
- Extra helper: `POST /api/auth/request-reset-code`

### Classes and requests
- `GET /api/classes`
- `POST /api/admin/create-class`
- `POST /api/users/request/:userId/to/:classId`
- `GET /api/users/:userId/classes`
- `GET /api/users/:userId/requests`
- `GET /api/classes/:classId/users`
- `GET /api/classes/:classId/announcements`
- `GET /api/classes/:classId/tasks`
- `GET /api/classes/:classId/requests`
- `PUT /api/admin/approve-request/:requestId`
- `PUT /api/admin/decline-request/:requestId`

### Tasks, announcements and submissions
- `POST /api/teachers/class/:classId/create-task`
- `POST /api/teachers/create-announcement/:classId`
- `POST /api/teachers/task/:taskId/create-source`
- `GET /api/users/task/:taskId`
- `POST /api/students/submit/:userId/:taskId`
- `GET /api/students/submissions/:taskId/:userId`
- `GET /api/teachers/task/:taskId/submissions`
- `PUT /api/teachers/update-submission/:submissionId`

### User
- `GET /api/users/:userId`
- `PUT /api/users/update-user/:userId`
- `POST /api/users/:userId/upload-image` (multipart field: `file`)

## Important limitations — read before real use

This is a starter/testing backend, not a production school database:
- All records are held in memory and are erased when the process restarts or redeploys.
- Verification and password-reset codes are printed in the server logs. No email is sent.
- Uploaded profile images are accepted but not permanently stored.
- A default `JWT_SECRET` exists only to make local testing easier. Set a strong
  `JWT_SECRET` in Render before deploying publicly.
- A first ADMIN account must be provisioned securely before admin-only actions
  can be used. Do not grant ADMIN role from an open public signup endpoint.
- Before using real student information, connect persistent PostgreSQL storage,
  configure an email provider, persistent image storage, and production security.

The Android project source has no explicit endpoint for requesting a password
reset code; `/api/auth/request-reset-code` is an additional helper endpoint.
