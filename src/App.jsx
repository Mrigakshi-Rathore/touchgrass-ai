import ReactMarkdown from "react-markdown";
import { useState } from "react";
import "./App.css";

const activities = [
  { name: "Nature Walk", icon: "🌿" },
  { name: "Birdwatching", icon: "🐦" },
  { name: "Gardening", icon: "🌱" },
  { name: "Mindful Break", icon: "☀️" },
];

function App() {
  const [activity, setActivity] = useState("Nature Walk");
  const [duration, setDuration] = useState(15);
  const [energy, setEnergy] = useState("Relaxed");
  const [mission, setMission] = useState(null);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(false);



async function generateMission() {
  setLoading(true);

  setMission({
    title: "Creating your adventure...",
    description: "Your local AI is thinking 🌿",
    duration,
    energy,
  });

  try {
    const response = await fetch(
      "http://localhost:11434/api/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen2.5:3b",
          prompt: `Create a fun, practical outdoor mission for a college student.

Activity: ${activity}
Available time: ${duration} minutes
Energy level: ${energy}

Follow these rules:

* Match the mission to the selected activity, time, and energy level.
* Keep the entire mission achievable within the available time.
* Give exactly 3 short, specific steps.
* Avoid repeating instructions or adding unnecessary explanations.
* Make it engaging, safe, accessible, and possible near home or on campus.
* Do not require special equipment, travel, or spending money.
* Include one accurate, interesting nature fact.
* Never invent scientific facts.

Use this exact format:

### MISSION

A short, creative mission title

### STEPS

1. First action
2. Second action
3. Third action

### NATURE FACT

One interesting, accurate fact in 1–2 sentences

### SAFETY TIP

One short, relevant safety reminder.`,
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Ollama API request failed");
    }

    const data = await response.json();

    setMission({
      title: `${activity} Adventure`,
      description: data.response,
      duration,
      energy,
    });
  } catch (error) {
    console.error(error);

    setMission({
      title: "Couldn't connect to local AI",
      description:
        "Check that Ollama is running and qwen2.5:3b is installed.",
      duration,
      energy,
    });
  } finally {
    setLoading(false);
  }
}


  return (
    <main className="app">
      <nav className="navbar">
        <a className="brand" href="#home">🌿 TouchGrass<span>AI</span></a>
        <span className="nav-note">Less scrolling. More living.</span>
      </nav>

      <section className="hero" id="home">
        <div className="eyebrow">✦ YOUR LITTLE PUSH TO GO OUTSIDE</div>
        <h1>Life is happening<br /> <span>out there.</span></h1>
        <p>
          Let AI help you find your next little adventure.
          Step outside, explore something new, and reconnect with the world.
        </p>
        <a href="#planner" className="hero-button">Find my adventure ↓</a>
        <div className="hero-decoration">☀️</div>
      </section>

      <section className="planner" id="planner">
        <div className="section-heading">
          <span className="eyebrow">YOUR NEXT ADVENTURE</span>
          <h2>What feels good today?</h2>
          <p>Pick your mood. We'll help with the rest.</p>
        </div>

        <div className="field">
          <label>01 — Choose your activity</label>
          <div className="activity-grid">
            {activities.map((item) => (
              <button
                key={item.name}
                className={`activity-card ${activity === item.name ? "selected" : ""}`}
                onClick={() => setActivity(item.name)}
              >
                <span className="activity-icon">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>02 — How much time do you have?</label>
          <div className="choice-row">
            {[15, 30, 60].map((time) => (
              <button
                key={time}
                className={`choice ${duration === time ? "selected" : ""}`}
                onClick={() => setDuration(time)}
              >
                {time} min
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>03 — What's your energy level?</label>
          <div className="choice-row">
            {["Low-key", "Relaxed", "Energetic"].map((level) => (
              <button
                key={level}
                className={`choice ${energy === level ? "selected" : ""}`}
                onClick={() => setEnergy(level)}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        
<button
  className="generate-button"
  onClick={generateMission}
  disabled={loading}
>
  {loading
    ? "🌿 Creating your adventure..."
    : "✨ Generate my adventure"}
</button>

        {mission && (
          <article className="mission">
            <div className="mission-top">
              <span className="eyebrow">YOUR MISSION</span>
              <span className="mission-time">◷ {mission.duration} min</span>
            </div>
            <h3>{mission.title}</h3>
<div className="mission-description">
  <ReactMarkdown>{mission.description}</ReactMarkdown>
</div>
            <button
              className="complete-button"
              onClick={() => {
                setCompleted((count) => count + 1);
                setMission(null);
              }}
            >
              ✓ I completed this mission
            </button>
          </article>
        )}

        <div className="progress">
          <span>🌱 Adventures completed</span>
          <strong>{completed}</strong>
        </div>
      </section>

      <footer>
        <p>Made for a world beyond the screen 🌎</p>
        <span>TouchGrass AI · Hacktoberfest 2026</span>
      </footer>
    </main>
  );
}

export default App;