const scenarioLibrary: Record<string, string[]> = {
  grp_001: [
    "תודה רבה על העדכון",
    "Reminder: tomorrow's class meeting moved to 18:30.",
    "דחוף: הטיול מחר בוטל בגלל מזג האוויר",
    "מי יכול להביא כוסות חד פעמיות למסיבה?",
  ],
  grp_002: [
    "המים ייסגרו היום בין 14:00 ל-16:00",
    "Meeting with the city inspector moved to 3pm.",
    "דחוף: יש ריח חריף בחדר המדרגות, מישהו בדק?",
    "Thanks, the electrician already arrived.",
  ],
  grp_003: [
    "נפגשים ב-05:45 כרגיל ליד הפארק",
    "Route changed, we start from the east gate tomorrow.",
    "דחוף: אל תגיעו דרך השביל, יש שם עבודות",
    "Great run today, תודה לכולם",
  ],
  grp_004: [
    "Agenda draft is in the drive.",
    "Meeting moved to 3pm so the principal can join.",
    "Urgent: budget vote postponed until next week.",
    "Can someone confirm the volunteer list?",
  ],
  grp_005: [
    "הטכנאי מגיע ב-11:00 במקום 09:00",
    "Please leave the basement access clear this afternoon.",
    "דחוף: המעלית שוב נתקעה בקומה 4",
    "Thanks, the repair ticket is open.",
  ],
  grp_006: [
    "Practice starts 30 minutes earlier today.",
    "נא להביא בקבוק מים נוסף למשחק מחר",
    "Urgent: the match was cancelled due to rain.",
    "Coach says please arrive in blue shirts.",
  ],
  grp_007: [
    "Next month we read The Bee Sting.",
    "מי מביא יין למפגש של יום חמישי?",
    "Schedule change: we start at 20:00, not 19:30.",
    "דחוף: הספרייה סוגרת מוקדם, צריך מקום חלופי",
  ],
  grp_008: [
    "נחתנו, הכל בסדר",
    "Dinner moved to 19:30 because traffic is bad.",
    "דחוף: מי יכול לאסוף את סבתא מהרופא?",
    "Love you all, תודה על העזרה",
  ],
  grp_009: [
    "Office closed after 2pm for maintenance.",
    "Please submit expenses by 15:00 today.",
    "דחוף: הישיבה בוטלה, נחזור עם מועד חדש",
    "Thanks, the updated roster is attached on Slack.",
  ],
  grp_010: [
    "אני מאחרת 10 דקות",
    "Pickup moved to 07:25 because of traffic.",
    "Urgent: car won't start, can anyone cover this morning?",
    "תודה רבה, אני אקח את הסיבוב של מחר",
  ],
  grp_011: [
    "Bus will be 12 minutes late today.",
    "נא לעדכן אם הילד לא עולה להסעה מחר",
    "דחוף: הנהג התחלף ברגע האחרון",
    "Thanks, route sheet updated.",
  ],
  grp_012: [
    "Saw suspicious movement near the playground.",
    "נא לנעול את המחסנים הלילה",
    "Urgent: police asked us to avoid the west entrance.",
    "תודה על הדיווח, צוות העירייה בדרך",
  ],
  grp_013: [
    "Cake order confirmed for Friday.",
    "מי יכול להביא בלונים כחולים?",
    "Schedule change: setup starts at 16:00.",
    "דחוף: המקום המקורי ביטל, צריך חלופה",
  ],
  grp_014: [
    "Leg day at 18:00?",
    "Trainer moved the session to 19:15.",
    "דחוף: הסטודיו נסגר מוקדם היום",
    "Thanks, bringing resistance bands.",
  ],
  grp_015: [
    "מישהו יכול לשלוח שוב את המתכון לקובה?",
    "Tonight I'm posting the sourdough ratios in English.",
    "Schedule change: live cook-along moved to Sunday.",
    "דחוף: למי יש תחליף ללא גלוטן עכשיו?",
  ],
};

export function pickGroupScenario(groupId: string): string {
  const options = scenarioLibrary[groupId] ?? [
    "תודה רבה",
    "Meeting moved to 3pm.",
    "דחוף: הישיבה בוטלה",
  ];
  const index = Math.floor(Math.random() * options.length);
  return options[index] ?? options[0] ?? "תודה";
}
