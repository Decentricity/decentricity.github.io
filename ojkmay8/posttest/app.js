const quizConfig = {
  formName: "Form B | Post-Test",
  questions: [
    {
      prompt: 'The COO says:\n"Operating expenses are rising faster than revenue. The board wants to know whether we should cut discretionary spend, adjust pricing, or focus only on high-margin customers."\n\nWhich analytics question is strongest for decision-making?',
      options: [
        "Which expense categories increased most this quarter, and how do they compare with the approved operating budget?",
        "Are operating expenses rising because of temporary growth investment, poor cost control, or an unfavorable customer mix?",
        "Which customer and cost segments are driving margin compression, and what threshold would support spend reduction, pricing adjustment, or customer-mix intervention?",
        "Can we create a dashboard showing revenue, operating expenses, customer mix, and margin trends for the board?"
      ],
      answer: 2
    },
    {
      prompt: "A dashboard shows that cash balance fell faster than expected in September. Treasury thinks collections were late. Sales says several large customers renewed on delayed payment terms. Operations says vendor prepayments increased due to annual contracts.\n\nWhat should the analyst do first?",
      options: [
        "Produce a 12-month cash runway forecast to determine whether the company risks breaching its minimum cash threshold.",
        "Validate cash movement categories, payment timing, receivables aging, and vendor prepayment entries, then segment the variance by customer and vendor type.",
        "Accept Treasury's explanation because collections timing is the most common cause of short-term cash variance.",
        "Report that cash fell due to delayed collections, delayed renewals, and vendor prepayments, with each factor requiring follow-up."
      ],
      answer: 1
    },
    {
      prompt: "A fraud-detection model flags a 35% increase in high-risk transactions from one channel. Operations wants to block the channel immediately; Growth warns that the channel is also the fastest-growing source of new customers.\n\nWhat is the best decision-oriented response?",
      options: [
        "Block the channel temporarily because fraud risk can create direct financial loss and reputational damage.",
        "Keep the channel open because growth impact is measurable, while the model only estimates risk.",
        "Validate model precision, false-positive rate, segment-level drivers, loss exposure, and customer value before recommending a targeted control or channel-wide block.",
        "Retrain the model before taking action because model-driven fraud decisions should not be made using current outputs alone."
      ],
      answer: 2
    },
    {
      prompt: "A team reports that Product X has the highest revenue growth, Product Y has the highest gross margin, and Product Z has the lowest churn. They recommend prioritizing Product X because growth is the board's main target.\n\nWhat is the key issue with this recommendation?",
      options: [
        "The recommendation selects one metric without showing the trade-off among growth, margin, retention, and strategic priority.",
        "Product Y should be prioritized because margin is usually more important than growth in financial decision-making.",
        "Product Z should be prioritized because low churn indicates stronger long-term customer value.",
        "The team should avoid recommending any product until a predictive model estimates future revenue for all three products."
      ],
      answer: 0
    },
    {
      prompt: "An analysis finds:\nEnterprise customers generate 70% of revenue but have slower sales cycles. SMB customers are growing faster but churn more often. A pricing change could improve SMB margin, but may increase churn. The next leadership decision is where to focus the Q4 sales push.\n\nWhich executive recommendation is strongest?",
      options: [
        "Focus the Q4 sales push on enterprise customers because they generate most revenue and have more stable retention.",
        "Focus on SMB customers because faster growth creates the best chance of meeting Q4 revenue targets.",
        "Run a segmented Q4 plan: protect enterprise renewals while piloting SMB pricing changes only in cohorts where margin upside exceeds churn-risk threshold.",
        "Delay the Q4 sales-focus decision until more data is collected on sales-cycle length, churn behavior, pricing sensitivity, and customer lifetime value."
      ],
      answer: 2
    }
  ]
};

