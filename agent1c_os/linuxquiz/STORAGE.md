# Storage Design - SCF Utility Workshop Quiz (Simplified)

## Data Requirements

- **Local Storage Only**: Questions JSON, current session answers
- **No Database**: All data stored locally
- **Session-based**: Each quiz session is independent

## Storage Strategy

### LocalStorage Keys
- `scfquiz:questions_json` - The questions JSON data entered by user in setup
- `scfquiz:last_answers` - Last session's answers (for viewing stats)

### Data Structures

```json
// Questions JSON format (stored in localStorage)
{
  "quiz_id": "scf-utility-quiz",
  "title": "SCF Utility Workshop",
  "questions": [
    {
      "id": "q1",
      "type": "tf",
      "text": "Question text here",
      "correct": true
    }
  ]
}

// Last answers (stored in localStorage)
[
  {
    "questionId": "q1",
    "questionText": "Question text",
    "answerType": "right" | "wrong" | "split" | "dunno",
    "isCorrect": true | false | null
  }
]
```

### Answer Types
- **Right (→)**: User thinks statement is TRUE
- **Wrong (←)**: User thinks statement is FALSE  
- **Split (↓)**: Split decision / unsure
- **Don't Know (↑)**: User doesn't know the answer

### No Authentication Required
- No user login
- No admin panel
- Setup page for entering questions JSON