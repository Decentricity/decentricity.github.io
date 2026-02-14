(() => {
  const renderFatal = (message) => {
    const root = document.getElementById('root') || document.body;
    const container = document.createElement('div');
    container.style.fontFamily = 'monospace';
    container.style.padding = '24px';
    container.style.background = '#fff3f3';
    container.style.border = '2px solid #ef5350';
    container.style.color = '#7f1d1d';
    container.style.margin = '24px';
    container.style.borderRadius = '8px';
    container.innerHTML = `<strong>Quiz failed to load.</strong><div style="margin-top:8px;">${message}</div>`;
    root.appendChild(container);
  };

  if (!window.React || !window.ReactDOM) {
    renderFatal('React failed to load. Check your internet connection or CDN access.');
    return;
  }

  const { useState, useEffect, useRef, useCallback, useMemo } = window.React;

const STORAGE_KEY_QUESTIONS = 'scfquiz:questions_json';
const STORAGE_KEY_ANSWERS = 'scfquiz:last_answers';
const STORAGE_KEY_COMPLETED = 'scfquiz:has_completed';
const DEFAULT_JSON_URL = './quiz.json';

// Utility functions
const loadStoredQuestions = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_QUESTIONS);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        return data;
      }
    }
  } catch (e) {
    console.error('[loadStoredQuestions] Error:', e);
  }
  return null;
};

const saveQuestionsToStorage = (jsonData) => {
  try {
    localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(jsonData));
    return true;
  } catch (e) {
    console.error('[saveQuestionsToStorage] Error:', e);
    return false;
  }
};

const saveAnswersToStorage = (answers) => {
  try {
    localStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(answers));
  } catch (e) {
    console.error('[saveAnswersToStorage] Error:', e);
  }
};

const loadStoredAnswers = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ANSWERS);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

const hasCompletedQuiz = () => {
  try {
    return localStorage.getItem(STORAGE_KEY_COMPLETED) === 'true';
  } catch (e) {
    return false;
  }
};

const setQuizCompleted = () => {
  try {
    localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
  } catch (e) {
    console.error('[setQuizCompleted] Error:', e);
  }
};

const fetchQuestionsFromUrl = async (url) => {
  try {
    // Convert GitHub blob URLs to raw URLs
    let fetchUrl = url;
    if (url.includes('github.com') && url.includes('/blob/')) {
      fetchUrl = url
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
    }
    
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

const normalizeExpectedAnswer = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 'right' : 'wrong';
  const text = String(value).toLowerCase().trim();
  if (text === 'true' || text === 't') return 'right';
  if (text === 'false' || text === 'f') return 'wrong';
  if (['right', 'wrong', 'split', 'dunno', "don't know", 'dont know'].includes(text)) {
    if (text === "don't know" || text === 'dont know') return 'dunno';
    return text;
  }
  return null;
};

const formatCorrectAnswer = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (['true', 't', 'right'].includes(normalized)) return 'TRUE';
  if (['false', 'f', 'wrong'].includes(normalized)) return 'FALSE';
  if (['split'].includes(normalized)) return 'SPLIT';
  if (['dunno', "don't know", 'dont know'].includes(normalized)) return "DON'T KNOW";
  return text;
};

const getPreferredCorrectAnswer = (question) => {
  if (!question) return null;
  const hasAnswerText = question.answer !== undefined && question.answer !== null && String(question.answer).trim() !== '';
  return formatCorrectAnswer(hasAnswerText ? question.answer : question.correct);
};

