/**
 * IslamicSchool API
 * Node.js + Express + Supabase PostgreSQL
 */

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// SUPABASE & ENVIRONMENT VARIABLES
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://hewxmgzajaqwqxcdchvv.supabase.co";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:[YOUR-DATABASE-PASSWORD]@db.hewxmgzajaqwqxcdchvv.supabase.co:5432/postgres";
const JWT_SECRET = process.env.JWT_SECRET;
const TEACHER_SIGNUP_CODE = process.env.TEACHER_SIGNUP_CODE;

if (!DATABASE_URL || DATABASE_URL.includes("[YOUR-DATABASE-PASSWORD]")) {
  throw new Error(
    "DATABASE_URL is required and must replace [sb_publishable_n8JdbNxS4jIKfNhMcojCvg_iI0d_8yZ]"
  );
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}

// SUPABASE POSTGRESQL CONNECTION
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (err) => {
  console.error("Database connection error:", err.message);
});

const db = (sql, params = []) => pool.query(sql, params);

// HELPERS
const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const auth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.substring(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const allow = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Permission denied" });
  }
  next();
};

const validId = (id) =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  }
});

// HEALTH CHECK
app.get("/", (req, res) => {
  res.json({
    name: "IslamicSchool API",
    supabaseUrl: SUPABASE_URL,
    status: "running"
  });
});

app.get("/health", async (req, res) => {
  try {
    await db("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(503).json({
      status: "error",
      database: "disconnected"
    });
  }
});

