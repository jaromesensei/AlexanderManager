// משוב מגע עדין בטלפון (Vibration API). נכשל בשקט היכן שלא נתמך.

function buzz(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      // לא נתמך - מתעלמים
    }
  }
}

/** נגיעה קלה - לחיצות ניווט/בחירה. */
export const hapticTap = () => buzz(8)

/** הצלחה - שמירה/אישור. */
export const hapticSuccess = () => buzz(14)

/** שגיאה - דפוס כפול קצר. */
export const hapticError = () => buzz([10, 40, 10])