// Components
const PolygonBackground = () => {
  return React.createElement('div', { className: 'polygon-bg' },
    React.createElement('svg', {
      className: 'absolute inset-0 w-full h-full',
      xmlns: 'http://www.w3.org/2000/svg',
      preserveAspectRatio: 'none'
    },
      React.createElement('defs', null,
        React.createElement('pattern', {
          id: 'polypattern',
          x: '0',
          y: '0',
          width: '100',
          height: '100',
          patternUnits: 'userSpaceOnUse'
        },
          React.createElement('polygon', { points: '0,0 50,20 30,50', fill: 'rgba(200,200,220,0.15)' }),
          React.createElement('polygon', { points: '50,20 100,0 80,40 50,50', fill: 'rgba(180,180,200,0.1)' }),
          React.createElement('polygon', { points: '0,0 30,50 0,80', fill: 'rgba(190,190,210,0.12)' }),
          React.createElement('polygon', { points: '30,50 50,50 40,100 0,80', fill: 'rgba(210,210,230,0.08)' }),
          React.createElement('polygon', { points: '50,50 80,40 100,70 70,100 40,100', fill: 'rgba(195,195,215,0.1)' }),
          React.createElement('polygon', { points: '100,0 100,70 80,40', fill: 'rgba(185,185,205,0.13)' }),
          React.createElement('polygon', { points: '100,70 100,100 70,100', fill: 'rgba(205,205,225,0.09)' })
        )
      ),
      React.createElement('rect', { width: '100%', height: '100%', fill: 'url(#polypattern)' })
    )
  );
};

// Header with config button
const AppHeader = ({ onOpenConfig, statusText }) => {
  return React.createElement('header', { className: 'app-header' },
    React.createElement('div', { className: 'header-brand' },
      React.createElement('span', { className: 'font-vt323 text-2xl' }, 'SCF WORKSHOP')
    ),
    React.createElement('div', { className: 'header-actions' },
      statusText && React.createElement('span', { className: 'header-status' }, statusText),
      React.createElement('button', {
        className: 'btn-ghost header-config-btn',
        onClick: onOpenConfig
      }, 'Config')
    )
  );
};

const ConfigPanel = ({ isOpen, onClose, onStart, onClear, existingQuestions }) => {
  const [jsonUrl, setJsonUrl] = useState(DEFAULT_JSON_URL);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateAndStart = (data) => {
    if (!data.quiz_id) {
      setError('Missing quiz_id in JSON');
      return false;
    }
    if (!Array.isArray(data.questions)) {
      setError('Missing or invalid questions array');
      return false;
    }
    if (data.questions.length === 0) {
      setError('Questions array is empty');
      return false;
    }

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      if (!q.id || !q.text) {
        setError(`Question ${i + 1} is missing id or text`);
        return false;
      }
      const hasCorrect = q.correct !== undefined && q.correct !== null && String(q.correct).trim() !== '';
      const hasAnswer = q.answer !== undefined && q.answer !== null && String(q.answer).trim() !== '';
      if (!hasCorrect && !hasAnswer) {
        setError(`Question ${i + 1} is missing a correct/answer field`);
        return false;
      }
    }

    saveQuestionsToStorage(data);
    onStart(data);
    return true;
  };

  const handleLoadFromUrl = async () => {
    setError('');
    setLoading(true);

    const result = await fetchQuestionsFromUrl(jsonUrl);
    setLoading(false);

    if (!result.success) {
      setError(`Failed to load: ${result.error}`);
      return;
    }

    validateAndStart(result.data);
  };

  const handleStartWithExisting = () => {
    if (existingQuestions) {
      onStart(existingQuestions);
    }
  };

  if (!isOpen) return null;

  return React.createElement('div', { className: 'config-overlay' },
    React.createElement('div', { className: 'config-panel' },
      React.createElement('div', { className: 'config-header' },
        React.createElement('h2', { className: 'font-vt323 text-3xl text-charcoal' }, 'CONFIG'),
        React.createElement('button', { className: 'config-close', onClick: onClose }, 'Close')
      ),
      React.createElement('p', { className: 'font-mono text-sm text-gray-600 mb-4' }, 
        'Enter a URL to your questions JSON'
      ),
      existingQuestions && React.createElement('div', { className: 'existing-questions-banner' },
        React.createElement('span', null, `${existingQuestions.questions.length} questions loaded`),
        React.createElement('div', { className: 'existing-actions' },
          React.createElement('button', { 
            onClick: handleStartWithExisting,
            className: 'btn-primary'
          }, 'Start Quiz'),
          React.createElement('button', {
            onClick: onClear,
            className: 'btn-ghost'
          }, 'Clear Stored Quiz')
        )
      ),
      React.createElement('div', { className: 'url-input-section' },
        React.createElement('label', { className: 'input-label' }, 'JSON URL'),
        React.createElement('input', {
          type: 'text',
          value: jsonUrl,
          onChange: (e) => setJsonUrl(e.target.value),
          placeholder: 'Enter URL to questions JSON...',
          className: 'url-input'
        }),
        React.createElement('p', { className: 'input-hint' }, 
          'Supports GitHub blob URLs (auto-converted to raw)'
        )
      ),
      error && React.createElement('div', { className: 'setup-error' }, error),
      React.createElement('div', { className: 'setup-actions' },
        React.createElement('button', {
          onClick: handleLoadFromUrl,
          className: 'btn-primary w-full',
          disabled: loading
        }, loading ? 'Loading...' : 'Load & Start Quiz')
      ),
      React.createElement('div', { className: 'setup-hint' },
        React.createElement('p', null, 'JSON format:'),
        React.createElement('code', null, '{ quiz_id, title?, questions: [{ id, type?, text, correct? }] }')
      )
    )
  );
};

