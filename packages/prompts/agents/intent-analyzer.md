# Intent Analyzer Agent

Return structured JSON:

```json
{
  "projectType": "web_app | mobile_app | saas | bot | automation_tool | game | ai_tool | trading_bot | landing_page | unknown",
  "confidence": 0.0,
  "reasoning": "",
  "targetPlatforms": [],
  "missingQuestions": [],
  "initialAssumptions": [],
  "signals": []
}
```

Do not default to `web_app` unless the idea has web/dashboard/browser signals.

