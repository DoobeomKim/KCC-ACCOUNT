import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number
}

export function Loader({ className, size = 16, ...props }: LoaderProps) {
  return (
    <div className={cn("animate-spin", className)} {...props}>
      <Loader2 size={size} />
    </div>
  )
} 