import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`HSE backend running at http://localhost:${env.port}`);
  console.log(`Smart TV dashboard running at http://localhost:${env.port}/tv`);
});
