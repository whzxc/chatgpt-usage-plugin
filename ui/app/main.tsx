import { createRoot } from "react-dom/client";
import App from "./root";
import { onTeardown } from "./bridge";
const root = createRoot(document.getElementById("root")!);
onTeardown(() => root.unmount());
root.render(<App />);