const getQuestionImageSrc = (question) => {
  if (!question || !question.id) return null;
  return `images/${question.id}.png`;
};

// Low-poly SVG illustrations for cards (fallback)
const CardIllustration = ({ type, imageSrc }) => {
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    setImgOk(true);
  }, [imageSrc]);

  const tfIllustration = React.createElement('svg', {
    viewBox: '0 0 200 120',
    className: 'low-poly-illustration'
  },
    React.createElement('polygon', { points: '30,100 70,20 110,100', fill: '#e8f5e9', stroke: '#4caf50', strokeWidth: '2' }),
    React.createElement('polygon', { points: '90,100 130,20 170,100', fill: '#ffebee', stroke: '#ef5350', strokeWidth: '2' }),
    React.createElement('text', { x: '70', y: '75', textAnchor: 'middle', fill: '#4caf50', fontFamily: 'VT323', fontSize: '24' }, 'T'),
    React.createElement('text', { x: '130', y: '75', textAnchor: 'middle', fill: '#ef5350', fontFamily: 'VT323', fontSize: '24' }, 'F')
  );
  
  const promptIllustration = React.createElement('svg', {
    viewBox: '0 0 200 120',
    className: 'low-poly-illustration'
  },
    React.createElement('polygon', { points: '100,10 180,60 140,110 60,110 20,60', fill: '#f3e5f5', stroke: '#9b59b6', strokeWidth: '2' }),
    React.createElement('circle', { cx: '100', cy: '60', r: '20', fill: '#9b59b6', opacity: '0.3' }),
    React.createElement('text', { x: '100', y: '68', textAnchor: 'middle', fill: '#9b59b6', fontFamily: 'VT323', fontSize: '24' }, '?')
  );
  
  if (imageSrc && imgOk) {
    return React.createElement('img', {
      src: imageSrc,
      className: 'card-image',
      alt: '',
      loading: 'eager',
      onError: () => setImgOk(false)
    });
  }

  return type === 'tf' ? tfIllustration : promptIllustration;
};

