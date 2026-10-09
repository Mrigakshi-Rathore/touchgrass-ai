import ReactMarkdown from "react-markdown";
import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

const activities = [
  {
    name: "Nature Walk",
    icon: "🌿",
    tag: "Mindful stroll",
    desc: "Open trails, tree canopies & fresh air",
  },
  {
    name: "Birdwatching",
    icon: "🐦",
    tag: "Active spotting",
    desc: "Listen for calls & observe local species",
  },
  {
    name: "Gardening",
    icon: "🌱",
    tag: "Hands-on care",
    desc: "Touch soil, inspect flora & foliage",
  },
  {
    name: "Mindful Break",
    icon: "☀️",
    tag: "Sensory pause",
    desc: "Ground your senses under the open sky",
  },
];

const durationOptions = [
  { time: 15, hint: "Quick reset" },
  { time: 30, hint: "Balanced walk" },
  { time: 60, hint: "Deep immersion" },
];

const energyOptions = [
  { level: "Low-key", hint: "Gentle & calming" },
  { level: "Relaxed", hint: "Steady & mindful" },
  { level: "Energetic", hint: "Active & curious" },
];

const OLLAMA_BASE_URL = "http://localhost:11434";
const TARGET_MODEL = "qwen2.5:3b";
// Local 3B inference on CPU or laptop GPUs may take longer than standard web APIs
const GENERATION_TIMEOUT_MS = 90000; // 90 seconds
const STORAGE_KEY_COMPLETED = "touchgrass_completed_count";

function getStoredCompletedCount() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_COMPLETED);
    if (saved === null) return 0;
    const parsed = parseInt(saved, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch (err) {
    console.warn("Unable to read completed count from localStorage:", err);
    return 0;
  }
}

function setStoredCompletedCount(count) {
  try {
    localStorage.setItem(STORAGE_KEY_COMPLETED, String(count));
  } catch (err) {
    console.warn("Unable to save completed count to localStorage:", err);
  }
}

/**
 * Parses Qwen's standard markdown output into structured cards
 * while gracefully falling back to raw markdown if formatting deviates.
 */
