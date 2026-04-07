import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const playerId = url.searchParams.get("state"); // The ID we passed from main.js!

  if (!code || !playerId) {
    return new Response("Missing code or state", { status: 400 });
  }

  // 1. Exchange the code for an Access Token securely
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("DISCORD_CLIENT_ID")!,
      client_secret: Deno.env.get("DISCORD_CLIENT_SECRET")!,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: "https://okbynkairmznzcriuknd.supabase.co/functions/v1/discord-callback",
    }),
  });

  const tokenData = await tokenResponse.json();

  // 2. Use the Access Token to get the user's Discord ID
  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = await userResponse.json();
  const discordId = userData.id;

  // 3. Update the JAWRGON database
  // We use the service_role key to bypass RLS since this is a secure backend function
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  await supabase
    .from("players")
    .update({ 
        discord_id: discordId, 
        wants_mentions: true // Default to true when they link!
    })
    .eq("id", playerId);

  // 4. Redirect them back to the game!
  // You can add a success parameter to show a toast notification on load
  // 4. Redirect them back to the game!
  return Response.redirect("https://joshua-elsner.github.io/Multiplayer-Word-Game/?discord_linked=success", 302);
});
