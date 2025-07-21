import { useEffect, useRef, ComponentType } from "react";

interface Changes<T> {
  [key: string]: {
    from: T[keyof T] | undefined;
    to: T[keyof T] | undefined;
  };
}

export function useWhyDidYouUpdate<T extends Record<string, any>>(
  name: string,
  props: T
): void {
  const previousProps = useRef<T>();

  useEffect(() => {
    if (previousProps.current) {
      const keys = Object.keys({ ...previousProps.current, ...props }) as Array<
        keyof T
      >;
      const changesObj: Changes<T> = {};

      keys.forEach(key => {
        const previousValue = previousProps.current?.[key];
        const currentValue = props[key];

        if (
          typeof currentValue === "object" &&
          typeof previousValue === "object"
        ) {
          if (JSON.stringify(previousValue) !== JSON.stringify(currentValue)) {
            changesObj[key as string] = {
              from: previousValue,
              to: currentValue,
            };
          }
        } else if (previousValue !== currentValue) {
          changesObj[key as string] = {
            from: previousValue,
            to: currentValue,
          };
        }
      });

      if (Object.keys(changesObj).length) {
        console.log("[why-did-you-update]", name, changesObj);
      }
    }

    previousProps.current = props;
  });
}



export function withWhyDidYouUpdate<P extends Record<string, any>>(
  WrappedComponent: ComponentType<P>,
  componentName?: string
): ComponentType<P> {
  const displayName =
    componentName ||
    WrappedComponent.displayName ||
    WrappedComponent.name ||
    "Component";

  const ComponentWithWhyDidYouUpdate = (props: P) => {
    useWhyDidYouUpdate(displayName, props);
    return <WrappedComponent {...props} />;
  };
  ComponentWithWhyDidYouUpdate.displayName = `withWhyDidYouUpdate(${displayName})`;
  return ComponentWithWhyDidYouUpdate;
}

