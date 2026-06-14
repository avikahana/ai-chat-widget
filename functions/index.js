import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { REGION } from "./config.js";

initializeApp();
setGlobalOptions({ region: REGION, maxInstances: 10 });

// The /api/chat handler lives in its own module.
export { chat } from "./chat.js";
