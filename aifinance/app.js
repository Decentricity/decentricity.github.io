"use strict";

const compressedInstructorSlides = [
  {
    kicker: "AI Foundation for Finance",
    title: "Practical AI for finance teams",
    time: "2 days",
    thesis: "A hands-on course for using AI in finance data processing, analysis, reporting, forecasting, and governance.",
    tags: ["FP&A", "Accounting", "Audit", "Reporting"],
    keyLine: "AI can accelerate finance work, but finance remains responsible for evidence, judgment, and approval.",
    layout: "cards",
    points: [
      ["Course promise", "Participants leave with reusable templates, prompts, workflows, and a controlled first-pilot plan."],
      ["Operating model", "AI assists with preparation and drafting; humans validate source data, assumptions, and final outputs."],
      ["Tool stack", "Google Drive, Sheets, Docs, Colab, AI chat tools, and optional dashboard tools."],
      ["Final outcome", "A 30-60-90 day action plan for a practical finance AI pilot."]
    ],
    visual: {
      type: "flow",
      title: "Finance AI workflow",
      subtitle: "The core pattern repeated throughout the course.",
      badge: "Course Arc",
      steps: [
        ["Source data", "Reports, PDFs, sheets, invoices"],
        ["AI assist", "Clean, extract, summarize, forecast"],
        ["Finance review", "Check numbers, caveats, risks"],
        ["Approved output", "Dashboard, narrative, pilot plan"]
      ]
    },
    notes: {
      talk: [
        "Open with the practical positioning: this is not a coding bootcamp and not a generic AI productivity class.",
        "Emphasize that finance AI is useful only when outputs remain traceable to source data."
      ],
      demo: [
        "Show the shared Drive folder structure.",
        "Confirm participants can open Google Sheets, Google Docs, Google Colab, and an AI chat tool."
      ]
    }
  },
  {
    kicker: "Learning Outcomes",
    title: "What participants should be able to do",
    time: "Opening",
    thesis: "Every session produces a concrete artifact that can be reused after class.",
    tags: ["Artifacts", "Practice", "Controls"],
    keyLine: "The course is successful when participants can run a narrow AI-assisted workflow and explain how it is controlled.",
    layout: "list",
    points: [
      ["Explain AI in finance terms", "Automation, analytics, machine learning, generative AI, and human-in-the-loop review."],
      ["Match problem to model", "Classification, regression, clustering, anomaly detection, and generative AI."],
      ["Prepare finance data", "Clean messy spreadsheets and extract structured fields from PDFs or unstructured text."],
      ["Create analysis and reporting outputs", "Ratios, variances, dashboards, executive summaries, and scenario narratives."],
      ["Apply governance", "Document prompts, sources, assumptions, reviewers, approval, and audit evidence."]
    ],
    visual: {
      type: "checklist",
      title: "Participant evidence",
      subtitle: "Outputs collected across the two days.",
      badge: "Assessment",
      items: [
        "AI opportunity map",
        "Cleaned dataset",
        "Extraction table",
        "Variance analysis",
        "Dashboard commentary",
        "Prompt library",
        "Scenario forecast",
        "Governance checklist",
        "30-60-90 action plan"
      ]
    },
    notes: {
      talk: [
        "Use this slide to make the course concrete. Participants should know exactly what they will produce.",
        "Frame the outputs as templates for internal pilots, not as polished production systems."
      ]
    }
  },
  {
    kicker: "Trainer Setup",
    title: "Prepare the classroom like a finance pilot",
    time: "Before class",
    thesis: "The course works best when every lab has a clean input, a fallback file, and a clear review point.",
    tags: ["Drive", "Sheets", "Colab", "Fallbacks"],
    keyLine: "A finance AI class should model the same discipline expected from a finance AI workflow.",
    layout: "cards",
    points: [
      ["Seven days before", "Create the Drive folder, templates, notebooks, sample data, prompt docs, and governance checklists."],
      ["Two days before", "Test permissions, formulas, charts, notebook restarts, PDF extraction, and fallback CSVs."],
      ["Morning of class", "Open required tabs, run the first Colab setup cell, check projector zoom, and keep local copies."],
      ["Data rule", "Use sanitized or synthetic sample data only; never ask participants to upload sensitive company data."]
    ],
    visual: {
      type: "docs",
      title: "Shared Drive structure",
      subtitle: "Keep each participant output in a predictable place.",
      badge: "Setup",
      docs: [
        ["00", "Course Guide", "Agenda, objectives, participant setup"],
        ["01", "Sample Data", "Financial statements, budget data, messy transactions"],
        ["02", "Sheets Templates", "Cleaning, ratios, dashboard, forecasting"],
        ["03", "Colab Notebooks", "PDF extraction, trends, anomaly, forecasting"],
        ["04", "Prompt Templates", "Analysis, commentary, validation prompts"],
        ["05", "Governance", "Review checklist and audit evidence"]
      ]
    },
    notes: {
      talk: [
        "If this deck is used for trainer preparation, spend time on fallbacks. Colab package installs and PDF extraction can fail in live rooms.",
        "The setup itself teaches governance: source data, workflow version, output folder, review notes."
      ]
    }
  },
  {
    kicker: "Day 1",
    title: "Foundations, data processing, and analysis",
    time: "09:00-17:00",
    thesis: "Day 1 moves from finance AI concepts into cleaned data, extracted tables, ratios, variances, and dashboards.",
    tags: ["Concepts", "Data", "Analysis", "Dashboards"],
    keyLine: "Before AI can write useful finance commentary, the underlying data must be clean, structured, and reviewed.",
    layout: "list",
    points: [
      ["09:00-10:30", "Opening and what AI means in practical finance terms."],
      ["10:45-12:00", "Types of AI models: classification, regression, clustering, anomaly detection, and generative AI."],
      ["13:00-14:00", "Responsible AI in financial reporting."],
      ["14:00-15:30", "Hands-on data cleaning, PDF extraction, and LLM-assisted extraction."],
      ["15:45-17:00", "Financial statement analysis and dashboarding."]
    ],
    visual: {
      type: "timeline",
      title: "Day 1 run sheet",
      subtitle: "Keep concept blocks short and labs concrete.",
      badge: "Agenda",
      items: [
        ["09:00", "Open", "Access, objectives, participant workflows"],
        ["09:30", "AI in finance", "Opportunity mapping"],
        ["10:45", "Model types", "Finance problem matching"],
        ["13:00", "Responsible AI", "Risk review checklist"],
        ["14:00", "Data processing", "Three labs: cleaning, PDF, LLM extraction"],
        ["15:45", "Analysis", "Ratios, variance, dashboard"]
      ]
    },
    notes: {
      talk: [
        "Day 1 is about building trust in the inputs and the analysis process.",
        "Keep returning to one question: what would finance need to verify before using this output?"
      ]
    }
  },
  {
    kicker: "Session 1",
    title: "Map AI opportunities in finance work",
    time: "09:30-10:30",
    thesis: "Participants classify their current workflows by repetition, data intensity, judgment, reporting load, and AI suitability.",
    tags: ["Opportunity Map", "Workflow", "Quick Wins"],
    keyLine: "The best first AI pilot is narrow, repetitive, reviewable, and useful even before full automation.",
    layout: "cards",
    points: [
      ["Define the terms", "Automation executes rules; analytics explains data; ML predicts or classifies; generative AI drafts language."],
      ["List finance workflows", "Monthly close, budget vs actual, invoice review, cash flow projection, board reports, vendor checks."],
      ["Tag each step", "Repetitive, data-heavy, judgment-based, reporting-heavy, suitable for AI, or unsuitable for AI."],
      ["Choose candidates", "Mark one quick win and one high-risk use case that needs stricter controls."]
    ],
    visual: {
      type: "matrix",
      title: "Opportunity map",
      subtitle: "A simple way to separate assistance from approval.",
      badge: "Exercise",
      rows: [
        ["Monthly reporting pack", "AI drafts first commentary", "Manager validates sources"],
        ["Invoice review", "AI extracts fields", "AP checks exceptions"],
        ["Cash flow projection", "AI suggests scenarios", "Treasury owns assumptions"],
        ["Board report", "AI creates draft summary", "CFO approves final language"]
      ]
    },
    notes: {
      talk: [
        "Encourage participants to start with their own work, not with the tools.",
        "Push back on vague use cases. The workflow step should be specific enough to assign a reviewer."
      ],
      activity: [
        "Ask each participant to list three workflows.",
        "For each workflow, mark one AI-assisted step and one control point.",
        "Close with two shared examples from the room."
      ]
    }
  },
  {
    kicker: "Session 2",
    title: "Match finance problems to AI model types",
    time: "10:45-12:00",
    thesis: "Generative AI is only one part of the toolkit; finance use cases often need prediction, classification, grouping, or anomaly detection.",
    tags: ["Classification", "Regression", "Anomaly", "Generative AI"],
    keyLine: "A good finance AI design starts by asking what kind of answer the workflow needs.",
    layout: "cards",
    points: [
      ["Classification", "Categorize transactions, receivables, expense claims, or risk flags."],
      ["Regression", "Predict numbers such as revenue, expenses, cash flow, and working capital."],
      ["Anomaly detection", "Flag unusual vendor payments, cost-center movements, or account changes."],
      ["Generative AI", "Draft summaries, variance commentary, board updates, and follow-up questions."]
    ],
    visual: {
      type: "docs",
      title: "Problem to model",
      subtitle: "Examples participants should be able to classify.",
      badge: "Worksheet",
      docs: [
        ["R", "Predict next quarter revenue", "Regression or time-series forecasting"],
        ["C", "Identify suspicious expense claims", "Classification or anomaly detection"],
        ["G", "Summarize monthly performance", "Generative AI"],
        ["K", "Group customers by payment behavior", "Clustering"],
        ["A", "Detect unusual vendor payments", "Anomaly detection"]
      ]
    },
    notes: {
      talk: [
        "Stress that the model choice determines the validation method.",
        "For optional Colab, show loading a CSV, training a tiny model, reading predictions, and explaining why results should not be trusted blindly."
      ],
      activity: [
        "Give participants the model matching worksheet.",
        "Review answers out loud and ask for the validation question for each model type."
      ]
    }
  },
  {
    kicker: "Session 3",
    title: "Responsible AI in financial reporting",
    time: "13:00-14:00",
    thesis: "Finance AI needs stronger controls because wrong numbers, unsupported claims, and confidentiality failures can create real reporting risk.",
    tags: ["Accuracy", "Privacy", "Explainability", "Approval"],
    keyLine: "The safest finance AI output is one that clearly shows what is fact, what is assumption, and what needs confirmation.",
    layout: "cards",
    points: [
      ["Accuracy risk", "Wrong numbers, wrong direction, wrong period, or unsupported interpretation."],
      ["Transparency", "The source data, prompt, assumptions, and output version must be recoverable."],
      ["Confidentiality", "Sensitive financial data should not be pasted into public tools without approval."],
      ["Approval", "AI can draft, but accountable finance roles approve final reporting."]
    ],
    visual: {
      type: "risk",
      title: "AI output risk review",
      subtitle: "Mark every AI statement before it enters a finance report.",
      badge: "Control",
      risks: [
        ["Correct statement", "Tie it to a source cell, PDF line, or report table."],
        ["Unsupported claim", "Remove or rewrite as a follow-up question."],
        ["Missing assumption", "Add the driver, period, method, and caveat."],
        ["Sensitive data", "Mask, sanitize, or use approved tools only."],
        ["Hallucination", "Flag as not supported by source data."],
        ["Approval required", "Assign reviewer and final approval owner."]
      ]
    },
    notes: {
      talk: [
        "Use a flawed AI commentary example. Some mistakes should be subtle so participants practice careful reading.",
        "Build the shared checklist live from participant observations."
      ],
      activity: [
        "Groups annotate an AI-generated finance paragraph.",
        "Each group presents one issue and one control."
      ]
    }
  },
  {
    kicker: "Session 4 Lab 1",
    title: "Cleaning messy finance data",
    time: "14:00-14:35",
    thesis: "AI can suggest cleaning formulas, but finance users still reconcile totals and document assumptions.",
    tags: ["Sheets", "Data Quality", "Reconciliation"],
    keyLine: "Never overwrite the raw data; create clean fields, exception flags, and assumption notes.",
    layout: "cards",
    points: [
      ["Inspect first", "Identify inconsistent dates, duplicates, missing values, currency formats, vendor spelling, and unclear cost centers."],
      ["Create clean fields", "Clean date, clean vendor, numeric amount, standard account, standard cost center, issue flag, assumption note."],
      ["Use AI carefully", "Ask for formula suggestions, then review before applying."],
      ["Reconcile", "Compare raw total to cleaned total and explain differences."]
    ],
    visual: {
      type: "cleaning",
      title: "Data cleaning pipeline",
      subtitle: "Raw rows remain intact while clean columns feed reporting.",
      badge: "Live Demo"
    },
    notes: {
      demo: [
        "Open messy_transactions.csv in Google Sheets.",
        "Ask the room to identify visible issues before using AI.",
        "Create clean_date, clean_vendor, amount_numeric, account_standard, cost_center_standard, issue_flag, and assumption_note columns.",
        "Ask AI for Google Sheets formula suggestions.",
        "Apply reviewed formulas and mapping tables.",
        "Filter rows with issue flags.",
        "Create a cleaned output tab.",
        "Reconcile raw and cleaned totals."
      ],
      prompt: [
        "Act as a finance data quality analyst. I have a Google Sheets transaction table with inconsistent dates, vendor names, account names, cost centers, currencies, and amount formats. Suggest practical Google Sheets formulas to create clean_date, clean_vendor, amount_numeric, account_standard, duplicate_flag, issue_flag, and assumption_note columns. Do not change source data. Include validation checks I should perform before using the cleaned data for reporting."
      ]
    }
  },
  {
    kicker: "Session 4 Lab 2",
    title: "PDF and invoice extraction",
    time: "14:35-15:05",
    thesis: "PDF extraction is useful only when extracted fields are reconciled back to the original document.",
    tags: ["Colab", "PDF", "OCR", "CSV"],
    keyLine: "Original PDF, extracted text, structured table, and review status all belong in the evidence trail.",
    layout: "cards",
    points: [
      ["Open source", "Show the PDF and identify the fields participants should care about."],
      ["Run notebook", "Upload PDF, extract text, structure fields, export CSV, and open in Sheets."],
      ["Review quality", "Look for line break errors, missing table boundaries, OCR mistakes, labels, and currency symbols."],
      ["Mark status", "Each field is verified, needs review, or not found."]
    ],
    visual: {
      type: "flow",
      title: "PDF extraction flow",
      subtitle: "Keep source evidence next to the structured output.",
      badge: "Live Demo",
      steps: [
        ["PDF", "Invoice or annual report excerpt"],
        ["Text extraction", "Colab notebook or OCR fallback"],
        ["Structured fields", "Table with source quotes and confidence"],
        ["Sheets output", "CSV reviewed by finance"]
      ]
    },
    notes: {
      demo: [
        "Open sample_invoice.pdf or sample_annual_report_excerpt.pdf.",
        "Check whether the PDF is text-based or scanned.",
        "Run the Colab setup cell.",
        "Upload the PDF and run extraction.",
        "Preview extracted text and discuss extraction problems.",
        "Run structuring cell and export CSV.",
        "Open CSV in Sheets and reconcile fields to the PDF.",
        "Use fallback text or CSV if Colab package installation fails."
      ]
    }
  },
  {
    kicker: "Session 4 Lab 3",
    title: "LLM-assisted extraction from financial text",
    time: "15:05-15:30",
    thesis: "Participants use an AI chat tool to extract structured finance fields from unstructured text, then compare every field against the source.",
    tags: ["AI Chat", "Docs", "Extraction", "Validation"],
    keyLine: "The LLM output is a proposed extraction table, not a source of truth.",
    layout: "cards",
    points: [
      ["Start with text", "Use a short financial text excerpt, not a full confidential report."],
      ["Extract fields", "Company, reporting period, revenue, gross profit, net income, key variance, explanation, and risks."],
      ["Require evidence", "Ask for source quote, confidence, and review_needed for each extracted field."],
      ["Compare to source", "Mark correct fields, missing fields, unsupported values, and statements requiring review."]
    ],
    visual: {
      type: "docs",
      title: "LLM extraction table",
      subtitle: "Every extracted field needs source evidence.",
      badge: "Lab 3",
      docs: [
        ["CO", "Company name", "must appear in source text"],
        ["PER", "Reporting period", "date or period copied exactly"],
        ["REV", "Revenue", "number, unit, and currency checked"],
        ["NI", "Net income", "no inferred value if missing"],
        ["VAR", "Key variance", "source-backed movement only"],
        ["RISK", "Risks mentioned", "not found if not explicit"]
      ]
    },
    notes: {
      demo: [
        "Open the short financial text excerpt.",
        "Paste the excerpt into an AI chat tool with the extraction prompt.",
        "Ask for a table with field_name, extracted_value, source_quote, confidence, and review_needed.",
        "Copy the output into Google Docs or Google Sheets.",
        "Compare each extracted field against the source text.",
        "Mark unsupported values, missing fields, and fields requiring human review.",
        "Discuss why this differs from PDF extraction: the LLM structures language, but finance validates evidence."
      ],
      prompt: [
        "Extract structured finance fields from the text below. Use only the source text. Return a table with field_name, extracted_value, source_quote, confidence, and review_needed. If a field is missing, write \"not found.\" Do not infer values that are not explicitly present."
      ]
    }
  },
  {
    kicker: "Session 5",
    title: "From financial statements to insight",
    time: "15:45-16:25",
    thesis: "Participants calculate ratios and variances, then use AI to draft initial commentary that remains grounded in the numbers.",
    tags: ["Ratios", "Variance", "Materiality"],
    keyLine: "AI commentary is only useful when every sentence can be traced to a source value or marked for confirmation.",
    layout: "cards",
    points: [
      ["Calculate", "Gross margin, operating margin, net profit margin, current ratio, debt-to-equity, and cash flow movement."],
      ["Compare", "Revenue growth, expense growth, budget variance, and prior-period variance."],
      ["Prioritize", "Apply a materiality threshold before asking for commentary."],
      ["Validate", "Separate factual observations, possible explanations, follow-up questions, and numbers requiring verification."]
    ],
    visual: {
      type: "metrics",
      title: "Finance analysis board",
      subtitle: "Ratios and variances before narrative.",
      badge: "Analysis",
      metrics: [
        ["Revenue", "+8.4%", "Current vs prior period"],
        ["Gross margin", "42.1%", "Down 1.7 pts"],
        ["Opex", "+12.6%", "Above budget"],
        ["Current ratio", "1.8x", "Stable liquidity"],
        ["Cash flow", "-6.2%", "Collection timing risk"],
        ["Net income", "+3.1%", "Requires explanation"]
      ]
    },
    notes: {
      talk: [
        "Keep the data table compact when pasting into AI.",
        "Ask participants to trace one AI-generated statement back to a source cell."
      ],
      prompt: [
        "Act as an FP&A analyst supporting the CFO. Analyze the financial statement and variance table below. Use only the provided data. Identify the top five material movements. Separate factual observations, possible explanations, follow-up questions, and numbers requiring verification. Do not invent causes. If the data does not explain a cause, write \"requires management confirmation.\""
      ]
    }
  },
  {
    kicker: "Session 5 Demo",
    title: "From numbers to CFO commentary",
    time: "15:45-16:25",
    thesis: "A strong prompt forces AI to distinguish facts from possible explanations and unanswered management questions.",
    tags: ["Prompt", "CFO Summary", "Review"],
    keyLine: "The phrase \"requires management confirmation\" is a control, not a weakness.",
    layout: "cards",
    points: [
      ["Copy compact table", "Include current, prior, budget, absolute variance, percentage variance, and materiality flag."],
      ["Prompt with constraints", "Use only provided data; separate observations, explanations, follow-up questions, and verification items."],
      ["Review line by line", "Check number, period, variance direction, supported cause, and follow-up question."],
      ["Finalize", "Copy only reviewed commentary into the finance narrative."]
    ],
    visual: {
      type: "narrative",
      title: "Commentary review path",
      subtitle: "Draft language is not final finance language.",
      badge: "Live Demo"
    },
    notes: {
      demo: [
        "Open financial_statement_analysis_template.gsheet.",
        "Calculate or reveal ratios and variance formulas.",
        "Set a materiality threshold.",
        "Sort or filter to top movements.",
        "Paste a compact table into AI.",
        "Review the AI response line by line.",
        "Rewrite unsupported claims into reviewable language.",
        "Add source references such as tab and row."
      ]
    }
  },
  {
    kicker: "Session 6",
    title: "Dashboard insights without decorative charts",
    time: "16:25-17:00",
    thesis: "Finance dashboards should answer management questions with simple metrics, clear comparisons, and validated commentary.",
    tags: ["Dashboard", "KPI", "Charts"],
    keyLine: "If management cannot act on a chart, the chart probably does not belong in the dashboard.",
    layout: "cards",
    points: [
      ["Design from questions", "Revenue trend, expense movement, margin, budget variance, top costs, and cash position."],
      ["Build simple visuals", "Pivot tables, line charts, bar charts, and KPI cards."],
      ["Ask AI for commentary", "Use dashboard summary tables, not screenshots."],
      ["Remove noise", "Identify which chart supports a decision and which chart is unnecessary."]
    ],
    visual: {
      type: "dashboard",
      title: "Management dashboard mockup",
      subtitle: "Data first, chart second, commentary last.",
      badge: "Sheets"
    },
    notes: {
      demo: [
        "Open dashboard_template.gsheet.",
        "Create or reveal pivot tables for revenue, expense, margin, variance, top costs, and cash.",
        "Create line, bar, and KPI visuals.",
        "Copy a dashboard summary table into AI.",
        "Validate AI-generated chart commentary against the dashboard."
      ],
      prompt: [
        "Act as a finance manager preparing dashboard commentary. Use only the dashboard summary table below. Write three concise management insights, two risks to monitor, and three follow-up questions. Do not describe chart design. Do not invent causes. Mention only movements supported by the table."
      ]
    }
  },
  {
    kicker: "Day 2",
    title: "Narrative, forecasting, workflow, and governance",
    time: "09:00-17:00",
    thesis: "Day 2 turns analysis into reviewed finance narratives, prompt libraries, scenario models, workflow redesigns, and pilot governance.",
    tags: ["Narrative", "Forecast", "Workflow", "Controls"],
    keyLine: "A useful AI pilot connects the numbers, the words, the workflow, and the control evidence.",
    layout: "list",
    points: [
      ["09:00-10:45", "Recap and generative AI for narrative reporting."],
      ["11:00-12:00", "Prompt engineering for finance accuracy."],
      ["13:00-14:30", "Scenario planning and forecasting."],
      ["14:30-15:30", "Integrating AI into FP&A workflows."],
      ["15:45-17:00", "Audit, governance, controls, and 30-60-90 action plans."]
    ],
    visual: {
      type: "timeline",
      title: "Day 2 run sheet",
      subtitle: "Move from individual outputs to an internal pilot plan.",
      badge: "Agenda",
      items: [
        ["09:00", "Recap", "Use case, risk, control"],
        ["09:30", "Narrative", "Executive summary and validation"],
        ["11:00", "Prompting", "Reusable finance prompt library"],
        ["13:00", "Forecasting", "Base, upside, downside"],
        ["14:30", "Workflow", "Monthly reporting redesign"],
        ["15:45", "Governance", "Audit-ready checklist and action plan"]
      ]
    },
    notes: {
      talk: [
        "Start Day 2 by asking participants to name one useful AI output and one control from Day 1.",
        "Day 2 should feel like integration, not a separate topic."
      ]
    }
  },
  {
    kicker: "Sessions 7-8",
    title: "Narrative reporting and finance prompts",
    time: "09:30-12:00",
    thesis: "Generative AI can draft executive summaries and variance commentary when prompts specify source data, constraints, structure, and caveats.",
    tags: ["Executive Summary", "Prompt Library", "Validation"],
    keyLine: "A finance prompt should make unsupported explanations difficult to write and easy to detect.",
    layout: "cards",
    points: [
      ["Narrative outputs", "CFO summary, monthly variance commentary, board update, MD&A-style draft, and follow-up actions."],
      ["Audience control", "Adjust level of detail for CFO, board, business heads, investors, or audit."],
      ["Prompt framework", "Role, task, source data, output format, constraints, accuracy rules, caveats, and questions."],
      ["Validation", "Mark correct statements, unsupported assumptions, missing risks, misleading wording, and numbers to verify."]
    ],
    visual: {
      type: "prompt",
      title: "Finance prompt framework",
      subtitle: "Reusable prompt parts for controlled outputs.",
      badge: "Prompting",
      tokens: ["Role", "Task", "Source data", "Output format", "Constraints", "Accuracy rules", "Caveats", "Questions"]
    },
    notes: {
      activity: [
        "Participants create prompt templates for monthly summary, budget variance, revenue movement, cost increase, cash flow risk, board report, audit review, and forecast assumption review.",
        "Ask each participant to test one prompt and revise it after seeing the output."
      ],
      prompt: [
        "Act as a finance analyst supporting the CFO. Analyze the table below. Use only the provided data. Create a management summary with five sections: key movements, favorable variances, unfavorable variances, risks, and follow-up questions. Do not invent explanations. Separate facts from possible interpretations. Flag any number that appears inconsistent."
      ]
    }
  },
  {
    kicker: "Session 9",
    title: "Scenario planning and forecasting",
    time: "13:00-14:30",
    thesis: "Participants build base, upside, and downside cases, then use AI to convert scenario outputs into management language.",
    tags: ["Forecast", "Scenario", "Sensitivity"],
    keyLine: "A forecast narrative should explain assumptions and implications, not pretend the future is known.",
    layout: "cards",
    points: [
      ["Build assumptions", "Revenue growth, expense inflation, gross margin, collection delay, FX, interest rate, and demand shock."],
      ["Create scenarios", "Base case, upside case, and downside case using transparent spreadsheet formulas."],
      ["Test sensitivity", "Change one driver and observe revenue, expense, margin, and cash flow impact."],
      ["Draft narrative", "Ask AI to compare scenarios and list assumptions management must validate."]
    ],
    visual: {
      type: "scenario",
      title: "Three-scenario forecast",
      subtitle: "Show the effect of assumptions before writing the story.",
      badge: "Forecast"
    },
    notes: {
      demo: [
        "Open scenario_forecasting_template.gsheet.",
        "Inspect historical monthly revenue, expenses, and cash flow.",
        "Build or reveal an assumption table.",
        "Create base, upside, and downside formulas.",
        "Adjust one assumption and observe the scenario output.",
        "Optional: run Colab forecasting notebook and export CSV."
      ],
      prompt: [
        "Act as an FP&A manager. Using only the scenario table below, draft a management discussion comparing base case, upside case, and downside case. Explain business implications for revenue, expense, margin, and cash flow. Do not recommend decisions beyond the data. List assumptions management must validate and risks that require monitoring."
      ]
    }
  },
  {
    kicker: "Session 10",
    title: "Integrate AI into FP&A workflows",
    time: "14:30-15:30",
    thesis: "Workflow redesign shows where AI assists, where humans review, and which controls protect the final report.",
    tags: ["Process", "Human Review", "Pilot"],
    keyLine: "Do not add AI to a broken process without deciding who reviews the output and who approves the final report.",
    layout: "cards",
    points: [
      ["Choose a workflow", "Monthly management report, budget vs actual, cash flow forecast, board pack, consolidation, or vendor expense review."],
      ["Map current state", "Data input, validation, consolidation, analysis, commentary, review, and final approval."],
      ["Add AI assistance", "Use AI where work is repetitive, data-heavy, or drafting-heavy."],
      ["Add controls", "Human review, risk, control, evidence, and final approval."]
    ],
    visual: {
      type: "workflow",
      title: "Four-layer workflow redesign",
      subtitle: "AI support sits between source data and accountable approval.",
      badge: "FP&A",
      steps: [
        ["Data input", "Templates, source files, data owner"],
        ["AI processing", "Extraction, cleaning, flags, first draft"],
        ["Human review", "Completeness, numbers, assumptions, caveats"],
        ["Final reporting", "Approved dashboard, deck, memo, or report"]
      ]
    },
    notes: {
      activity: [
        "Groups choose one finance workflow.",
        "Document current process, AI assistance, human review needed, risk, and control.",
        "Ask each group to identify one pilot that can be tested in 30 days."
      ]
    }
  },
  {
    kicker: "Session 11",
    title: "Audit-ready AI governance",
    time: "15:45-16:30",
    thesis: "A minimum viable governance checklist makes AI-assisted finance work explainable, reviewable, and defensible.",
    tags: ["Audit", "Evidence", "Approval"],
    keyLine: "Governance is the evidence trail that proves AI did not silently become the approver.",
    layout: "cards",
    points: [
      ["Record inputs", "Data source, data owner, confidentiality level, and original files."],
      ["Record workflow", "AI tool used, prompt or workflow version, output version, and known limitations."],
      ["Record review", "Reviewer, approval authority, error-checking method, exceptions, and escalation."],
      ["Retain evidence", "Source data, prompt, raw AI output, review notes, and final approved output."]
    ],
    visual: {
      type: "checklist",
      title: "Minimum viable control checklist",
      subtitle: "Use this for one AI-assisted finance workflow.",
      badge: "Governance",
      items: [
        "Data source and owner",
        "AI tool and prompt version",
        "Output reviewer",
        "Approval authority",
        "Confidentiality level",
        "Error-checking method",
        "Audit evidence",
        "Retention policy",
        "Known limitations",
        "Escalation process"
      ]
    },
    notes: {
      demo: [
        "Open an AI-generated variance commentary.",
        "Open the source data behind it.",
        "Ask what could go wrong if the commentary were sent without review.",
        "Fill the AI governance checklist.",
        "Attach source data, prompt, raw AI output, reviewed final output, and reviewer notes.",
        "Assign final approval to the finance manager or CFO role."
      ]
    }
  },
  {
    kicker: "Session 12",
    title: "30-60-90 day action plan",
    time: "16:30-17:00",
    thesis: "Participants leave with one controlled finance AI pilot that is narrow enough to run and useful enough to matter.",
    tags: ["Pilot", "Roadmap", "Ownership"],
    keyLine: "The first pilot should be narrow, measurable, reviewable, and based on data the team is allowed to use.",
    layout: "list",
    points: [
      ["Choose one workflow", "Define the business problem, data sources, tools or methods, benefits, risks, stakeholders, and controls."],
      ["First 30 days", "Prepare sanitized data, assign owner, build template, define review checklist, and run a small test."],
      ["60-day milestone", "Pilot with a controlled reporting cycle and compare quality, time, and review findings."],
      ["90-day target", "Decide whether to expand, revise controls, automate more steps, or stop the pilot."],
      ["Close", "Ask every participant to state their first 30-day action in one sentence."]
    ],
    visual: {
      type: "action",
      title: "Participant roadmap",
      subtitle: "A practical path from class output to internal pilot.",
      badge: "Next Steps"
    },
    notes: {
      talk: [
        "Close by reinforcing that a failed but well-documented pilot is better than a flashy uncontrolled demo.",
        "The first pilot should avoid direct automatic posting to official financial reports."
      ],
      activity: [
        "Participants complete the 30-60-90 Day Action Plan Template.",
        "Volunteers share one plan and one control."
      ]
    }
  }
];

