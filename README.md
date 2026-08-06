# Lie-of-Omission Detector (Verity)

Verity is a full-stack AI-powered application designed to detect "lies of omission" in insurance claims. It uses Vision Language Models (VLMs) and Large Language Models (LLMs) to automatically analyze claimant-submitted evidence (images and documents) and cross-reference them against the stated claims to flag unsupported, contradicted, or missing evidence.

## Workflow Architecture

The application is built using a modern, scalable architecture:

1. **Frontend (React + Vite + TailwindCSS)**: Provides an intuitive wizard for claimants to upload evidence, review AI-extracted information, and generate a final PDF claim form. It also includes an admin dashboard for adjusters to review flagged claims. Authentication is handled via **Clerk**.
2. **Backend (FastAPI + Python)**: The core engine that orchestrates the AI pipeline, handles file uploads, and manages database interactions. PDF generation and text extraction (using `pdfplumber` and `reportlab`) are also handled here.
3. **Database (MongoDB)**: Stores case data, user information, and AI analysis results.
4. **AI Pipeline (Groq + Ollama)**:
   - **Primary Provider (Groq)**: Uses high-speed LLMs (e.g., Llama 3) for text extraction and Vision models for image analysis.
   - **Fallback Provider (Ollama)**: A local, open-source fallback to ensure the pipeline doesn't break if cloud APIs are rate-limited.

## Setup Instructions

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/) (Recommended for easy setup)
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (3.11+)
- [MongoDB Atlas](https://www.mongodb.com/) Account (or local MongoDB)
- [Clerk](https://clerk.dev/) Account (for Authentication)
- [Groq](https://console.groq.com/) API Key

### 1. Environment Configuration
You need to set up three `.env` files across the project.

**Root `.env` (Used by Docker):**
Create a `.env` file in the root directory:
```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
GROQ_API_KEY=your_groq_api_key
PRIMARY_PROVIDER=groq
FALLBACK_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
MONGODB_URI=your_mongodb_connection_string
CLERK_SECRET_KEY=your_clerk_secret_key
```

**Backend `.env` (For local development):**
Located in `/backend/.env`. Copy the contents of the root `.env` here, but change `OLLAMA_BASE_URL` if running locally without Docker:
```env
OLLAMA_BASE_URL=http://localhost:11434
```

**Frontend `.env` (For local development):**
Located in `/frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### 2. Running the Application (Docker - Recommended)

The easiest way to run the full stack is using Docker Compose. From the root of the project, simply run:

```bash
docker-compose up --build
```
- The **Frontend** will be available at `http://localhost:8080`
- The **Backend API** will be available at `http://localhost:8000`
- The **Swagger UI** for the API will be at `http://localhost:8000/docs`

### 3. Running the Application Locally (Without Docker)

If you prefer to run the services directly on your machine for development:

**Start the Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Start the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 4. Setting up the Local Fallback (Ollama)
If you want to use the local fallback to avoid API rate limits:
1. Download and install [Ollama](https://ollama.com).
2. Pull the required models:
   ```bash
   ollama pull qwen2.5vl
   ollama pull llama3.1
   ```
3. Ensure Ollama is running in the background.

## Key Features
- **Smart Evidence Extraction**: Upload a PDF or Image, and the AI automatically extracts relevant fields (Date, Location, Witnesses, etc.) to pre-fill the claim form.
- **Visual Damage Assessment**: Analyzes images of damaged vehicles to cross-reference against the user's claims.
- **Automated PDF Generation**: Generates a professional, standardized PDF claim form pre-filled with the AI-extracted and user-verified data.
- **Omission Detection**: Flags discrepancies where the submitted photo does not show the damaged areas described in the claim.
