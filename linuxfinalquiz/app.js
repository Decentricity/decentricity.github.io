const quizData = [
  {
    question: "In Linux, what does /etc primarily store?",
    choices: ["User home directories", "Temporary files", "System-wide configuration files", "Installed source code"],
    answer: 2,
    explanation: "/etc contains host-specific system configuration, not user data or temporary runtime files."
  },
  {
    question: "Which command shows your current directory?",
    choices: ["whereami", "pwd", "cwd", "showdir"],
    answer: 1,
    explanation: "pwd prints the absolute path of your present working directory."
  },
  {
    question: "Which command updates the Ubuntu package index?",
    choices: ["apt install", "apt refresh", "apt update", "apt sync"],
    answer: 2,
    explanation: "apt update refreshes package metadata from configured repositories."
  },
  {
    question: "Which command upgrades installed packages after updating index metadata?",
    choices: ["apt upgrade", "apt rebuild", "apt patch", "apt scan"],
    answer: 0,
    explanation: "apt upgrade applies available package upgrades using the refreshed index."
  },
  {
    question: "What does sudo allow a regular user to do?",
    choices: ["Disable networking", "Run commands with elevated privileges", "Log in as root automatically forever", "Encrypt all files"],
    answer: 1,
    explanation: "sudo grants controlled elevated execution for specific commands."
  },
  {
    question: "Which command is used to list files in a directory?",
    choices: ["ls", "list", "dirshow", "lf"],
    answer: 0,
    explanation: "ls lists directory entries and supports many display flags."
  },
  {
    question: "Which symbol redirects standard output to overwrite a file?",
    choices: ["|", ">>", ">", "<"],
    answer: 2,
    explanation: "> writes stdout to a file, replacing previous contents."
  },
  {
    question: "Which command recursively searches for text inside files?",
    choices: ["cat", "grep -r", "echo", "touch"],
    answer: 1,
    explanation: "grep -r recursively scans directories for matching text patterns."
  },
  {
    question: "Why is pip usually recommended inside a virtual environment (venv)?",
    choices: ["It makes Python faster", "It avoids modifying system Python packages", "It enables root login", "It replaces apt"],
    answer: 1,
    explanation: "venv isolates dependencies so system Python and OS packages stay intact."
  },
  {
    question: "Which tool is Ubuntu's default package manager for .deb repositories?",
    choices: ["yum", "dnf", "apt", "pacman"],
    answer: 2,
    explanation: "apt is Ubuntu's native package management front-end for Debian packages."
  },
  {
    question: "Which command shows running processes in real time (interactive)?",
    choices: ["ps -ef", "jobs", "top", "uptime"],
    answer: 2,
    explanation: "top provides a live, updating view of CPU, memory, and processes."
  },
  {
    question: "What does chmod +x script.sh do?",
    choices: ["Deletes the script", "Adds execute permission", "Compresses the script", "Changes script owner"],
    answer: 1,
    explanation: "chmod +x sets executable permission bits so the script can be run directly."
  },
  {
    question: "What is the purpose of a shebang line like #!/bin/bash?",
    choices: ["Encrypt script contents", "Set file permissions", "Specify which interpreter should run the script", "Export environment variables"],
    answer: 2,
    explanation: "The shebang tells the kernel which interpreter to invoke for the script file."
  },
  {
    question: "If a script should be runnable from anywhere, what must be true?",
    choices: ["It must be in /tmp", "It must be in a directory listed in PATH (or called with full path)", "It must be owned by root", "It must be named run.sh"],
    answer: 1,
    explanation: "Shells find commands by searching PATH directories unless you provide an explicit path."
  },
  {
    question: "In shell scripting, what is an exit code of 0?",
    choices: ["Error", "Success", "Warning", "Timeout"],
    answer: 1,
    explanation: "By convention, 0 means success and non-zero indicates failure or specific conditions."
  },
  {
    question: "Which utility schedules recurring jobs on Linux?",
    choices: ["systemctl", "atd", "cron", "watchdog"],
    answer: 2,
    explanation: "cron runs periodic jobs defined in crontab schedules."
  },
  {
    question: "Which file format is used by Netplan for network configuration?",
    choices: ["JSON", "YAML", "XML", "INI"],
    answer: 1,
    explanation: "Netplan uses YAML configuration files under /etc/netplan/."
  },
  {
    question: "Which command securely copies files over SSH?",
    choices: ["ftp", "scp", "rsyncd", "telnet"],
    answer: 1,
    explanation: "scp uses SSH transport for encrypted file transfer between hosts."
  },
  {
    question: "Which is the best practice for SSH authentication?",
    choices: ["Root login with password", "Shared team password", "SSH keys, disable password auth where possible", "Open SSH to all networks with default config"],
    answer: 2,
    explanation: "SSH keys reduce brute-force risk and improve access control compared to passwords."
  },
  {
    question: "What is fail2ban mainly used for?",
    choices: ["DNS caching", "Automatic IP banning after repeated failed logins", "Firewall replacement for all traffic", "Disk encryption"],
    answer: 1,
    explanation: "fail2ban watches logs and blocks abusive IPs after suspicious repeated failures."
  },
  {
    question: "Which command changes file ownership?",
    choices: ["chmod", "chown", "usermod", "grpmod"],
    answer: 1,
    explanation: "chown modifies file owner and optionally group assignment."
  },
  {
    question: "Which permission mode gives owner full access, group read/execute, others no access?",
    choices: ["755", "700", "750", "744"],
    answer: 2,
    explanation: "750 maps to rwx for owner, r-x for group, --- for others."
  },
  {
    question: "What does systemctl enable nginx do?",
    choices: ["Starts nginx once", "Restarts nginx immediately", "Enables nginx to start at boot", "Reinstalls nginx"],
    answer: 2,
    explanation: "enable creates startup symlinks so the service starts automatically on boot."
  },
  {
    question: "Before reloading nginx after config changes, what command is best?",
    choices: ["nginx -t", "nginx -r", "systemctl check nginx", "nginx --reload-only"],
    answer: 0,
    explanation: "nginx -t validates configuration syntax before reload to avoid downtime from bad configs."
  },
  {
    question: "What is the main purpose of a virtual host in web servers?",
    choices: ["Increase CPU speed", "Host multiple sites on one server/IP", "Replace DNS", "Manage SSH users"],
    answer: 1,
    explanation: "Virtual hosts route different domains/sites to distinct configs on one host."
  },
  {
    question: "TLS primarily provides:",
    choices: ["Faster downloads only", "Command-line autocomplete", "Encrypted transport and server identity verification", "Disk backup automation"],
    answer: 2,
    explanation: "TLS protects data in transit and verifies server identity via certificates."
  },
  {
    question: "Which entry format is used for persistent mounts at boot?",
    choices: ["/etc/passwd", "/etc/fstab", "/etc/hosts", "/etc/mtab.conf"],
    answer: 1,
    explanation: "/etc/fstab defines filesystems and mount options applied at boot."
  },
  {
    question: "Which command is best for viewing systemd journal logs?",
    choices: ["tail", "dmesg", "journalctl", "logcat"],
    answer: 2,
    explanation: "journalctl queries and filters logs from systemd's journal."
  },
  {
    question: "In a pipeline like journalctl -u nginx | grep error | sort | uniq -c, what does the pipe | do?",
    choices: ["Runs commands in parallel only", "Sends output of one command as input to the next", "Saves output to a file", "Changes command priority"],
    answer: 1,
    explanation: "A pipe streams stdout from one command directly into stdin of the next command."
  },
  {
    question: "Which operational habit best improves long-term server stability?",
    choices: ["Avoid all updates", "Run everything as root for convenience", "Regular updates, backups, and least privilege", "Disable logging to save disk"],
    answer: 2,
    explanation: "Healthy ops combines patching, recoverability, and tight access control."
  }
];