const slides = buildStudentFacingSlides();

function S(session, time, title, thesis, points, tags = [], visualType = "docs", keyLine = "", activity = "", prompt = "") {
  return { session, time, title, thesis, points, tags, visualType, keyLine, activity, prompt };
}

function buildStudentFacingSlides() {
  const dayOne = [
    S("Opening", "09:00", "Welcome to AI Foundation for Finance", "This class is about using AI for real finance work without losing accuracy, evidence, or control.", [["Your role", "You will act as a finance user, reviewer, and approver."], ["The course style", "Short concepts, live examples, guided labs, and finance review."], ["The standard", "Every useful AI output must connect back to source data."], ["The outcome", "You leave with templates, prompts, workflows, and a pilot plan."]], ["Orientation", "Finance AI"], "flow"),
    S("Opening", "09:05", "How the two days will work", "We will build from simple ideas to practical workflows you can repeat after class.", [["Day 1", "Foundations, data processing, financial analysis, and dashboards."], ["Day 2", "Narrative reporting, prompting, forecasting, workflow integration, and governance."], ["Every session", "One concept block, one finance example, and one reusable output."], ["Your outputs", "Save your work in the shared participant output folder."]], ["Agenda", "Outputs"], "timeline"),
    S("Opening", "09:10", "What you will build", "The course is practical, so every major concept ends in a finance artifact.", [["Opportunity map", "Identify where AI can assist your finance workflows."], ["Cleaned dataset", "Prepare messy transactions for analysis and reporting."], ["Finance analysis", "Calculate ratios, variances, commentary, and follow-up questions."], ["Action plan", "Design a controlled 30-60-90 day AI pilot."]], ["Artifacts", "Practice"], "checklist"),
    S("Opening", "09:15", "Tools you will use", "The tools are intentionally accessible so the focus stays on finance judgment, not software setup.", [["Google Drive", "Shared course files, templates, and participant outputs."], ["Google Sheets", "Cleaning, formulas, variance analysis, dashboards, and forecasting."], ["Google Colab", "Guided notebooks with prepared code cells."], ["AI chat tool", "Prompting, summarization, extraction, and commentary drafts."]], ["Tools", "Setup"], "docs"),
    S("Opening", "09:20", "Finance safety rule", "Use sanitized data in class and treat confidentiality as a default requirement.", [["Do not upload secrets", "Avoid real confidential financial data in public AI tools."], ["Use sample data", "All exercises use provided or anonymized data."], ["Save evidence", "Keep source files, prompts, outputs, and review notes."], ["Human approval", "AI never becomes the final approver."]], ["Safety", "Governance"], "risk"),

    S("Session 1", "09:30", "AI in plain finance language", "AI is a set of tools that can help finance teams classify, predict, detect, summarize, and draft.", [["Classify", "Sort transactions, claims, or receivables into useful categories."], ["Predict", "Estimate future numbers such as revenue, expenses, or cash flow."], ["Detect", "Flag unusual movements or patterns for review."], ["Draft", "Turn verified numbers into first-pass business language."]], ["Foundations", "Finance"], "flow"),
    S("Session 1", "09:36", "Automation, analytics, ML, and generative AI", "These terms are related, but they solve different finance problems.", [["Automation", "Follows explicit rules, such as moving files or applying formulas."], ["Analytics", "Explains what happened using calculations and dashboards."], ["Machine learning", "Learns patterns from data to classify, predict, or flag."], ["Generative AI", "Produces text, summaries, structures, and drafts."]], ["Definitions"], "matrix"),
    S("Session 1", "09:42", "Why finance is a strong AI use case", "Finance work has repeatable data flows, frequent reporting cycles, and high value from faster review.", [["Repetition", "Monthly close, budget reports, invoice checks, and board packs repeat."], ["Data volume", "Finance teams handle spreadsheets, PDFs, reports, and transaction tables."], ["Pattern review", "Variances, anomalies, and trends are common finance questions."], ["Narrative demand", "Numbers often need written explanation for management."]], ["Use Cases"], "docs"),
    S("Session 1", "09:48", "What AI can help with", "AI is strongest when the task is narrow, evidence-based, and reviewable.", [["Data preparation", "Suggest formulas, standardize fields, and identify exceptions."], ["Extraction", "Turn PDFs or text into structured tables."], ["Analysis support", "Highlight movements and propose follow-up questions."], ["Drafting", "Create first-pass summaries from verified data."]], ["AI Assistance"], "checklist"),
    S("Session 1", "09:54", "What AI cannot own", "AI should not replace accountability, source validation, or professional judgment in finance.", [["Final approval", "Finance managers, controllers, or CFOs approve reporting."], ["Unsupported causes", "AI should not invent reasons for changes."], ["Confidential decisions", "Sensitive data needs approved tools and access controls."], ["Policy exceptions", "Judgment-based exceptions require responsible humans."]], ["Limits", "Controls"], "risk"),
    S("Session 1", "10:00", "Human-in-the-loop finance", "The practical model is assistant first, reviewer second, approver last.", [["Assistant", "AI prepares, extracts, drafts, or flags."], ["Reviewer", "Finance checks numbers, source evidence, assumptions, and wording."], ["Approver", "An accountable role approves final output."], ["Evidence", "The workflow stores source, prompt, output, and review notes."]], ["Workflow", "Review"], "flow"),
    S("Session 1", "10:08", "Opportunity map categories", "Before choosing tools, classify the work so you know where AI belongs.", [["Repetitive", "The same task recurs with similar inputs."], ["Data-heavy", "The task requires cleaning, comparing, or extracting data."], ["Judgment-based", "The task needs human interpretation or approval."], ["Reporting-heavy", "The task turns numbers into a management output."]], ["Exercise", "Mapping"], "matrix"),
    S("Session 1", "10:16", "Exercise: build your AI opportunity map", "You will identify one finance workflow that could become an AI-assisted pilot.", [["Choose a workflow", "Monthly close, variance report, invoice review, forecast, or board pack."], ["Break it into steps", "Input, processing, review, reporting, and approval."], ["Tag each step", "Repetitive, data-heavy, judgment-based, reporting-heavy, AI-suitable."], ["Pick one pilot", "Choose the narrowest useful step to test first."]], ["Exercise", "Output"], "checklist", "A good first pilot is narrow, repetitive, reviewable, and useful even before full automation."),

    S("Session 2", "10:45", "Why model type matters", "The right AI approach depends on the kind of answer the finance task needs.", [["Category answer", "Use classification."], ["Number answer", "Use regression or forecasting."], ["Unusual movement", "Use anomaly detection."], ["Written output", "Use generative AI with source constraints."]], ["Models", "Matching"], "flow"),
    S("Session 2", "10:51", "Classification: sorting finance records", "Classification assigns records into categories that guide review or action.", [["Expense claims", "Normal, needs review, or high risk."], ["Receivables", "Collectible, delayed, or doubtful."], ["Transactions", "Operating, financing, investing, or exception."], ["Review rule", "Check false positives and false negatives."]], ["Classification"], "docs"),
    S("Session 2", "10:57", "Regression: predicting numbers", "Regression estimates numeric outcomes based on historical patterns and drivers.", [["Revenue forecast", "Estimate future sales from historical and business drivers."], ["Expense projection", "Predict monthly cost movement."], ["Cash flow", "Estimate collections, payments, and shortfall risk."], ["Review rule", "Check assumptions, error range, and business reasonableness."]], ["Regression", "Forecast"], "metrics"),
    S("Session 2", "11:03", "Clustering: grouping similar behavior", "Clustering groups records without preassigned labels, which can reveal finance patterns.", [["Customers", "Group by payment behavior or overdue pattern."], ["Vendors", "Group by spend type or frequency."], ["Cost centers", "Group by expense pattern."], ["Review rule", "Interpret clusters carefully; labels are added by humans."]], ["Clustering"], "docs"),
    S("Session 2", "11:09", "Anomaly detection: finding unusual items", "Anomaly detection does not prove fraud; it prioritizes items for human review.", [["Vendor payments", "Flag unusual amount, timing, or frequency."], ["Cost movement", "Detect account or department spikes."], ["Journal entries", "Highlight unusual combinations or dates."], ["Review rule", "Investigate context before concluding anything."]], ["Anomaly", "Review"], "risk"),
    S("Session 2", "11:15", "Generative AI: drafting language", "Generative AI helps convert verified finance data into structured explanations.", [["Executive summary", "Write concise management updates."], ["Variance commentary", "Separate facts, possible causes, and follow-up questions."], ["Board update", "Translate detail into business implications."], ["Review rule", "Do not accept unsupported explanations."]], ["Generative AI", "Narrative"], "narrative"),
    S("Session 2", "11:22", "Match the finance problem to the AI approach", "The same dataset can support different AI tasks depending on the question.", [["Predict next quarter revenue", "Regression or time-series forecasting."], ["Identify suspicious expense claims", "Classification or anomaly detection."], ["Summarize monthly performance", "Generative AI."], ["Group customers by payment behavior", "Clustering."]], ["Worksheet"], "matrix"),
    S("Session 2", "11:32", "Validation changes by model type", "Each model type needs a different review question.", [["Classification", "Which categories were wrong, and how costly are mistakes?"], ["Regression", "How large is the forecast error, and are assumptions reasonable?"], ["Anomaly detection", "Is the flag meaningful after business context is checked?"], ["Generative AI", "Is every statement supported by source data?"]], ["Validation"], "checklist"),
    S("Session 2", "11:42", "Mini demo: training is not trusting", "A model can produce a result that looks precise but still needs finance validation.", [["Load data", "Use a small finance-like CSV."], ["Train model", "Run prepared Colab cells; no coding skill required."], ["Read output", "Inspect predictions or classifications."], ["Challenge output", "Ask what data, assumptions, and errors could affect it."]], ["Colab", "Model Demo"], "flow"),

    S("Session 3", "13:00", "Responsible AI has a higher finance standard", "Finance outputs affect management decisions, audit trails, and trust.", [["Wrong number", "A small-looking error can affect a report."], ["Wrong cause", "Unsupported explanations can mislead management."], ["Wrong access", "Sensitive data can be exposed."], ["Wrong approval", "AI output can bypass human accountability."]], ["Responsible AI"], "risk"),
    S("Session 3", "13:07", "Accuracy risk", "Accuracy is not just calculation; it includes period, direction, label, and interpretation.", [["Number", "Is the amount correct?"], ["Period", "Is the month, quarter, or year correct?"], ["Direction", "Is the increase or decrease described correctly?"], ["Meaning", "Is the explanation supported by the data?"]], ["Accuracy"], "checklist"),
    S("Session 3", "13:14", "Transparency and source trail", "A useful finance AI output should be traceable after the meeting is over.", [["Source data", "Save the spreadsheet, PDF, or report excerpt."], ["Prompt", "Save the instruction used to generate the output."], ["AI output", "Keep the raw response, not only the edited version."], ["Review notes", "Record what was changed and why."]], ["Transparency", "Evidence"], "docs"),
    S("Session 3", "13:21", "Explainability", "Finance teams must be able to explain AI-assisted work to managers, auditors, and regulators.", [["Method", "What tool or model was used?"], ["Input", "What data was included or excluded?"], ["Assumption", "What did the workflow assume?"], ["Limitation", "Where should the output not be used?"]], ["Explainability"], "matrix"),
    S("Session 3", "13:28", "Confidentiality", "Do not put sensitive finance data into tools unless the organization approves the tool and use case.", [["Public AI tools", "Avoid confidential uploads unless policy allows it."], ["Sanitization", "Remove names, IDs, and sensitive amounts when possible."], ["Access", "Limit files to participants who need them."], ["Retention", "Know where prompts and outputs are stored."]], ["Privacy", "Policy"], "risk"),
    S("Session 3", "13:35", "Approval workflow", "AI can prepare a draft, but accountable finance roles approve official outputs.", [["Analyst", "Runs the tool and prepares first output."], ["Manager", "Checks source data and interpretation."], ["Controller or CFO", "Approves final reporting where required."], ["Audit trail", "Stores evidence for later review."]], ["Approval"], "flow"),
    S("Session 3", "13:42", "AI output review checklist", "Use a checklist before any AI-generated finance text becomes management-facing.", [["Correct statements", "Keep and link to source."], ["Unsupported claims", "Remove or convert to follow-up questions."], ["Missing assumptions", "Add driver, source, or caveat."], ["Sensitive content", "Mask, remove, or use approved environment."]], ["Checklist"], "checklist"),
    S("Session 3", "13:50", "Exercise: review AI commentary", "You will mark an AI-generated finance paragraph as if it were heading to a CFO.", [["Mark facts", "Which statements are supported by the data?"], ["Mark risks", "Which statements are unsupported or misleading?"], ["Add questions", "What must management confirm?"], ["Rewrite", "Produce a safer version of the paragraph."]], ["Exercise", "Review"], "risk"),

    S("Session 4", "14:00", "Data processing bottlenecks", "Many finance AI wins start with reducing manual data preparation.", [["PDF extraction", "Invoices, annual reports, bank statements, and reporting packs."], ["Spreadsheet cleanup", "Date, amount, account, vendor, and cost-center issues."], ["Copy-paste work", "Manual transfer between systems and templates."], ["Recurring reports", "Monthly packs that need the same treatment each cycle."]], ["Data Processing"], "docs"),
    S("Session 4", "14:05", "Common finance sources", "AI workflows often combine structured, semi-structured, and unstructured data.", [["Structured", "Tables, CSV files, trial balances, and budgets."], ["Semi-structured", "PDF invoices and annual report tables."], ["Unstructured", "Management explanations, notes, emails, and text excerpts."], ["Control point", "Each source needs a validation method."]], ["Data Sources"], "flow"),
    S("Session 4", "14:10", "Data quality checklist", "Before analysis, check whether the dataset can be trusted for reporting.", [["Completeness", "Are required fields missing?"], ["Consistency", "Are dates, currencies, names, and categories standardized?"], ["Duplicates", "Are rows repeated or double counted?"], ["Reconciliation", "Do totals match the original source?"]], ["Data Quality"], "checklist"),
    S("Session 4 Lab 1", "14:15", "Lab 1 goal: clean messy finance data", "You will turn a messy transaction spreadsheet into a report-ready table.", [["Raw data stays raw", "Never overwrite original data."], ["Clean columns", "Create standardized fields next to source fields."], ["Exception flags", "Mark rows that require review."], ["Assumption notes", "Document every non-obvious choice."]], ["Lab 1", "Sheets"], "cleaning"),
    S("Session 4 Lab 1", "14:20", "Lab 1 step: inspect the raw data", "Before formulas, look for the problems a finance reviewer would care about.", [["Dates", "Multiple formats or invalid dates."], ["Amounts", "Currency signs, commas, text, blanks, or negative signs."], ["Names", "Vendor and account spelling variations."], ["Rows", "Duplicates, missing values, or unclear cost centers."]], ["Lab 1"], "risk"),
    S("Session 4 Lab 1", "14:25", "Lab 1 step: create clean fields", "Create standardized columns so formulas and dashboards use consistent inputs.", [["clean_date", "One usable date format."], ["clean_vendor", "Standardized vendor naming."], ["amount_numeric", "A number that Sheets can calculate."], ["issue_flag", "A visible marker for rows needing review."]], ["Lab 1"], "matrix"),
    S("Session 4 Lab 1", "14:30", "Lab 1 step: ask AI for formula help", "AI can suggest formulas, but you must understand and test them before use.", [["Good request", "Describe columns, desired clean fields, and validation checks."], ["Review formula", "Check whether it handles blanks, signs, and unusual formats."], ["Test sample", "Apply to a few known rows before copying down."], ["Document", "Record formulas and assumptions."]], ["Lab 1", "Prompting"], "prompt", "AI formula suggestions are starting points, not controls.", "", "Act as a finance data quality analyst. Suggest Google Sheets formulas for clean_date, clean_vendor, amount_numeric, duplicate_flag, issue_flag, and assumption_note. Do not change source data."),
    S("Session 4 Lab 1", "14:35", "Lab 1 step: standardize names and categories", "Mapping tables make finance cleanup repeatable instead of purely manual.", [["Vendor mapping", "Group spelling variants under one approved name."], ["Account mapping", "Standardize account categories."], ["Cost center mapping", "Use approved business unit labels."], ["Exception handling", "Flag unknown names for review rather than guessing."]], ["Lab 1"], "docs"),
    S("Session 4 Lab 1", "14:40", "Lab 1 step: reconcile totals", "A cleaned dataset must reconcile back to the raw source or explain differences.", [["Raw total", "Calculate from original amount fields."], ["Clean total", "Calculate from numeric cleaned fields."], ["Difference", "Explain duplicates removed, signs corrected, or excluded rows."], ["Reviewer note", "Document why the cleaned file is acceptable."]], ["Lab 1", "Control"], "metrics"),
    S("Session 4 Lab 1", "14:45", "Lab 1 output", "Your output is not just a cleaner file; it is a reviewable data-preparation workflow.", [["Cleaned dataset", "Report-ready transaction table."], ["Issue list", "Rows needing human review."], ["Assumption notes", "Documented cleanup decisions."], ["Reconciliation", "Raw vs cleaned totals explained."]], ["Lab 1", "Output"], "checklist"),
    S("Session 4 Lab 2", "14:50", "Lab 2 goal: PDF and invoice extraction", "You will extract structured information from a sample PDF or invoice.", [["Source file", "Open the original PDF first."], ["Notebook", "Use prepared Colab cells to extract text."], ["Structured table", "Convert extracted text into fields."], ["Review status", "Mark each field as verified, needs review, or not found."]], ["Lab 2", "PDF"], "flow"),
    S("Session 4 Lab 2", "14:55", "Lab 2 step: upload and extract", "The notebook automates the mechanical step, but you still review the output.", [["Upload PDF", "Use the sample invoice or annual report excerpt."], ["Run cells", "Execute prepared Colab cells in order."], ["Preview text", "Look for missing lines, broken tables, or OCR errors."], ["Fallback", "Use prepared text or CSV if package installation fails."]], ["Lab 2", "Colab"], "docs"),
    S("Session 4 Lab 2", "15:00", "Lab 2 step: structure fields", "Structured extraction makes PDF data usable in Sheets.", [["Field names", "Company, date, invoice number, period, amount, tax, total."], ["Extracted values", "Values copied or parsed from PDF text."], ["Source evidence", "Where the value appears in the PDF."], ["Confidence", "Whether the value is clear or needs review."]], ["Lab 2"], "matrix"),
    S("Session 4 Lab 2", "15:05", "Lab 2 step: export and reconcile", "PDF extraction is complete only after values are checked against the source.", [["Export CSV", "Open structured output in Google Sheets."], ["Check values", "Compare important fields to the original PDF."], ["Mark review", "Verified, needs review, or not found."], ["Retain source", "Keep the original PDF as evidence."]], ["Lab 2", "Control"], "checklist"),
    S("Session 4 Lab 3", "15:10", "Lab 3 goal: LLM-assisted extraction", "You will use AI chat to structure a short financial text excerpt.", [["Text excerpt", "A short unstructured finance passage."], ["Requested fields", "Company, period, revenue, gross profit, net income, key variance, explanation, risks."], ["Structured output", "A table you can copy into Docs or Sheets."], ["Validation", "Compare every extracted value to the source text."]], ["Lab 3", "LLM"], "docs"),
    S("Session 4 Lab 3", "15:15", "Lab 3 prompt and output table", "The prompt should force the AI to show evidence and uncertainty.", [["field_name", "The item requested."], ["extracted_value", "The value copied from source text."], ["source_quote", "Short evidence from the excerpt."], ["review_needed", "Whether finance must check or confirm it."]], ["Lab 3", "Prompt"], "prompt", "If a field is missing, the correct answer is not found.", "", "Extract structured finance fields from the text below. Use only the source text. Return field_name, extracted_value, source_quote, confidence, and review_needed. If missing, write not found."),
    S("Session 4 Lab 3", "15:22", "Lab 3 validation", "LLM extraction is useful only when the source text supports the table.", [["Correct", "The value and source quote match."], ["Unsupported", "The value is not in the text."], ["Incomplete", "The field is partially present or ambiguous."], ["Needs review", "Human confirmation is required before use."]], ["Lab 3", "Validation"], "risk"),

    S("Session 5", "15:45", "Financial statement analysis goal", "AI can support financial analysis after ratios and variances are calculated correctly.", [["Financial statements", "Income statement, balance sheet, and cash flow statement."], ["Calculations", "Ratios, growth, budget variance, prior-period variance."], ["Interpretation", "AI can help draft observations and questions."], ["Validation", "Finance checks every number and explanation."]], ["Analysis"], "metrics"),
    S("Session 5", "15:50", "Core ratios", "Ratios turn raw financial statements into comparable signals.", [["Profitability", "Gross margin, operating margin, net profit margin."], ["Liquidity", "Current ratio and cash position."], ["Leverage", "Debt-to-equity and related balance sheet indicators."], ["Efficiency", "Movements that show how assets or costs are used."]], ["Ratios"], "docs"),
    S("Session 5", "15:55", "Variance analysis", "Variance analysis asks what changed, how much, and whether it matters.", [["Actual vs budget", "Did performance beat or miss plan?"], ["Current vs prior", "What changed from the previous period?"], ["Entity vs entity", "Which business unit changed most?"], ["Product line", "Where are margin or revenue shifts concentrated?"]], ["Variance"], "matrix"),
    S("Session 5", "16:00", "Materiality thresholds", "Do not ask AI to explain every movement; first identify what is material.", [["Percentage threshold", "Example: greater than 5 percent movement."], ["Absolute threshold", "Example: greater than a defined currency amount."], ["Critical accounts", "Always review cash, revenue, tax, debt, or control-sensitive accounts."], ["Management context", "Materiality depends on business use."]], ["Materiality"], "risk"),
    S("Session 5", "16:08", "AI-assisted interpretation", "Use AI to produce a first draft of observations, not final judgment.", [["Facts", "What the numbers show."], ["Possible explanations", "Only if supported by data."], ["Follow-up questions", "What management must confirm."], ["Verification items", "Numbers or statements to check."]], ["Commentary", "AI"], "narrative"),
    S("Session 5", "16:16", "Validate finance commentary", "Every sentence in finance commentary should survive a source-data check.", [["Number check", "Does the value match the table?"], ["Period check", "Is the comparison period correct?"], ["Direction check", "Increase or decrease stated correctly?"], ["Cause check", "Is the explanation supported or marked for confirmation?"]], ["Validation"], "checklist"),
    S("Session 5", "16:23", "Lab output: short analysis", "Your output is a concise AI-assisted analysis that a manager could review.", [["Ratios", "Core metrics calculated."], ["Top movements", "Material variances identified."], ["Commentary", "Facts separated from possible explanations."], ["Questions", "Follow-up items for management."]], ["Output"], "docs"),

    S("Session 6", "16:25", "Dashboard purpose", "Dashboards should answer management questions, not show every available chart.", [["Question first", "What decision or review does the dashboard support?"], ["Metric second", "What measure answers that question?"], ["Chart third", "What visual makes the answer clear?"], ["Commentary last", "What does management need to know or ask next?"]], ["Dashboard"], "dashboard"),
    S("Session 6", "16:32", "Executive vs operational dashboards", "Different audiences need different levels of detail.", [["Executive", "Few KPIs, trend, risk, and action focus."], ["Operational", "More detail for recurring process management."], ["Finance reviewer", "Source links, reconciliations, and exception flags."], ["Common mistake", "Using one dashboard for all audiences."]], ["Dashboard", "Audience"], "matrix"),
    S("Session 6", "16:38", "Build dashboard elements", "A simple finance dashboard usually combines KPIs, trends, and variance views.", [["Revenue trend", "Line chart over time."], ["Expense trend", "Line or bar chart by period."], ["Budget variance", "Actual vs budget by category."], ["KPI cards", "Margin, net income, and cash position."]], ["Sheets", "Charts"], "dashboard"),
    S("Session 6", "16:44", "AI chart commentary", "Use AI only after the dashboard summary table is correct.", [["Provide table", "Paste values, not a vague screenshot."], ["Constrain output", "Ask for insights, risks, and follow-up questions."], ["Avoid invention", "Require only movements supported by data."], ["Review", "Check commentary against the charts."]], ["Commentary"], "prompt"),
    S("Session 6", "16:50", "Avoid misleading visuals", "A dashboard can mislead even when the data is correct.", [["Wrong scale", "Exaggerates or hides movement."], ["Too many charts", "Makes management miss the key point."], ["Mixed periods", "Compares unlike dates."], ["No context", "Shows movement without budget, prior period, or threshold."]], ["Dashboard", "Risk"], "risk"),
    S("Day 1 Close", "16:57", "Day 1 checkpoint", "By the end of Day 1, you have practiced the full path from source data to reviewed insight.", [["You mapped a workflow", "AI opportunity map."], ["You cleaned and extracted data", "Three Session 4 labs."], ["You analyzed statements", "Ratios, variances, and commentary."], ["You built a dashboard", "Simple management view with validated notes."]], ["Wrap", "Checkpoint"], "checklist")
  ];

  const dayTwo = [
    S("Recap", "09:00", "Welcome back: what Day 1 proved", "AI is useful when the data is prepared, the output is reviewed, and the workflow is controlled.", [["Data first", "Clean data and source evidence matter."], ["AI second", "Use AI for extraction, drafting, flags, and questions."], ["Review third", "Finance validates numbers and language."], ["Approval last", "Accountable humans own final reporting."]], ["Recap"], "flow"),
    S("Recap", "09:15", "Day 2 learning arc", "Today we turn analysis into reporting, forecasting, workflow redesign, governance, and action plans.", [["Narrative reporting", "Turn verified data into CFO and board language."], ["Prompt engineering", "Build reusable finance prompts."], ["Forecasting", "Create base, upside, and downside scenarios."], ["Governance", "Make the workflow audit-ready."]], ["Day 2", "Agenda"], "timeline"),

    S("Session 7", "09:30", "Why narrative reporting matters", "Finance teams do not only calculate numbers; they explain business performance.", [["Executive summary", "What management needs to know quickly."], ["Variance commentary", "What changed and what needs follow-up."], ["Board update", "What matters at governance level."], ["MD&A style", "Structured explanation with caveats and risks."]], ["Narrative"], "narrative"),
    S("Session 7", "09:36", "Know your audience", "The same data needs different language for different readers.", [["CFO", "Concise, decision-oriented, risk-aware."], ["Board", "High-level business implications and governance risks."], ["Business unit head", "Operational drivers and follow-up actions."], ["Audit", "Traceability, evidence, controls, and review history."]], ["Audience"], "matrix"),
    S("Session 7", "09:42", "CFO summary structure", "A CFO summary should separate performance, risk, and action.", [["Revenue", "What moved and whether it is material."], ["Expense", "What exceeded or stayed under plan."], ["Margin and cash", "What changed in profitability and liquidity."], ["Follow-up", "What management must confirm."]], ["CFO", "Summary"], "docs"),
    S("Session 7", "09:48", "Board update structure", "Board language should be concise, sourced, and focused on implications.", [["Performance", "Top movements only."], ["Risk", "Issues that need oversight."], ["Management action", "Actions underway or requiring decision."], ["Caveat", "What is still uncertain or under review."]], ["Board"], "docs"),
    S("Session 7", "09:54", "Variance commentary", "Good variance commentary tells what changed without inventing unsupported causes.", [["Observation", "Revenue increased by a specific amount or percentage."], ["Possible cause", "Only if data supports it."], ["Question", "What the business owner must explain."], ["Risk", "What could affect next period."]], ["Variance"], "narrative"),
    S("Session 7", "10:00", "Hallucination control", "The AI should not sound more certain than the data allows.", [["Use only data below", "Limits the answer to provided evidence."], ["Do not invent causes", "Blocks unsupported explanations."], ["Requires confirmation", "Makes uncertainty visible."], ["List questions", "Turns missing evidence into action."]], ["Control", "Prompt"], "prompt"),
    S("Session 7", "10:07", "Source-linked statements", "A finance narrative is stronger when each claim can point back to a table, row, or document.", [["Statement", "The written claim."], ["Source", "The table, cell, PDF line, or report section."], ["Status", "Verified, needs review, or unsupported."], ["Reviewer note", "What was changed or confirmed."]], ["Evidence"], "checklist"),
    S("Session 7", "10:14", "Lab data prep for narrative reporting", "Before prompting, prepare a compact table that contains only the needed data.", [["Current period", "Actual performance."], ["Comparison", "Budget and prior period."], ["Variance", "Absolute and percentage movement."], ["Materiality", "Flag the lines that matter."]], ["Lab", "Data Prep"], "metrics"),
    S("Session 7", "10:22", "Lab prompt: executive summary", "The prompt should instruct AI to produce a reviewable first draft.", [["Role", "FP&A analyst supporting the CFO."], ["Task", "Draft concise executive summary."], ["Sections", "Revenue, expense, margin, cash flow, risks, follow-up actions."], ["Constraint", "Use only provided data and mark unclear causes."]], ["Prompt", "Lab"], "prompt"),
    S("Session 7", "10:34", "Narrative validation checklist", "Your final narrative is the reviewed version, not the AI response.", [["Correct statements", "Keep and source."], ["Unsupported assumptions", "Remove or rewrite."], ["Missing risks", "Add if source data indicates risk."], ["Numbers to verify", "Check before final use."]], ["Validation"], "checklist"),

    S("Session 8", "11:00", "Prompt engineering for finance accuracy", "A finance prompt is a control surface: it shapes the output and the review process.", [["Specific role", "Who the AI should act as."], ["Specific task", "What output is needed."], ["Source data", "What evidence is allowed."], ["Rules", "What the AI must not do."]], ["Prompting"], "prompt"),
    S("Session 8", "11:05", "Prompt part 1: role", "A role gives the AI a finance lens but does not make it an expert approver.", [["Good role", "Act as an FP&A analyst supporting the CFO."], ["Avoid vague role", "Be smart or make this better."], ["Keep accountability", "The user remains reviewer and approver."], ["Match audience", "CFO, board, audit, or business unit."]], ["Prompting"], "docs"),
    S("Session 8", "11:10", "Prompt part 2: task", "The task should say exactly what kind of output is needed.", [["Analyze", "Identify material movements."], ["Summarize", "Create a concise management summary."], ["Check", "Find inconsistencies between numbers and narrative."], ["Draft", "Create a first version for review."]], ["Prompting"], "matrix"),
    S("Session 8", "11:15", "Prompt part 3: source data", "Tell AI what data it may use and what it must ignore.", [["Paste table", "Include only needed columns and rows."], ["Define periods", "Current, budget, prior, forecast."], ["State units", "Currency, thousands, millions, percentages."], ["Limit evidence", "Use only the data below."]], ["Source Data"], "checklist"),
    S("Session 8", "11:20", "Prompt part 4: output format", "Structured output makes AI easier to review.", [["Sections", "Facts, interpretations, risks, questions."], ["Tables", "Field, value, source, confidence, review_needed."], ["Bullets", "Short points for management."], ["Labels", "Mark facts separately from assumptions."]], ["Output Format"], "docs"),
    S("Session 8", "11:25", "Prompt part 5: constraints", "Constraints reduce overconfident or unsupported answers.", [["Do not invent causes", "Use when reasons are not in the data."], ["Flag inconsistent numbers", "Do not silently fix them."], ["Ask follow-up questions", "Show what is missing."], ["Add caveats", "State limitations clearly."]], ["Constraints"], "risk"),
    S("Session 8", "11:30", "Prompt part 6: caveats and questions", "Good finance outputs make uncertainty visible.", [["Caveat", "Where the data is incomplete."], ["Question", "What management must confirm."], ["Assumption", "What driver the model uses."], ["Limitation", "Where the output should not be used."]], ["Caveats"], "checklist"),
    S("Session 8", "11:36", "Weak vs strong prompt", "Small prompt changes can decide whether the output is reviewable.", [["Weak", "Explain this variance."], ["Better", "Use only the table below."], ["Stronger", "Separate facts, possible interpretations, risks, and follow-up questions."], ["Best", "Flag unsupported causes and inconsistent numbers."]], ["Prompt Quality"], "matrix"),
    S("Session 8", "11:44", "Build your prompt library", "A reusable prompt library helps finance teams work consistently.", [["Monthly summary", "Performance and risks."], ["Budget variance", "Favorable and unfavorable movements."], ["Cash flow risk", "Collections, payments, and shortfall risks."], ["Audit review", "Unsupported claims and evidence gaps."]], ["Prompt Library"], "docs"),
    S("Session 8", "11:53", "Test and revise prompts", "A prompt is not finished until you have tested it against real-looking data.", [["Run prompt", "Use sample finance data."], ["Review output", "Mark strengths and weaknesses."], ["Revise", "Add missing constraints or format rules."], ["Save", "Keep the prompt version for reuse."]], ["Practice"], "flow"),

    S("Session 9", "13:00", "Scenario planning and forecasting", "Forecasting is not predicting the future with certainty; it is testing assumptions.", [["Base case", "Most likely planning case."], ["Upside case", "Better-than-base assumptions."], ["Downside case", "Stress or risk assumptions."], ["Management use", "Understand implications before decisions."]], ["Forecasting"], "scenario"),
    S("Session 9", "13:06", "Forecast drivers", "A scenario model changes when its drivers change.", [["Revenue growth", "Demand, price, volume, or mix."], ["Expense inflation", "Cost movement and operating leverage."], ["Cash collection", "Timing of receivables."], ["External factors", "FX, interest rates, inflation, demand shock."]], ["Drivers"], "docs"),
    S("Session 9", "13:12", "Base, upside, and downside cases", "Each scenario should be defined by explicit assumptions.", [["Base", "Expected growth and cost movement."], ["Upside", "Higher revenue, better margin, faster collections."], ["Downside", "Demand shock, cost increase, collection delay."], ["Compare", "Review impact on profit and cash."]], ["Scenarios"], "matrix"),
    S("Session 9", "13:18", "Prepare historical data", "Forecast quality depends on clean and consistent historical inputs.", [["Monthly periods", "One row per month."], ["Consistent accounts", "Revenue, expenses, margin, cash flow."], ["Clean values", "No text amounts or mixed currencies."], ["Known events", "Mark unusual months before modeling."]], ["Data Prep"], "checklist"),
    S("Session 9", "13:24", "Build an assumption table", "Assumptions should be visible, editable, and reviewable.", [["Revenue growth", "Set percentage by scenario."], ["Expense inflation", "Set cost movement by scenario."], ["Margin", "Set margin or cost behavior."], ["Collection delay", "Set days or percentage impact."]], ["Assumptions"], "matrix"),
    S("Session 9", "13:30", "Create forecast formulas", "Spreadsheet formulas keep the model transparent for finance review.", [["Start from actuals", "Use last actual period or historical average."], ["Apply assumptions", "Reference assumption cells."], ["Separate scenarios", "Do not hardcode hidden numbers."], ["Check totals", "Review reasonableness and formula consistency."]], ["Sheets"], "flow"),
    S("Session 9", "13:38", "Sensitivity analysis", "Sensitivity shows which assumptions matter most.", [["Change one driver", "Move revenue growth or expense inflation."], ["Observe impact", "Review revenue, margin, net income, cash."], ["Rank drivers", "Identify the assumption with biggest effect."], ["Discuss action", "What management should monitor."]], ["Sensitivity"], "scenario"),
    S("Session 9", "13:46", "Stress testing", "Stress tests ask what happens under difficult conditions.", [["Interest rate change", "Debt cost or investment income impact."], ["FX movement", "Import, export, or translation exposure."], ["Inflation", "Supplier and operating cost pressure."], ["Demand shock", "Lower volume or delayed sales."]], ["Stress Test"], "risk"),
    S("Session 9", "13:54", "Colab forecasting concept demo", "Colab can demonstrate forecasting logic without becoming a production system.", [["Load time series", "Use historical finance data."], ["Plot actuals", "Visualize trend and volatility."], ["Generate forecast", "Run prepared cells."], ["Export result", "Open forecast output in Sheets."]], ["Colab", "Forecast"], "flow"),
    S("Session 9", "14:04", "AI scenario narrative", "AI can convert scenario output into management language if assumptions are clear.", [["Compare cases", "Base, upside, downside."], ["Explain implications", "Revenue, expense, margin, and cash flow."], ["List assumptions", "What management must validate."], ["Avoid recommendations", "Do not recommend decisions beyond the data."]], ["Narrative"], "narrative"),
    S("Session 9", "14:14", "Forecast limits", "Forecast outputs should always include limitations.", [["Data limits", "History may not repeat."], ["Assumption limits", "Drivers may change suddenly."], ["Model limits", "Simple formulas are not a full planning system."], ["Review limits", "Scenario narrative requires management confirmation."]], ["Limits"], "risk"),
    S("Session 9", "14:24", "Scenario lab output", "Your output is a three-scenario forecast plus a reviewed management narrative.", [["Forecast table", "Base, upside, downside."], ["Sensitivity view", "Key drivers tested."], ["Narrative", "Implications and risks."], ["Validation notes", "Assumptions requiring management confirmation."]], ["Output"], "checklist"),

    S("Session 10", "14:30", "AI in the reporting calendar", "AI should fit into existing finance cycles rather than bypass them.", [["Data collection", "Gather templates and source files."], ["Validation", "Check completeness and quality."], ["Analysis", "Calculate, compare, and flag."], ["Commentary", "Draft, review, approve, and publish."]], ["Workflow"], "flow"),
    S("Session 10", "14:36", "No-code, low-code, and Python choices", "Choose the simplest tool that can meet the control requirement.", [["No-code", "Sheets, Docs, dashboards, and AI chat."], ["Low-code", "Automations with configured steps."], ["Python or Colab", "Repeatable cleaning, extraction, or forecasting."], ["Manual", "Keep high-judgment approval steps human."]], ["Tools"], "matrix"),
    S("Session 10", "14:42", "Choose one workflow", "Workflow redesign starts with one real finance process.", [["Monthly management report", "Recurring executive output."], ["Budget vs actual", "Variance review and commentary."], ["Cash flow forecast", "Scenario and risk review."], ["Vendor expense review", "Exception detection and documentation."]], ["Exercise"], "docs"),
    S("Session 10", "14:48", "Map the current process", "Before adding AI, understand how the workflow works today.", [["Inputs", "Files, reports, systems, and owners."], ["Processing", "Cleaning, formulas, consolidation, analysis."], ["Review", "Who checks and when."], ["Output", "Report, dashboard, deck, or memo."]], ["Workflow"], "checklist"),
    S("Session 10", "14:54", "Add the AI assistance layer", "AI belongs where it reduces repetitive effort without hiding risk.", [["Extraction", "PDFs, invoices, or text into tables."], ["Cleaning", "Formula suggestions and exception flags."], ["Analysis", "Top movement identification."], ["Drafting", "First-pass commentary or questions."]], ["AI Layer"], "flow"),
    S("Session 10", "15:00", "Add the human review layer", "Every AI-assisted step needs a defined review point.", [["Completeness review", "Are all inputs included?"], ["Accuracy review", "Do numbers match source?"], ["Interpretation review", "Are causes supported?"], ["Approval review", "Who signs off before reporting?"]], ["Review"], "checklist"),
    S("Session 10", "15:06", "Risk and control table", "A workflow pilot should name the risk and the control for each AI-assisted step.", [["Risk", "Missing data, wrong interpretation, hallucination, confidentiality."], ["Control", "Input checklist, source validation, prompt rules, reviewer approval."], ["Evidence", "Saved files, prompts, outputs, notes."], ["Owner", "Named person or role."]], ["Controls"], "matrix"),
    S("Session 10", "15:12", "Optional demo: Colab to Sheets workflow", "A repeatable data workflow can start in Colab and end in Sheets for review.", [["Read CSV", "Load raw file."], ["Clean data", "Run prepared logic."], ["Export CSV", "Create cleaned output."], ["Review in Sheets", "Use charts, flags, and approval notes."]], ["Demo"], "flow"),
    S("Session 10", "15:20", "Pilot proposal structure", "A good AI pilot proposal is practical and reviewable.", [["Workflow", "Which finance process is being improved?"], ["Benefit", "Time saved, quality improved, or risk reduced."], ["Controls", "How errors and confidentiality are managed."], ["Success measure", "How you will decide whether to continue."]], ["Pilot"], "docs"),
    S("Session 10", "15:27", "Group share: workflow redesign", "Each group should explain the workflow, AI step, review owner, and control.", [["One workflow", "Keep it specific."], ["One AI-assisted step", "Avoid trying to automate everything."], ["One reviewer", "Name the role."], ["One control", "State how the risk is reduced."]], ["Share"], "checklist"),

    S("Session 11", "15:45", "Audit questions about AI", "Auditors will ask how the output was produced, reviewed, approved, and retained.", [["What data was used?", "Source and owner."], ["What tool was used?", "AI tool, prompt, or workflow version."], ["Who reviewed it?", "Reviewer and approval authority."], ["What evidence remains?", "Files, prompts, outputs, and notes."]], ["Audit"], "risk"),
    S("Session 11", "15:49", "Document the AI-assisted process", "Documentation turns a clever workflow into a controlled process.", [["Purpose", "What the workflow does."], ["Scope", "Where it may and may not be used."], ["Steps", "Input, AI assistance, review, approval."], ["Limitations", "Known weaknesses and escalation rules."]], ["Documentation"], "docs"),
    S("Session 11", "15:53", "Prompt and workflow version control", "Saved prompts and workflow versions help explain why outputs changed.", [["Prompt version", "Keep the exact instruction."], ["Tool version", "Record the AI tool or notebook used."], ["Output version", "Save raw and reviewed outputs."], ["Change notes", "Explain important edits."]], ["Versioning"], "checklist"),
    S("Session 11", "15:57", "Input controls", "Bad inputs create bad outputs even when the AI behaves correctly.", [["Data source", "Approved source file or system."], ["Completeness", "Required fields present."], ["Format", "Consistent dates, currencies, accounts."], ["Access", "Only authorized users can view source data."]], ["Input Controls"], "matrix"),
    S("Session 11", "16:01", "Output validation controls", "AI outputs need a defined error-checking method.", [["Number tie-out", "Check values against source."], ["Narrative check", "Remove unsupported causes."], ["Exception review", "Investigate flagged rows."], ["Approval record", "Document who approved final output."]], ["Output Controls"], "checklist"),
    S("Session 11", "16:05", "Confidentiality and access", "Governance must define what data can be used with which tools.", [["Public tools", "Use only approved non-sensitive data."], ["Internal tools", "Follow company access and retention rules."], ["Shared folders", "Limit access to course or project participants."], ["Sensitive fields", "Mask or remove where possible."]], ["Confidentiality"], "risk"),
    S("Session 11", "16:09", "Segregation of duties", "AI should not blur who prepares, reviews, and approves finance outputs.", [["Preparer", "Runs AI-assisted workflow."], ["Reviewer", "Checks data and interpretation."], ["Approver", "Owns final reporting decision."], ["Admin", "Controls access, versioning, or workflow changes."]], ["SOD"], "flow"),
    S("Session 11", "16:13", "Minimum viable governance checklist", "A simple checklist is enough for a first pilot if it captures the important evidence.", [["Data source and owner", "Where inputs came from."], ["AI tool and prompt", "How output was generated."], ["Reviewer and approver", "Who checked and signed off."], ["Retention policy", "Where evidence is saved and for how long."]], ["Checklist"], "checklist"),
    S("Session 11", "16:19", "Control example: variance commentary", "AI-generated commentary needs source data and human review.", [["Attach source data", "Budget and actual table."], ["Check numbers", "Every amount and percentage."], ["Remove unsupported causes", "Use requires confirmation when needed."], ["Approve final version", "Finance manager or CFO role."]], ["Example"], "narrative"),
    S("Session 11", "16:25", "Control example: PDF extraction", "Extracted tables need reconciliation to the original document.", [["Retain original PDF", "Source evidence."], ["Check extracted values", "Important fields tied back to PDF."], ["Flag exceptions", "OCR errors or ambiguous fields."], ["Approve data use", "Before reporting or analysis."]], ["Example"], "docs"),

    S("Session 12", "16:30", "Course recap", "AI can accelerate finance work, but the finance team must control the workflow.", [["Data processing", "Clean, extract, structure, reconcile."], ["Analysis", "Ratios, variance, materiality, commentary."], ["Forecasting", "Scenarios and assumptions."], ["Governance", "Evidence, review, approval, and retention."]], ["Recap"], "flow"),
    S("Session 12", "16:35", "Recommended first pilots", "Start with a pilot that is narrow and easy to review.", [["PDF extraction", "Invoices, bank statements, or report excerpts."], ["Variance commentary", "First draft with strict validation."], ["Dashboard commentary", "Insights from verified summary tables."], ["Forecast narrative", "Scenario explanation with assumptions."]], ["Pilots"], "docs"),
    S("Session 12", "16:40", "First 30 days", "The first month is about preparation and a small controlled test.", [["Choose workflow", "One clear finance process."], ["Prepare data", "Sanitized or approved sample inputs."], ["Build template", "Sheet, prompt, checklist, or notebook."], ["Run test", "One controlled cycle with review notes."]], ["30 Days"], "action"),
    S("Session 12", "16:45", "60-day pilot milestone", "By day 60, the pilot should run through a real but controlled reporting cycle.", [["Run workflow", "Use the agreed inputs and process."], ["Measure time", "Compare manual effort vs AI-assisted effort."], ["Measure quality", "Track errors, unsupported claims, and review findings."], ["Adjust controls", "Fix weak points before expanding."]], ["60 Days"], "action"),
    S("Session 12", "16:50", "90-day implementation target", "By day 90, decide whether to expand, revise, or stop.", [["Expand", "If benefit and controls are strong."], ["Revise", "If useful but controls need improvement."], ["Stop", "If risk or effort outweighs benefit."], ["Document", "Keep the decision and evidence."]], ["90 Days"], "action"),
    S("Session 12", "16:55", "Final commitment", "Write one practical action you can take in the next 30 days.", [["Workflow", "Name the finance workflow."], ["Business problem", "State the pain point."], ["Control", "Name the review or approval step."], ["Next action", "State the first step you will take."]], ["Close"], "checklist")
  ];

  return [
    ...dayOne.map((spec, index) => enrichStudentSlide(spec, "Day 1", index + 1, dayOne.length)),
    ...dayTwo.map((spec, index) => enrichStudentSlide(spec, "Day 2", index + 1, dayTwo.length))
  ];
}

