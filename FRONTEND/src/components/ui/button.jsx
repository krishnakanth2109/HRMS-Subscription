import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"
import { buttonVariants } from "./button-variants" // imported from separate file

function Button(props) {
  const {
    className,
    variant,
    size,
    asChild = false,
    ...rest
  } = props

  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    />
  )
}

export { Button }
