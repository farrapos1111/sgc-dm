import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
  X,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/context/ThemeContext";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useTheme();

  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      expand
      gap={10}
      duration={4200}
      visibleToasts={4}
      offset={{ top: 16, right: 16 }}
      mobileOffset={{ top: 12, right: 12, left: 12 }}
      icons={{
        success: <CircleCheck className="size-4 shrink-0" strokeWidth={2.25} />,
        info: <Info className="size-4 shrink-0" strokeWidth={2.25} />,
        warning: <TriangleAlert className="size-4 shrink-0" strokeWidth={2.25} />,
        error: <OctagonX className="size-4 shrink-0" strokeWidth={2.25} />,
        loading: <LoaderCircle className="size-4 shrink-0 animate-spin" strokeWidth={2.25} />,
        close: <X className="size-3.5" strokeWidth={2.25} />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast sgc-toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border",
          title: "sgc-toast-title",
          description: "sgc-toast-description group-[.toast]:text-muted-foreground",
          actionButton:
            "sgc-toast-action group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "sgc-toast-cancel group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "sgc-toast-close",
          icon: "sgc-toast-icon",
          success: "sgc-toast-success",
          error: "sgc-toast-error",
          warning: "sgc-toast-warning",
          info: "sgc-toast-info",
          loading: "sgc-toast-loading",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