function enrichStudentSlide(spec, day, dayIndex, dayTotal) {
  return {
    kicker: `${day} | ${spec.session} | Slide ${dayIndex} / ${dayTotal}`,
    title: spec.title,
    time: spec.time,
    thesis: spec.thesis,
    tags: spec.tags,
    keyLine: spec.keyLine || spec.thesis,
    layout: spec.points.length > 4 ? "list" : "cards",
    points: spec.points,
    visual: makeStudentVisual(spec, day, dayIndex),
    notes: {
      talk: [spec.thesis, spec.keyLine || ""].filter(Boolean),
      activity: spec.activity ? [spec.activity] : undefined,
      prompt: spec.prompt ? [spec.prompt] : undefined
    }
  };
}

function makeStudentVisual(spec, day, dayIndex) {
  const badge = `${day} ${String(dayIndex).padStart(2, "0")}`;
  const base = {
    title: spec.title,
    subtitle: spec.thesis,
    badge
  };
  if (spec.visualType === "flow") {
    return { ...base, type: "flow", steps: pointSteps(spec.points) };
  }
  if (spec.visualType === "timeline") {
    return { ...base, type: "timeline", items: spec.points.map((point, index) => [String(index + 1), point[0], point[1]]) };
  }
  if (spec.visualType === "matrix") {
    return { ...base, type: "matrix", rows: pointRows(spec.points) };
  }
  if (spec.visualType === "checklist") {
    return { ...base, type: "checklist", items: spec.points.map((point) => point[0]) };
  }
  if (spec.visualType === "risk") {
    return { ...base, type: "risk", risks: spec.points.map((point) => [point[0], point[1]]) };
  }
  if (spec.visualType === "prompt") {
    return { ...base, type: "prompt", tokens: spec.points.map((point) => point[0]) };
  }
  if (spec.visualType === "metrics") {
    return { ...base, type: "metrics", metrics: spec.points.map((point, index) => [point[0], String(index + 1), point[1]]) };
  }
  if (["cleaning", "narrative", "dashboard", "scenario", "action"].includes(spec.visualType)) {
    return { ...base, type: spec.visualType };
  }
  return { ...base, type: "docs", docs: pointDocs(spec.points) };
}

