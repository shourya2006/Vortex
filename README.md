# Vortex

Vortex is an advanced AI-powered study assistant designed to help students learn more effectively. It combines a modern chat interface with powerful document processing capabilities to answer questions, solve math problems, and assist with study materials.

## 🚀 Features

- **AI Chat Interface**: Interactive chat with support for Markdown and mathematical (LaTeX) rendering.
- **Document Analysis**: Upload study materials (PDFs, Office docs) for analysis and RAG (Retrieval-Augmented Generation) powered answers.
- **Math Support**: Renders complex mathematical equations using KaTeX.
- **Microservices Architecture**: Separate services for the main application logic and document processing.

## 🛠️ Tech Stack

### Frontend (`client/`)

- **Framework**: React 19 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: GSAP
- **Rendering**: React Markdown, Remark/Rehype plugins (Math, KaTeX)

### Backend (`server/`)

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Authentication**: JWT, Passport (Google OAuth)
- **AI Integration**: OpenAI API, Pinecone Vector Database

### Upload Platform (`upload-platform/`)

- **Purpose**: Dedicated microservice for processing and indexing documents.
- **Stack**: Node.js, Express, Multer, OfficeParser, PDF.js

## 📂 Project Structure

```bash
StudyBuddy/
├── client/            # Frontend application
├── server/            # Main backend API and authentication
└── upload-platform/   # Service for document parsing and embedding
```

## 🏁 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- MongoDB installed locally or a MongoDB Atlas URI
- API Keys for OpenAI and Pinecone

### Installation & Setup

1.  **Clone the repository**

    ```bash
    git clone <repository-url>
    cd StudyBuddy
    ```

2.  **Setup Client**

    ```bash
    cd client
    npm install
    cp .env.example .env # Configure your environment variables
    ```

3.  **Setup Server**

    ```bash
    cd ../server
    npm install
    # Create a .env file with: PORT, MONGO_URI, JWT_SECRET, OPENAI_API_KEY, PINECONE_API_KEY, etc.
    ```

4.  **Setup Upload Platform**
    ```bash
    cd ../upload-platform
    npm install
    # Create a .env file with necessary API keys and config.
    ```

## 🏃 Running the Application

To run the full stack, you will need to start each service in a separate terminal:

**1. Start the Backend Server**

```bash
cd server
npm start # or npm run dev
```

**2. Start the Upload Service**

```bash
cd upload-platform
node server.js # or npm start
```

**3. Start the Frontend Client**

```bash
cd client
npm run dev
```

Visit `http://localhost:5173` (or the port shown in your terminal) to use the application.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