function parseMissionResponse(rawText, fallbackActivity) {
  if (!rawText || typeof rawText !== "string") return null;

  try {
    const missionMatch = rawText.match(
      /###\s*MISSION\s*\n+([\s\S]*?)(?=\n+###\s*STEPS|$)/i
    );
    const stepsMatch = rawText.match(
      /###\s*STEPS\s*\n+([\s\S]*?)(?=\n+###\s*NATURE\s*FACT|$)/i
    );
    const factMatch = rawText.match(
      /###\s*NATURE\s*FACT\s*\n+([\s\S]*?)(?=\n+###\s*SAFETY\s*TIP|$)/i
    );
    const safetyMatch = rawText.match(/###\s*SAFETY\s*TIP\s*\n+([\s\S]*?)$/i);

    let title = `${fallbackActivity} Adventure`;
    if (missionMatch && missionMatch[1]) {
      const clean = missionMatch[1]
        .trim()
        .replace(/^["']|["']$/g, "")
        .split("\n")[0]
        .trim();
      if (clean.length > 0) title = clean;
    }

    let steps = [];
    if (stepsMatch && stepsMatch[1]) {
      const lines = stepsMatch[1].trim().split("\n");
      for (const line of lines) {
        const cleaned = line
          .trim()
          .replace(/^(\d+\.|\*|-)\s+/, "")
          .trim();
        if (cleaned.length > 0) {
          steps.push(cleaned);
        }
      }
    }

    const natureFact = factMatch && factMatch[1] ? factMatch[1].trim() : null;
    const safetyTip =
      safetyMatch && safetyMatch[1] ? safetyMatch[1].trim() : null;

    if (steps.length > 0) {
      return {
        isParsed: true,
        title,
        steps,
        natureFact,
        safetyTip,
        raw: rawText,
      };
    }
  } catch (e) {
    console.warn("Could not parse structured mission format:", e);
  }

  return {
    isParsed: false,
    title: `${fallbackActivity} Adventure`,
    steps: null,
    natureFact: null,
    safetyTip: null,
    raw: rawText,
  };
}

function App() {
  const [activity, setActivity] = useState("Nature Walk");
  const [duration, setDuration] = useState(15);
  const [energy, setEnergy] = useState("Relaxed");
  const [mission, setMission] = useState(null);
  const [checkedSteps, setCheckedSteps] = useState({});
  const [copied, setCopied] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const [completed, setCompleted] = useState(getStoredCompletedCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ollamaStatus, setOllamaStatus] = useState({
    state: "checking", // "checking" | "connected" | "model_missing" | "disconnected"
    message: "Checking local Ollama...",
  });

  const abortControllerRef = useRef(null);
  const missionContainerRef = useRef(null);

  const checkOllamaConnection = useCallback(async () => {
    setOllamaStatus({ state: "checking", message: "Checking local Ollama..." });
    const checkController = new AbortController();
    const timeoutId = setTimeout(() => checkController.abort(), 4000);

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: checkController.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const models = data.models || [];
      const hasModel = models.some(
        (m) =>
          m.name === TARGET_MODEL ||
          m.name?.startsWith(`${TARGET_MODEL}:`) ||
          m.model === TARGET_MODEL
      );

      if (hasModel) {
        setOllamaStatus({
          state: "connected",
          message: `Local AI ready (${TARGET_MODEL})`,
        });
      } else {
        setOllamaStatus({
          state: "model_missing",
          message: `Ollama online, but '${TARGET_MODEL}' not installed`,
        });
      }
    } catch {
      clearTimeout(timeoutId);
      setOllamaStatus({
        state: "disconnected",
        message: "Local Ollama not detected",
      });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkController = new AbortController();
    const timeoutId = setTimeout(() => checkController.abort(), 4000);

    fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: checkController.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const models = data.models || [];
        const hasModel = models.some(
          (m) =>
            m.name === TARGET_MODEL ||
            m.name?.startsWith(`${TARGET_MODEL}:`) ||
            m.model === TARGET_MODEL
        );
        setOllamaStatus({
          state: hasModel ? "connected" : "model_missing",
          message: hasModel
            ? `Local AI ready (${TARGET_MODEL})`
            : `Ollama online, but '${TARGET_MODEL}' not installed`,
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setOllamaStatus({
          state: "disconnected",
          message: "Local Ollama not detected",
        });
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      isMounted = false;
      checkController.abort();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Smooth scroll into view when a real mission arrives
  useEffect(() => {
    if (mission && missionContainerRef.current) {
      missionContainerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [mission]);

  function cancelGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setError({
      title: "Generation cancelled",
      message: "You cancelled the mission generation.",
      isTimeout: false,
    });
  }

  async function generateMission() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setMission(null);
    setCheckedSteps({});
    setCelebration(null);

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, GENERATION_TIMEOUT_MS);

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: TARGET_MODEL,
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
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Ollama returned HTTP error ${response.status} (${
            response.statusText || "Request failed"
          })`
        );
      }

      const data = await response.json();

      if (!data.response || typeof data.response !== "string") {
        throw new Error("Received an empty or malformed response from Ollama.");
      }

      const parsed = parseMissionResponse(data.response, activity);

      setMission({
        title: parsed?.title || `${activity} Adventure`,
        description: data.response,
        parsedData: parsed,
        duration,
        energy,
        activity,
      });
      setError(null);

      // Re-verify connection state if not already marked connected
      if (ollamaStatus.state !== "connected") {
        checkOllamaConnection();
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError") {
        if (abortControllerRef.current === null) return;
        setError({
          title: "Request timed out",
          message: `Generation exceeded ${
            GENERATION_TIMEOUT_MS / 1000
          } seconds. Local LLM inference may be queued or waiting for system resources.`,
          isTimeout: true,
        });
      } else {
        console.error("Mission generation error:", err);
        setError({
          title: "Couldn't connect to local AI",
          message:
            "Make sure Ollama is running locally and the model 'qwen2.5:3b' is installed.",
          isTimeout: false,
        });
        checkOllamaConnection();
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  }

  function toggleStep(idx) {
    setCheckedSteps((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }

  function handleCompleteMission() {
    setCompleted((prev) => {
      const next = prev + 1;
      setStoredCompletedCount(next);
      return next;
    });
    setCelebration({
      title: mission?.title || "Your outdoor adventure",
      activity: mission?.activity || activity,
      duration: mission?.duration || duration,
    });
    setMission(null);
    setCheckedSteps({});
  }

  function handleCopyMission() {
    if (!mission) return;
    const textToCopy = `${mission.title} (${mission.duration} min · ${mission.energy})\n\n${mission.description}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2400);
        })
        .catch(() => {});
    }
  }

  const stepsList = mission?.parsedData?.steps || [];
  const completedStepsCount = stepsList.filter(
    (_, i) => checkedSteps[i]
  ).length;
  const allStepsDone =
    stepsList.length > 0 && completedStepsCount === stepsList.length;

  return (
    <main className="app">
      <nav className="navbar">
        <a className="brand" href="#home">
          <span className="brand-leaf" aria-hidden="true">
            🌿
          </span>
          TouchGrass<span className="brand-badge">AI</span>
        </a>
        <div className="nav-right">
          <div
            className={`status-pill status-${ollamaStatus.state}`}
            title="Local Ollama AI connection status"
          >
            <span className="status-dot" aria-hidden="true"></span>
            <span className="status-text">{ollamaStatus.message}</span>
            <button
              type="button"
              className="status-refresh-btn"
              onClick={() => checkOllamaConnection()}
              title="Refresh connection status"
              aria-label="Refresh connection status"
            >
              ↺
            </button>
          </div>
          <span className="nav-note">Less scrolling. More living.</span>
        </div>
      </nav>

      <section className="hero" id="home">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot" aria-hidden="true"></span>
            <span>YOUR LITTLE PUSH TO GO OUTSIDE</span>
          </div>
          <h1>
            Life is happening <br />
            <span className="hero-highlight">out there.</span>
          </h1>
          <p className="hero-text">
            Let local AI generate a bite-sized, achievable outdoor quest. Step
            away from notifications, reconnect with nature, and explore the
            world right around you.
          </p>

          <div className="hero-actions">
            <a href="#planner" className="hero-button">
              <span>Find my adventure</span>
              <span className="hero-btn-arrow" aria-hidden="true">
                ↓
              </span>
            </a>
            <div className="hero-badge">
              <span className="badge-icon" aria-hidden="true">
                🔒
              </span>
              <span>100% Private &amp; Offline via Ollama</span>
            </div>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="visual-circle outer"></div>
          <div className="visual-circle inner"></div>
          <div className="floating-card top-card">
            <span className="floating-icon">🌱</span>
            <div className="floating-meta">
              <strong>Mindful Reset</strong>
              <span>15 min outdoors</span>
            </div>
          </div>
          <div className="floating-card bottom-card">
            <span className="floating-icon">🐦</span>
            <div className="floating-meta">
              <strong>Campus Quest</strong>
              <span>Local bird spotting</span>
            </div>
          </div>
        </div>
      </section>

      <section className="planner" id="planner">
        <div className="section-heading">
          <span className="eyebrow">CUSTOMIZE YOUR BREAK</span>
          <h2>What feels good today?</h2>
          <p>Choose your mood. Your local AI takes care of the rest.</p>
        </div>

        {/* 01 Activity Selection */}
        <div className="field">
          <div className="field-header">
            <label className="field-label">01 — Choose your activity</label>
            <span className="field-hint">Pick what draws you outside</span>
          </div>
          <div className="activity-grid">
            {activities.map((item) => (
              <button
                key={item.name}
                type="button"
                className={`activity-card ${
                  activity === item.name ? "selected" : ""
                }`}
                onClick={() => setActivity(item.name)}
                disabled={loading}
              >
                <div className="activity-icon-wrap">
                  <span className="activity-icon">{item.icon}</span>
                </div>
                <div className="activity-text">
                  <span className="activity-title">{item.name}</span>
                  <span className="activity-desc">{item.desc}</span>
                </div>
                <span className="activity-tag">{item.tag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 02 Duration Selection */}
        <div className="field">
          <div className="field-header">
            <label className="field-label">
              02 — How much time do you have?
            </label>
            <span className="field-hint">Achievable in a single break</span>
          </div>
          <div className="choice-row">
            {durationOptions.map((opt) => (
              <button
                key={opt.time}
                type="button"
                className={`choice ${duration === opt.time ? "selected" : ""}`}
                onClick={() => setDuration(opt.time)}
                disabled={loading}
              >
                <span className="choice-title">{opt.time} min</span>
                <span className="choice-sub">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 03 Energy Level Selection */}
        <div className="field">
          <div className="field-header">
            <label className="field-label">
              03 — What's your energy level?
            </label>
            <span className="field-hint">Match your natural pace</span>
          </div>
          <div className="choice-row">
            {energyOptions.map((opt) => (
              <button
                key={opt.level}
                type="button"
                className={`choice ${
                  energy === opt.level ? "selected" : ""
                }`}
                onClick={() => setEnergy(opt.level)}
                disabled={loading}
              >
                <span className="choice-title">{opt.level}</span>
                <span className="choice-sub">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Button & Cancel Option */}
        <div className="generate-actions">
          <button
            type="button"
            className="generate-button"
            onClick={generateMission}
            disabled={loading}
          >
            {loading ? (
              <span className="btn-loading-content">
                <span className="btn-spinner" aria-hidden="true"></span>
                <span>Crafting your adventure...</span>
              </span>
            ) : (
              <span>✨ Generate my adventure</span>
            )}
          </button>
          {loading && (
            <button
              type="button"
              className="cancel-button"
              onClick={cancelGeneration}
              title="Cancel current generation"
            >
              ✕ Cancel
            </button>
          )}
        </div>

        <p className="privacy-badge">
          <span className="privacy-lock" aria-hidden="true">
            🔒
          </span>
          <span>
            Generated locally via Ollama (<code>{TARGET_MODEL}</code>).
            No prompt data leaves your machine.
          </span>
        </p>

        {/* CELEBRATION BANNER - after user completes a mission */}
        {celebration && !loading && !mission && (
          <div className="celebration-banner" role="status" aria-live="polite">
            <div className="celebration-icon">🎉</div>
            <div className="celebration-text">
              <h4>Adventure Logged!</h4>
              <p>
                You completed <strong>{celebration.title}</strong>. Take a
                refreshing breath and enjoy being present in the real world.
              </p>
            </div>
            <button
              type="button"
              className="celebration-dismiss-btn"
              onClick={() => setCelebration(null)}
            >
              Plan another ↓
            </button>
          </div>
        )}

        {/* LOADING STATE - Rich skeleton experience with pulse animation */}
        {loading && (
          <div className="mission-loading" role="status" aria-live="polite">
            <div className="loading-badge">
              <span className="loading-dot" aria-hidden="true"></span>
              <span>LOCAL AI AT WORK</span>
            </div>
            <div className="loading-icon-wrap">
              <span className="loading-spinner-emoji">🌿</span>
            </div>
            <h3>Formulating your {activity}...</h3>
            <p className="loading-subtext">
              Local model <code>{TARGET_MODEL}</code> is assembling a{" "}
              {duration}-minute, {energy.toLowerCase()} adventure. Running
              completely offline on your hardware.
            </p>

            <div className="skeleton-card" aria-hidden="true">
              <div className="skeleton-line skeleton-title"></div>
              <div className="skeleton-step-row">
                <div className="skeleton-box"></div>
                <div className="skeleton-line skeleton-text"></div>
              </div>
              <div className="skeleton-step-row">
                <div className="skeleton-box"></div>
                <div className="skeleton-line skeleton-text short"></div>
              </div>
              <div className="skeleton-step-row">
                <div className="skeleton-box"></div>
                <div className="skeleton-line skeleton-text"></div>
              </div>
            </div>

            <div className="loading-pulse-bar" aria-hidden="true"></div>
          </div>
        )}

        {/* ERROR STATE - Dedicated alert with clear checklist and retry button */}
        {error && !loading && (
          <div className="mission-error" role="alert">
            <div className="error-header">
              <span className="error-badge">⚠️ Notice</span>
              <span className="error-code">
                {error.isTimeout ? "Timeout" : "Connection Issue"}
              </span>
            </div>
            <h3>{error.title}</h3>
            <p className="error-desc">{error.message}</p>
            <div className="troubleshoot-box">
              <span className="troubleshoot-title">
                Quick verification checklist:
              </span>
              <ol>
                <li>
                  Start local Ollama: <code>ollama serve</code>
                </li>
                <li>
                  Ensure model is ready: <code>ollama run {TARGET_MODEL}</code>
                </li>
                <li>
                  Endpoint check: <code>curl {OLLAMA_BASE_URL}</code>
                </li>
              </ol>
            </div>
            <div className="error-btn-row">
              <button
                type="button"
                className="retry-button"
                onClick={generateMission}
              >
                ↻ Retry Generation
              </button>
              <button
                type="button"
                className="dismiss-button"
                onClick={() => setError(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* REAL MISSION CARD - Focused presentation with checkable steps */}
        {mission && !loading && (
          <article
            className="mission"
            ref={missionContainerRef}
            aria-labelledby="mission-title"
          >
            {/* Top Mission Header & Actions */}
            <div className="mission-top">
              <div className="mission-tags">
                <span className="mission-eyebrow">✦ YOUR ADVENTURE</span>
                <span className="mission-pill">
                  ⏱ {mission.duration} min
                </span>
                <span className="mission-pill">
                  ⚡ {mission.energy}
                </span>
              </div>
              <div className="mission-top-actions">
                <button
                  type="button"
                  className="mission-copy-btn"
                  onClick={handleCopyMission}
                  title="Copy mission to clipboard"
                >
                  {copied ? "✓ Copied" : "📋 Copy"}
                </button>
              </div>
            </div>

            <h3 id="mission-title" className="mission-main-title">
              {mission.title}
            </h3>

            {/* Structured Card Presentation if parsed */}
            {mission.parsedData && mission.parsedData.isParsed ? (
              <div className="mission-structured-body">
                {/* Steps Section */}
                <div className="mission-steps-section">
                  <div className="steps-header">
                    <h4>Action Steps</h4>
                    <span className="steps-counter">
                      {completedStepsCount} of {stepsList.length} completed
                    </span>
                  </div>
                  <div className="steps-list">
                    {stepsList.map((step, idx) => {
                      const isDone = !!checkedSteps[idx];
                      return (
                        <div
                          key={idx}
                          className={`step-item ${isDone ? "step-done" : ""}`}
                          onClick={() => toggleStep(idx)}
                          role="checkbox"
                          aria-checked={isDone}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              toggleStep(idx);
                            }
                          }}
                        >
                          <div className="step-checkbox" aria-hidden="true">
                            {isDone ? "✓" : idx + 1}
                          </div>
                          <p className="step-text">{step}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Nature Fact Card */}
                {mission.parsedData.natureFact && (
                  <div className="nature-fact-card">
                    <div className="fact-badge">
                      <span aria-hidden="true">🌿</span>
                      <span>NATURE FACT</span>
                    </div>
                    <p>{mission.parsedData.natureFact}</p>
                  </div>
                )}

                {/* Safety Tip Card */}
                {mission.parsedData.safetyTip && (
                  <div className="safety-tip-card">
                    <div className="safety-badge">
                      <span aria-hidden="true">🧭</span>
                      <span>SAFETY REMINDER</span>
                    </div>
                    <p>{mission.parsedData.safetyTip}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Fallback: Direct React Markdown rendering */
              <div className="mission-description">
                <ReactMarkdown>{mission.description}</ReactMarkdown>
              </div>
            )}

            {/* Completion Section */}
            <div className="mission-footer">
              <button
                type="button"
                className={`complete-button ${
                  allStepsDone ? "all-done-pulse" : ""
                }`}
                onClick={handleCompleteMission}
              >
                {allStepsDone
                  ? "🎉 All steps done! Mark adventure complete"
                  : "✓ I completed this mission"}
              </button>
            </div>
          </article>
        )}

        {/* Progress Tracker Banner */}
        <div className="progress">
          <div className="progress-info">
            <span className="progress-icon" aria-hidden="true">
              🌱
            </span>
            <div className="progress-text">
              <span className="progress-title">Adventures completed</span>
              <span className="progress-sub">
                Small outdoor breaks add up to big mental resets
              </span>
            </div>
          </div>
          <strong className="progress-counter">{completed}</strong>
        </div>
      </section>

      <footer>
        <div className="footer-content">
          <p className="footer-tagline">
            Made for a world beyond the screen 🌎
          </p>
          <div className="footer-meta">
            <span>TouchGrass AI</span>
            <span className="footer-sep">·</span>
            <span>Local Qwen2.5 3B via Ollama</span>
            <span className="footer-sep">·</span>
            <span>Hacktoberfest 2026</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default App;