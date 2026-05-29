# 🏗️ SkillSync AI - Architecture Deep Dive

Detailed technical documentation of system design, data flow, and implementation patterns.

---

## 📐 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  React 18 + Vite + Tailwind (http://localhost:5173)            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Pages: Landing, Auth, Dashboard, Resume, Analysis, etc   │  │
│  │ Components: Cards, Forms, Navbar, ProtectedRoute         │  │
│  │ Context: AuthContext (login state, token management)     │  │
│  │ API Client: Axios with Bearer token interceptor          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬──────────────────────────────────────────┘
                      │ HTTP/REST + JSON
                      │ Authorization: Bearer {JWT}
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                          │
│  Express.js (http://localhost:5000)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CORS | Helmet | Morgan Logging | Express Middleware     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬──────────────────────────────────────────┘
                      │ Route → Controller mapping
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROLLER LAYER                             │
│  Request handlers → Response formatting                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ authController | resumeController | analysisController  │  │
│  │ interviewController | dashboardController               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬──────────────────────────────────────────┘
                      │ Business logic delegation
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                │
│  Pure business logic & external API orchestration               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ authService       | JWT generation, bcrypt hashing       │  │
│  │ resumeService     | CRUD operations, PDF parsing          │  │
│  │ aiService         | Gemini API integration               │  │
│  │ analysisService   | ATS & Job Match wrappers             │  │
│  │ interviewService  | Interview workflow orchestration      │  │
│  │ dashboardService  | Analytics aggregation                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬──────────────────────────────────────────┘
                      │ Data persistence & AI calls
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA ACCESS LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Mongoose Models: User | Resume | Analysis                │  │
│  │                  InterviewSession                        │  │
│  │ Schema validation & database operations                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────-┬──────────────────────────────────────────────┘
        │           │
        ▼           ▼
   ┌─────────┐  ┌──────────────────────┐
   │ MongoDB │  │  Gemini AI API       │
   │ Atlas   │  │  (Generative AI)     │
   └─────────┘  └──────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### Authentication Flow
```
USER INPUT (Signup/Login)
         │
         ▼
  authController.signup()
         │
         ├─→ Validate input (email, password)
         │
         ├─→ Check duplicate email (DB query)
         │
         ├─→ authService.hashPassword()
         │   └─→ bcryptjs (10 rounds)
         │
         ├─→ User.create(username, email, hashedPassword)
         │   └─→ Save to MongoDB
         │
         └─→ authService.generateToken(userId)
             ├─→ Create JWT payload
             ├─→ Sign with JWT_SECRET
             └─→ Send token + user data to frontend
```

### Resume Analysis Flow (ATS)
```
USER REQUEST: Analyze Resume
         │
         ▼
analysisController.analyzeResume(resumeId)
         │
         ├─→ Resume.findById(resumeId)
         │   └─→ Fetch resume from MongoDB
         │
         ├─→ aiService.analyzeResumeWithAI(resumeData)
         │   │
         │   ├─→ Create prompt with schema requirement
         │   │
         │   ├─→ model.generateContent(prompt, { responseMimeType: 'application/json' })
         │   │   └─→ Call Gemini API
         │   │
         │   ├─→ Parse JSON response
         │   │
         │   ├─→ Validate schema & clamp values
         │   │   ├─→ score: 0-100
         │   │   ├─→ missing_skills: array of strings
         │   │   ├─→ strengths: array of strings
         │   │   └─→ improvements: array of strings
         │   │
         │   └─→ Return structured object
         │
         ├─→ Analysis.create({ resumeId, type: 'ats', result })
         │   └─→ Save to MongoDB
         │
         └─→ Send response to frontend with score + insights
```

### Interview Generation → Evaluation → Improvement Flow
```
1. GENERATE QUESTIONS
   User clicks "Generate Questions"
         │
         ▼
   interviewController.generateQuestions(resumeId)
         │
         ├─→ Resume.findById(resumeId)
         │
         ├─→ aiService.generateInterviewQuestionsWithAI(resumeData)
         │   │
         │   ├─→ Create prompt: "Generate exactly 5 questions..."
         │   │
         │   ├─→ Call Gemini with JSON response mode
         │   │
         │   ├─→ Parse & validate array length = 5
         │   │
         │   └─→ Return questions array
         │
         ├─→ InterviewSession.create({ resumeId, questions, answers: [] })
         │
         └─→ Return sessionId + questions to frontend

2. EVALUATE ANSWERS
   User submits answers to 5 questions
         │
         ▼
   interviewController.evaluateAnswers(sessionId, answers[])
         │
         ├─→ InterviewSession.findById(sessionId)
         │
         ├─→ aiService.evaluateInterviewAnswersWithAI({
         │     resumeData, questions[], answers[], previousScore
         │   })
         │   │
         │   ├─→ Prompt: "Score each answer 0-10..."
         │   │
         │   ├─→ Call Gemini with per-question breakdown
         │   │
         │   ├─→ Clamp scores 0-10
         │   │
         │   └─→ Return { score, per_question[], strengths, improvements }
         │
         ├─→ InterviewSession.updateOne({
         │     answers, evaluations, score, iteration: 1
         │   })
         │
         └─→ Return evaluation to frontend

3. IMPROVE & RE-EVALUATE
   User improves answers and resubmits
         │
         ▼
   interviewController.improveAnswers(sessionId, improvedAnswers[])
         │
         ├─→ InterviewSession.findById(sessionId)
         │   └─→ Get previous evaluation
         │
         ├─→ aiService.evaluateImprovedAnswersWithAI({
         │     previousEvaluation, questions, oldAnswers, newAnswers
         │   })
         │   │
         │   ├─→ Prompt: "Compare old vs improved answers..."
         │   │
         │   ├─→ Call Gemini
         │   │
         │   └─→ Return { score, summary, improvements }
         │
         ├─→ InterviewSession.updateOne({
         │     improvedAnswers, improvedEvaluation, iteration: 2, score
         │   })
         │
         └─→ Return new score + comparison to frontend
            (User can see progression: score1 → score2)
```

---

## 📊 Data Models

### User Schema
```javascript
User {
  _id: ObjectId,
  name: String (required),
  email: String (required, unique),
  password: String (hashed with bcryptjs),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

### Resume Schema
```javascript
Resume {
  _id: ObjectId,
  userId: ObjectId (ref: User),
  skills: [String],
  education: [{
    school: String,
    degree: String,
    year: String
  }],
  experience: [{
    company: String,
    role: String,
    duration: String,
    description: String
  }],
  projects: [{
    name: String,
    description: String,
    skills: [String]
  }],
  summary: String,
  parsedText: String (from PDF upload),
  createdAt: Date,
  updatedAt: Date
}
```

### Analysis Schema
```javascript
Analysis {
  _id: ObjectId,
  userId: ObjectId (ref: User),
  resumeId: ObjectId (ref: Resume),
  type: String (enum: ['ats', 'job_match']),
  result: Mixed ({
    // For ATS:
    score: Number,
    missing_skills: [String],
    strengths: [String],
    improvements: [String],
    
    // For Job Match:
    match_percentage: Number,
    missing_skills: [String],
    recommendation: String
  }),
  createdAt: Date
}
```

### InterviewSession Schema
```javascript
InterviewSession {
  _id: ObjectId,
  userId: ObjectId (ref: User),
  resumeId: ObjectId (ref: Resume),
  
  // Generation
  questions: [String],  // Exactly 5 generated questions
  
  // First attempt
  answers: [String],    // User's initial answers
  score: Number,        // 0-10 from evaluation
  evaluation: {
    score: Number,
    strengths: [String],
    improvements: [String],
    per_question: [{
      question: String,
      answer: String,
      score: Number,
      strengths: [String],
      improvements: [String]
    }]
  },
  
  // Improvement loop
  improvedAnswers: [String],
  improvedScore: Number,
  improvedEvaluation: {
    score: Number,
    summary: String,
    strengths: [String],
    improvements: [String]
  },
  
  iteration: Number (1 or 2+),
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔑 Key Design Patterns

### 1. Clean Architecture
```
Models (Data) ← Services (Logic) → Controllers (Handlers) → Routes (Endpoints)
```
Clear separation of concerns:
- **Models**: Database schemas only
- **Services**: Pure business logic, all Gemini calls
- **Controllers**: HTTP request/response handling
- **Routes**: Endpoint definitions

### 2. Async/Await + Error Handling
```javascript
// All async operations wrapped
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Usage
export const analyzeResume = asyncHandler(async (req, res) => {
  // any error thrown here caught by asyncHandler
});
```

### 3. JWT Authentication + Authorization
```
1. User login → Generate JWT with user ID
2. Client stores token in localStorage
3. Axios interceptor adds: Authorization: Bearer {token}
4. Backend middleware validates JWT on protected routes
5. Middleware extracts userId from token
6. Controller uses userId for data scoping
```

### 4. Gemini AI with JSON Response Mode
```javascript
// Force Gemini to return valid JSON only
model.generateContent({
  contents: [{...}],
  generationConfig: {
    responseMimeType: "application/json",  // ← Force JSON
    temperature: 0.2                        // ← Low temp for consistency
  }
});

// Fallback JSON parsing if response includes markdown
const cleaned = text
  .replace(/^```json\s*/i, "")
  .replace(/```$/i, "")
  .trim();
```

### 5. MongoDB ObjectId References
```javascript
// Establish relationships
Resume.userId → User._id        // Resume belongs to User
Analysis.resumeId → Resume._id  // Analysis analyzes Resume
Interview.userId → User._id     // Interview belongs to User
```

---

## 🔐 Authentication & Authorization Flow

```
SIGNUP
├─ Client: POST /api/auth/signup { name, email, password }
├─ Validation: email format, password length
├─ Duplicate check: User.findOne({ email })
├─ Hash: bcryptjs.hash(password, 10)
├─ Save: User.create({ name, email, hashedPassword })
├─ Generate JWT: jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
└─ Response: { token, user: { id, name, email } }

LOGIN
├─ Client: POST /api/auth/login { email, password }
├─ Find: User.findOne({ email })
├─ Compare: bcryptjs.compare(inputPassword, storedHash)
├─ Generate JWT: jwt.sign({ userId }, JWT_SECRET)
└─ Response: { token, user }

PROTECTED REQUEST
├─ Client: GET /api/resumes (header: Authorization: Bearer {token})
├─ Middleware: Extract token from headers
├─ Verify: jwt.verify(token, JWT_SECRET)
├─ Extract: userId from token payload
├─ Scope: Resume.find({ userId })  ← Only user's resumes
└─ Response: [resumeList]
```

---

## 🤖 Gemini AI Integration

### Why Gemini?
1. **JSON Response Mode** - Forces structured JSON output
2. **Reliability** - Consistent format for parsing
3. **Cost** - Cheap with 1.5-flash model
4. **Speed** - Fast API responses

### Prompt Engineering

All prompts include:
1. **Clear instruction** - What AI should do
2. **Schema definition** - Expected JSON structure
3. **Rules section** - Validation constraints
4. **Evidence requirement** - "must reference specific content"

Example:
```javascript
const prompt = `
Analyze this resume for ATS readiness.

Resume JSON:
${JSON.stringify(resumeInput)}

Return JSON with exact schema:
{
  "score": number,
  "missing_skills": string[],
  "strengths": string[],
  "improvements": string[]
}

Rules:
- score must be 0-100 integer
- missing_skills: concrete market-relevant skills NOT in resume
- strengths: reference SPECIFIC resume content
- improvements: actionable and specific to THIS resume
`;
```

### Response Parsing Strategy
```
1. Try: JSON.parse(response)
2. Clean markdown: Remove ```json ... ``` wrappers
3. Try: JSON.parse(cleaned)
4. Fallback: Return default shape
5. All: Clamp values (score 0-100, etc.)
```

---

## 📈 Performance Considerations

### Database Queries
```javascript
// Efficient: Indexed lookups
User.findById(userId)        // _id is auto-indexed
Resume.find({ userId })      // Create index on userId

// Less efficient: Full scans
User.find({ email })         // Make unique index
Resume.find({ skills: 'JavaScript' })  // Expensive, avoid
```

### Caching Strategy (Ready for implementation)
```javascript
// Could cache: Dashboard stats (update every 5 minutes)
// Could cache: Gemini responses (same input = same output)
// Should NOT cache: Interview questions (should be fresh each time)
```

### API Response Time Targets
- Auth endpoints: < 200ms
- Resume CRUD: < 300ms
- Resume analysis (Gemini call): 3-10s
- Interview generation: 3-8s
- Evaluation: 5-15s

---

## 🚀 Deployment Architecture

### Production Setup
```
┌─────────────────────────────────────────┐
│  Frontend: Vercel                       │
│  - Auto-deploys on git push             │
│  - Built: React + Vite bundle           │
│  - Hosted: Vercel CDN                   │
│  - URL: skillsync-ai.vercel.app         │
└─────────────────────────────────────────┘
              ↓ HTTPS
┌─────────────────────────────────────────┐
│  Backend: Railway/Render                │
│  - Node.js process                      │
│  - Env vars: MongoDB URI, Gemini key    │
│  - Auto-restart on crash                │
│  - URL: api.skillsync-ai.com            │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Database: MongoDB Atlas                │
│  - Cloud-hosted (AWS, GCP, Azure)       │
│  - Automatic backups                    │
│  - Built-in monitoring                  │
└─────────────────────────────────────────┘
```

---

## 🔍 Error Handling Strategy

### Frontend Error Handling
```javascript
try {
  const response = await apiClient.post('/resume/:id');
  setState(response.data);
} catch (error) {
  if (error.response?.status === 401) {
    // Token expired → redirect to login
  } else if (error.response?.status === 400) {
    // Validation error → show form errors
  } else if (error.response?.status === 500) {
    // Server error → show generic message + retry button
  }
}
```

### Backend Error Handling
```javascript
// Global error middleware catches all errors
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (err.name === 'MongoError') {
    return res.status(500).json({ error: 'Database error' });
  }
  res.status(500).json({ error: 'Internal server error' });
});
```

---

## 📝 Request/Response Format

### Standard Response Shape
```javascript
// Success
{
  success: true,
  data: { /* response data */ }
}

// Error
{
  success: false,
  error: "Error message",
  details: { /* optional additional info */ }
}
```

### Authentication Header
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🧪 Testing Layers

### Unit Testing (Ready to add)
```javascript
// Test individual services
describe('aiService.analyzeResumeWithAI', () => {
  it('should return score 0-100', () => {
    // Test with mock resume input
  });
});
```

### Integration Testing (Ready to add)
```javascript
// Test endpoint + service + database
describe('POST /api/analysis/resume/:resumeId', () => {
  it('should analyze resume and save result', () => {
    // Create resume, call endpoint, verify DB
  });
});
```

### End-to-End Testing
See `FINAL_TEST_CHECKLIST.md` for complete test scenarios.

---

## 📚 Technology Justification

| Tech | Why |
|------|-----|
| **React** | Component-based, virtual DOM, large ecosystem |
| **Vite** | Fast bundling, instant HMR, optimized build |
| **Express** | Minimal, flexible, great middleware ecosystem |
| **MongoDB** | Schema-less, scales horizontally, great for prototyping |
| **Mongoose** | Schema validation, relationship management, middleware hooks |
| **JWT** | Stateless auth, scalable, no session storage needed |
| **bcryptjs** | Industry standard, salted hashing, resistant to attacks |
| **Gemini API** | JSON response mode, cost-effective, fast, reliable |
| **Tailwind** | Utility-first, rapid UI development, responsive design |

---

## 🎯 Quality Metrics

✅ **Code Quality**
- Clean architecture (separation of concerns)
- No hardcoded values
- Proper error handling
- Input validation

✅ **Security**
- Password hashing (bcryptjs)
- JWT authentication
- CORS protection
- Input sanitization

✅ **Performance**
- Efficient database queries
- Optimized bundle size (frontend)
- Response time < 2s (excluding Gemini)
- Concurrent request handling

✅ **Scalability**
- Stateless API (can run multiple instances)
- Database indexing ready
- Caching hooks in place
- MongoDB scales horizontally

---

**Last Updated:** March 21, 2026  
**Architecture Version:** 1.0 - FAANG-Ready
