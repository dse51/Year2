import React, { useState, useEffect, useCallback, useRef } from "react";
import { Info, BarChart3, Share2, X } from "lucide-react";

// ---- Word list: Bowdoin / Maine / polar themed 5-13-letter words ----
const WORDS = [
  "HOWARD", "SMITH", "NESCAC", "MOULTON", "THORNE", "AFRICANA", "MORRELL", "SARGENT",
  "FARLEY", "HARPS", "BRUNS", "BRUNSWICK", "HUBBARD", "SUPERS", "MCMOULTON", "QUAD",
  "ZAKI", "ORIENT", "MAGEE", "WINTHROP", "MAINE", "APPLETON", "COLEMAN", "MOORE", 
  "HYDE", "WEST", "OSHER", "STOWE"
];

const LAUNCH_DATE = new Date(2026, 0, 1); // day 0 of the puzzle
const MAX_GUESSES = 6;
const WORD_LEN = (3,4,5,6,7,8,9,10,11,12,13);

const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

function getDayIndex() {
  const now = new Date();
  const start = new Date(LAUNCH_DATE.getFullYear(), LAUNCH_DATE.getMonth(), LAUNCH_DATE.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - start) / 86400000);
  return Math.max(0, diff);
}

function evaluateGuess(guess, answer) {
  const result = Array(WORD_LEN).fill("absent");
  const answerLetters = answer.split("");
  const used = Array(WORD_LEN).fill(false);

  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
      used[i] = true;
    }
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (result[i] === "correct") continue;
    const idx = answerLetters.findIndex((l, j) => l === guess[i] && !used[j]);
    if (idx !== -1) {
      result[i] = "present";
      used[idx] = true;
    }
  }
  return result;
}

const DEFAULT_STATS = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0],
  lastPlayedIndex: -1,
  lastResult: null, // { guesses: [], evaluations: [], status: 'won'|'lost' }
};

const TILE_COLORS = {
  correct: { bg: "#0A0A0A", border: "#0A0A0A", color: "#FFFFFF" },
  present: { bg: "#5C87A8", border: "#5C87A8", color: "#FFFFFF" },
  absent: { bg: "#C9C7BE", border: "#C9C7BE", color: "#5A5850" },
  empty: { bg: "transparent", border: "#D3D1C6", color: "#141412" },
  filled: { bg: "transparent", border: "#9B998E", color: "#141412" },
};

