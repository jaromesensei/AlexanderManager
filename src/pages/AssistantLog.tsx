import { Link } from 'react-router-dom'
import { ArrowRight, History, Undo2 } from 'lucide-react'
import { useActionLog, useUndoAction, type ActionRow } from '@/lib/queries/actionLog'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialog'

function when(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function AssistantLog() {
  const { data: actions, isLoading } = useActionLog()
  const undo = useUndoAction()
  const confirm = useConfirm()

  async function onUndo(a: ActionRow) {
    const ok = await confirm({
      title: 'לבטל את הפעולה?',
      message: `${a.description} — יוחזר המצב שלפני הפעולה.`,
      confirmLabel: 'בטל פעולה',
      danger: true,
    })
    if (!ok) return
    await undo.mutateAsync(a)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">יומן אלכס</h1>
      </div>
      <p className="text-sm text-neutral-400">
        כל פעולה שאלכס ביצע — אפשר לבטל גם בדיעבד ולחזור למצב הקודם.
      </p>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : (actions ?? []).length === 0 ? (
        <EmptyState
          icon={History}
          title="אין עדיין פעולות"
          description="פעולות שתאשר לאלכס (כמו סגירת יום) יופיעו כאן."
        />
      ) : (
        <div className="space-y-2">
          {(actions ?? []).map((a) => (
            <Card key={a.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{a.description}</p>
                <p className="text-xs text-neutral-500">{when(a.created_at)}</p>
              </div>
              {a.undone ? (
                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-400">
                  בוטל
                </span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onUndo(a)}
                  loading={undo.isPending && undo.variables?.id === a.id}
                >
                  <Undo2 className="h-4 w-4" />
                  בטל
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
