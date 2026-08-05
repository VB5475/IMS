import { createRoot } from "react-dom/client";
import "./index.css";
import { loadRuntimeConfig } from "./config/runtimeConfig";

// App and its dependency graph are imported dynamically so nothing reads the
// API base URLs before public/config.json has been applied.
async function bootstrap() {
  await loadRuntimeConfig();

  const [{ default: App }, { NotificationProvider }] = await Promise.all([
    import("./App.jsx"),
    import("./context/NotificationContext.jsx"),
  ]);

  createRoot(document.getElementById("root")).render(
    <NotificationProvider>
      <App />
    </NotificationProvider>
  );
}

bootstrap();