export default function Bowdle() {
  const dayIndex = getDayIndex();
  const answer = WORDS[dayIndex % WORDS.length];

  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loaded, setLoaded] = useState(false);
  const [guesses, setGuesses] = useState([]); // array of {word, evaluation}
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("playing"); // playing | won | lost
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [revealRow, setRevealRow] = useState(-1);
  const toastTimer = useRef(null);

  // Load stats + today's progress from persistent storage
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("bowdle-stats", false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setStats({ ...DEFAULT_STATS, ...parsed });
          if (parsed.lastPlayedIndex === dayIndex && parsed.lastResult) {
            setGuesses(
              parsed.lastResult.guesses.map((w, i) => ({
                word: w,
                evaluation: parsed.lastResult.evaluations[i],
              }))
            );
            setStatus(parsed.lastResult.status);
          }
        }
      } catch (e) {
        // no saved data yet
      }
      setLoaded(true);
    })();
  }, [dayIndex]);

  const saveStats = useCallback(async (next) => {
    setStats(next);
    try {
      await window.storage.set("bowdle-stats", JSON.stringify(next), false);
    } catch (e) {
      // best-effort; ignore failures
    }
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  };

  const finishGame = useCallback(
    (won, allGuesses, allEvals) => {
      const next = { ...stats };
      next.gamesPlayed += 1;
      if (won) {
        next.gamesWon += 1;
        next.currentStreak += 1;
        next.maxStreak = Math.max(next.maxStreak, next.currentStreak);
        const distIdx = allGuesses.length - 1;
        next.guessDistribution = [...next.guessDistribution];
        next.guessDistribution[distIdx] += 1;
      } else {
        next.currentStreak = 0;
      }
      next.lastPlayedIndex = dayIndex;
      next.lastResult = { guesses: allGuesses, evaluations: allEvals, status: won ? "won" : "lost" };
      saveStats(next);
      setTimeout(() => setShowStats(true), 1600);
    },
    [stats, dayIndex, saveStats]
  );

  const submitGuess = useCallback(() => {
    if (status !== "playing") return;
    if (current.length < WORD_LEN) {
      setShake(true);
      showToast("Not enough letters");
      setTimeout(() => setShake(false), 500);
      return;
    }
    const evaluation = evaluateGuess(current, answer);
    const newGuesses = [...guesses, { word: current, evaluation }];
    setGuesses(newGuesses);
    setRevealRow(newGuesses.length - 1);
    const won = current === answer;
    setCurrent("");

    setTimeout(() => {
      if (won) {
        setStatus("won");
        showToast(["Splendid!", "Excellent!", "Well done!", "Nice one!", "Good job!", "Phew!"][newGuesses.length - 1]);
        finishGame(true, newGuesses.map((g) => g.word), newGuesses.map((g) => g.evaluation));
      } else if (newGuesses.length >= MAX_GUESSES) {
        setStatus("lost");
        showToast(answer);
        finishGame(false, newGuesses.map((g) => g.word), newGuesses.map((g) => g.evaluation));
      }
    }, WORD_LEN * 220 + 150);
  }, [current, guesses, status, answer, finishGame]);

  const handleKey = useCallback(
    (key) => {
      if (status !== "playing" || !loaded) return;
      if (key === "ENTER") {
        submitGuess();
      } else if (key === "BACK") {
        setCurrent((c) => c.slice(0, -1));
      } else if (/^[A-Z]$/.test(key) && current.length < WORD_LEN) {
        setCurrent((c) => c + key);
      }
    },
    [current, status, loaded, submitGuess]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (key === "ENTER") handleKey("ENTER");
      else if (key === "BACKSPACE") handleKey("BACK");
      else if (/^[A-Z]$/.test(key)) handleKey(key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  const letterStatus = {};
  guesses.forEach(({ word, evaluation }) => {
    word.split("").forEach((letter, i) => {
      const rank = { absent: 0, present: 1, correct: 2 };
      if (!letterStatus[letter] || rank[evaluation[i]] > rank[letterStatus[letter]]) {
        letterStatus[letter] = evaluation[i];
      }
    });
  });

  const buildShareText = () => {
    const rows = guesses
      .map((g) =>
        g.evaluation
          .map((s) => (s === "correct" ? "\u2B1B" : s === "present" ? "\uD83D\uDFE6" : "\u2B1C"))
          .join("")
      )
      .join("\n");
    return `Bowdle #${dayIndex}  ${status === "won" ? guesses.length : "X"}/${MAX_GUESSES}\n\n${rows}`;
  };

  const handleShare = async () => {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied results to clipboard");
    } catch (e) {
      showToast("Could not copy — try manually");
    }
  };

  const winPct = stats.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  const maxDist = Math.max(1, ...stats.guessDistribution);

  const rows = [];
  for (let r = 0; r < MAX_GUESSES; r++) {
    if (r < guesses.length) {
      rows.push({ letters: guesses[r].word.split(""), evaluation: guesses[r].evaluation, revealed: r <= revealRow });
    } else if (r === guesses.length && status === "playing") {
      rows.push({ letters: current.split(""), evaluation: null, revealed: false });
    } else {
      rows.push({ letters: [], evaluation: null, revealed: false });
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F1F2ED",
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        color: "#141412",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <style>{`
        @keyframes bowdle-flip {
          0% { transform: rotateX(0deg); }
          50% { transform: rotateX(90deg); }
          100% { transform: rotateX(0deg); }
        }
        @keyframes bowdle-shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-8px); }
          40%, 60% { transform: translateX(8px); }
        }
        @keyframes bowdle-pop {
          0% { transform: scale(0.9); }
          40% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .bowdle-tile-reveal { animation: bowdle-flip 0.5s ease forwards; }
        .bowdle-shake { animation: bowdle-shake 0.5s; }
        .bowdle-pop { animation: bowdle-pop 0.12s ease; }
        .bowdle-key {
          border: none;
          border-radius: 4px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          transition: background 0.1s;
        }
        .bowdle-key:active { transform: translateY(1px); }
      `}</style>

      <div style={{ width: "100%", maxWidth: 480, padding: "0 12px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 4px 12px",
            borderBottom: "1.5px solid #D9D7CD",
          }}
        >
          <button
            onClick={() => setShowHelp(true)}
            aria-label="How to play"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "#141412" }}
          >
            <Info size={22} strokeWidth={1.75} />
          </button>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontWeight: 700,
                fontSize: 30,
                letterSpacing: 2,
                lineHeight: 1,
              }}
            >
              BOWDLE
            </div>
            <div style={{ fontSize: 11, color: "#6B6A63", marginTop: 3, letterSpacing: 0.3 }}>
              Bowdoin's daily word game &middot; No. {dayIndex}
            </div>
          </div>
          <button
            onClick={() => setShowStats(true)}
            aria-label="Statistics"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "#141412" }}
          >
            <BarChart3 size={22} strokeWidth={1.75} />
          </button>
        </div>

        {/* Board */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: `repeat(${MAX_GUESSES}, 1fr)`,
            gap: 6,
            padding: "20px 0",
            justifyItems: "center",
          }}
        >
          {rows.map((row, ri) => (
            <div
              key={ri}
              className={shake && ri === guesses.length ? "bowdle-shake" : ""}
              style={{ display: "grid", gridTemplateColumns: `repeat(${WORD_LEN}, 1fr)`, gap: 6 }}
            >
              {Array.from({ length: WORD_LEN }).map((_, ci) => {
                const letter = row.letters[ci] || "";
                let colors = TILE_COLORS.empty;
                if (letter && !row.evaluation) colors = TILE_COLORS.filled;
                if (row.evaluation && row.revealed) colors = TILE_COLORS[row.evaluation[ci]];
                return (
                  <div
                    key={ci}
                    className={letter && !row.evaluation ? "bowdle-pop" : ""}
                    style={{
                      width: 58,
                      height: 58,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      fontWeight: 700,
                      border: `2px solid ${colors.border}`,
                      background: colors.bg,
                      color: colors.color,
                      borderRadius: 4,
                      animation: row.evaluation && row.revealed ? `bowdle-flip 0.45s ease ${ci * 0.12}s` : "none",
                    }}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Toast */}
        <div style={{ position: "relative", height: 0 }}>
          {toast && (
            <div
              style={{
                position: "absolute",
                top: -60,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#141412",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
                zIndex: 20,
              }}
            >
              {toast}
            </div>
          )}
        </div>

        {status !== "playing" && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <button
              onClick={handleShare}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#141412",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: 0.5,
              }}
            >
              <Share2 size={16} /> SHARE RESULT
            </button>
          </div>
        )}

        {/* Keyboard */}
        <div style={{ padding: "8px 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
          {KEY_ROWS.map((row, ri) => (
            <div key={ri} style={{ display: "flex", justifyContent: "center", gap: 6 }}>
              {row.map((k) => {
                const st = letterStatus[k];
                const bg =
                  st === "correct"
                    ? "#0A0A0A"
                    : st === "present"
                    ? "#5C87A8"
                    : st === "absent"
                    ? "#C9C7BE"
                    : "#E4E2D9";
                const color = st === "correct" || st === "present" ? "#fff" : st === "absent" ? "#7A7870" : "#141412";
                const isWide = k === "ENTER" || k === "BACK";
                return (
                  <button
                    key={k}
                    className="bowdle-key"
                    onClick={() => handleKey(k)}
                    style={{
                      background: bg,
                      color,
                      flex: isWide ? "1.5 1 0" : "1 1 0",
                      minWidth: isWide ? 46 : 30,
                      fontSize: isWide ? 11 : 14,
                    }}
                  >
                    {k === "BACK" ? "\u232B" : k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Help modal */}
      {showHelp && (
        <Modal onClose={() => setShowHelp(false)} title="How to play">
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 12px" }}>
            Guess the BOWDLE word in {MAX_GUESSES} tries. Each guess must be a real 5-letter word. After each guess,
            tile colors show how close you were.
          </p>
          <div style={{ display: "flex", gap: 6, margin: "12px 0" }}>
            {["B", "E", "A", "R", "S"].map((l, i) => (
              <div
                key={i}
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  borderRadius: 4,
                  background: i === 0 ? "#0A0A0A" : "#E4E2D9",
                  color: i === 0 ? "#fff" : "#141412",
                  border: i === 0 ? "none" : "2px solid #D3D1C6",
                }}
              >
                {l}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "#6B6A63", margin: "0 0 12px" }}>
            B is in the word and in the correct spot.
          </p>
          <div style={{ display: "flex", gap: 6, margin: "12px 0" }}>
            {["Q", "U", "A", "D", "S"].map((l, i) => (
              <div
                key={i}
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  borderRadius: 4,
                  background: i === 2 ? "#5C87A8" : "#E4E2D9",
                  color: i === 2 ? "#fff" : "#141412",
                  border: i === 2 ? "none" : "2px solid #D3D1C6",
                }}
              >
                {l}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "#6B6A63", margin: 0 }}>
            A is in the word but in the wrong spot. Grey tiles mean the letter isn't in the word at all. A new
            Bowdoin-themed word arrives every day.
          </p>
        </Modal>
      )}

      {/* Stats modal */}
      {showStats && (
        <Modal onClose={() => setShowStats(false)} title="Statistics">
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center", marginBottom: 20 }}>
            <Stat label="Played" value={stats.gamesPlayed} />
            <Stat label="Win %" value={winPct} />
            <Stat label="Streak" value={stats.currentStreak} />
            <Stat label="Max streak" value={stats.maxStreak} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, letterSpacing: 0.3 }}>Guess distribution</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: status !== "playing" ? 20 : 0 }}>
            {stats.guessDistribution.map((count, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, width: 10 }}>{i + 1}</div>
                <div
                  style={{
                    background: "#0A0A0A",
                    color: "#fff",
                    minWidth: count > 0 ? `${8 + (count / maxDist) * 85}%` : 22,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    padding: "0 6px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 2,
                  }}
                >
                  {count}
                </div>
              </div>
            ))}
          </div>
          {status !== "playing" && (
            <button
              onClick={handleShare}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#141412",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "12px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: 0.5,
              }}
            >
              <Share2 size={16} /> SHARE RESULT
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,20,18,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#F1F2ED",
          borderRadius: 6,
          padding: "20px 24px 24px",
          maxWidth: 360,
          width: "100%",
          border: "1.5px solid #D9D7CD",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 20 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#141412" }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "Georgia, serif" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#6B6A63", letterSpacing: 0.3, marginTop: 2 }}>{label}</div>
    </div>
  );
}