const QuizScreen = ({ questions, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [pressedKey, setPressedKey] = useState(null);
  const [cardAnim, setCardAnim] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragState, setDragState] = useState({ dragging: false, startX: 0, startY: 0, deltaX: 0, deltaY: 0 });
  const [swipeOverlay, setSwipeOverlay] = useState(null);
  const handleAnswerRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const keyTimeoutRef = useRef(null);
  const animTimeoutRef = useRef(null);
  const cardRef = useRef(null);

  const handleAnswer = useCallback((answerType) => {
    const question = questions[currentIndex];
    
    // Determine if answer is correct (tf or explicit answer field)
    const expectedAnswerType = normalizeExpectedAnswer(
      question.correct !== undefined ? question.correct : question.answer
    );
    const isCorrect = expectedAnswerType ? answerType === expectedAnswerType : null;

    const correctAnswerDisplay = getPreferredCorrectAnswer(question);
    
    const newAnswer = {
      questionId: question.id,
      questionText: question.text,
      answerType,
      isCorrect,
      expectedAnswerType,
      correctAnswer: correctAnswerDisplay
    };
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    
    if (currentIndex >= questions.length - 1) {
      saveAnswersToStorage(newAnswers);
      onComplete(newAnswers);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, questions, answers, onComplete]);

  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  }, [handleAnswer]);

  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isAnimatingRef.current) return;
      const key = e.key.toLowerCase();
      let dir = null;
      let answerType = null;
      switch (e.key.toLowerCase()) {
        case 'arrowright':
        case 'd':
          dir = 'right';
          answerType = 'right';
          break;
        case 'arrowleft':
        case 'a':
          dir = 'left';
          answerType = 'wrong';
          break;
        case 'arrowup':
        case 'w':
          dir = 'up';
          answerType = 'dunno';
          break;
        case 'arrowdown':
        case 's':
          dir = 'down';
          answerType = 'split';
          break;
      }
      if (dir) {
        e.preventDefault();
        if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current);
        setPressedKey(dir);
        keyTimeoutRef.current = setTimeout(() => setPressedKey(null), 150);

        if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
        setIsAnimating(true);
        setCardAnim(dir);
        setSwipeOverlay(answerType === 'right' ? 'right' : answerType === 'wrong' ? 'wrong' : answerType === 'dunno' ? 'dunno' : 'split');
        animTimeoutRef.current = setTimeout(() => {
          setCardAnim(null);
          setSwipeOverlay(null);
          if (handleAnswerRef.current) {
            handleAnswerRef.current(answerType);
          }
          setIsAnimating(false);
        }, 500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current);
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, []);

  if (!questions || questions.length === 0) {
    return React.createElement('div', { className: 'min-h-screen flex flex-col items-center justify-center p-4' },
      React.createElement('p', { className: 'font-mono text-sm text-gray-600' }, 'No questions loaded. Use Config to load a quiz.')
    );
  }

  // Touch/swipe handling

  const handlePointerDown = (e) => {
    setDragState({
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      deltaX: 0,
      deltaY: 0
    });
  };

  const handlePointerMove = (e) => {
    if (!dragState.dragging) return;
    
    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;
    setDragState(prev => ({ ...prev, deltaX, deltaY }));
    
    const threshold = 50;
    if (deltaX > threshold) {
      setSwipeOverlay('right');
    } else if (deltaX < -threshold) {
      setSwipeOverlay('wrong');
    } else if (deltaY < -threshold) {
      setSwipeOverlay('dunno');
    } else if (deltaY > threshold) {
      setSwipeOverlay('split');
    } else {
      setSwipeOverlay(null);
    }
  };

  const handlePointerUp = () => {
    if (!dragState.dragging) return;
    
    const threshold = 80;
    const { deltaX, deltaY } = dragState;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > threshold) {
        handleAnswer('right');
      } else if (deltaX < -threshold) {
        handleAnswer('wrong');
      }
    } else {
      if (deltaY < -threshold) {
        handleAnswer('dunno');
      } else if (deltaY > threshold) {
        handleAnswer('split');
      }
    }
    
    setDragState({ dragging: false, startX: 0, startY: 0, deltaX: 0, deltaY: 0 });
    setSwipeOverlay(null);
  };

  const question = questions[currentIndex];
  const progress = ((currentIndex) / questions.length) * 100;

  const cardStyle = dragState.dragging ? {
    transform: `translate(${dragState.deltaX * 0.5}px, ${dragState.deltaY * 0.5}px) rotate(${dragState.deltaX * 0.05}deg)`,
    transition: 'none'
  } : {};

  // Trail cards for stack effect
  const trailCards = [1, 2].map(offset => {
    const scale = 1 - offset * 0.03;
    const yOffset = offset * 8;
    return React.createElement('div', {
      key: offset,
      className: 'card-trail',
      style: {
        transform: `translateY(${yOffset}px) scale(${scale})`,
        zIndex: -offset
      }
    });
  });

  return React.createElement('div', { className: 'flex flex-col relative quiz-screen' },
    React.createElement('main', { className: 'flex-1 flex items-center justify-center p-0 quiz-main' },
      React.createElement('div', {
        ref: cardRef,
        className: 'card-stack',
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerUp
      },
        trailCards,
        React.createElement('div', { className: `card-wrapper top-card ${cardAnim ? `card-anim-${cardAnim}` : ''}`, style: cardStyle },
          React.createElement('div', { className: 'quiz-card' },
            React.createElement('div', { 
              className: 'swipe-overlay swipe-yes', 
              style: { opacity: swipeOverlay === 'right' ? 1 : 0 } 
            }, 'TRUE'),
            React.createElement('div', { 
              className: 'swipe-overlay swipe-no', 
              style: { opacity: swipeOverlay === 'wrong' ? 1 : 0 } 
            }, 'FALSE'),
            React.createElement('div', { 
              className: 'swipe-overlay swipe-dunno', 
              style: { opacity: swipeOverlay === 'dunno' ? 1 : 0 } 
            }, "DON'T KNOW"),
            React.createElement('div', { 
              className: 'swipe-overlay swipe-split', 
              style: { opacity: swipeOverlay === 'split' ? 1 : 0 } 
            }, 'SPLIT'),
            React.createElement('div', { className: 'card-header' },
              React.createElement('span', { className: 'question-number' }, `Q${currentIndex + 1}`),
              React.createElement('span', { className: `question-type ${question.type === 'tf' ? 'type-tf' : 'type-prompt'}` },
                question.type === 'tf' ? 'TRUE/FALSE' : 'QUESTION'
              )
            ),
            React.createElement('div', { className: 'card-illustration' },
              React.createElement(CardIllustration, { 
                type: question.type,
                imageSrc: getQuestionImageSrc(question)
              })
            ),
            React.createElement('div', { className: 'card-body' },
              React.createElement('p', { className: 'question-text' }, question.text)
            ),
            React.createElement('div', { className: 'card-footer' },
              React.createElement('div', { className: 'progress-text' }, `Progress: ${Math.round(progress)}%`),
              React.createElement('div', { className: 'progress-bar' },
                React.createElement('div', { className: 'progress-fill', style: { width: `${progress}%` } })
              )
            )
          )
        )
      )
    ),
    React.createElement('footer', { className: 'keyboard-hints' },
      React.createElement('div', { className: 'key-row' },
        React.createElement('div', { className: `keycap key-up ${pressedKey === 'up' ? 'pressed' : ''}` },
          React.createElement('span', { className: 'key-label' }, "DON'T KNOW")
        )
      ),
      React.createElement('div', { className: 'key-row' },
        React.createElement('div', { className: `keycap key-left ${pressedKey === 'left' ? 'pressed' : ''}` },
          React.createElement('span', { className: 'key-label' }, 'FALSE')
        ),
        React.createElement('div', { className: `keycap key-down ${pressedKey === 'down' ? 'pressed' : ''}` },
          React.createElement('span', { className: 'key-label' }, 'SPLIT')
        ),
        React.createElement('div', { className: `keycap key-right ${pressedKey === 'right' ? 'pressed' : ''}` },
          React.createElement('span', { className: 'key-label' }, 'TRUE')
        )
      )
    )
  );
};

