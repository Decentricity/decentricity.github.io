"use strict";

const slides = [
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
        ["14:00", "Data processing", "Cleaning and extraction demos"],
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
    kicker: "Demo 1",
    title: "From messy spreadsheet to clean dataset",
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
    kicker: "Demo 2",
    title: "From PDF to structured table",
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
    kicker: "Demo 3",
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
