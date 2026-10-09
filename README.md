# 🌿 TouchGrassAI

**Less scrolling. More living.**

TouchGrassAI is an AI-powered outdoor activity planner that turns your available time, preferred activity, and energy level into a small, achievable adventure.

Built for the Hacktoberfest 2026 Open-Source AI Challenge — Week 1: *Touch Grass*.

## ✨ Features

* 🌱 Personalized missions for nature walks, birdwatching, gardening, and mindful breaks
* ⏱️ Activities tailored to 15, 30, or 60 minutes
* ☀️ Suggestions adapted to your energy level
* 🤖 Locally generated missions using the open-weight Qwen2.5 3B model
* 🔒 Local inference through Ollama, without sending prompts to a hosted AI API
* ✅ Mission completion counter
* 📱 Responsive React interface

## 🛠️ Tech Stack

* React
* Vite
* Ollama
* Qwen2.5 3B
* React Markdown

## 🚀 Run Locally

### Prerequisites

Install Node.js and [Ollama](https://ollama.com/).

### 1. Clone the repository

```bash
git clone https://github.com/Mrigakshi-Rathore/touch-grass-ai.git
cd touchgrass-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Download the model

```bash
ollama pull qwen2.5:3b
```

### 4. Start Ollama

Make sure the Ollama service is running. On systems where it is not already running, use:

```bash
ollama serve
```

If Ollama is already running, you don't need to start another server.

### 5. Start the frontend

```bash
npm run dev
```

Open the local URL printed by Vite in your browser.

## 🧠 How It Works

1. Choose an activity, available time, and energy level.
2. React sends those preferences to the local Ollama API.
3. Qwen2.5 3B generates a mission with steps, a nature fact, and a safety tip.
4. The response is rendered as Markdown in the interface.
5. Complete the mission and track your completed adventures during the current session.

## 🔐 Privacy and Limitations

The model runs locally through Ollama, so mission prompts are processed on the user's machine rather than sent to a hosted AI provider by this application.

The frontend currently connects to `http://localhost:11434`. Other people need Ollama and the specified model installed locally to generate missions. A public frontend deployment alone will not provide remote AI generation.

AI-generated nature facts should be independently verified. Users should follow local safety guidance and avoid disturbing wildlife.

## 🌍 Why TouchGrassAI?

AI can be useful beyond productivity and screen time. TouchGrassAI uses open-weight AI to encourage small offline experiences, curiosity about nature, and healthier breaks from screens.

**Less scrolling. More living.**

## 📄 License

To be decided. Add a license file before describing the project as open source.