function pointSteps(points) {
  return points.slice(0, 4).map((point) => [point[0], point[1]]);
}

function pointRows(points) {
  return points.slice(0, 4).map((point, index) => {
    const control = index === 0 ? "Use carefully" : index === 1 ? "Validate" : index === 2 ? "Document" : "Review";
    return [point[0], point[1], control];
  });
}

function pointDocs(points) {
  return points.slice(0, 6).map((point, index) => [
    String(index + 1).padStart(2, "0"),
    point[0],
    point[1]
  ]);
}

const app = {
  slideIndex: 0,
  revealIndex: 99,
  timerSeconds: 0,
  timerInterval: null
};

const els = {
  slideCopy: document.getElementById("slideCopy"),
  slideVisual: document.getElementById("slideVisual"),
  menuToggle: document.getElementById("menuToggle"),
  controlMenu: document.getElementById("controlMenu"),
  sceneKicker: document.getElementById("sceneKicker"),
  sceneTitle: document.getElementById("sceneTitle"),
  sceneTime: document.getElementById("sceneTime"),
  sceneThesis: document.getElementById("sceneThesis"),
  timerReadout: document.getElementById("timerReadout"),
  timerToggle: document.getElementById("timerToggle"),
  timerReset: document.getElementById("timerReset"),
  prevSlide: document.getElementById("prevSlide"),
  nextSlide: document.getElementById("nextSlide"),
  stepSlide: document.getElementById("stepSlide"),
  keyLine: document.getElementById("keyLine"),
  notesToggle: document.getElementById("notesToggle"),
  progressFill: document.getElementById("progressFill"),
  progressDots: document.getElementById("progressDots"),
  lineModal: document.getElementById("lineModal"),
  modalText: document.getElementById("modalText"),
  closeModal: document.getElementById("closeModal"),
  notesPanel: document.getElementById("notesPanel"),
  notesContent: document.getElementById("notesContent"),
  closeNotes: document.getElementById("closeNotes")
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSlide() {
  const slide = slides[app.slideIndex];
  const visibleCount = Math.min(app.revealIndex, slide.points.length);
  const bodyHtml = slide.layout === "list"
    ? renderWideList(slide.points, visibleCount)
    : renderCardGrid(slide.points, visibleCount);

  els.slideCopy.innerHTML = `
    <p class="slide-kicker">${escapeHtml(slide.kicker)}</p>
    <h1 class="slide-title">${escapeHtml(slide.title)}</h1>
    <div class="slide-meta">
      <span class="time-pill">${escapeHtml(slide.time)}</span>
      ${slide.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
    </div>
    <p class="slide-thesis">${escapeHtml(slide.thesis)}</p>
    ${bodyHtml}
  `;

  els.slideVisual.innerHTML = renderVisual(slide.visual);
  els.sceneKicker.textContent = `Slide ${app.slideIndex + 1} / ${slides.length}`;
  els.sceneTitle.textContent = slide.title;
  els.sceneTime.textContent = slide.time;
  els.sceneThesis.textContent = slide.thesis;
  els.prevSlide.disabled = app.slideIndex === 0;
  els.nextSlide.disabled = app.slideIndex === slides.length - 1;
  els.stepSlide.disabled = false;
  els.progressFill.style.width = `${((app.slideIndex + 1) / slides.length) * 100}%`;
  renderDots();
  renderNotes();
  history.replaceState(null, "", `#${app.slideIndex + 1}`);
}

function renderCardGrid(points, visibleCount) {
  return `
    <div class="body-grid">
      ${points.map((point, index) => `
        <div class="body-item ${index >= visibleCount ? "is-pending" : ""}">
          <strong>${escapeHtml(point[0])}</strong>
          <span>${escapeHtml(point[1])}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderWideList(points, visibleCount) {
  return `
    <div class="wide-list">
      ${points.map((point, index) => `
        <div class="wide-row ${index >= visibleCount ? "is-pending" : ""}">
          <span class="row-num">${index + 1}</span>
          <span class="row-copy">
            <strong>${escapeHtml(point[0])}</strong>
            <span>${escapeHtml(point[1])}</span>
          </span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderVisual(visual) {
  const renderers = {
    flow: renderFlowVisual,
    checklist: renderChecklistVisual,
    docs: renderDocsVisual,
    timeline: renderTimelineVisual,
    matrix: renderMatrixVisual,
    risk: renderRiskVisual,
    cleaning: renderCleaningVisual,
    metrics: renderMetricsVisual,
    narrative: renderNarrativeVisual,
    dashboard: renderDashboardVisual,
    prompt: renderPromptVisual,
    scenario: renderScenarioVisual,
    workflow: renderFlowVisual,
    action: renderActionVisual
  };
  return `
    <div class="visual-frame">
      <div class="visual-title">
        <div>
          <h3>${escapeHtml(visual.title)}</h3>
          <p>${escapeHtml(visual.subtitle)}</p>
        </div>
        <span class="visual-badge">${escapeHtml(visual.badge)}</span>
      </div>
      ${renderers[visual.type](visual)}
    </div>
  `;
}

function renderFlowVisual(visual) {
  return `
    <div class="flow horizontal">
      ${visual.steps.map((step, index) => `
        <div class="flow-step">
          <b>Layer ${index + 1}</b>
          <strong>${escapeHtml(step[0])}</strong>
          <span>${escapeHtml(step[1])}</span>
        </div>
      `).join("")}
    </div>
    <div class="chip-row">
      <span class="chip">source data</span>
      <span class="chip">AI assist</span>
      <span class="chip">human review</span>
      <span class="chip">approval evidence</span>
    </div>
  `;
}

function renderChecklistVisual(visual) {
  return `
    <div class="checklist">
      ${visual.items.map((item, index) => `
        <div class="check">
          <span class="box">${index < 5 ? "OK" : ""}</span>
          <strong>${escapeHtml(item)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDocsVisual(visual) {
  return `
    <div class="doc-stack">
      ${visual.docs.map((doc) => `
        <div class="doc-row">
          <span class="doc-icon">${escapeHtml(doc[0])}</span>
          <span class="doc-copy">
            <strong>${escapeHtml(doc[1])}</strong>
            <span>${escapeHtml(doc[2])}</span>
          </span>
          <span class="status-dot">ready</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTimelineVisual(visual) {
  return `
    <div class="timeline">
      ${visual.items.map((item) => `
        <div class="timeline-item">
          <span class="timeline-time">${escapeHtml(item[0])}</span>
          <span class="timeline-copy">
            <strong>${escapeHtml(item[1])}</strong>
            <span>${escapeHtml(item[2])}</span>
          </span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderMatrixVisual(visual) {
  return `
    <div class="matrix">
      <div class="matrix-head">
        <span>Workflow</span>
        <span>AI assistance</span>
        <span>Human control</span>
      </div>
      ${visual.rows.map((row) => `
        <div class="matrix-row">
          <span>${escapeHtml(row[0])}</span>
          <span>${escapeHtml(row[1])}</span>
          <span>${escapeHtml(row[2])}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderRiskVisual(visual) {
  return `
    <div class="risk-grid">
      ${visual.risks.map((risk) => `
        <div class="risk">
          <strong>${escapeHtml(risk[0])}</strong>
          <span>${escapeHtml(risk[1])}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCleaningVisual() {
  return `
    <div class="matrix">
      <div class="matrix-head">
        <span>Raw issue</span>
        <span>Clean field</span>
        <span>Review evidence</span>
      </div>
      <div class="matrix-row">
        <span>6/7/26, 07-Jun, blank</span>
        <span>clean_date</span>
        <span>date parse flag</span>
      </div>
      <div class="matrix-row">
        <span>Vendor spelling variations</span>
        <span>clean_vendor</span>
        <span>mapping table</span>
      </div>
      <div class="matrix-row">
        <span>IDR 1,250,000</span>
        <span>amount_numeric</span>
        <span>raw vs cleaned total</span>
      </div>
      <div class="matrix-row">
        <span>Unclear cost center</span>
        <span>issue_flag</span>
        <span>assumption note</span>
      </div>
    </div>
    <div class="bar-chart">
      <span class="bar"><i style="height: 88%"></i><span>raw</span></span>
      <span class="bar"><i style="height: 78%"></i><span>clean</span></span>
      <span class="bar"><i style="height: 28%"></i><span>dupes</span></span>
      <span class="bar"><i style="height: 34%"></i><span>missing</span></span>
      <span class="bar"><i style="height: 21%"></i><span>mapping</span></span>
      <span class="bar"><i style="height: 12%"></i><span>review</span></span>
    </div>
  `;
}

function renderMetricsVisual(visual) {
  return `
    <div class="metric-grid">
      ${visual.metrics.map((metric) => `
        <div class="metric">
          <b>${escapeHtml(metric[0])}</b>
          <strong>${escapeHtml(metric[1])}</strong>
          <span>${escapeHtml(metric[2])}</span>
        </div>
      `).join("")}
    </div>
    <div class="bar-chart">
      <span class="bar"><i style="height: 62%"></i><span>Jan</span></span>
      <span class="bar"><i style="height: 68%"></i><span>Feb</span></span>
      <span class="bar"><i style="height: 72%"></i><span>Mar</span></span>
      <span class="bar"><i style="height: 65%"></i><span>Apr</span></span>
      <span class="bar"><i style="height: 84%"></i><span>May</span></span>
      <span class="bar"><i style="height: 91%"></i><span>Jun</span></span>
    </div>
  `;
}

function renderNarrativeVisual() {
  return `
    <div class="flow">
      <div class="flow-step">
        <b>Step 1</b>
        <strong>Compact variance table</strong>
        <span>Actual, budget, prior, variance, materiality flag.</span>
      </div>
      <div class="flow-step">
        <b>Step 2</b>
        <strong>AI draft with constraints</strong>
        <span>Facts, possible explanations, questions, verification items.</span>
      </div>
      <div class="flow-step">
        <b>Step 3</b>
        <strong>Finance review</strong>
        <span>Unsupported claims become follow-up questions.</span>
      </div>
      <div class="flow-step">
        <b>Step 4</b>
        <strong>CFO-ready summary</strong>
        <span>Source-backed language only.</span>
      </div>
    </div>
  `;
}

function renderDashboardVisual() {
  return `
    <div class="metric-grid">
      <div class="metric"><b>Revenue</b><strong>8.4%</strong><span>growth vs prior</span></div>
      <div class="metric"><b>Margin</b><strong>42.1%</strong><span>down 1.7 pts</span></div>
      <div class="metric"><b>Cash</b><strong>1.8x</strong><span>coverage ratio</span></div>
    </div>
    <div class="bar-chart">
      <span class="bar"><i style="height: 50%"></i><span>Ops</span></span>
      <span class="bar"><i style="height: 78%"></i><span>Sales</span></span>
      <span class="bar"><i style="height: 42%"></i><span>G&A</span></span>
      <span class="bar"><i style="height: 63%"></i><span>R&D</span></span>
      <span class="bar"><i style="height: 31%"></i><span>Tax</span></span>
      <span class="bar"><i style="height: 57%"></i><span>Capex</span></span>
    </div>
    <div class="chip-row">
      <span class="chip">actual vs budget</span>
      <span class="chip">prior period</span>
      <span class="chip">top movements</span>
      <span class="chip">management action</span>
    </div>
  `;
}

function renderPromptVisual(visual) {
  return `
    <div class="prompt-block">
      <p class="mini-label">Reusable structure</p>
      <div class="prompt-grid">
        ${visual.tokens.map((token) => `<span class="prompt-token">${escapeHtml(token)}</span>`).join("")}
      </div>
    </div>
    <div class="doc-stack">
      <div class="doc-row">
        <span class="doc-icon">1</span>
        <span class="doc-copy"><strong>Use only the provided data</strong><span>prevents invented causes</span></span>
        <span class="status-dot">constraint</span>
      </div>
      <div class="doc-row">
        <span class="doc-icon">2</span>
        <span class="doc-copy"><strong>Separate facts from interpretations</strong><span>makes review faster</span></span>
        <span class="status-dot">control</span>
      </div>
      <div class="doc-row">
        <span class="doc-icon">3</span>
        <span class="doc-copy"><strong>List follow-up questions</strong><span>keeps uncertainty visible</span></span>
        <span class="status-dot">review</span>
      </div>
    </div>
  `;
}

function renderScenarioVisual() {
  return `
    <div class="scenario-lines">
      <div class="scenario-line">
        <span>Upside</span>
        <div class="scenario-track"><div class="scenario-fill" style="width: 92%"></div></div>
        <span>112</span>
      </div>
      <div class="scenario-line">
        <span>Base</span>
        <div class="scenario-track"><div class="scenario-fill" style="width: 74%"></div></div>
        <span>100</span>
      </div>
      <div class="scenario-line">
        <span>Downside</span>
        <div class="scenario-track"><div class="scenario-fill" style="width: 48%"></div></div>
        <span>82</span>
      </div>
    </div>
    <div class="risk-grid">
      <div class="risk"><strong>Revenue growth</strong><span>largest upside driver</span></div>
      <div class="risk"><strong>Collection delay</strong><span>largest cash risk</span></div>
      <div class="risk"><strong>Expense inflation</strong><span>margin pressure</span></div>
      <div class="risk"><strong>FX movement</strong><span>scenario caveat</span></div>
    </div>
  `;
}

function renderActionVisual() {
  return `
    <div class="timeline">
      <div class="timeline-item">
        <span class="timeline-time">30 days</span>
        <span class="timeline-copy"><strong>Prepare pilot</strong><span>owner, sanitized data, template, review checklist</span></span>
      </div>
      <div class="timeline-item">
        <span class="timeline-time">60 days</span>
        <span class="timeline-copy"><strong>Run controlled cycle</strong><span>measure quality, time saved, review findings</span></span>
      </div>
      <div class="timeline-item">
        <span class="timeline-time">90 days</span>
        <span class="timeline-copy"><strong>Decide next step</strong><span>expand, revise controls, automate more, or stop</span></span>
      </div>
    </div>
    <div class="checklist">
      <div class="check"><span class="box">OK</span><strong>Narrow workflow</strong></div>
      <div class="check"><span class="box">OK</span><strong>Measurable benefit</strong></div>
      <div class="check"><span class="box">OK</span><strong>Named reviewer and approver</strong></div>
    </div>
  `;
}

function renderDots() {
  els.progressDots.innerHTML = slides.map((_, index) => `
    <button class="dot ${index === app.slideIndex ? "active" : ""}" data-slide="${index}" type="button" aria-label="Go to slide ${index + 1}"></button>
  `).join("");
}

function renderNotes() {
  const slide = slides[app.slideIndex];
  const sections = [];
  if (slide.notes.talk) {
    sections.push(renderNoteSection("Talk Track", slide.notes.talk, "ul"));
  }
  if (slide.notes.activity) {
    sections.push(renderNoteSection("Activity", slide.notes.activity, "ol"));
  }
  if (slide.notes.demo) {
    sections.push(renderNoteSection("Demo Steps", slide.notes.demo, "ol"));
  }
  if (slide.notes.prompt) {
    sections.push(renderNoteSection("Prompt", slide.notes.prompt, "ul"));
  }

  els.notesContent.innerHTML = `
    <h3>${escapeHtml(slide.title)}</h3>
    <p>${escapeHtml(slide.keyLine)}</p>
    ${sections.join("")}
  `;
}

function renderNoteSection(title, items, listType) {
  const tag = listType === "ol" ? "ol" : "ul";
  return `
    <section class="note-section">
      <h4>${escapeHtml(title)}</h4>
      <${tag}>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </${tag}>
    </section>
  `;
}

function nextSlide() {
  if (app.slideIndex < slides.length - 1) {
    app.slideIndex += 1;
    app.revealIndex = 99;
    renderSlide();
  }
}

function prevSlide() {
  if (app.slideIndex > 0) {
    app.slideIndex -= 1;
    app.revealIndex = 99;
    renderSlide();
  }
}

function stepSlide() {
  const slide = slides[app.slideIndex];
  if (app.revealIndex >= slide.points.length) {
    app.revealIndex = 1;
  } else {
    app.revealIndex += 1;
  }
  renderSlide();
}

function showKeyLine() {
  const slide = slides[app.slideIndex];
  els.modalText.textContent = slide.keyLine;
  els.lineModal.hidden = false;
}

function closeKeyLine() {
  els.lineModal.hidden = true;
}

function toggleMenu() {
  const isHidden = els.controlMenu.hidden;
  els.controlMenu.hidden = !isHidden;
  els.menuToggle.setAttribute("aria-expanded", String(isHidden));
}

function toggleNotes(forceOpen) {
  els.notesPanel.hidden = typeof forceOpen === "boolean" ? !forceOpen : !els.notesPanel.hidden;
}

function tickTimer() {
  app.timerSeconds += 1;
  els.timerReadout.textContent = formatTime(app.timerSeconds);
}

function toggleTimer() {
  if (app.timerInterval) {
    clearInterval(app.timerInterval);
    app.timerInterval = null;
    els.timerToggle.textContent = "Start";
  } else {
    app.timerInterval = window.setInterval(tickTimer, 1000);
    els.timerToggle.textContent = "Pause";
  }
}

function resetTimer() {
  app.timerSeconds = 0;
  els.timerReadout.textContent = "00:00";
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function loadHashSlide() {
  const hashValue = Number.parseInt(window.location.hash.replace("#", ""), 10);
  if (Number.isInteger(hashValue) && hashValue >= 1 && hashValue <= slides.length) {
    app.slideIndex = hashValue - 1;
  }
}

function bindEvents() {
  els.prevSlide.addEventListener("click", prevSlide);
  els.nextSlide.addEventListener("click", nextSlide);
  els.stepSlide.addEventListener("click", stepSlide);
  els.keyLine.addEventListener("click", showKeyLine);
  els.closeModal.addEventListener("click", closeKeyLine);
  els.lineModal.addEventListener("click", (event) => {
    if (event.target === els.lineModal) {
      closeKeyLine();
    }
  });
  els.menuToggle.addEventListener("click", toggleMenu);
  els.timerToggle.addEventListener("click", toggleTimer);
  els.timerReset.addEventListener("click", resetTimer);
  els.notesToggle.addEventListener("click", () => toggleNotes());
  els.closeNotes.addEventListener("click", () => toggleNotes(false));
  els.progressDots.addEventListener("click", (event) => {
    const dot = event.target.closest("[data-slide]");
    if (!dot) {
      return;
    }
    app.slideIndex = Number.parseInt(dot.dataset.slide, 10);
    app.revealIndex = 99;
    renderSlide();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      nextSlide();
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      prevSlide();
    } else if (event.key === " ") {
      event.preventDefault();
      stepSlide();
    } else if (event.key.toLowerCase() === "n") {
      toggleNotes();
    } else if (event.key === "Escape") {
      closeKeyLine();
      toggleNotes(false);
      els.controlMenu.hidden = true;
      els.menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

loadHashSlide();
bindEvents();
renderSlide();
