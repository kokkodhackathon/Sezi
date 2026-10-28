import { cn } from "cn"

import { SeziLoader } from "@/components/sezi-loader"

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <SeziLoader data-slot="spinner" className={cn("size-4", className)} {...props} />
  )
}

export { Spinner }
