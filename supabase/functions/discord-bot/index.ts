import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Initialize the Supabase client using environment variables
// (These are automatically provided to Edge Functions by Supabase)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''; 
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  const payload = await req.json();

  // 1. Detect if this is a FISH EATEN or YOINK event
  if (payload.table === 'players' && payload.type === 'UPDATE') {
    const oldRecord = payload.old_record;
    const newRecord = payload.record;

    // Did fish eaten increase?
    if (newRecord.fish_eaten > oldRecord.fish_eaten) {
      let message = `🐟 **${newRecord.username}** just ate a fish! Nom nom.`;
      
      await fetch(Deno.env.get("DISCORD_WEBHOOK_FISH")!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
    }
    
    // Did yoinks increase? (This player stole a word out from under someone else!)
    if (newRecord.yoinks > oldRecord.yoinks) {
      let tag = `**${newRecord.username}**`;
      if (newRecord.discord_id && newRecord.wants_mentions) {
        tag = `<@${newRecord.discord_id}>`; // Discord syntax to ping!
      }
      
      let message = `🚨 YOINK!!! ${tag} just snatched the word!`;
      
      await fetch(Deno.env.get("DISCORD_WEBHOOK_YOINKS")!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
    }
  }

  // 2. Detect if this is a WORD GUESSED event
  if (payload.table === 'game_state' && payload.type === 'UPDATE') {
    const oldState = payload.old_record;
    const newState = payload.record;

    // Only trigger if the Shark actually changed
    if (oldState.current_shark_id !== newState.current_shark_id) {
       
       // Stop and ask the database for the usernames belonging to these UUIDs
       const { data: players } = await supabase
         .from('players')
         .select('id, username, discord_id, wants_mentions')
         .in('id', [oldState.current_shark_id, newState.current_shark_id]);

       // Default names just in case the database lookup fails
       let oldSharkName = "Someone";
       let newSharkName = "A new Shark";
       
       // Match the IDs to the actual usernames
       if (players) {
         const oldShark = players.find(p => p.id === oldState.current_shark_id);
         const newShark = players.find(p => p.id === newState.current_shark_id);
         
         if (oldShark) {
             oldSharkName = `**${oldShark.username}**`;
             // Ping the victim if they have Discord linked!
             if (oldShark.discord_id && oldShark.wants_mentions) {
                 oldSharkName = `<@${oldShark.discord_id}>`; 
             }
         }
         
         if (newShark) {
             newSharkName = `**${newShark.username}**`;
         }
       }

       // Build the ultimate combo message!
       let message = `🦈 ${newSharkName} just guessed ${oldSharkName}'s word! The word was **${oldState.secret_word}**.`;
       
       await fetch(Deno.env.get("DISCORD_WEBHOOK_WORDS")!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
    }
  }

  return new Response("OK");
});
