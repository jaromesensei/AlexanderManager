import { APP_VERSION } from '@/version'

// הקישור הקבוצתי בוטל: בורר-שמות מאפשר למלא זמינות בשם עובד אחר.
// כל עובד ממלא זמינות דרך הקישור האישי שלו בלבד.
export function AvailabilityGroup() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-10 text-center">
      <h1 className="text-2xl font-extrabold text-brand-500">אלכסנדר</h1>
      <p className="mt-4 text-lg text-neutral-200">
        כדי למלא זמינות, השתמש בקישור האישי שקיבלת בוואטסאפ.
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        לכל עובד יש קישור אישי משלו — כך אי אפשר למלא זמינות בשם מישהו אחר.
      </p>
      <p className="mt-8 text-xs text-neutral-600">גרסה {APP_VERSION}</p>
    </div>
  )
}
