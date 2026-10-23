import React, { useState, useEffect, useCallback, useRef } from "react";
import { Info, BarChart3, Share2, X } from "lucide-react";

// ============================================================
// BOWDLE WORD LIST
// Words are organized by length so the game can support
// different word lengths from 3 through 13 letters.
// ============================================================

const WORDS = {
  
  4: [
    "WEST",
    "HYDE",
    "ZAKI",
    "QUAD",
  ],

  5: [
    "SMITH",
    "OSHER",
    "MAINE",
    "HARPS",
    "BRUNS",
    "MAGEE",
    "STOWE",
  ],

  6: [
    "HOWARD",
    "NESCAC",
    "SUPERS",
    "ORIENT",
    "FARLEY",
    "THORNE",
  ],

  7: [
    "MOULTON",
    "MORRELL",
    "SARGENT",
    "HUBBARD",
    "COLEMAN",
  ],

  8: [
    "AFRICANA",
    "WINTHROP",
    "APPLETON",
    "KATAHDIN",
    "DOWNEAST",
  ],

  9: [
    "BRUNSWICK",
    "MCMOULTON",
    "PENOBSCOT",
  ],

  

};

// ============================================================
// GAME SETTINGS
// ============================================================

const LAUNCH_DATE = new Date(2026, 0, 1);
const MAX_GUESSES = 6;

const WORD_LENGTHS = [
  4, 5, 6, 7, 8, 9, 10, 11, 12, 13
];

// ============================================================
// DAILY WORD LENGTH
// The length changes every day in a repeating 3–13 cycle.
// ============================================================

function getWordLength(dayIndex) {
  return WORD_LENGTHS[dayIndex % WORD_LENGTHS.length];
}

// ============================================================
// DAILY PUZZLE NUMBER
// ============================================================

function getDayIndex() {
  const now = new Date();

  const start = new Date(
    LAUNCH_DATE.getFullYear(),
    LAUNCH_DATE.getMonth(),
    LAUNCH_DATE.getDate()
  );

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const diff = Math.round((today - start) / 86400000);

  return Math.max(0, diff);
}

// ============================================================
// GET TODAY'S ANSWER
// ============================================================

function getDailyAnswer(dayIndex) {
  const wordLength = getWordLength(dayIndex);
  const words = WORDS[wordLength] || [];

  if (words.length === 0) {
    return "ICE";
  }

  return words[dayIndex % words.length];
}

// ============================================================
// EVALUATE GUESS
// Works with ANY word length.
// ============================================================

function evaluateGuess(guess, answer) {
  const wordLength = answer.length;

  const result = Array(wordLength).fill("absent");
  const answerLetters = answer.split("");
  const used = Array(wordLength).fill(false);

  // First pass: exact matches
  for (let i = 0; i < wordLength; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
      used[i] = true;
    }
  }

  // Second pass: letters in the wrong position
  for (let i = 0; i < wordLength; i++) {
    if (result[i] === "correct") continue;

    const idx = answerLetters.findIndex(
      (letter, j) =>
        letter === guess[i] && !used[j]
    );

    if (idx !== -1) {
      result[i] = "present";
      used[idx] = true;
    }
  }

  return result;
}

// ============================================================
// DEFAULT STATISTICS
// ============================================================

const DEFAULT_STATS = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0],
  lastPlayedIndex: -1,
  lastResult: null,
};

// ============================================================
// TILE COLORS
// ============================================================

const TILE_COLORS = {
  correct: {
    bg: "#0A0A0A",
    border: "#0A0A0A",
    color: "#FFFFFF",
  },

  present: {
    bg: "#5C87A8",
    border: "#5C87A8",
    color: "#FFFFFF",
  },

  absent: {
    bg: "#C9C7BE",
    border: "#C9C7BE",
    color: "#5A5850",
  },

  empty: {
    bg: "transparent",
    border: "#D3D1C6",
    color: "#141412",
  },

  filled: {
    bg: "transparent",
    border: "#9B998E",
    color: "#141412",
  },
};

// ============================================================
// MAIN GAME
// ============================================================

