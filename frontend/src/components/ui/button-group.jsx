import * as React from "react";
import { cn } from "@/lib/utils";

const ButtonGroup = React.forwardRef(({ className, children, ...props }, ref) => {
  // Ensure children is an array so we can map over it and clone elements
  const childrenArray = React.Children.toArray(children);
  
  return (
    <div
      ref={ref}
      className={cn("flex w-full items-center justify-center rounded-md", className)}
      {...props}
    >
      {React.Children.map(childrenArray, (child, index) => {
        if (!React.isValidElement(child)) return child;
        
        // Compute border radius classes based on position
        const isFirst = index === 0;
        const isLast = index === childrenArray.length - 1;
        
        let roundedClass = "";
        if (isFirst && isLast) {
          roundedClass = "rounded-md";
        } else if (isFirst) {
          roundedClass = "rounded-l-md rounded-r-none border-r-0";
        } else if (isLast) {
          roundedClass = "rounded-r-md rounded-l-none";
        } else {
          roundedClass = "rounded-none border-r-0";
        }

        return React.cloneElement(child, {
          className: cn(
            child.props.className,
            roundedClass,
            // Add a subtle focus ring that respects the group
            "focus:z-10"
          ),
        });
      })}
    </div>
  );
});

ButtonGroup.displayName = "ButtonGroup";

export { ButtonGroup };
