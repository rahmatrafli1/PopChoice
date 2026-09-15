import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/** OpenAI config */
const openAiKey = import.meta.env.VITE_OPENAI_API_KEY;
export const openai = openAiKey
  ? new OpenAI({ apiKey: openAiKey, dangerouslyAllowBrowser: true })
  : null;

/** Supabase config */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