export default function Bowdle() {
  const dayIndex = getDayIndex();

  const wordLength = getWordLength(dayIndex);

  const answer = getDailyAnswer(dayIndex);

  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loaded, setLoaded] = useState(false);

  const [guesses, setGuesses] = useState([]);

  const [current, setCurrent] = useState("");

  const [status, setStatus] = useState("playing");

  const [shake, setShake] = useState(false);

  const [toast, setToast] = useState("");

  const [showHelp, setShowHelp] = useState(false);

  const [showStats, setShowStats] = useState(false);

  const [revealRow, setRevealRow] = useState(-1);

  const toastTimer = useRef(null);

  // ==========================================================
  // LOAD SAVED GAME
  // ==========================================================

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bowdle-stats");

      if (saved) {
        const parsed = JSON.parse(saved);

        const mergedStats = {
          ...DEFAULT_STATS,
          ...parsed,
        };

        setStats(mergedStats);

        // Restore today's completed game
        if (
          parsed.lastPlayedIndex === dayIndex &&
          parsed.lastResult
        ) {
          const restoredGuesses =
            parsed.lastResult.guesses.map((word, i) => ({
              word,
              evaluation:
                parsed.lastResult.evaluations[i],
            }));

          setGuesses(restoredGuesses);

          setStatus(parsed.lastResult.status);

          if (restoredGuesses.length > 0) {
            setRevealRow(restoredGuesses.length - 1);
          }
        }
      }
    } catch (error) {
      console.error(
        "Could not load saved Bowdle game:",
        error
      );
    }

    setLoaded(true);
  }, [dayIndex]);

  // ==========================================================
  // SAVE GAME
  // ==========================================================

  const saveStats = useCallback((next) => {
    setStats(next);

    try {
      localStorage.setItem(
        "bowdle-stats",
        JSON.stringify(next)
      );
    } catch (error) {
      console.error(
        "Could not save Bowdle game:",
        error
      );
    }
  }, []);

  // ==========================================================
  // TOAST
  // ==========================================================

  const showToast = useCallback((message) => {
    setToast(message);

    clearTimeout(toastTimer.current);

    toastTimer.current = setTimeout(() => {
      setToast("");
    }, 1800);
  }, []);

  // ==========================================================
  // FINISH GAME
  // ==========================================================

  const finishGame = useCallback(
    (won, allGuesses, allEvals) => {
      const next = {
        ...stats,
      };

      next.gamesPlayed += 1;

      if (won) {
        next.gamesWon += 1;

        next.currentStreak += 1;

        next.maxStreak = Math.max(
          next.maxStreak,
          next.currentStreak
        );

        const distIdx = allGuesses.length - 1;

        next.guessDistribution = [
          ...next.guessDistribution,
        ];

        if (
          distIdx >= 0 &&
          distIdx < next.guessDistribution.length
        ) {
          next.guessDistribution[distIdx] += 1;
        }
      } else {
        next.currentStreak = 0;
      }

      next.lastPlayedIndex = dayIndex;

      next.lastResult = {
        guesses: allGuesses,
        evaluations: allEvals,
        status: won ? "won" : "lost",
      };

      saveStats(next);

      setTimeout(() => {
        setShowStats(true);
      }, 1600);
    },
    [stats, dayIndex, saveStats]
  );

  // ==========================================================
  // SUBMIT GUESS
  // ==========================================================

  const submitGuess = useCallback(() => {
    if (status !== "playing") return;

    if (current.length < wordLength) {
      setShake(true);

      showToast(
        `Not enough letters — need ${wordLength}`
      );

      setTimeout(() => {
        setShake(false);
      }, 500);

      return;
    }

    const evaluation = evaluateGuess(
      current,
      answer
    );

    const newGuesses = [
      ...guesses,
      {
        word: current,
        evaluation,
      },
    ];

    setGuesses(newGuesses);

    setRevealRow(newGuesses.length - 1);

    const won = current === answer;

    setCurrent("");

    // Wait for the tiles to flip
    setTimeout(() => {
      if (won) {
        setStatus("won");

        const messages = [
          "Splendid!",
          "Excellent!",
          "Well done!",
          "Nice one!",
          "Good job!",
          "Phew!",
        ];

        showToast(
          messages[newGuesses.length - 1] ||
            "Excellent!"
        );

        finishGame(
          true,
          newGuesses.map((g) => g.word),
          newGuesses.map((g) => g.evaluation)
        );
      } else if (
        newGuesses.length >= MAX_GUESSES
      ) {
        setStatus("lost");

        showToast(answer);

        finishGame(
          false,
          newGuesses.map((g) => g.word),
          newGuesses.map((g) => g.evaluation)
        );
      }
    }, wordLength * 100 + 500);
  }, [
    current,
    guesses,
    status,
    answer,
    wordLength,
    finishGame,
    showToast,
  ]);

  // ==========================================================
  // KEYBOARD
  // ==========================================================

  const handleKey = useCallback(
    (key) => {
      if (status !== "playing" || !loaded) return;

      if (key === "ENTER") {
        submitGuess();
      } else if (key === "BACK") {
        setCurrent((value) =>
          value.slice(0, -1)
        );
      } else if (
        /^[A-Z]$/.test(key) &&
        current.length < wordLength
      ) {
        setCurrent(
          (value) => value + key
        );
      }
    },
    [
      current,
      status,
      loaded,
      submitGuess,
      wordLength,
    ]
  );

  // ==========================================================
  // PHYSICAL KEYBOARD
  // ==========================================================

  useEffect(() => {
    const onKeyDown = (event) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const key = event.key.toUpperCase();

      if (key === "ENTER") {
        handleKey("ENTER");
      } else if (key === "BACKSPACE") {
        handleKey("BACK");
      } else if (/^[A-Z]$/.test(key)) {
        handleKey(key);
      }
    };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
    };
  }, [handleKey]);

  // ==========================================================
  // KEYBOARD LETTER STATUS
  // ==========================================================

  const letterStatus = {};

  guesses.forEach(
    ({ word, evaluation }) => {
      word.split("").forEach(
        (letter, index) => {
          const rank = {
            absent: 0,
            present: 1,
            correct: 2,
          };

          if (
            !letterStatus[letter] ||
            rank[evaluation[index]] >
              rank[letterStatus[letter]]
          ) {
            letterStatus[letter] =
              evaluation[index];
          }
        }
      );
    }
  );

  // ==========================================================
  // SHARE RESULTS
  // ==========================================================

  const buildShareText = () => {
    const resultRows = guesses
      .map((guess) =>
        guess.evaluation
          .map((state) => {
            if (state === "correct") {
              return "⬛";
            }

            if (state === "present") {
              return "🟦";
            }

            return "⬜";
          })
          .join("")
      )
      .join("\n");

    return `Bowdle #${dayIndex}  ${
      status === "won"
        ? guesses.length
        : "X"
    }/${MAX_GUESSES}

${resultRows}`;
  };

  const handleShare = async () => {
    const text = buildShareText();

    try {
      if (
        navigator.share &&
        /Mobi|Android|iPhone|iPad/i.test(
          navigator.userAgent
        )
      ) {
        await navigator.share({
          title: "Bowdle",
          text,
        });

        return;
      }

      await navigator.clipboard.writeText(
        text
      );

      showToast(
        "Copied results to clipboard"
      );
    } catch (error) {
      showToast(
        "Could not share — try manually"
      );
    }
  };

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const winPct = stats.gamesPlayed
    ? Math.round(
        (stats.gamesWon /
          stats.gamesPlayed) *
          100
      )
    : 0;

  const maxDist = Math.max(
    1,
    ...stats.guessDistribution
  );

  // ==========================================================
  // BOARD ROWS
  // ==========================================================

  const rows = [];

  for (
    let r = 0;
    r < MAX_GUESSES;
    r++
  ) {
    if (r < guesses.length) {
      rows.push({
        letters:
          guesses[r].word.split(""),

        evaluation:
          guesses[r].evaluation,

        revealed:
          r <= revealRow,
      });
    } else if (
      r === guesses.length &&
      status === "playing"
    ) {
      rows.push({
        letters: current.split(""),
        evaluation: null,
        revealed: false,
      });
    } else {
      rows.push({
        letters: [],
        evaluation: null,
        revealed: false,
      });
    }
  }

  // ==========================================================
  // RESPONSIVE TILE SIZE
  // ==========================================================

  const tileSize =
    wordLength >= 11
      ? 28
      : wordLength >= 9
      ? 34
      : wordLength >= 7
      ? 42
      : 48;

  const tileFontSize =
    wordLength >= 11
      ? 14
      : wordLength >= 9
      ? 17
      : wordLength >= 7
      ? 20
      : 24;

  const tileGap =
    wordLength >= 10 ? 3 : 5;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F1F2ED",
        fontFamily:
          "'Helvetica Neue', Arial, sans-serif",
        color: "#141412",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes bowdle-flip {
          0% {
            transform: rotateX(0deg);
          }

          50% {
            transform: rotateX(90deg);
          }

          100% {
            transform: rotateX(0deg);
          }
        }

        @keyframes bowdle-shake {
          10%, 90% {
            transform: translateX(-2px);
          }

          20%, 80% {
            transform: translateX(4px);
          }

          30%, 50%, 70% {
            transform: translateX(-8px);
          }

          40%, 60% {
            transform: translateX(8px);
          }
        }

        @keyframes bowdle-pop {
          0% {
            transform: scale(0.9);
          }

          40% {
            transform: scale(1.05);
          }

          100% {
            transform: scale(1);
          }
        }

        .bowdle-shake {
          animation:
            bowdle-shake 0.5s;
        }

        .bowdle-pop {
          animation:
            bowdle-pop 0.12s ease;
        }

        .bowdle-key {
          border: none;
          border-radius: 4px;
          font-weight: 700;
          cursor: pointer;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          transition:
            background 0.1s,
            transform 0.05s;
        }

        .bowdle-key:active {
          transform: translateY(1px);
        }

        * {
          box-sizing: border-box;
        }

        button {
          -webkit-tap-highlight-color:
            transparent;
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 560,
          padding: "0 12px",
        }}
      >
        {/* ==================================================
            HEADER
        ================================================== */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            padding:
              "16px 4px 12px",
            borderBottom:
              "1.5px solid #D9D7CD",
          }}
        >
          <button
            onClick={() =>
              setShowHelp(true)
            }
            aria-label="How to play"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              color: "#141412",
            }}
          >
            <Info
              size={22}
              strokeWidth={1.75}
            />
          </button>

          <div
            style={{
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily:
                  "Georgia, 'Times New Roman', serif",
                fontWeight: 700,
                fontSize: 30,
                letterSpacing: 2,
                lineHeight: 1,
              }}
            >
              BOWDLE
            </div>

            <div
              style={{
                fontSize: 11,
                color: "#6B6A63",
                marginTop: 3,
                letterSpacing: 0.3,
              }}
            >
              Bowdoin's daily word game
              {" · "}
              No. {dayIndex}
              {" · "}
              {wordLength} letters
            </div>
          </div>

          <button
            onClick={() =>
              setShowStats(true)
            }
            aria-label="Statistics"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              color: "#141412",
            }}
          >
            <BarChart3
              size={22}
              strokeWidth={1.75}
            />
          </button>
        </div>

        {/* ==================================================
            BOARD
        ================================================== */}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "20px 0",
            alignItems: "center",
            overflowX: "auto",
          }}
        >
          {rows.map(
            (row, rowIndex) => (
              <div
                key={rowIndex}
                className={
                  shake &&
                  rowIndex ===
                    guesses.length
                    ? "bowdle-shake"
                    : ""
                }
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    `repeat(${wordLength}, ${tileSize}px)`,
                  gap: tileGap,
                }}
              >
                {Array.from({
                  length: wordLength,
                }).map(
                  (_, columnIndex) => {
                    const letter =
                      row.letters[
                        columnIndex
                      ] || "";

                    let colors =
                      TILE_COLORS.empty;

                    if (
                      letter &&
                      !row.evaluation
                    ) {
                      colors =
                        TILE_COLORS.filled;
                    }

                    if (
                      row.evaluation &&
                      row.revealed
                    ) {
                      colors =
                        TILE_COLORS[
                          row.evaluation[
                            columnIndex
                          ]
                        ];
                    }

                    return (
                      <div
                        key={
                          columnIndex
                        }
                        className={
                          letter &&
                          !row.evaluation
                            ? "bowdle-pop"
                            : ""
                        }
                        style={{
                          width: tileSize,
                          height: tileSize,
                          display: "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          fontSize:
                            tileFontSize,
                          fontWeight: 700,
                          border:
                            `2px solid ${colors.border}`,
                          background:
                            colors.bg,
                          color:
                            colors.color,
                          borderRadius: 4,
                          animation:
                            row.evaluation &&
                            row.revealed
                              ? `bowdle-flip 0.45s ease ${columnIndex * 0.08}s`
                              : "none",
                        }}
                      >
                        {letter}
                      </div>
                    );
                  }
                )}
              </div>
            )
          )}
        </div>

        {/* ==================================================
            TOAST
        ================================================== */}

        <div
          style={{
            position: "relative",
            height: 0,
          }}
        >
          {toast && (
            <div
              style={{
                position:
                  "absolute",
                top: -60,
                left: "50%",
                transform:
                  "translateX(-50%)",
                background:
                  "#141412",
                color: "#fff",
                padding:
                  "8px 16px",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace:
                  "nowrap",
                zIndex: 20,
              }}
            >
              {toast}
            </div>
          )}
        </div>

        {/* ==================================================
            SHARE BUTTON
        ================================================== */}

        {status !== "playing" && (
          <div
            style={{
              display: "flex",
              justifyContent:
                "center",
              marginBottom: 12,
            }}
          >
            <button
              onClick={
                handleShare
              }
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 8,
                background:
                  "#141412",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding:
                  "10px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: 0.5,
              }}
            >
              <Share2
                size={16}
              />
              SHARE RESULT
            </button>
          </div>
        )}

        {/* ==================================================
            KEYBOARD
        ================================================== */}

        <div
          style={{
            padding:
              "8px 0 24px",
            display: "flex",
            flexDirection:
              "column",
            gap: 8,
          }}
        >
          {KEY_ROWS.map(
            (row, rowIndex) => (
              <div
                key={rowIndex}
                style={{
                  display: "flex",
                  justifyContent:
                    "center",
                  gap: 5,
                  width: "100%",
                }}
              >
                {row.map((key) => {
                  const state =
                    letterStatus[
                      key
                    ];

                  const background =
                    state ===
                    "correct"
                      ? "#0A0A0A"
                      : state ===
                        "present"
                      ? "#5C87A8"
                      : state ===
                        "absent"
                      ? "#C9C7BE"
                      : "#E4E2D9";

                  const color =
                    state ===
                      "correct" ||
                    state ===
                      "present"
                      ? "#fff"
                      : state ===
                        "absent"
                      ? "#7A7870"
                      : "#141412";

                  const isWide =
                    key === "ENTER" ||
                    key === "BACK";

                  return (
                    <button
                      key={key}
                      className="bowdle-key"
                      onClick={() =>
                        handleKey(key)
                      }
                      style={{
                        background,
                        color,
                        flex: isWide
                          ? "1.5 1 0"
                          : "1 1 0",
                        minWidth:
                          isWide
                            ? 46
                            : 26,
                        fontSize:
                          isWide
                            ? 11
                            : 14,
                      }}
                    >
                      {key ===
                      "BACK"
                        ? "⌫"
                        : key}
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* ====================================================
          HELP MODAL
      ==================================================== */}

      {showHelp && (
        <Modal
          onClose={() =>
            setShowHelp(false)
          }
          title="How to play"
        >
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              margin:
                "0 0 12px",
            }}
          >
            Guess the BOWDLE word
            in {MAX_GUESSES} tries.
            The number of letters
            changes each day —
            today's word has{" "}
            <strong>
              {wordLength}
              letters
            </strong>
            .
          </p>

          <div
            style={{
              display: "flex",
              gap: 6,
              margin: "12px 0",
            }}
          >
            {["B", "E", "A", "R", "S"].map(
              (letter, index) => (
                <div
                  key={index}
                  style={{
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    fontWeight: 700,
                    borderRadius: 4,
                    background:
                      index === 0
                        ? "#0A0A0A"
                        : "#E4E2D9",
                    color:
                      index === 0
                        ? "#fff"
                        : "#141412",
                    border:
                      index === 0
                        ? "none"
                        : "2px solid #D3D1C6",
                  }}
                >
                  {letter}
                </div>
              )
            )}
          </div>

          <p
            style={{
              fontSize: 13,
              color: "#6B6A63",
              margin:
                "0 0 12px",
            }}
          >
            Black means the
            letter is in the word
            and in the correct
            spot.
          </p>

          <div
            style={{
              display: "flex",
              gap: 6,
              margin: "12px 0",
            }}
          >
            {["Q", "U", "A", "D", "S"].map(
              (letter, index) => (
                <div
                  key={index}
                  style={{
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    fontWeight: 700,
                    borderRadius: 4,
                    background:
                      index === 2
                        ? "#5C87A8"
                        : "#E4E2D9",
                    color:
                      index === 2
                        ? "#fff"
                        : "#141412",
                    border:
                      index === 2
                        ? "none"
                        : "2px solid #D3D1C6",
                  }}
                >
                  {letter}
                </div>
              )
            )}
          </div>

          <p
            style={{
              fontSize: 13,
              color: "#6B6A63",
              margin: 0,
            }}
          >
            Blue means the
            letter is in the word
            but in the wrong spot.
            Grey means the letter
            isn't in the word.
            A new Bowdoin-themed
            puzzle arrives every
            day.
          </p>
        </Modal>
      )}

      {/* ====================================================
          STATISTICS MODAL
      ==================================================== */}

      {showStats && (
        <Modal
          onClose={() =>
            setShowStats(false)
          }
          title="Statistics"
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-around",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            <Stat
              label="Played"
              value={
                stats.gamesPlayed
              }
            />

            <Stat
              label="Win %"
              value={winPct}
            />

            <Stat
              label="Streak"
              value={
                stats.currentStreak
              }
            />

            <Stat
              label="Max streak"
              value={
                stats.maxStreak
              }
            />
          </div>

          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 8,
              letterSpacing: 0.3,
            }}
          >
            Guess distribution
          </div>

          <div
            style={{
              display: "flex",
              flexDirection:
                "column",
              gap: 4,
              marginBottom:
                status !==
                "playing"
                  ? 20
                  : 0,
            }}
          >
            {stats.guessDistribution.map(
              (count, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      width: 10,
                    }}
                  >
                    {index + 1}
                  </div>

                  <div
                    style={{
                      background:
                        "#0A0A0A",
                      color: "#fff",
                      width:
                        count > 0
                          ? `${
                              8 +
                              (count /
                                maxDist) *
                                85
                            }%`
                          : 22,
                      minWidth: 22,
                      height: 20,
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "flex-end",
                      padding:
                        "0 6px",
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 2,
                    }}
                  >
                    {count}
                  </div>
                </div>
              )
            )}
          </div>

          {status !==
            "playing" && (
            <button
              onClick={
                handleShare
              }
              style={{
                width: "100%",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                gap: 8,
                background:
                  "#141412",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: 0.5,
              }}
            >
              <Share2
                size={16}
              />
              SHARE RESULT
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// MODAL
// ============================================================

function Modal({
  children,
  onClose,
  title,
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background:
          "rgba(20,20,18,0.5)",
        display: "flex",
        alignItems:
          "center",
        justifyContent:
          "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          background: "#F1F2ED",
          borderRadius: 6,
          padding:
            "20px 24px 24px",
          maxWidth: 360,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          border:
            "1.5px solid #D9D7CD",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontFamily:
                "Georgia, serif",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            {title}
          </div>

          <button
            onClick={onClose}
            style={{
              background:
                "none",
              border: "none",
              cursor: "pointer",
              color:
                "#141412",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

// ============================================================
// STAT
// ============================================================

function Stat({
  label,
  value,
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          fontFamily:
            "Georgia, serif",
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 10,
          color: "#6B6A63",
          letterSpacing: 0.3,
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
