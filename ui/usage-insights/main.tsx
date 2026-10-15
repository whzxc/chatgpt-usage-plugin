import { createRoot } from "react-dom/client";
import App from "./p3-root";
import { onTeardown } from "./bridge";
const root = createRoot(document.getElementById("root")!);
onTeardown(() => root.unmount());
root.render(<App />);
