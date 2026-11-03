import type { OnDownloadComplete, WhenQueueFinishes } from '@shared/types'
import { Power } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const COMPLETE_ACTIONS: { value: OnDownloadComplete; label: string }[] = [
  { value: 'none', label: 'Do nothing' },
  { value: 'open', label: 'Open the file' },
  { value: 'reveal', label: 'Show it in its folder' }
]

const QUEUE_ACTIONS: { value: WhenQueueFinishes; label: string }[] = [
  { value: 'none', label: 'Do nothing' },
  { value: 'quit', label: 'Quit Plexo' },
  { value: 'sleep', label: 'Sleep the computer' },
  { value: 'shutdown', label: 'Shut down the computer' }
]

/** What Plexo does on its own once downloads finish, as IDM's completion options. Sits with the
 * other set-once choices; its icon is lit while it will do something. */
export function CompletionMenu(): React.JSX.Element {
  const onDownloadComplete = useAppStore((store) => store.onDownloadComplete)
  const whenQueueFinishes = useAppStore((store) => store.whenQueueFinishes)
  const setOnDownloadComplete = useAppStore((store) => store.setOnDownloadComplete)
  const setWhenQueueFinishes = useAppStore((store) => store.setWhenQueueFinishes)
  const active = onDownloadComplete !== 'none' || whenQueueFinishes !== 'none'

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  aria-label="After downloads"
                  className={active ? 'size-9 rounded-[10px] text-primary' : 'size-9 rounded-[10px]'}
                >
                  <Power />
                </Button>
              }
            />
          }
        />
        <TooltipContent>After downloads</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>When a download finishes</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={onDownloadComplete}
          onValueChange={(value) => setOnDownloadComplete(value as OnDownloadComplete)}
        >
          {COMPLETE_ACTIONS.map((action) => (
            <DropdownMenuRadioItem key={action.value} value={action.value} closeOnClick>
              {action.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>When everything finishes</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={whenQueueFinishes}
          onValueChange={(value) => setWhenQueueFinishes(value as WhenQueueFinishes)}
        >
          {QUEUE_ACTIONS.map((action) => (
            <DropdownMenuRadioItem key={action.value} value={action.value} closeOnClick>
              {action.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