// STUDENT SIGNUP
async function studentSignup(req, res) {
  try {
    const { fullName, name, email, phone, password } = req.body;
    const userName = fullName || name;

    if (!userName || !email || !password) {
      return res.status(400).json({
        error: "Name, email and password are required"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must contain at least 8 characters"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db(
      `INSERT INTO users
       (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'STUDENT')
       RETURNING id, full_name, email, phone, role, created_at`,
      [userName, email.toLowerCase().trim(), phone || null, passwordHash]
    );

    const user = result.rows[0];

    res.status(201).json({
      message: "Student account created",
      user,
      token: createToken(user)
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ error: "Student signup failed" });
  }
}

app.post("/api/signup/student", studentSignup);
app.post("/api/auth/signup/student", studentSignup);

// TEACHER SIGNUP
async function teacherSignup(req, res) {
  try {
    const { fullName, name, email, phone, password, teacherCode } = req.body;
    const userName = fullName || name;

    if (!TEACHER_SIGNUP_CODE) {
      return res.status(403).json({
        error: "Teacher registration is currently disabled"
      });
    }

    if (teacherCode !== TEACHER_SIGNUP_CODE) {
      return res.status(403).json({ error: "Invalid teacher invitation code" });
    }

    if (!userName || !email || !password || password.length < 8) {
      return res.status(400).json({ error: "Invalid registration details" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db(
      `INSERT INTO users
       (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'TEACHER')
       RETURNING id, full_name, email, phone, role, created_at`,
      [userName, email.toLowerCase().trim(), phone || null, passwordHash]
    );

    const user = result.rows[0];

    res.status(201).json({
      message: "Teacher account created",
      user,
      token: createToken(user)
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ error: "Teacher signup failed" });
  }
}

app.post("/api/signup/teacher", teacherSignup);
app.post("/api/auth/signup/teacher", teacherSignup);

// LOGIN
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const result = await db(
      `SELECT * FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Incorrect email or password" });
    }

    const publicUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      is_verified: user.is_verified
    };

    res.json({
      message: "Login successful",
      user: publicUser,
      token: createToken(publicUser)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
}

app.post("/api/login", login);
app.post("/api/auth/login", login);

// CURRENT USER / PROFILE
app.get("/api/profile", auth, async (req, res) => {
  try {
    const result = await db(
      `SELECT id, full_name, email, phone, role, is_verified, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load profile" });
  }
});

app.put("/api/profile", auth, async (req, res) => {
  try {
    const { fullName, name, phone } = req.body;
    const userName = fullName || name;

    const result = await db(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           updated_at = now()
       WHERE id = $3
       RETURNING id, full_name, email, phone, role`,
      [userName || null, phone || null, req.user.id]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Profile update failed" });
  }
});

// CLASSES
app.get("/api/classes", auth, async (req, res) => {
  try {
    let result;

    if (req.user.role === "ADMIN") {
      result = await db(
        `SELECT c.*, u.full_name AS teacher_name
         FROM classes c
         LEFT JOIN users u ON u.id = c.teacher_id
         ORDER BY c.created_at DESC`
      );
    } else if (req.user.role === "TEACHER") {
      result = await db(
        `SELECT c.*, u.full_name AS teacher_name
         FROM classes c
         LEFT JOIN users u ON u.id = c.teacher_id
         WHERE c.teacher_id = $1
         ORDER BY c.created_at DESC`,
        [req.user.id]
      );
    } else {
      result = await db(
        `SELECT c.*, u.full_name AS teacher_name
         FROM classes c
         JOIN class_members m ON m.class_id = c.id
         LEFT JOIN users u ON u.id = c.teacher_id
         WHERE m.user_id = $1 AND m.status = 'APPROVED'
         ORDER BY c.created_at DESC`,
        [req.user.id]
      );
    }

    res.json({ classes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load classes" });
  }
});

// CREATE CLASS
app.post("/api/classes", auth, allow("ADMIN"), async (req, res) => {
  try {
    const { name, description, teacherId } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Class name required" });
    }

    if (teacherId && !validId(teacherId)) {
      return res.status(400).json({ error: "Invalid teacher ID" });
    }

    if (teacherId) {
      const teacher = await db(
        "SELECT id FROM users WHERE id = $1 AND role = 'TEACHER'",
        [teacherId]
      );
      if (!teacher.rows.length) {
        return res.status(404).json({ error: "Teacher not found" });
      }
    }

    const result = await db(
      `INSERT INTO classes (name, description, teacher_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, description || null, teacherId || null]
    );

    res.status(201).json({ class: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Class creation failed" });
  }
});

// REQUEST TO JOIN CLASS
app.post("/api/classes/:id/request", auth, allow("STUDENT"), async (req, res) => {
  try {
    const classId = req.params.id;

    if (!validId(classId)) {
      return res.status(400).json({ error: "Invalid class ID" });
    }

    const found = await db("SELECT id FROM classes WHERE id = $1", [classId]);

    if (!found.rows.length) {
      return res.status(404).json({ error: "Class not found" });
    }

    const result = await db(
      `INSERT INTO class_members (class_id, user_id, status)
       VALUES ($1, $2, 'PENDING')
       ON CONFLICT (class_id, user_id)
       DO UPDATE SET status = 'PENDING'
       RETURNING *`,
      [classId, req.user.id]
    );

    res.status(201).json({
      message: "Class request submitted",
      request: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not submit class request" });
  }
});

// CLASS MEMBERS
app.get("/api/classes/:id/users", auth, async (req, res) => {
  try {
    const classId = req.params.id;

    if (!validId(classId)) {
      return res.status(400).json({ error: "Invalid class ID" });
    }

    const access = await db(
      `SELECT id FROM classes
       WHERE id = $1 AND ($2 = 'ADMIN' OR teacher_id = $3)`,
      [classId, req.user.role, req.user.id]
    );

    if (!access.rows.length && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Not allowed" });
    }

    const result = await db(
      `SELECT m.*, u.full_name, u.email, u.phone
       FROM class_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.class_id = $1
       ORDER BY m.joined_at DESC`,
      [classId]
    );

    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load class users" });
  }
});

// APPROVE / DECLINE CLASS REQUEST
async function updateMembership(req, res, status) {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({ error: "Invalid membership ID" });
    }

    const result = await db(
      `UPDATE class_members m
       SET status = $1
       FROM classes c
       WHERE m.id = $2
         AND c.id = m.class_id
         AND ($3 = 'ADMIN' OR c.teacher_id = $4)
       RETURNING m.*`,
      [status, id, req.user.role, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Request not found or not allowed" });
    }

    res.json({ membership: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Request update failed" });
  }
}

app.post("/api/requests/:id/approve", auth, allow("ADMIN", "TEACHER"),
  (req, res) => updateMembership(req, res, "APPROVED"));

app.post("/api/requests/:id/decline", auth, allow("ADMIN", "TEACHER"),
  (req, res) => updateMembership(req, res, "DECLINED"));

// ANNOUNCEMENTS
app.get("/api/classes/:id/announcements", auth, async (req, res) => {
  try {
    const classId = req.params.id;

    if (!validId(classId)) {
      return res.status(400).json({ error: "Invalid class ID" });
    }

    const result = await db(
      `SELECT a.*, u.full_name AS teacher_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.teacher_id
       WHERE a.class_id = $1
       ORDER BY a.created_at DESC`,
      [classId]
    );

    res.json({ announcements: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load announcements" });
  }
});

app.post("/api/classes/:id/announcements", auth, allow("ADMIN", "TEACHER"),
  async (req, res) => {
    try {
      const classId = req.params.id;
      const { title, content } = req.body;

      if (!validId(classId) || !title || !content) {
        return res.status(400).json({ error: "Invalid announcement details" });
      }

      const access = await db(
        `SELECT id FROM classes
         WHERE id = $1 AND ($2 = 'ADMIN' OR teacher_id = $3)`,
        [classId, req.user.role, req.user.id]
      );

      if (!access.rows.length) {
        return res.status(403).json({ error: "Not allowed for this class" });
      }

      const result = await db(
        `INSERT INTO announcements (class_id, teacher_id, title, content)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [classId, req.user.id, title, content]
      );

      res.status(201).json({ announcement: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Announcement creation failed" });
    }
  }
);

// TASKS
app.get("/api/classes/:id/tasks", auth, async (req, res) => {
  try {
    const classId = req.params.id;

    if (!validId(classId)) {
      return res.status(400).json({ error: "Invalid class ID" });
    }

    const result = await db(
      `SELECT t.*, u.full_name AS teacher_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.teacher_id
       WHERE t.class_id = $1
       ORDER BY t.created_at DESC`,
      [classId]
    );

    res.json({ tasks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load tasks" });
  }
});

app.post("/api/classes/:id/tasks", auth, allow("ADMIN", "TEACHER"),
  async (req, res) => {
    try {
      const classId = req.params.id;
      const { title, description, dueDate, attachmentUrl } = req.body;

      if (!validId(classId) || !title) {
        return res.status(400).json({ error: "Invalid task details" });
      }

      const access = await db(
        `SELECT id FROM classes
         WHERE id = $1 AND ($2 = 'ADMIN' OR teacher_id = $3)`,
        [classId, req.user.role, req.user.id]
      );

      if (!access.rows.length) {
        return res.status(403).json({ error: "Not allowed for this class" });
      }

      const result = await db(
        `INSERT INTO tasks
         (class_id, teacher_id, title, description, due_date, attachment_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          classId,
          req.user.id,
          title,
          description || null,
          dueDate || null,
          attachmentUrl || null
        ]
      );

      res.status(201).json({ task: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Task creation failed" });
    }
  }
);

// SUBMIT TASK
app.post("/api/tasks/:id/submit", auth, allow("STUDENT"), async (req, res) => {
  try {
    const taskId = req.params.id;
    const { answer, fileUrl } = req.body;

    if (!validId(taskId)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    const task = await db(
      `SELECT t.id, t.class_id FROM tasks t
       JOIN class_members m ON m.class_id = t.class_id
       WHERE t.id = $1 AND m.user_id = $2 AND m.status = 'APPROVED'`,
      [taskId, req.user.id]
    );

    if (!task.rows.length) {
      return res.status(403).json({ error: "You are not a member of this class" });
    }

    const result = await db(
      `INSERT INTO submissions
       (task_id, student_id, answer, file_url, status)
       VALUES ($1, $2, $3, $4, 'SUBMITTED')
       ON CONFLICT (task_id, student_id)
       DO UPDATE SET answer = EXCLUDED.answer,
                     file_url = EXCLUDED.file_url,
                     status = 'SUBMITTED',
                     submitted_at = now(),
                     updated_at = now()
       RETURNING *`,
      [taskId, req.user.id, answer || null, fileUrl || null]
    );

    res.status(201).json({ submission: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Task submission failed" });
  }
});

// STUDENT'S SUBMISSIONS
app.get("/api/submissions/mine", auth, allow("STUDENT"), async (req, res) => {
  try {
    const result = await db(
      `SELECT s.*, t.title AS task_title
       FROM submissions s
       JOIN tasks t ON t.id = s.task_id
       WHERE s.student_id = $1
       ORDER BY s.submitted_at DESC`,
      [req.user.id]
    );

    res.json({ submissions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load submissions" });
  }
});

// TEACHER VIEW SUBMISSIONS
app.get("/api/tasks/:id/submissions", auth, allow("ADMIN", "TEACHER"),
  async (req, res) => {
    try {
      const taskId = req.params.id;

      if (!validId(taskId)) {
        return res.status(400).json({ error: "Invalid task ID" });
      }

      const access = await db(
        `SELECT t.id FROM tasks t
         JOIN classes c ON c.id = t.class_id
         WHERE t.id = $1 AND ($2 = 'ADMIN' OR c.teacher_id = $3)`,
        [taskId, req.user.role, req.user.id]
      );

      if (!access.rows.length) {
        return res.status(403).json({ error: "Not allowed" });
      }

      const result = await db(
        `SELECT s.*, u.full_name AS student_name, u.email
         FROM submissions s
         JOIN users u ON u.id = s.student_id
         WHERE s.task_id = $1
         ORDER BY s.submitted_at DESC`,
        [taskId]
      );

      res.json({ submissions: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load submissions" });
    }
  }
);

// GRADE SUBMISSION
app.put("/api/submissions/:id/grade", auth, allow("ADMIN", "TEACHER"),
  async (req, res) => {
    try {
      const submissionId = req.params.id;
      const { grade, feedback } = req.body;

      if (!validId(submissionId)) {
        return res.status(400).json({ error: "Invalid submission ID" });
      }

      if (grade !== null && grade !== undefined &&
          (!Number.isFinite(Number(grade)) || Number(grade) < 0)) {
        return res.status(400).json({ error: "Invalid grade" });
      }

      const result = await db(
        `UPDATE submissions s
         SET grade = $1, feedback = $2, status = 'GRADED',
             updated_at = now()
         FROM tasks t
         JOIN classes c ON c.id = t.class_id
         WHERE s.task_id = t.id
           AND s.id = $3
           AND ($4 = 'ADMIN' OR c.teacher_id = $5)
         RETURNING s.*`,
        [grade ?? null, feedback || null, submissionId, req.user.role, req.user.id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Submission not found or not allowed" });
      }

      res.json({ submission: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Grading failed" });
    }
  }
);

// IMAGE UPLOAD
// This endpoint returns a temporary response only.
// Use Supabase Storage (${SUPABASE_URL}) for permanent file storage.
app.post("/api/upload", auth, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Image file required" });
  }

  res.status(501).json({
    error: "Permanent image storage is not configured yet",
    message: `Configure Supabase Storage (${SUPABASE_URL}) before using image uploads`
  });
});

// ADMIN USER LIST
app.get("/api/admin/users", auth, allow("ADMIN"), async (req, res) => {
  try {
    const result = await db(
      `SELECT id, full_name, email, phone, role, is_verified, created_at
       FROM users ORDER BY created_at DESC`
    );

    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load users" });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: "Internal server error" });
});

// START SERVER
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`IslamicSchool API running on port ${PORT}`);
});

async function shutdown() {
  console.log("Shutting down...");
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