const quizCard = document.getElementById("quizCard");
const resultCard = document.getElementById("resultCard");
const progressText = document.getElementById("progressText");
const meter = document.getElementById("meter");
const questionArea = document.getElementById("questionArea");
const nextBtn = document.getElementById("nextBtn");
const scoreText = document.getElementById("scoreText");
const percentText = document.getElementById("percentText");
const reviewList = document.getElementById("reviewList");
const restartBtn = document.getElementById("restartBtn");

let currentIndex = 0;
let selectedChoice = null;
let answers = [];

function renderQuestion() {
  const item = quizData[currentIndex];
  selectedChoice = null;
  nextBtn.disabled = true;

  progressText.textContent = `Question ${currentIndex + 1} of ${quizData.length}`;
  meter.style.width = `${(currentIndex / quizData.length) * 100}%`;

  const optionsHtml = item.choices
    .map(
      (choice, idx) =>
        `<button class="option" data-index="${idx}"><strong>${String.fromCharCode(65 + idx)}.</strong> ${choice}</button>`
    )
    .join("");

  questionArea.innerHTML = `
    <h2>${item.question}</h2>
    <div class="options">${optionsHtml}</div>
  `;

  const buttons = questionArea.querySelectorAll(".option");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (selectedChoice !== null) return;
      selectedChoice = Number(btn.dataset.index);
      answers[currentIndex] = selectedChoice;

      buttons.forEach((b) => b.classList.add("locked"));
      btn.classList.add("selected");

      nextBtn.disabled = false;
    });
  });
}

function showResults() {
  quizCard.classList.add("hidden");
  resultCard.classList.remove("hidden");

  const correctCount = answers.reduce((total, ans, idx) => total + (ans === quizData[idx].answer ? 1 : 0), 0);
  const pct = ((correctCount / quizData.length) * 100).toFixed(1);

  scoreText.textContent = `Score: ${correctCount} / ${quizData.length}`;
  percentText.textContent = `Percentage: ${pct}%`;

  reviewList.innerHTML = "";

  quizData.forEach((q, idx) => {
    const userAnswer = answers[idx];
    const isCorrect = userAnswer === q.answer;
    const el = document.createElement("article");
    el.className = `review-item ${isCorrect ? "correct" : "incorrect"}`;

    const status = isCorrect
      ? '<span class="badge ok">Correct</span>'
      : '<span class="badge bad">Incorrect</span>';

    el.innerHTML = `
      ${status}
      <h3>Q${idx + 1}. ${q.question}</h3>
      <p><strong>Your answer:</strong> ${String.fromCharCode(65 + userAnswer)}. ${q.choices[userAnswer]}</p>
      <p><strong>Correct answer:</strong> ${String.fromCharCode(65 + q.answer)}. ${q.choices[q.answer]}</p>
      <p><strong>Explanation:</strong> ${q.explanation}</p>
    `;

    reviewList.appendChild(el);
  });
}

nextBtn.addEventListener("click", () => {
  currentIndex += 1;
  if (currentIndex >= quizData.length) {
    meter.style.width = "100%";
    showResults();
    return;
  }

  renderQuestion();
});

restartBtn.addEventListener("click", () => {
  currentIndex = 0;
  answers = [];
  resultCard.classList.add("hidden");
  quizCard.classList.remove("hidden");
  renderQuestion();
});

// Discourage browser-back navigation during quiz flow.
window.history.pushState(null, "", window.location.href);
window.addEventListener("popstate", () => {
  window.history.pushState(null, "", window.location.href);
});

renderQuestion();
