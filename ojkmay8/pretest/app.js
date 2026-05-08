const quizConfig = {
  formName: "Form A | Pre-Test",
  questions: [
    {
      prompt: 'The CFO says:\n"Cloud cost is 18% above budget after the product launch, gross margin is down 4 percentage points, and Product wants approval to expand the rollout next month."\n\nWhich analytics question is strongest for decision-making?',
      options: [
        "Did the product launch cause the cloud cost increase, and will margin return to normal if usage stabilizes next month?",
        "Which launch-cohort segments are driving the cloud cost increase and margin decline, and what threshold would justify expansion, repricing, optimization, or pausing the rollout?",
        "How much did actual cloud cost, revenue, and gross margin differ from budget this month, and which line item had the largest unfavorable variance?",
        "Which customer groups used the product most after launch, and does their usage indicate strong adoption relative to previous launches?"
      ],
      answer: 1
    },
    {
      prompt: "July revenue is $1.4M below budget. Sales says SMB churn caused the gap. Product says a billing defect delayed invoices. Finance says one enterprise invoice shifted into August.\n\nWhat is the best first analytical response?",
      options: [
        "Build a revenue forecast through year-end to determine whether the July shortfall will reverse naturally.",
        "Compare July variance by segment and customer cohort, then validate billing status, invoice timing, and revenue-recognition cutoffs before assigning cause.",
        "Prioritize churn analysis because Sales has the closest view of customer behavior and has already identified a plausible driver.",
        "Present all three explanations as contributing factors, then recommend further analysis before any corrective action."
      ],
      answer: 1
    },
    {
      prompt: "A credit-risk model shows that probability of default for one portfolio rose from 4.8% to 6.1% over two months. The Head of Risk asks whether underwriting policy should be tightened.\n\nWhich response best reflects responsible use of predictive analytics?",
      options: [
        "Tighten underwriting across the full portfolio because the model indicates rising risk and waiting may increase losses.",
        "Treat the score as an early warning; check model calibration, drift, feature drivers, affected segments, and whether the movement breaches the approved risk-appetite threshold.",
        "Do not change policy because probability of default is still below 10%, and a two-month increase may simply be noise.",
        "Build a more explainable model before taking any underwriting action, because the current model output is not sufficient for a regulated decision."
      ],
      answer: 1
    },
    {
      prompt: "Region A grew revenue by 12%, Region B by 4%, and Region C declined by 3%. The analytics team recommends shifting more sales budget to Region A.\n\nWhat is the most important weakness in that recommendation?",
      options: [
        "Revenue growth alone is not enough; the team should also compare margin, base size, customer mix, cost-to-serve, and whether the growth is sustainable.",
        "Region C may deserve more budget because a declining region often needs turnaround investment rather than reduced support.",
        "Region A's growth is probably seasonal, so the team should avoid using this result for budget allocation.",
        "Sales budget decisions require predictive modeling; descriptive analytics cannot justify resource allocation."
      ],
      answer: 0
    },
    {
      prompt: "An analysis finds:\nSMB churn explains 62% of a $1.4M July revenue miss. A targeted retention offer could recover an estimated $480k within 45 days, but it would reduce short-term margin. Cloud cost also rose 15% in the launch cohort, and launch-cohort profitability is not yet clear.\n\nWhich executive recommendation is strongest?",
      options: [
        "July revenue miss is primarily caused by SMB churn. We recommend further analysis of churn, retention cost, and cloud spend before deciding.",
        "Approve a 45-day targeted SMB retention offer, capped by margin-impact limits, while running a launch-cohort unit economics review before approving the next rollout expansion.",
        "Pause product rollout expansion and redirect budget to SMB retention because revenue recovery is more certain than usage growth.",
        "Delay both the retention offer and rollout decision until churn, cloud spend, and unit economics are fully modeled."
      ],
      answer: 1
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