const CompletionScreen = ({ answers, onRestart, questions }) => {
  return React.createElement('div', { className: 'flex flex-col items-center justify-center p-4 relative' },
    React.createElement(StatsScreen, { answers, onRestart, questions })
  );
};

const StatsScreen = ({ answers, onRestart, questions }) => {
  const questionMap = useMemo(() => {
    if (!Array.isArray(questions)) return null;
    const map = {};
    questions.forEach((q) => {
      if (q && q.id) map[q.id] = q;
    });
    return map;
  }, [questions]);

  const getExpectedAnswerType = (answer) => {
    const question = questionMap ? questionMap[answer.questionId] : null;
    return normalizeExpectedAnswer(
      question
        ? (question.correct !== undefined ? question.correct : question.answer)
        : null
    );
  };

  const isAnswerCorrect = (answer) => {
    if (typeof answer.isCorrect === 'boolean') return answer.isCorrect;
    const expected = getExpectedAnswerType(answer);
    if (!expected) return false;
    return answer.answerType === expected;
  };

  const getAnswerLabel = (answer) => (isAnswerCorrect(answer) ? 'Correct' : 'Incorrect');

  const getAnswerClass = (answer) => (isAnswerCorrect(answer) ? 'answer-correct' : 'answer-incorrect');

  const getCorrectAnswerDisplay = (answer) => {
    const question = questionMap ? questionMap[answer.questionId] : null;
    const raw = (question && question.answer !== undefined && question.answer !== null && String(question.answer).trim() !== '')
      ? question.answer
      : getPreferredCorrectAnswer(question) || answer.correctAnswer || '';
    return formatCorrectAnswer(raw) || '';
  };

  const shouldShowCorrectAnswer = (answer) => !isAnswerCorrect(answer);
  const splitCount = answers.filter(a => a.answerType === 'split').length;
  const correctCount = answers.filter(a => isAnswerCorrect(a) && a.answerType !== 'split').length;
  const incorrectCount = answers.filter(a => !isAnswerCorrect(a) && a.answerType !== 'split').length;

  return React.createElement('div', { className: 'stats-screen-content' },
    React.createElement('div', { className: 'stats-content' },
      React.createElement('div', { className: 'stats-header-inline' },
        React.createElement('h2', { className: 'font-vt323 text-3xl' }, 'QUIZ STATS'),
        React.createElement('button', { onClick: onRestart, className: 'btn-primary text-sm' }, 'Restart Quiz')
      ),
      React.createElement('div', { className: 'stats-summary' },
        React.createElement('div', { className: 'stat-card stat-right' },
          React.createElement('span', { className: 'stat-value' }, correctCount),
          React.createElement('span', { className: 'stat-label' }, 'Correct')
        ),
        React.createElement('div', { className: 'stat-card stat-wrong' },
          React.createElement('span', { className: 'stat-value' }, incorrectCount),
          React.createElement('span', { className: 'stat-label' }, 'Incorrect')
        ),
        React.createElement('div', { className: 'stat-card stat-split' },
          React.createElement('span', { className: 'stat-value' }, splitCount),
          React.createElement('span', { className: 'stat-label' }, 'Split')
        )
      ),
      answers.length > 0 ? React.createElement('div', { className: 'stats-table-wrapper' },
        React.createElement('table', { className: 'stats-table' },
          React.createElement('thead', null,
            React.createElement('tr', null,
              React.createElement('th', null, '#'),
              React.createElement('th', null, 'Question'),
              React.createElement('th', null, 'Result'),
              React.createElement('th', null, 'Correct Answer')
            )
          ),
          React.createElement('tbody', null,
            answers.map((answer, idx) => 
              React.createElement('tr', { key: answer.questionId, className: getAnswerClass(answer) },
                React.createElement('td', { className: 'id-cell' }, idx + 1),
                React.createElement('td', { className: 'question-cell' }, answer.questionText),
                React.createElement('td', { className: 'result-cell' }, getAnswerLabel(answer)),
                React.createElement(
                  'td',
                  { className: 'correct-cell' },
                  shouldShowCorrectAnswer(answer) ? getCorrectAnswerDisplay(answer) : ''
                )
              )
            )
          )
        )
      ) : React.createElement('div', { className: 'no-stats-message' },
        React.createElement('p', null, 'No quiz results yet. Complete a quiz to see your stats here.')
      )
    )
  );
};