const letters = ["A", "B", "C", "D"];
const form = document.querySelector("#quizForm");
const questionList = document.querySelector("#questionList");
const progressCount = document.querySelector("#progressCount");
const progressBar = document.querySelector("#progressBar");
const formMessage = document.querySelector("#formMessage");
const resultPanel = document.querySelector("#resultPanel");
const scoreLine = document.querySelector("#scoreLine");
const scoreDetail = document.querySelector("#scoreDetail");
const resetBtn = document.querySelector("#resetBtn");

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderQuiz() {
  quizConfig.questions.forEach((question, questionIndex) => {
    const card = makeElement("section", "question-card");
    card.dataset.questionIndex = String(questionIndex);

    const topline = makeElement("div", "question-topline");
    topline.append(
      makeElement("span", "question-number", String(questionIndex + 1)),
      makeElement("span", "question-status", "Required")
    );

    const prompt = makeElement("p", "question-prompt", question.prompt);
    const optionList = makeElement("div", "option-list");

    question.options.forEach((optionText, optionIndex) => {
      const label = makeElement("label", "option");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `question-${questionIndex}`;
      input.value = String(optionIndex);
      input.setAttribute("aria-label", `Question ${questionIndex + 1}, option ${letters[optionIndex]}`);

      label.append(
        input,
        makeElement("span", "option-letter", letters[optionIndex]),
        makeElement("span", "option-text", optionText)
      );
      optionList.append(label);
    });

    card.append(topline, prompt, optionList);
    questionList.append(card);
  });

  updateProgress();
}

function getSelectedAnswers() {
  return quizConfig.questions.map((_, index) => {
    const selected = form.querySelector(`input[name="question-${index}"]:checked`);
    return selected ? Number(selected.value) : null;
  });
}

function updateProgress() {
  const answered = getSelectedAnswers().filter((answer) => answer !== null).length;
  const total = quizConfig.questions.length;
  progressCount.textContent = `${answered}/${total}`;
  progressBar.style.width = `${(answered / total) * 100}%`;

  document.querySelectorAll(".question-card").forEach((card, index) => {
    const selected = form.querySelector(`input[name="question-${index}"]:checked`);
    card.classList.toggle("is-missing", false);
    const status = card.querySelector(".question-status");
    status.textContent = selected ? "Answered" : "Required";
  });
}

function showIncompleteState(answers) {
  formMessage.textContent = "Please answer all five questions before submitting.";
  const firstMissingIndex = answers.findIndex((answer) => answer === null);
  const firstMissingCard = document.querySelector(`[data-question-index="${firstMissingIndex}"]`);
  if (firstMissingCard) {
    firstMissingCard.classList.add("is-missing");
    firstMissingCard.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstInput = firstMissingCard.querySelector("input");
    if (firstInput) firstInput.focus({ preventScroll: true });
  }
}

function submitQuiz(event) {
  event.preventDefault();
  const answers = getSelectedAnswers();
  const missing = answers.some((answer) => answer === null);

  document.querySelectorAll(".question-card").forEach((card) => {
    card.classList.remove("is-missing");
  });

  if (missing) {
    showIncompleteState(answers);
    resultPanel.hidden = true;
    return;
  }

  formMessage.textContent = "";
  const score = answers.reduce((total, answer, index) => {
    return total + (answer === quizConfig.questions[index].answer ? 1 : 0);
  }, 0);

  scoreLine.textContent = `Score: ${score}/${quizConfig.questions.length}`;
  scoreDetail.textContent = `${quizConfig.formName} submitted. Individual answer review is not displayed on this page.`;
  resultPanel.hidden = false;
  resultPanel.focus({ preventScroll: true });
  resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function resetQuiz() {
  form.reset();
  formMessage.textContent = "";
  resultPanel.hidden = true;
  document.querySelectorAll(".question-card").forEach((card) => {
    card.classList.remove("is-missing");
  });
  updateProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

renderQuiz();
form.addEventListener("change", updateProgress);
form.addEventListener("submit", submitQuiz);
resetBtn.addEventListener("click", resetQuiz);

if (window.lucide) {
  window.lucide.createIcons();
}