const App = () => {
  const [screen, setScreen] = useState('main'); // 'main' | 'quiz' | 'complete' | 'stats'
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [storedQuestions, setStoredQuestions] = useState(() => loadStoredQuestions());
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    const existing = loadStoredQuestions();
    if (existing && Array.isArray(existing.questions) && existing.questions.length > 0) {
      setStoredQuestions(existing);
      setQuestions(existing.questions);
      setScreen('quiz');
    } else {
      setConfigOpen(true);
    }
  }, []);

  const handleStartQuiz = (questionsData) => {
    setQuestions(questionsData.questions);
    setStoredQuestions(questionsData);
    setAnswers([]);
    setScreen('quiz');
    setConfigOpen(false);
  };

  const handleComplete = (finalAnswers) => {
    setAnswers(finalAnswers);
    saveAnswersToStorage(finalAnswers);
    setQuizCompleted();
    setScreen('complete');
  };

  const handleRestart = () => {
    setAnswers([]);
    if (storedQuestions && Array.isArray(storedQuestions.questions) && storedQuestions.questions.length > 0) {
      setQuestions(storedQuestions.questions);
      setScreen('quiz');
    } else {
      setScreen('main');
      setConfigOpen(true);
    }
  };

  const handleGoToStats = () => {
    setScreen('stats');
  };

  const handleOpenConfig = () => {
    setConfigOpen(true);
  };

  const handleCloseConfig = () => {
    setConfigOpen(false);
  };

  const handleClearStored = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_QUESTIONS);
      localStorage.removeItem(STORAGE_KEY_ANSWERS);
      localStorage.removeItem(STORAGE_KEY_COMPLETED);
    } catch (e) {
      console.error('[handleClearStored] Error:', e);
    }
    setStoredQuestions(null);
    setQuestions([]);
    setAnswers([]);
    setScreen('main');
  };

  const storedAnswers = loadStoredAnswers();
  const hasStoredAnswers = storedAnswers.length > 0;
  const statusText = storedQuestions
    ? `Quiz loaded (${storedQuestions.questions.length}Q)`
    : 'No quiz loaded';

  let content = null;
  if (screen === 'quiz') {
    content = React.createElement(QuizScreen, { 
      questions,
      onComplete: handleComplete
    });
  } else if (screen === 'complete') {
    content = React.createElement('main', { className: 'flex-1 flex items-center justify-center p-4 z-10' },
      React.createElement(CompletionScreen, { 
        answers, 
        onRestart: handleRestart,
        questions
      })
    );
  } else if (screen === 'stats') {
    content = React.createElement('main', { className: 'flex-1 flex items-center justify-center p-4 z-10' },
      React.createElement(StatsScreen, { 
        answers: storedAnswers,
        onRestart: handleRestart,
        questions: storedQuestions ? storedQuestions.questions : null
      })
    );
  } else {
    content = React.createElement('main', { className: 'flex-1 flex items-center justify-center p-4 z-10' },
      React.createElement('div', { className: 'setup-content' },
        React.createElement('div', { className: 'setup-container' },
          React.createElement('h2', { className: 'font-vt323 text-3xl text-center text-charcoal mb-2' }, 'READY TO START?'),
          React.createElement('p', { className: 'font-mono text-sm text-gray-600 mb-4 text-center' }, 
            'Use Config to load a JSON URL for your quiz.'
          ),
          storedQuestions && React.createElement('div', { className: 'existing-questions-banner' },
            React.createElement('span', null, `${storedQuestions.questions.length} questions loaded`),
            React.createElement('button', { 
              onClick: () => handleStartQuiz(storedQuestions),
              className: 'btn-primary'
            }, 'Start Quiz')
          ),
          !storedQuestions && React.createElement('div', { className: 'setup-actions' },
            React.createElement('button', { onClick: handleOpenConfig, className: 'btn-primary w-full' }, 'Open Config')
          ),
          hasStoredAnswers && React.createElement('div', { className: 'setup-actions' },
            React.createElement('button', { onClick: handleGoToStats, className: 'btn-ghost w-full' }, 'View Stats')
          )
        )
      )
    );
  }

  return React.createElement('div', { className: 'min-h-screen flex flex-col relative' },
    React.createElement(PolygonBackground),
    React.createElement(AppHeader, { onOpenConfig: handleOpenConfig, statusText }),
    content,
    React.createElement(ConfigPanel, { 
      isOpen: configOpen,
      onClose: handleCloseConfig,
      onStart: handleStartQuiz,
      onClear: handleClearStored,
      existingQuestions: storedQuestions
    })
  );
};

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    renderFatal('Missing #root element in index.html.');
    return;
  }

  const root = window.ReactDOM.createRoot(rootEl);
  root.render(React.createElement(App));
})();
